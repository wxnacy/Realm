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
 * 收到凭据后扫描表单并填充
 */
ipcRenderer.on('credential:do-autofill', (event, credentials) => {
  const forms = FormDetector.scanForLoginForms();
  if (forms.length > 0) {
    AutofillEngine.fillCredentials(credentials, forms[0]);
  }
});

// ==================== 页面加载和 DOM 变更监听 ====================

/**
 * DOMContentLoaded 初始扫描
 * 页面加载完成后扫描登录表单并绑定 submit 监听
 * 检测到表单时发送 autofill 请求到 renderer（per D-09）
 */
window.addEventListener('DOMContentLoaded', () => {
  const forms = FormDetector.scanForLoginForms();
  forms.forEach(formInfo => FormDetector.attachSubmitListener(formInfo));
  if (forms.length > 0) {
    ipcRenderer.sendToHost('credential:autofill-request');
  }
});

/**
 * MutationObserver 持续监听（per D-01）
 * SPA 路由切换、动态加载登录表单时触发重新扫描
 * 使用 300ms 防抖避免频繁触发（per 32-RESEARCH.md Pitfall 3）
 */
let _credentialMutationTimer = null;
const _credentialObserver = new MutationObserver(() => {
  if (_credentialMutationTimer) clearTimeout(_credentialMutationTimer);
  _credentialMutationTimer = setTimeout(() => {
    const forms = FormDetector.scanForLoginForms();
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
