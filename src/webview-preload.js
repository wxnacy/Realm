/**
 * Realm Browser - Webview Guest Preload 脚本
 *
 * 通过 contextBridge 暴露安全的 IPC 桥接方法，使注入脚本能即时发送
 * 视频检测结果到 renderer 进程（per D-10 即时通知，不做防抖）。
 *
 * 注入脚本通过 window.__realmBridge.sendMediaDetected(videos) 发送数据，
 * 数据经由 webview ipc-message 事件传递到 renderer。
 *
 * @module webview-preload
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 暴露给 webview guest 页面的安全桥接接口
 * 注入脚本通过 window.__realmBridge 访问
 */
contextBridge.exposeInMainWorld('__realmBridge', {
  /**
   * 即时发送检测到的视频数据到 renderer 进程
   * 通过 ipcRenderer.sendToHost 触发 webview 的 ipc-message 事件
   *
   * @param {Array<Object>} videos - 检测到的视频数组
   * @param {string} videos[].url - 视频 URL
   * @param {string} [videos[].type] - 视频类型
   * @param {string} [videos[].source] - 检测来源（script/dom）
   */
  sendMediaDetected: (videos) => {
    ipcRenderer.sendToHost('media:detected', videos);
  },

  /**
   * 发送输入框焦点状态到 renderer 进程
   * 用于 Vim 快捷键禁用逻辑（D-07, D-09）
   * 当焦点在 input/textarea/select/contentEditable 时报告 true
   *
   * @param {boolean} isInInput - 焦点是否在输入框中
   */
  sendFocusState: (isInInput) => {
    ipcRenderer.sendToHost('vim:focus-state', isInInput);
  },

  /**
   * 发送 Vim 命令到 renderer 进程
   * 注入脚本通过此方法与 renderer 通信（如 Hint Mode 退出、URL 复制等）
   *
   * @param {string} command - 命令名称（hintModeExit, copyUrl, findInPage, searchModeExit 等）
   * @param {Object} [data] - 命令附加数据
   */
  sendVimCommand: (command, data) => {
    ipcRenderer.sendToHost('vim:command', command, data);
  },

  /**
   * 发送表单提交的凭据数据到 renderer 进程
   * 表单检测引擎在检测到登录表单提交时调用
   *
   * @param {Object} data - 凭据数据
   * @param {string} data.url - 页面 URL
   * @param {string} data.origin - 页面 origin
   * @param {string} data.username - 用户名
   * @param {string} data.password - 密码
   * @param {string} data.formType - 表单类型（login/register/password-change）
   */
  sendCredentialSubmitted: (data) => {
    ipcRenderer.sendToHost('credential:form-submitted', data);
  },

  /**
   * 发送自动填充请求到 renderer 进程
   * 页面加载完成后检测到登录表单时调用，renderer 查询凭据后回传填充指令
   */
  sendAutofillRequest: () => {
    ipcRenderer.sendToHost('credential:autofill-request');
  },
});

/**
 * 捕获 guest 页面 mousedown 事件并转发到 renderer 进程
 * 用于关闭浮动媒体面板（点网页区域关面板，点面板自身不触发）
 */
window.addEventListener('mousedown', () => {
  ipcRenderer.sendToHost('media:outside-click');
}, true);

// ==================== 表单检测引擎 ====================

/**
 * 表单检测引擎
 * 两层检测：password 字段存在 + 多字段特征匹配
 * 持续监听 DOM 变更（MutationObserver），检测动态加载的登录表单
 *
 * @module FormDetector
 */
const FormDetector = {
  /** 已检测到的表单集合（避免重复绑定 submit 监听） */
  detectedForms: new WeakSet(),

  /** 缓存首次扫描的表单信息，供 credential:do-autofill 直接使用 */
  cachedCredentialForms: [],

  /** autofill 是否暂停（fillForm 互斥，D-13） */
  autofillPaused: false,

  /**
   * 扫描页面中的登录表单
   * 第一层：password 字段存在即为登录表单候选
   * 第二层：多字段特征匹配精细分类（登录/注册/密码修改）
   *
   * @returns {Array<Object>} 检测到的表单信息数组
   */
  scanForLoginForms() {
    const forms = [];
    const passwordFields = document.querySelectorAll('input[type="password"]');

    passwordFields.forEach(pwField => {
      // 跳过隐藏的 password 字段
      if (pwField.offsetParent === null && pwField.style.display === 'none') return;

      const form = pwField.closest('form');
      if (form && this.detectedForms.has(form)) return;

      // 第一层检测：password 字段存在即为登录表单
      const formInfo = this.classifyForm(pwField, form);
      if (formInfo) {
        forms.push(formInfo);
        if (form) this.detectedForms.add(form);
      }
    });

    return forms;
  },

  /**
   * 分类表单类型（第二层多字段特征匹配）
   *
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {Object|null} 表单信息 { usernameField, passwordField, form, type }
   */
  classifyForm(pwField, form) {
    const usernameField = this.findUsernameField(pwField, form);
    if (!usernameField) return null;

    const formType = this.detectFormType(pwField, form);

    return {
      usernameField,
      passwordField: pwField,
      form,
      type: formType,
    };
  },

  /**
   * 查找用户名字段
   * 优先匹配 name/id/placeholder 包含 user/login/email/account/phone 的字段
   * 兜底：password 字段前最近的 text/email 输入框
   *
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {HTMLInputElement|null} 用户名字段
   */
  findUsernameField(pwField, form) {
    const container = form || document;
    const candidates = container.querySelectorAll(
      'input[type="text"], input[type="email"], input:not([type])'
    );

    // 优先：name/id/placeholder/autocomplete 包含用户名相关关键词
    for (const input of candidates) {
      if (input === pwField) continue;
      // 检查是否在 password 字段之前（DOM 顺序）
      if (input.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        const attrs = (
          (input.name || '') +
          (input.id || '') +
          (input.placeholder || '') +
          (input.autocomplete || '')
        ).toLowerCase();
        if (/user|login|email|account|phone|mobile|用户名|邮箱|手机|账号/i.test(attrs) || input.type === 'email') {
          return input;
        }
      }
    }

    // 兜底：password 字段前最近的 text/email 输入框
    for (const input of candidates) {
      if (input === pwField) continue;
      if (input.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return input;
      }
    }

    return null;
  },

  /**
   * 检测表单类型
   * 多个 password 字段 → password-change
   * 包含 register/sign-up/注册 关键词 → register
   * 否则 → login
   *
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {string} 'login' | 'register' | 'password-change'
   */
  detectFormType(pwField, form) {
    const container = form || document;
    const passwordFields = container.querySelectorAll('input[type="password"]');
    if (passwordFields.length >= 2) return 'password-change';

    const text = ((container.textContent || '') + (container.innerHTML || '')).toLowerCase();
    if (/register|sign.?up|注册|创建账号/i.test(text)) return 'register';

    return 'login';
  },

  /**
   * 提取凭据（直接读取 input.value，per D-04）
   *
   * @param {Object} formInfo - 表单信息
   * @returns {Object} { username, password }
   */
  extractCredentials(formInfo) {
    return {
      username: formInfo.usernameField.value || '',
      password: formInfo.passwordField.value || '',
    };
  },

  /**
   * 绑定 form submit 监听器（per D-03）
   * 提交时提取凭据并通过 sendToHost 发送到 renderer
   *
   * @param {Object} formInfo - 表单信息
   */
  attachSubmitListener(formInfo) {
    const form = formInfo.form;
    if (!form) return;

    form.addEventListener('submit', () => {
      // D-13 互斥：fillForm 激活时跳过凭据提取
      if (this.autofillPaused) return;

      const creds = this.extractCredentials(formInfo);
      if (creds.username && creds.password) {
        ipcRenderer.sendToHost('credential:form-submitted', {
          url: window.location.href,
          origin: window.location.origin,
          username: creds.username,
          password: creds.password,
          formType: formInfo.type,
        });
      }
    });
  },
};

// ==================== 自动填充引擎 ====================

/**
 * 自动填充引擎
 * 使用 native setter 设置 input 值，兼容 React/Vue 等框架
 * 页面加载后自动填充已保存的凭据（D-09, D-11, D-12）
 *
 * @module AutofillEngine
 */
const AutofillEngine = {
  /**
   * 填充凭据到表单
   * D-13 互斥：autofillPaused 时跳过填充
   *
   * @param {Object} credentials - { username, password }
   * @param {Object} formInfo - 表单信息
   */
  fillCredentials(credentials, formInfo) {
    if (FormDetector.autofillPaused) return;

    this.setInputValue(formInfo.usernameField, credentials.username);
    this.setInputValue(formInfo.passwordField, credentials.password);
  },

  /**
   * 使用 native setter 设置 input 值
   * 获取 HTMLInputElement.prototype.value 的原生 setter 避免框架拦截
   * 设置后触发 input 和 change 事件让框架感知变化
   *
   * @param {HTMLInputElement} input - 输入框元素
   * @param {string} value - 要设置的值
   */
  setInputValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(input, value);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },
};

// ==================== 地址表单检测（Phase 33） ====================

/**
 * 地址表单检测器
 * 扫描页面中的地址表单（姓名、手机号、地址字段）
 * per D-09：多字段特征匹配
 * per D-10：2/3 匹配阈值
 * per D-11：与登录表单共用检测框架
 * per D-12：单次检测（页面加载完成后执行一次）
 *
 * @module AddressDetector
 */
const AddressDetector = {
  /** 已检测到的地址表单集合（避免重复触发） */
  detectedForms: new WeakSet(),

  /**
   * 扫描页面中的地址表单
   * 匹配姓名、手机号、地址三个字段，2/3 匹配即触发
   * 排除包含 password 字段的表单（避免与登录表单冲突）
   *
   * @returns {Object|null} 检测结果 { nameField, phoneField, addressField } 或 null
   */
  scanForAddressForms() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="tel"], textarea, input:not([type])'
    );

    let nameField = null;
    let phoneField = null;
    let addressField = null;

    for (const input of inputs) {
      // 跳过隐藏字段
      if (input.offsetParent === null && input.style.display === 'none') continue;

      // 跳过包含 password 字段的表单（避免与登录表单冲突）
      const form = input.closest('form');
      if (form && form.querySelector('input[type="password"]')) continue;

      const attrs = (
        (input.name || '') +
        (input.id || '') +
        (input.placeholder || '') +
        (input.autocomplete || '')
      ).toLowerCase();

      // 姓名字段特征
      if (!nameField && /name|realname|username|姓名|收件人|联系人|收货人/i.test(attrs)) {
        nameField = input;
        continue;
      }

      // 手机号字段特征
      if (!phoneField && (input.type === 'tel' || /phone|mobile|tel|手机|电话|联系方式/i.test(attrs))) {
        phoneField = input;
        continue;
      }

      // 地址字段特征
      if (!addressField && /address|addr|地址|详细地址|收货地址|街道|门牌/i.test(attrs)) {
        addressField = input;
        continue;
      }
    }

    // 2/3 匹配阈值（D-10）
    const matchCount = [nameField, phoneField, addressField].filter(Boolean).length;
    if (matchCount >= 2) {
      return { nameField, phoneField, addressField };
    }

    return null;
  },

  /**
   * 填充地址字段
   * 使用 AutofillEngine 的 native setter 方法
   *
   * @param {Object} fields - { nameField, phoneField, addressField }
   * @param {Object} data - { name, phone, address }
   */
  fillAddressFields(fields, data) {
    if (fields.nameField && data.name) {
      AutofillEngine.setInputValue(fields.nameField, data.name);
    }
    if (fields.phoneField && data.phone) {
      AutofillEngine.setInputValue(fields.phoneField, data.phone);
    }
    if (fields.addressField && data.address) {
      AutofillEngine.setInputValue(fields.addressField, data.address);
    }
  },
};

// ==================== autofill/fillForm 互斥监听 ====================

/**
 * 监听主进程的 fillForm 互斥信号（D-13~D-16）
 * fillForm 激活时临时禁用 autofill 检测，完成后自动恢复
 */
ipcRenderer.on('autofill:pause', () => {
  FormDetector.autofillPaused = true;
});

ipcRenderer.on('autofill:resume', () => {
  FormDetector.autofillPaused = false;
});

/**
 * 监听 autofill 填充指令（来自 renderer，由主进程中转）
 * 使用缓存的表单信息填充（scanForLoginForms 的 WeakSet 去重会导致重新扫描返回空）
 */
ipcRenderer.on('credential:do-autofill', (event, credentials) => {
  const forms = FormDetector.cachedCredentialForms;
  if (forms.length > 0) {
    AutofillEngine.fillCredentials(credentials, forms[0]);
  }
});

/**
 * 监听地址自动填充指令（来自 renderer，由主进程中转）
 * 收到地址数据后扫描地址表单并填充
 */
ipcRenderer.on('address:do-autofill', (event, addressData) => {
  const addressFields = AddressDetector.scanForAddressForms();
  if (addressFields && addressData) {
    AddressDetector.fillAddressFields(addressFields, addressData);
  }
});

// ==================== 页面加载和 DOM 变更监听 ====================

/**
 * DOMContentLoaded 初始扫描
 * 页面加载完成后扫描登录表单并绑定 submit 监听
 * 检测到表单时发送 autofill 请求到 renderer（per D-09）
 */
window.addEventListener('DOMContentLoaded', () => {
  // realm:// 内部页面（settings/favorites/history 等）通过 http://localhost:PORT/ 加载，不需要表单检测
  const isInternalPage = window.location.hostname === 'localhost';

  if (!isInternalPage) {
    // 登录表单检测
    const forms = FormDetector.scanForLoginForms();
    FormDetector.cachedCredentialForms = forms;
    forms.forEach(formInfo => FormDetector.attachSubmitListener(formInfo));
    if (forms.length > 0) {
      ipcRenderer.sendToHost('credential:autofill-request');
    }

    // 地址表单检测（per D-12：页面加载完成后检测一次）
    const addressFields = AddressDetector.scanForAddressForms();
    if (addressFields) {
      // 通知主窗口检测到地址表单，提取当前字段值
      const detectedData = {
        name: addressFields.nameField ? addressFields.nameField.value : '',
        phone: addressFields.phoneField ? addressFields.phoneField.value : '',
        address: addressFields.addressField ? addressFields.addressField.value : '',
      };
      ipcRenderer.sendToHost('address:form-detected', detectedData);

      // 请求自动填充地址
      ipcRenderer.sendToHost('address:autofill-request');
    }
  }
});

/**
 * MutationObserver 持续监听（per D-01）
 * SPA 路由切换、动态加载登录表单时触发重新扫描
 * 使用 300ms 防抖避免频繁触发（per 32-RESEARCH.md Pitfall 3）
 */
let _credentialMutationTimer = null;
const _credentialObserver = new MutationObserver(() => {
  // realm:// 内部页面（通过 http://localhost:PORT/ 加载）不需要表单检测
  if (window.location.hostname === 'localhost') return;

  if (_credentialMutationTimer) clearTimeout(_credentialMutationTimer);
  _credentialMutationTimer = setTimeout(() => {
    const forms = FormDetector.scanForLoginForms();
    if (forms.length > 0) {
      FormDetector.cachedCredentialForms = forms;
    }
    forms.forEach(formInfo => {
      FormDetector.attachSubmitListener(formInfo);
      // 动态检测到新表单时也发送 autofill 请求
      ipcRenderer.sendToHost('credential:autofill-request');
    });
  }, 300);
});
_credentialObserver.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
});

// ==================== Vim 快捷键焦点检测 ====================

/**
 * 检测当前焦点元素是否为输入框
 * 用于 Vim 快捷键禁用逻辑（D-07, D-09）
 *
 * @returns {boolean} 焦点是否在输入框中
 */
function _isFocusInInputElement() {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;

  return false;
}

/**
 * 上一次报告的焦点状态（避免重复发送）
 * @type {boolean}
 */
let _lastFocusInInput = false;

/**
 * 检查焦点状态并报告变化
 * 仅在状态发生变化时发送 IPC 消息，避免频繁通信
 */
function _checkAndReportFocusState() {
  const isInInput = _isFocusInInputElement();
  if (isInInput !== _lastFocusInInput) {
    _lastFocusInInput = isInInput;
    try {
      window.__realmBridge.sendFocusState(isInInput);
    } catch (err) {
      // __realmBridge 可能尚未初始化，忽略错误
    }
  }
}

// 监听 focusin/focusout 事件检测焦点变化（所有页面都生效，含 realm:// 内部页）
document.addEventListener('focusin', _checkAndReportFocusState, true);
document.addEventListener('focusout', _checkAndReportFocusState, true);

// 页面加载完成后检查初始焦点状态
window.addEventListener('DOMContentLoaded', _checkAndReportFocusState);

// 兜底：定期检查焦点状态（处理动态创建的输入框）
setInterval(_checkAndReportFocusState, 500);
