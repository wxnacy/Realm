# 领域陷阱研究

**领域：** 多容器隔离浏览器 (Electron)
**研究日期：** 2026-08-06（v2.2 多媒体）/ 2026-08-11（v2.3 下载管理器 + 自动填充）
**置信度：** HIGH（基于 Chromium/Electron 官方文档 + 现有代码库分析）

---

## v2.3 陷阱：下载管理器 + 自动填充

本节聚焦 v2.3 里程碑新增功能的陷阱：向已有 Electron 多容器浏览器**添加**下载管理器和表单自动填充时的常见错误。

**核心风险领域：**
1. **`will-download` 路径设置时序** — 只能在回调内部同步调用
2. **断点续传依赖服务端** — 无 Range/ETag 支持时 resume() 静默重头下载
3. **`interrupted` 状态歧义** — updated 和 done 事件中含义不同
4. **safeStorage 平台差异** — Linux 可能降级为明文、Windows DPAPI 同用户暴露
5. **容器间凭据泄漏** — autofill 未按容器隔离导致跨容器密码泄露
6. **webview 下载事件路由** — 每个容器 Session 需单独注册处理器
7. **autofill 与 CDP fillForm 冲突** — 双重填充同一字段

---

## 关键陷阱 — 下载管理器

### 陷阱 DL-1：`will-download` 路径设置时序窗口（CRITICAL）

**问题描述：**
`item.setSavePath()` 和 `item.setSaveDialogOptions()` **只能在 `will-download` 事件回调内部同步调用**。如果开发者尝试异步设置路径（例如等待用户选择目录后再调用），下载会静默失败或弹出意外的系统对话框。

**根本原因：**
Electron 的 DownloadItem 生命周期极短，`will-download` 返回后 DownloadItem 进入 progressing 状态，路径已锁定。官方文档明确要求"only works inside will-download callback"。

**后果：**
- 下载到错误位置（默认 Downloads 目录）
- 用户看到意外的系统保存对话框
- 下载完全静默失败（无错误提示）

**如何避免：**
```javascript
// 错误：异步设置路径
ses.on('will-download', (event, item) => {
  dialog.showSaveDialog({ defaultPath: item.getFilename() }).then(({ filePath }) => {
    item.setSavePath(filePath); // 静默失败！回调已返回
  });
});

// 正确：使用 setSaveDialogOptions 让 Electron 处理对话框
ses.on('will-download', (event, item) => {
  item.setSaveDialogOptions({
    defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    buttonLabel: '保存'
  });
  // Electron 会在 will-download 上下文中弹出对话框
});

// 正确：如果已知保存路径，直接设置
ses.on('will-download', (event, item) => {
  const savePath = path.join(downloadDir, item.getFilename());
  item.setSavePath(savePath);
});
```

**预警信号：**
- 下载无进度、文件出现在意外位置
- 用户报告"下载了但找不到文件"

**应解决的阶段：** Download Manager 核心实现阶段

---

### 陷阱 DL-2：`resume()` 依赖服务端支持 — 静默重头下载（CRITICAL）

**问题描述：**
调用 `item.resume()` 恢复中断的下载时，如果目标服务器**不支持 Range 请求或未返回 `Last-Modified` 和 `ETag` 头**，Electron 会**丢弃已接收的全部字节并从头重新下载**。

**根本原因：**
Electron 官方文档明确说明："To enable resumable downloads the server you are downloading from must support range requests and provide both `Last-Modified` and `ETag` header values." 缺少任一条件，`resume()` 等同于重新发起新请求。

**后果：**
- 用户以为在续传，实际重新下载了整个文件
- 大文件场景浪费大量带宽
- 用户看到进度从 0% 重新开始，困惑不已

**如何避免：**
```javascript
// 下载开始时检查服务器是否支持续传
ses.on('will-download', (event, item) => {
  item.once('updated', (event, state) => {
    if (state === 'progressing') {
      const lastModified = item.getLastModifiedTime();
      const etag = item.getETag();
      const supportsResume = lastModified && etag;

      // 存储续传能力信息
      downloadRecords.set(item.getURL(), {
        supportsResume,
        lastModified,
        etag
      });

      if (!supportsResume) {
        // 通知 UI：此下载不支持续传，"继续"将重新下载
        notifyRenderer('download:no-resume-support', { url: item.getURL() });
      }
    }
  });
});
```

**预警信号：**
- 用户报告"暂停继续后进度回到 0"
- 带宽异常消耗

**应解决的阶段：** Download Manager 暂停/恢复功能实现阶段

---

### 陷阱 DL-3：`interrupted` 状态歧义 — 两个事件含义不同（HIGH）

**问题描述：**
`updated` 事件中的 `interrupted` 表示**可恢复**的中断（如网络波动），而 `done` 事件中的 `interrupted` 表示**不可恢复**的中断。Electron 官方文档对两者的描述使用相同的字符串值，但语义完全不同。

**后果：**
- 可恢复中断被标记为最终失败，用户无法继续下载
- 不可恢复中断被当作临时问题反复重试，永远无法成功

**如何避免：**
```javascript
item.on('updated', (event, state) => {
  if (state === 'interrupted') {
    // 可恢复的中断 — 显示"等待恢复"UI
    updateUI({ status: 'paused-auto', canResume: item.canResume() });
  } else if (state === 'progressing') {
    // 正常下载中
    updateUI({ status: 'downloading', progress: item.getPercentComplete() });
  }
});

item.once('done', (event, state) => {
  if (state === 'interrupted') {
    // 不可恢复的中断 — 显示"下载失败"UI
    updateUI({ status: 'failed', canRetry: true });
  } else if (state === 'completed') {
    updateUI({ status: 'completed' });
  } else if (state === 'cancelled') {
    updateUI({ status: 'cancelled' });
  }
});
```

**应解决的阶段：** Download Manager 状态机设计阶段

---

### 陷阱 DL-4：`getTotalBytes()` 返回 0 导致除零崩溃（MEDIUM）

**问题描述：**
当服务器未设置 `Content-Length` 头时，`item.getTotalBytes()` 返回 0。计算下载百分比时 `getReceivedBytes() / getTotalBytes()` 会产生除零错误（NaN 或 Infinity）。

**如何避免：**
```javascript
function getDownloadProgress(item) {
  const total = item.getTotalBytes();
  if (total <= 0) {
    return { percent: -1, label: `${formatBytes(item.getReceivedBytes())} / 未知大小` };
  }
  const received = item.getReceivedBytes();
  return {
    percent: Math.round((received / total) * 100),
    label: `${formatBytes(received)} / ${formatBytes(total)}`
  };
}
```

**应解决的阶段：** Download Manager UI 实现阶段

---

### 陷阱 DL-5：webview 中下载事件路由遗漏（HIGH）

**问题描述：**
Realm Browser 使用 webview 标签加载页面，每个 webview 使用独立的 Session（`persist:container-{id}`）。**每个 Session 的下载事件需要单独注册处理器**。如果只在 `defaultSession` 上注册了 `will-download` 处理器，容器内触发的下载会静默失败。

**根本原因：**
webview 的 partition session 与 defaultSession 是不同的 Session 实例。下载事件绑定在 Session 级别，不会跨 Session 传播。

**如何避免：**
```javascript
// 在创建容器 Session 时统一注册下载处理器
function setupContainerSession(containerId) {
  const partition = `persist:container-${containerId}`;
  const ses = session.fromPartition(partition);

  // 注册下载处理器
  ses.on('will-download', handleDownload);

  return ses;
}

// 在 initContainers 中确保所有容器都有处理器
function initContainers() {
  for (const container of containers) {
    setupContainerSession(container.id);
  }
}
```

**应解决的阶段：** Download Manager 与容器集成阶段

---

### 陷阱 DL-6：同时下载过多文件导致资源耗尽（MEDIUM）

**问题描述：**
没有并发下载限制时，用户可以同时发起数十个下载，每个下载消耗文件句柄和内存缓冲区。

**如何避免：**
- 设置最大并发下载数（建议 3-5 个）
- 超出限制的下载进入等待队列
- 监控活跃下载数和系统资源

**应解决的阶段：** Download Manager 队列管理实现阶段

---

### 陷阱 DL-7：大文件下载中断后临时文件泄漏（MEDIUM）

**问题描述：**
下载中断或应用崩溃时，已部分下载的临时文件残留在磁盘上。多次中断累积后占用大量空间。

**如何避免：**
- 下载中断时清理或标记临时文件
- 应用启动时检查并清理孤立的临时文件
- 使用 `.crdownload` 后缀标识未完成的下载文件

**应解决的阶段：** Download Manager 文件管理阶段

---

### 陷阱 DL-8：`getFilename()` 不等于实际保存的文件名（LOW）

**问题描述：**
如果用户在保存对话框中修改了文件名，`item.getFilename()` 返回的仍是原始文件名。用它来追踪下载会导致数据不一致。

**如何避免：** 使用 `item.getSavePath()` 获取实际保存路径和文件名。

---

### 陷阱 DL-9：DownloadItem 不可导出 — 无法在模块间传递（LOW）

**问题描述：**
`DownloadItem` 类不从 `electron` 模块导出，只能通过 `will-download` 事件获取实例。开发者无法创建 DownloadItem 实例或在模块间传递类型。

**如何避免：** 设计下载管理器时，用自定义数据结构（download record）在模块间传递下载信息，只在主进程内部持有 DownloadItem 引用。

---

### 陷阱 DL-10：应用退出时未完成的下载处理（MEDIUM）

**问题描述：**
应用关闭时，活跃的下载会被中断。如果没有持久化下载状态，用户重启后无法恢复下载。

**如何避免：**
- 在应用退出前保存所有活跃下载的 URL、已接收字节数、Last-Modified、ETag
- 重启后提供"恢复下载"功能
- 使用 `getLastModifiedTime()` 和 `getETag()` 实现断点续传

---

## 关键陷阱 — 自动填充

### 陷阱 AF-1：Linux 上 `safeStorage` 静态降级为明文存储（CRITICAL）

**问题描述：**
在 Linux 上，如果系统没有可用的密钥存储服务（GNOME Keyring、KWallet 等），`safeStorage` 会使用**硬编码的明文密码**加密数据。Electron 官方文档明确说明："If no secret store is available, items stored in using the safeStorage API will be unprotected as they are encrypted via hardcoded plaintext password"。

**检测方法：**
```javascript
const { safeStorage } = require('electron');

async function checkEncryptionSafety() {
  const available = await safeStorage.isAsyncEncryptionAvailable();
  if (!available) {
    console.error('[Realm] safeStorage 不可用，拒绝存储凭据');
    return false;
  }

  // Linux 特有检查
  if (process.platform === 'linux') {
    const backend = safeStorage.getSelectedStorageBackend();
    if (backend === 'basic_text') {
      console.error('[Realm] Linux 密钥存储降级为明文，拒绝存储凭据');
      return false;
    }
  }

  return true;
}
```

**如何避免：**
- 调用 `getSelectedStorageBackend()` 检查后端类型
- 如果返回 `'basic_text'`，**拒绝存储凭据**或向用户显示警告
- 使用异步 API（`encryptStringAsync`/`decryptStringAsync`）
- macOS/Windows 无此问题，但也要检查 `isEncryptionAvailable()`

**应解决的阶段：** Autofill 凭据存储实现的第一步

---

### 陷阱 AF-2：Windows DPAPI 同用户空间暴露（HIGH）

**问题描述：**
在 Windows 上，`safeStorage` 使用 DPAPI 加密。Electron 官方文档说明："only a user with the same logon credential as the user who encrypted the data can typically decrypt it"。这意味着**任何以同一用户身份运行的进程都能解密数据**，包括恶意软件。

**如何避免：**
- 在 Windows 上额外添加应用层加密（应用密钥 + DPAPI 双层）
- 或接受 Windows 上的安全局限性，在文档中明确说明
- macOS Keychain 提供进程级隔离，是最安全的平台

**应解决的阶段：** Autofill 安全模型设计阶段

---

### 陷阱 AF-3：容器间凭据数据泄漏（CRITICAL）

**问题描述：**
在多容器架构中，如果凭据存储没有按容器隔离，容器 A 保存的密码可能在容器 B 的页面中被自动填充。

**根本原因：**
简单的 autofill 实现通常使用全局凭据数据库（类似 Chrome 的统一密码库），对 Realm Browser 的容器隔离模型构成冲突。

**后果：**
- 用户在"工作"容器登录的账号密码被"个人"容器的页面获取
- 违反容器隔离这一核心价值

**如何避免：**
```javascript
// 凭据数据库必须按容器 ID 分区
class CredentialStore {
  constructor() {
    // 每个容器独立的凭据表
    this.db = new Database('credentials.db');
  }

  // 保存凭据时记录来源容器
  save(containerId, origin, username, encryptedPassword) {
    this.db.prepare(`
      INSERT INTO credentials (container_id, origin, username, password)
      VALUES (?, ?, ?, ?)
    `).run(containerId, origin, username, encryptedPassword);
  }

  // 查询时只返回当前容器的凭据
  getForOrigin(containerId, origin) {
    return this.db.prepare(`
      SELECT * FROM credentials
      WHERE container_id = ? AND origin = ?
    `).all(containerId, origin);
  }
}

// 填充前验证容器 ID + origin 双重匹配
function autofillCredentials(containerId, pageOrigin) {
  const credentials = credentialStore.getForOrigin(containerId, pageOrigin);
  if (credentials.length === 0) return;

  // 填充到表单
  for (const cred of credentials) {
    injectCredential(cred);
  }
}
```

**应解决的阶段：** Autofill 数据模型设计阶段

---

### 陷阱 AF-4：`safeStorage` 同步 API 阻塞主进程（HIGH）

**问题描述：**
macOS Keychain 和 Linux 密码管理器的同步 API 会阻塞当前线程等待用户交互（如输入 Keychain 密码）。Electron 官方文档建议使用异步 API："We recommend using the asynchronous API...The synchronous API may be deprecated in a future version of Electron"。

**后果：**
- 在 Electron 主进程中调用同步 API 会冻结整个应用 UI
- 同步 API 有未来被废弃的风险

**如何避免：**
- 始终使用异步 API（`encryptStringAsync`/`decryptStringAsync`）
- 在应用启动时预热异步加密可用性检查

**应解决的阶段：** Autofill 凭据存储实现阶段

---

### 陷阱 AF-5：加密数据不可跨机器/用户迁移（MEDIUM）

**问题描述：**
`safeStorage` 使用 OS 级密钥加密，加密后的 Buffer 在不同机器、不同用户、甚至（Linux 上）不同密钥存储后端之间不可解密。

**后果：**
- 用户更换电脑后无法恢复已保存的密码
- 应用数据迁移工具无法处理加密凭据

**如何避免：**
- 在用户尝试迁移数据时明确告知凭据不随数据迁移
- 不要假设加密 Buffer 可以跨机器使用
- 如果需要跨机器同步，需要额外的加密方案（用户主密码派生密钥）

---

### 陷阱 AF-6：autofill 与 CDP fillForm 的冲突（HIGH）

**问题描述：**
Realm Browser 已有基于 CDP 的 `fillForm` 自动化功能（Phase 24）。新增的用户级 autofill 与 AI 级 fillForm 可能产生冲突：两者都尝试操作同一输入字段。

**根本原因：**
CDP 的 `Input.insertText` 和 DOM 的 autofill 事件可能互相干扰。浏览器的原生 autofill 在 CDP 操作时可能意外触发。

**如何避免：**
```javascript
// 共享操作锁
let fillOperationLock = null;

async function userAutofill(credentials) {
  if (fillOperationLock) {
    console.warn('[Realm Autofill] 另一个填充操作正在进行，跳过');
    return;
  }

  fillOperationLock = 'user-autofill';
  try {
    // 使用 DOM 事件填充
    for (const cred of credentials) {
      await fillFieldViaDOM(cred);
    }
  } finally {
    fillOperationLock = null;
  }
}

async function aiFillForm(fields) {
  if (fillOperationLock) {
    console.warn('[Realm Autofill] 另一个填充操作正在进行，跳过');
    return;
  }

  fillOperationLock = 'ai-fillform';
  try {
    // 使用 CDP 填充
    await fillFormViaCDP(fields);
  } finally {
    fillOperationLock = null;
  }
}
```

**应解决的阶段：** Autofill 与现有 AI 自动化集成阶段

---

### 陷阱 AF-7：跨域 iframe 中的凭据注入风险（HIGH）

**问题描述：**
如果 autofill 逻辑不够严格，恶意页面可以通过隐藏的跨域 iframe 获取已保存的凭据。攻击者创建一个与目标站点外观相同的表单，浏览器自动填充时将凭据注入到攻击者的 iframe 中。

**如何避免：**
```javascript
function shouldAutofill(frame, pageOrigin) {
  // 只在顶层页面触发 autofill
  if (frame !== top) {
    // 验证 iframe 的 origin 与顶层页面一致
    try {
      const frameOrigin = new URL(frame.location.href).origin;
      if (frameOrigin !== pageOrigin) {
        console.warn('[Realm Autofill] 跨域 iframe，拒绝填充');
        return false;
      }
    } catch (e) {
      // 无法访问 frame.location（跨域限制），拒绝填充
      return false;
    }
  }
  return true;
}
```

**应解决的阶段：** Autofill 安全模型设计阶段

---

### 陷阱 AF-8：autofill 表单字段匹配的 DOM 异构问题（MEDIUM）

**问题描述：**
不同网站的表单字段命名千差万别（`username`、`email`、`user_login`、`loginId`、`account` 等）。简单的字符串匹配会导致填充到错误字段或完全无法匹配。

**如何避免：**
- 参考 Chrome 的字段匹配策略：`autocomplete` 属性优先，然后 name/id/type 语义匹配
- 维护一个字段名到语义类型的映射表
- 支持用户手动关联字段

```javascript
// 字段语义映射表
const FIELD_PATTERNS = {
  username: [
    /^user(name)?$/i, /^email$/i, /^login[_-]?id$/i,
    /^account$/i, /^phone$/i, /autocomplete.*username/i
  ],
  password: [
    /^pass(word)?$/i, /^pwd$/i, /autocomplete.*current-password/i
  ]
};

function identifyFieldType(inputElement) {
  // 优先检查 autocomplete 属性
  const autocomplete = inputElement.autocomplete;
  if (autocomplete === 'username' || autocomplete === 'email') return 'username';
  if (autocomplete === 'current-password') return 'password';

  // 然后检查 name/id
  const name = inputElement.name || '';
  const id = inputElement.id || '';

  for (const [type, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(name) || pattern.test(id)) return type;
    }
  }

  return null;
}
```

**应解决的阶段：** Autofill 表单检测实现阶段

---

### 陷阱 AF-9：`shouldReEncrypt` 标志被忽略（MEDIUM）

**问题描述：**
`decryptStringAsync` 返回的 `shouldReEncrypt` 标志表示密钥已轮换，应重新加密数据。忽略此标志会导致下次解密时使用旧密钥数据。

**如何避免：**
```javascript
async function decryptCredential(encryptedBuffer) {
  const { shouldReEncrypt, result } = await safeStorage.decryptStringAsync(encryptedBuffer);

  if (shouldReEncrypt) {
    // 密钥已轮换，重新加密
    const newEncrypted = await safeStorage.encryptStringAsync(result);
    // 更新数据库中的加密数据
    await updateStoredCredential(newEncrypted);
  }

  return result;
}
```

---

## 阶段到陷阱映射

| 阶段主题 | 陷阱编号 | 严重程度 | 预防措施 |
|---------|---------|---------|---------|
| Download Manager 核心 | DL-1 | CRITICAL | 同步调用 setSavePath，使用 setSaveDialogOptions |
| 下载暂停/恢复 | DL-2 | CRITICAL | 检查 Range 请求支持和 ETag/Last-Modified 头 |
| 下载状态机 | DL-3 | HIGH | 按事件名称区分可恢复/不可恢复中断 |
| 下载 UI 进度条 | DL-4 | MEDIUM | 检查 getTotalBytes() > 0 |
| 下载队列管理 | DL-6 | MEDIUM | 限制最大并发下载数 |
| 下载文件管理 | DL-7 | MEDIUM | 中断/退出时清理，启动时扫描孤立文件 |
| webview 集成 | DL-5 | HIGH | 每个容器 Session 注册处理器 |
| 应用退出处理 | DL-10 | MEDIUM | 持久化下载状态 |
| Autofill 凭据存储 | AF-1 | CRITICAL | 检查 getSelectedStorageBackend()，拒绝 basic_text |
| Autofill 凭据存储 | AF-4 | HIGH | 使用异步 API |
| Autofill 数据隔离 | AF-3 | CRITICAL | 凭据按容器 ID 分区存储 |
| Autofill 安全模型 | AF-2 | HIGH | Windows 额外应用层加密 |
| Autofill 安全模型 | AF-7 | HIGH | 只在顶层页面触发，验证 origin |
| Autofill + AI fillForm | AF-6 | HIGH | 互斥锁 + 优先级规则 |
| Autofill 表单检测 | AF-8 | MEDIUM | autocomplete 属性优先 + 语义映射表 |
| 跨机器迁移 | AF-5 | MEDIUM | 明确告知用户，不假设可移植性 |

---

## 技术债务模式

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 不检查 Range/ETag 直接 resume() | 代码简单 | 大文件带宽浪费 | **NEVER** |
| 全局凭据数据库不按容器分区 | 实现简单 | 容器隔离失效 | **NEVER** |
| 使用 safeStorage 同步 API | 代码简短 | UI 冻结 + 未来废弃 | **NEVER** |
| Linux 不检查 basic_text 后端 | 无需平台判断 | 密码明文存储 | **NEVER** |
| 不处理 getTotalBytes()=0 | 代码少一行 | UI 崩溃 | **NEVER** |
| 不注册容器 Session 下载处理器 | 代码少 | 容器内下载失败 | **NEVER** |

## "Looks Done But Isn't" 检查清单

- [ ] **DL 路径设置:** 验证所有 `setSavePath` 调用都在 `will-download` 同步上下文中
- [ ] **DL 断点续传:** 测试不支持 Range 的服务器，确认 resume() 行为符合预期
- [ ] **DL 状态机:** 验证 `updated.interrupted` 和 `done.interrupted` 的不同处理
- [ ] **DL 进度条:** 测试 Content-Length 为 0 的下载，确认 UI 不崩溃
- [ ] **DL 容器隔离:** 在每个容器中测试下载功能
- [ ] **AF Linux 加密:** 在无密钥存储的 Linux 环境测试，确认拒绝存储凭据
- [ ] **AF 容器隔离:** 验证容器 A 的密码不会在容器 B 中被填充
- [ ] **AF 跨域 iframe:** 测试恶意 iframe 是否能获取已保存凭据
- [ ] **AF 互斥:** 同时触发 autofill 和 AI fillForm，确认无冲突
- [ ] **AF 异步 API:** 验证 Keychain 密码弹窗不冻结主窗口

---

## 来源

- [Electron DownloadItem API 文档](https://www.electronjs.org/docs/latest/api/download-item) — 官方文档，直接抓取（HIGH）
- [Electron safeStorage API 文档](https://www.electronjs.org/docs/latest/api/safe-storage) — 官方文档，直接抓取（HIGH）
- [Electron Session will-download 文档](https://www.electronjs.org/docs/latest/api/session#event-will-download) — 官方文档（HIGH）
- Realm Browser PROJECT.md — 项目约束和现有架构（HIGH）
- Realm Browser CLAUDE.md — 现有实现细节：CDP fillForm、容器 Session、webview（HIGH）

---

## v2.2 陷阱：多媒体功能集成

以下为 v2.2 里程碑的陷阱研究（保留供参考）。

---

### 陷阱 1：CSP 阻断 executeJavaScript 脚本注入 — 视频检测的根本性障碍

**问题描述：**
很多视频网站（YouTube、Bilibili、Netflix 等）设置了严格的 Content-Security-Policy 头（如 `script-src 'self' 'nonce-xxx'`），导致 `webview.executeJavaScript()` 注入的检测脚本被浏览器引擎直接拒绝。错误信息：`Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'"`。

这意味着 `docs/multimedia-plan.md` 中 `MediaSniffer.injectDetector()` 的核心逻辑在大量网站上**完全失效**。

**根本原因：**
- `executeJavaScript()` 注入的代码被视为内联脚本，受 CSP `script-src` 约束
- `javascript:` URI 同样被 CSP 阻止
- `eval()` / `new Function()` 需要 CSP 包含 `'unsafe-eval'`
- 即使通过 DOM 操作注入 `<script>` 标签，也会被 CSP 拦截
- webview guest 页面的 CSP 由其自身响应头决定，与宿主页面无关

**如何避免：**

```javascript
// 方案 A：通过 webRequest 拦截响应头，移除/修改 CSP（推荐）
// 注意：这是一个安全权衡，仅对需要检测视频的容器 session 生效
function setupCSPBypassForMedia(ses) {
  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    // 不完全删除 CSP，而是仅放宽 script-src
    if (responseHeaders['content-security-policy']) {
      responseHeaders['content-security-policy'] =
        responseHeaders['content-security-policy'].map(directive =>
          directive.replace(/script-src\s/, "script-src 'unsafe-inline' ")
        );
    }
    // 同时处理 meta 标签中的 CSP（无法通过 webRequest 拦截）
    // 这部分需要在页面加载后通过 CDP 注入

    callback({ responseHeaders });
  });
}

// 方案 B：使用 Chrome DevTools Protocol 的 Runtime.evaluate（绕过 CSP）
// CDP 命令在 inspector 上下文执行，不受页面 CSP 限制
async function injectDetectorViaCDP(webContents) {
  // 已有 cdp-manager.js 的 attachDebugger 机制可复用
  const debuggerAttached = await ensureDebuggerAttached(webContents);
  if (!debuggerAttached) return;

  await webContents.debugger.sendCommand('Runtime.evaluate', {
    expression: `
      (function() {
        const videos = document.querySelectorAll('video, video source');
        const urls = [];
        videos.forEach(el => {
          if (el.src) urls.push(el.src);
          if (el.currentSrc) urls.push(el.currentSrc);
        });
        return JSON.stringify(urls);
      })();
    `,
    returnByValue: true
  });
}

// 方案 C：webview preload 脚本（在 webview 创建时指定）
// preload 脚本在独立上下文运行，部分 CSP 场景下可绕过
// <webview preload="./src/media-detector-preload.js">
```

**预警信号：**
- 媒体面板在 YouTube、Bilibili 等主流视频网站显示"未检测到媒体资源"
- 控制台出现 `Refused to execute inline script` 或 `Content Security Policy` 错误
- 某些网站检测到但某些网站完全无反应

**应解决的阶段：**
Phase 26（视频源检测）— **必须在实现 injectDetector 之前决定方案**。推荐方案 A + B 组合：webRequest 放宽 CSP 作为通用方案，CDP 注入作为兜底。

---

### 陷阱 2：session.webRequest 拦截性能开销 — 全局拦截的隐藏代价

**问题描述：**
`media-sniffer.js` 规划的 `ses.webRequest.onBeforeRequest` 使用 `{ urls: ['*://*/*.m3u8*', ...] }` 过滤器。虽然 URL 过滤器看起来精确，但 Chromium 内部对**每个匹配 session 的请求**都要执行过滤器匹配 + 回调调用。在复杂页面（如 SPA 加载数百个请求）中，这会引入可测量的延迟。

**根本原因：**
- `onBeforeRequest` 是**同步阻塞**的：回调未调用前，请求会挂起
- 现有代码 `main.js:359` 已经有一个 `onBeforeSendHeaders` 拦截器用于 UA-CH
- 多个 `webRequest` 监听器会**链式调用**，增加延迟
- `*://*/*.m3u8*` 这样的通配符需要 Chromium 对每个 URL 做正则匹配
- 高频请求场景下（如视频网站加载大量分片），回调队列可能堆积

**如何避免：**

```javascript
// 1. 使用精确的 URL 过滤器而非宽泛通配符
// 错误：{ urls: ['*://*/*'] }  — 拦截所有请求
// 正确：{ urls: ['*://*/*.m3u8*', '*://*/*.mp4*', '*://*/*.flv*', '*://*/*.webm*'] }
// 更好：进一步限制为特定 MIME 类型
ses.webRequest.onBeforeRequest(
  {
    urls: [
      '*://*/*.m3u8*',
      '*://*/*.mp4*',
      '*://*/*.flv*',
      '*://*/*.webm*',
      // 注意：某些视频 URL 没有扩展名，需要结合 onHeadersReceived 检查 MIME
    ]
  },
  (details, callback) => {
    // 回调必须尽快返回，不要做耗时操作
    // 错误：在这里做 URL 解析、数据库写入
    // 正确：仅收集 URL，异步处理
    mediaQueue.push({ url: details.url, timestamp: Date.now() });
    callback({}); // 立即放行
  }
);

// 2. 使用 onHeadersReceived 补充检测（检查 MIME 类型）
ses.webRequest.onHeadersReceived(
  { urls: ['*://*/*'] }, // 需要宽泛过滤才能检查所有响应头
  (details, callback) => {
    const contentType = details.responseHeaders['content-type']?.[0] || '';
    if (contentType.includes('video/') || contentType.includes('application/x-mpegURL')) {
      mediaQueue.push({
        url: details.url,
        mime: contentType,
        timestamp: Date.now()
      });
    }
    callback({}); // 不修改响应头
  }
);

// 3. 异步批量处理收集到的 URL（避免高频 IPC）
class MediaQueue {
  constructor() {
    this.queue = [];
    this.flushInterval = 500; // 500ms 批量刷新
    this.timer = null;
  }

  push(item) {
    this.queue.push(item);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.queue.length === 0) return;

    // 去重
    const unique = this.deduplicate(this.queue);
    this.queue = [];

    // 通知渲染进程更新媒体面板
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('media:list-updated', unique);
    }

    this.timer = null;
  }

  deduplicate(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }
}
```

**预警信号：**
- 页面加载速度明显变慢（>200ms 延迟可感知）
- 网络请求在 DevTools Network 面板中出现异常的 "pending" 状态
- 高频请求页面（如直播网站）出现请求超时
- 现有 UA-CH 功能（`main.js:359`）受到影响

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `initWebRequestInterceptor` 时同步实现性能监控。**必须**与现有 `onBeforeSendHeaders`（main.js:359）做集成测试。

---

### 陷阱 3：hls.js 与 Electron Chromium 版本的兼容性问题

**问题描述：**
hls.js 依赖 Media Source Extensions (MSE) API 来实现 HLS 播放。虽然 Electron 32.x（Chromium 128+）完整支持 MSE，但存在以下兼容性问题：

1. **硬件加速冲突** — Electron 的 GPU 进程与 MSE 的 MediaSource 竞争 GPU 资源，导致黑屏或渲染异常
2. **codec 支持差异** — Electron 构建可能未包含某些编解码器（取决于构建配置）
3. **跨域分片请求** — hls.js 的 XHR/fetch 请求受 webview session 的 CORS 策略限制
4. **autoplay 策略** — Chromium 的 autoplay 策略可能阻止自动播放

**根本原因：**
- Electron 32.x = Chromium 128，MSE 支持完整，但 **codec 取决于编译选项**
- hls.js 使用 `fetch` 或 `XMLHttpRequest` 加载 `.ts` 分片，受同源策略约束
- Chromium autoplay 策略要求用户交互后才能播放有声视频
- macOS 上的硬件加速在某些 GPU 型号上不稳定

**如何避免：**

```javascript
// 1. 播放器窗口创建时的正确配置
function createPlayerWindow(url, type) {
  const win = new BrowserWindow({
    width: 960,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'src/player-preload.js'),
      contextIsolation: true,
      // 关键：允许 autoplay（播放器窗口是用户主动打开的）
      autoplayPolicy: 'no-user-gesture-required',
      // 注意：不要设置 webSecurity: false，而是正确处理 CORS
    },
  });

  // macOS 特定：某些 GPU 上硬件加速导致黑屏
  // 如果检测到播放问题，可临时禁用
  // win.webContents.setWebRTCEnabled(false); // 如果不需要 WebRTC
}

// 2. hls.js 初始化时的兼容性处理
function initHlsPlayer(videoElement, url) {
  // 先检查 MSE 支持
  if (!window.MediaSource) {
    showError('当前环境不支持 Media Source Extensions');
    return null;
  }

  // 检查 hls.js 支持
  if (!Hls.isSupported()) {
    // macOS Safari/Electron 可能支持原生 HLS
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
      return null; // 不需要 hls.js
    }
    showError('当前环境不支持 HLS 播放');
    return null;
  }

  const hls = new Hls({
    // 缓冲配置
    maxBufferLength: 30,
    maxMaxBufferLength: 600,
    // 重要：Electron 中 XHR 需要正确处理 CORS
    // 如果跨域失败，考虑使用 customLoader
    xhrSetup: (xhr, requestUrl) => {
      // 可在此处添加自定义 headers（如 Referer）
      // 注意：某些视频网站需要特定 Referer 才能获取分片
    },
    // 错误恢复
    enableWorker: false, // Electron 中 Worker 可能有路径问题
    debug: false, // 生产环境关闭调试
  });

  hls.loadSource(url);
  hls.attachMedia(videoElement);

  // 错误处理和恢复
  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.error('[Realm Player] HLS 网络错误:', data.details);
          hls.startLoad(); // 重试
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.error('[Realm Player] HLS 媒体错误:', data.details);
          hls.recoverMediaError(); // 恢复
          break;
        default:
          console.error('[Realm Player] HLS 不可恢复错误:', data);
          hls.destroy();
          break;
      }
    }
  });

  return hls;
}

// 3. CORS 问题的处理（当 hls.js 跨域请求分片失败时）
// 方案 A：通过主进程代理请求（最可靠）
function setupMediaProxy(session) {
  session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      // 添加 Referer 等必要的请求头
      const headers = { ...details.requestHeaders };
      if (!headers['Referer']) {
        headers['Referer'] = details.url;
      }
      callback({ requestHeaders: headers });
    }
  );

  // 如果服务器不返回 CORS 头，需要在 onHeadersReceived 中添加
  session.webRequest.onHeadersReceived(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      // 添加 CORS 头允许跨域访问
      if (!responseHeaders['access-control-allow-origin']) {
        responseHeaders['access-control-allow-origin'] = ['*'];
      }
      callback({ responseHeaders });
    }
  );
}
```

**预警信号：**
- 播放器窗口显示黑屏但有声音（GPU 加速问题）
- hls.js 控制台报 `network error` 但网络正常（CORS 问题）
- 特定视频网站的 m3u8 无法加载（需要特定 Referer）
- 播放器不自动播放，需要手动点击（autoplay 策略）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-06（hls.js 集成）时**必须**同时实现错误恢复和 CORS 处理。建议在 Phase 26 就开始测试 hls.js 基础播放。

---

### 陷阱 4：HLS 实例和播放器窗口内存泄漏 — 最常见的长期运行问题

**问题描述：**
hls.js 实例在创建后如果不调用 `hls.destroy()` 会持续占用内存（每个实例约 10-50MB，取决于缓冲配置）。播放器窗口关闭时如果未正确清理，会导致：
- HLS 分片下载继续进行（即使窗口已不可见）
- MediaSource 对象未释放，GPU 内存持续增长
- 事件监听器累积，触发回调时访问已销毁的 DOM
- 多次打开/关闭播放器后，应用内存持续增长直到 OOM

**根本原因：**
- `hls.destroy()` 不仅停止下载，还释放 MediaSource 和 SourceBuffer
- BrowserWindow 的 `closed` 事件不保证 webContents 已完全销毁
- 视频元素的 `src` 未清空时，底层解码器继续工作
- Electron 的 GPU 进程独立于主进程，窗口关闭不自动释放 GPU 资源
- 如果在 `close` 事件中做异步清理，窗口可能在清理完成前就已销毁

**如何避免：**

```javascript
// === 主进程：播放器窗口生命周期管理 ===
class PlayerWindowManager {
  constructor() {
    this.windows = new Map(); // windowId -> { window, hlsReady }
  }

  create(url, type) {
    const win = new BrowserWindow({
      width: 960,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'src/player-preload.js'),
        contextIsolation: true,
      },
    });

    const entry = { window: win, destroyed: false };
    this.windows.set(win.id, entry);

    // 关键：在 close 事件中先通知渲染进程清理
    win.on('close', () => {
      // 同步发送清理指令（不要用异步，窗口可能立即销毁）
      if (!win.isDestroyed()) {
        win.webContents.send('cleanup-before-close');
      }
    });

    win.on('closed', () => {
      entry.destroyed = true;
      this.windows.delete(win.id);
    });

    win.loadFile('src/player.html');
    return win;
  }

  // 应用退出时清理所有播放器窗口
  cleanupAll() {
    for (const [id, entry] of this.windows) {
      if (!entry.window.isDestroyed()) {
        entry.window.destroy(); // 强制销毁，不触发 close 事件
      }
    }
    this.windows.clear();
  }
}

// === 渲染进程（player.js）：HLS 实例清理 ===
let hlsInstance = null;
let videoElement = null;

function initPlayer(url, type) {
  videoElement = document.getElementById('videoPlayer');

  // 先清理旧实例
  destroyPlayer();

  if (type === 'm3u8' && Hls.isSupported()) {
    hlsInstance = new Hls({ maxBufferLength: 30 });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(videoElement);
  } else {
    videoElement.src = url;
  }
}

function destroyPlayer() {
  // 1. 销毁 HLS 实例（停止下载、释放 MediaSource）
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  // 2. 清理视频元素
  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load(); // 触发资源释放
    // 移除所有事件监听器
    videoElement.replaceWith(videoElement.cloneNode(true));
  }
}

// 3. 监听清理指令（主进程 close 事件触发）
if (window.electronAPI && window.electronAPI.onCleanupBeforeClose) {
  window.electronAPI.onCleanupBeforeClose(() => {
    destroyPlayer();
  });
}

// 4. 页面卸载时的兜底清理
window.addEventListener('beforeunload', () => {
  destroyPlayer();
});

// 5. 页面隐藏时暂停（节省资源）
document.addEventListener('visibilitychange', () => {
  if (document.hidden && videoElement && !videoElement.paused) {
    videoElement.pause();
    // 注意：不要在这里 destroy，用户可能切回来
  }
});
```

**预警信号：**
- 应用内存使用随播放器打开/关闭次数线性增长
- 关闭播放器窗口后，活动监视器中仍有相关网络活动
- 打开 5+ 个播放器窗口后系统变慢
- 控制台出现 `Cannot read properties of null` 错误（访问已销毁 DOM）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-05（独立播放器窗口）时**必须**同步实现清理机制。这是最容易被忽视但影响最大的陷阱。

---

### 陷阱 5：DRM 保护内容的静默失败 — 用户预期管理

**问题描述：**
Netflix、Disney+、Amazon Prime Video 等平台的视频使用 Widevine DRM 保护。Electron 默认**不包含** Widevine CDM（Content Decryption Module），导致：
- 视频 URL 被成功检测到（m3u8 链接有效）
- 用户点击播放后，播放器显示黑屏或报错，但无明确提示
- 用户困惑为什么检测到视频却无法播放

**根本原因：**
- Widevine CDM 需要 Google 授权和单独集成
- 标准 Electron 构建不包含 Widevine
- 即使使用 `electron-widevinecdm` 或 `castlabs` fork，也只能获得 L3（软件解密），许多服务会限制画质到 480p 或直接拒绝播放
- EME（Encrypted Media Extensions）API 调用会静默失败或抛出不易理解的错误

**如何避免：**

```javascript
// 1. 检测 DRM 保护并提前告知用户
async function checkDrmSupport() {
  const config = [
    {
      initDataTypes: ['cenc'],
      videoCapabilities: [{
        contentType: 'video/mp4; codecs="avc1.42E01E"',
        robustness: 'HW_SECURE_ALL'
      }]
    }
  ];

  try {
    const access = await navigator.requestMediaKeySystemAccess(
      'com.widevine.alpha', config
    );
    return { supported: true, robustness: 'HW_SECURE_ALL' };
  } catch (e) {
    // 尝试软件级别
    try {
      config[0].videoCapabilities[0].robustness = '';
      const access = await navigator.requestMediaKeySystemAccess(
        'com.widevine.alpha', config
      );
      return { supported: true, robustness: 'software', limited: true };
    } catch (e2) {
      return { supported: false };
    }
  }
}

// 2. 在播放器中处理 DRM 错误
function initPlayerWithDrmCheck(videoElement, url) {
  // 检查是否可能是 DRM 保护的 URL
  const drmIndicators = [
    /manifest\.mpd/i,           // DASH manifest
    /license/i,                  // License server URL
    /drm/i,                      // URL 包含 drm
    /widevine/i,                 // Widevine 相关
    /playready/i,                // PlayReady 相关
    /fairplay/i,                 // FairPlay 相关
  ];

  const isLikelyDrm = drmIndicators.some(pattern => pattern.test(url));

  if (isLikelyDrm) {
    showDrmWarning(url);
    return;
  }

  // 监听加密事件
  videoElement.addEventListener('encrypted', (event) => {
    console.warn('[Realm Player] 检测到 DRM 加密内容');
    showDrmWarning(url);
  });

  // 监听 EME 错误
  videoElement.addEventListener('keystatuseschange', (event) => {
    const statuses = videoElement.mediaKeys?.getStatuses?.();
    if (statuses) {
      for (const [keyId, status] of statuses) {
        if (status === 'output-restricted' || status === 'internal-error') {
          showDrmWarning(url, `密钥状态异常: ${status}`);
          return;
        }
      }
    }
  });
}

// 3. 友好的 DRM 提示 UI
function showDrmWarning(url, detail = '') {
  const playerContainer = document.querySelector('.player-container');
  playerContainer.innerHTML = `
    <div class="drm-warning">
      <div class="drm-warning-icon">🔒</div>
      <h3>此视频受 DRM 保护</h3>
      <p>当前环境不支持播放 DRM（数字版权管理）保护的视频。</p>
      ${detail ? `<p class="drm-detail">${detail}</p>` : ''}
      <div class="drm-actions">
        <button onclick="copyVideoUrl('${encodeURIComponent(url)}')">复制视频链接</button>
        <button onclick="window.close()">关闭播放器</button>
      </div>
      <p class="drm-hint">
        提示：某些受 DRM 保护的视频可能无法在此浏览器中播放。
        您可以尝试在原网站上直接观看。
      </p>
    </div>
  `;
}
```

**预警信号：**
- 用户反馈"检测到视频但播放黑屏"
- 播放器控制台出现 `Encrypted Media` 或 `EME` 相关错误
- 某些视频网站的所有视频都无法播放（整个站点使用 DRM）

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-06（hls.js 集成）时同步实现 DRM 检测和提示。

---

### 陷阱 6：跨域视频 URL 检测和 CORS 限制 — m3u8 分片请求失败

**问题描述：**
视频检测到 m3u8 主播放列表 URL 后，hls.js 需要继续请求其中引用的分片列表和 .ts 分片文件。如果这些请求是跨域的（CDN 域名与页面域名不同），且服务器未返回正确的 CORS 头，分片请求会被浏览器阻止。

**根本原因：**
- m3u8 主播放列表中的分片 URL 通常指向 CDN（如 `cdn.example.com`），与页面域名（`www.example.com`）不同
- hls.js 使用 `fetch` 或 `XMLHttpRequest` 请求分片，受同源策略约束
- 即使在 Electron 中，webview 的 session 仍然执行 CORS 检查
- 某些视频网站故意不设置 CORS 头，强制只能在自己的播放器中播放

**如何避免：**

```javascript
// 方案 1：通过 session.webRequest 注入 CORS 头（推荐，对用户透明）
function setupCorsProxyForMedia(ses) {
  ses.webRequest.onHeadersReceived(
    { urls: ['*://*/*.ts', '*://*/*.m3u8', '*://*/*.m4s'] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };

      // 添加 CORS 头
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-methods'] = ['GET, HEAD, OPTIONS'];
      responseHeaders['access-control-allow-headers'] = ['*'];

      callback({ responseHeaders });
    }
  );

  // 同时处理 OPTIONS 预检请求
  ses.webRequest.onBeforeRequest(
    { urls: ['*://*/*.ts', '*://*/*.m3u8'] },
    (details, callback) => {
      // 某些 CDN 对 OPTIONS 请求返回 403，需要直接放行
      callback({});
    }
  );
}

// 方案 2：hls.js 自定义加载器（当 webRequest 方案不够时）
class ElectronHlsLoader extends Hls.DefaultConfig.loader {
  constructor(config) {
    super(config);
  }

  loadInternal() {
    // 使用 Electron 主进程代理请求
    // 通过 IPC 发送 URL 到主进程，主进程用 net.fetch 请求
    // 这样完全绕过 CORS
  }
}

// 方案 3：主进程代理请求（最可靠但最复杂）
// 在 main.js 中注册自定义协议
function setupStreamProxy() {
  protocol.handle('stream-proxy', async (request) => {
    const url = new URL(request.url);
    const targetUrl = decodeURIComponent(url.searchParams.get('url'));

    const response = await net.fetch(targetUrl, {
      headers: {
        'Referer': url.searchParams.get('referer') || '',
      }
    });

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type'),
        'Access-Control-Allow-Origin': '*',
      }
    });
  });
}
```

**预警信号：**
- hls.js 报 `network error` 但 m3u8 主播放列表能正常加载
- DevTools Network 面板中 .ts 请求显示 `(failed) net::ERR_FAILED`
- 控制台出现 `CORS policy` 相关错误
- 某些视频网站的视频能播放，某些不能（取决于 CDN 配置）

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `initWebRequestInterceptor` 时就添加 CORS 处理，不要等到 Phase 27 才发现跨域问题。

---

### 陷阱 7：MutationObserver 动态视频检测的性能和覆盖范围权衡

**问题描述：**
SPA 网站（如 YouTube、Bilibili）动态加载视频时，`<video>` 元素在页面加载后才被插入 DOM。使用 MutationObserver 可以检测到这些动态变化，但：
- `subtree: true` 观察整个 body 的开销在复杂页面上很大
- 某些视频播放器使用 Shadow DOM，MutationObserver 无法穿透
- 视频播放器可能在 iframe 中加载，需要单独处理
- 高频 DOM 变化（如 SPA 路由切换）会触发大量回调

**根本原因：**
- MutationObserver 的 `subtree: true` 在大 DOM 树上性能差（YouTube 页面 DOM 节点 >10,000）
- Shadow DOM 的 encapsulation 特性阻止外部 observer 看到内部变化
- iframe 中的视频需要在 iframe 的 session 中单独注入检测脚本
- 某些播放器（如 Bilibili）使用自定义元素和复杂的 DOM 结构

**如何避免：**

```javascript
// 1. 精细化的 MutationObserver 配置
function setupVideoObserver(document) {
  // 不要一开始就用 subtree: true
  // 先观察直接子节点变化，再按需深入
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // 仅检查新增节点
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // 检查是否是 video 元素
          if (node.tagName === 'VIDEO') {
            handleNewVideo(node);
            continue;
          }

          // 检查子树中是否有 video（但不要对每个节点都查）
          if (node.querySelector) {
            const videos = node.querySelectorAll('video');
            videos.forEach(handleNewVideo);
          }
        }
      }

      // 检查 src 属性变化（某些播放器动态修改 src）
      if (mutation.type === 'attributes' &&
          (mutation.attributeName === 'src' || mutation.attributeName === 'data-src')) {
        const target = mutation.target;
        if (target.tagName === 'VIDEO' || target.tagName === 'SOURCE') {
          handleVideoSrcChange(target);
        }
      }
    }
  });

  // 分阶段观察
  // 阶段 1：观察 body 的直接子节点变化
  observer.observe(document.body, {
    childList: true,
    subtree: false, // 先不深入
  });

  // 阶段 2：5 秒后如果没检测到视频，再启用 subtree
  setTimeout(() => {
    if (detectedVideos.size === 0) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data-src'],
      });
    }
  }, 5000);
}

// 2. Shadow DOM 穿透（如果需要）
function observeShadowRoots(element) {
  // 覆盖 attachShadow 以自动观察新创建的 Shadow DOM
  const originalAttachShadow = element.attachShadow;
  element.attachShadow = function(...args) {
    const shadowRoot = originalAttachShadow.apply(this, args);
    // 在 Shadow Root 中也设置 observer
    setupVideoObserver(shadowRoot);
    return shadowRoot;
  };
}

// 3. iframe 中的视频检测
function setupIframeDetection() {
  // 监听新创建的 iframe
  const iframeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'IFRAME') {
          // iframe 加载后在其 contentDocument 中注入检测
          node.addEventListener('load', () => {
            try {
              // 注意：跨域 iframe 无法访问 contentDocument
              if (node.contentDocument) {
                injectDetectorInDocument(node.contentDocument);
              }
            } catch (e) {
              // 跨域 iframe，忽略
            }
          });
        }
      }
    }
  });

  iframeObserver.observe(document.body, { childList: true, subtree: true });
}

// 4. 防抖处理（避免高频 DOM 变化导致性能问题）
function createDebouncedDetector(callback, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}
```

**预警信号：**
- 页面加载后 CPU 使用率持续 >30%（MutationObserver 回调风暴）
- YouTube/Bilibili 等 SPA 网站的视频未被检测到
- 某些使用 Shadow DOM 的播放器（如某些广告播放器）未被检测
- 检测到大量重复的视频 URL（同一视频被多次报告）

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `injectDetector` 时同步实现性能优化。**建议先实现基于网络拦截的检测（方案 A），MutationObserver 作为补充（方案 B）。**

---

### 陷阱 8：播放器窗口生命周期管理 — 多实例、关闭清理、GPU 冲突

**问题描述：**
用户可能同时打开多个播放器窗口播放不同视频，或者快速打开/关闭播放器。如果生命周期管理不当：
- 关闭播放器窗口时 GPU 进程崩溃（视频未停止就关闭窗口）
- 多个播放器窗口同时播放导致音频叠加
- 主窗口关闭时播放器窗口成为孤儿进程
- 播放器窗口关闭后 IPC 通道报错（webContents 已销毁）

**根本原因：**
- BrowserWindow 的 `close` 事件是**同步**的，无法等待异步清理完成
- 视频解码器需要在窗口销毁前停止，否则 GPU 进程可能崩溃
- 多个 BrowserWindow 共享同一个 GPU 进程
- 主窗口的 `app.quit()` 不会等待所有子窗口的清理完成

**如何避免：**

```javascript
// === 播放器窗口管理器（主进程） ===
class PlayerWindowManager {
  constructor() {
    this.windows = new Map();
    this.activePlayerId = null; // 当前活跃的播放器
  }

  /**
   * 创建新的播放器窗口
   * @param {string} url - 视频 URL
   * @param {string} type - 视频类型
   * @param {Object} options - 额外选项
   * @returns {BrowserWindow}
   */
  create(url, type, options = {}) {
    // 限制同时打开的播放器数量
    const MAX_PLAYERS = 5;
    if (this.windows.size >= MAX_PLAYERS) {
      // 关闭最旧的播放器
      const oldest = this.windows.keys().next().value;
      this.close(oldest);
    }

    const win = new BrowserWindow({
      width: 960,
      height: 600,
      title: 'Realm Player',
      webPreferences: {
        preload: path.join(__dirname, 'src/player-preload.js'),
        contextIsolation: true,
      },
    });

    const entry = {
      window: win,
      url,
      type,
      createdAt: Date.now(),
    };

    this.windows.set(win.id, entry);

    // === 关闭处理 ===
    // 使用 'close' 事件，在窗口实际关闭前执行同步清理
    win.on('close', (event) => {
      // 同步发送停止指令
      if (!win.isDestroyed()) {
        try {
          win.webContents.send('player:stop');
        } catch (e) {
          // webContents 可能已销毁
        }
      }
    });

    win.on('closed', () => {
      this.windows.delete(win.id);
      if (this.activePlayerId === win.id) {
        this.activePlayerId = null;
      }
    });

    // === 焦点管理 ===
    win.on('focus', () => {
      this.activePlayerId = win.id;
      // 可选：暂停其他播放器
      if (options.pauseOthersOnFocus) {
        this.pauseAllExcept(win.id);
      }
    });

    win.loadFile('src/player.html');
    return win;
  }

  /**
   * 关闭指定播放器窗口
   * @param {number} windowId
   */
  close(windowId) {
    const entry = this.windows.get(windowId);
    if (entry && !entry.window.isDestroyed()) {
      entry.window.close();
    }
  }

  /**
   * 关闭所有播放器窗口（应用退出时调用）
   */
  closeAll() {
    for (const [id, entry] of this.windows) {
      if (!entry.window.isDestroyed()) {
        // 先发送停止指令，再强制关闭
        try {
          entry.window.webContents.send('player:stop');
        } catch (e) {}
        entry.window.destroy();
      }
    }
    this.windows.clear();
  }

  /**
   * 暂停除指定窗口外的所有播放器
   * @param {number} exceptWindowId
   */
  pauseAllExcept(exceptWindowId) {
    for (const [id, entry] of this.windows) {
      if (id !== exceptWindowId && !entry.window.isDestroyed()) {
        entry.window.webContents.send('player:pause');
      }
    }
  }

  /**
   * 获取所有播放器窗口信息
   */
  getAll() {
    return [...this.windows.entries()].map(([id, entry]) => ({
      id,
      url: entry.url,
      type: entry.type,
      title: entry.window.getTitle(),
      focused: entry.window.isFocused(),
    }));
  }
}

// === 应用退出时的清理（main.js） ===
app.on('before-quit', () => {
  playerWindowManager.closeAll();
});

// === IPC 通道中的安全检查 ===
ipcMain.handle('player:play', async (event, { url, type }) => {
  // 检查发送者是否还存在
  if (event.sender.isDestroyed()) {
    return { success: false, error: '发送者已销毁' };
  }

  playerWindowManager.create(url, type);
  return { success: true };
});
```

**预警信号：**
- 关闭播放器窗口时应用崩溃或 GPU 进程重启
- 多个视频同时播放时声音重叠
- 主窗口关闭后播放器窗口仍然存在
- 控制台出现 `Object has been destroyed` 错误

**应解决的阶段：**
Phase 27（播放器窗口）— 在实现 MEDIA-05（独立播放器窗口）时**必须**同步实现生命周期管理。这是播放器功能的基础。

---

## 次要陷阱

### 陷阱 9：视频 URL 去重和质量识别

**问题描述：**
同一视频可能有多个 URL（不同分辨率、不同 CDN），导致媒体面板显示重复条目。某些 URL 不包含文件扩展名（如 `https://api.example.com/video/12345/stream`），无法通过 URL 模式判断类型。

**如何避免：**
- 基于 URL 的 path 部分（去除 query 参数）去重
- 通过 `Content-Type` 响应头判断类型（`application/x-mpegURL` = m3u8, `video/mp4` = mp4）
- 同一视频的多个分辨率只显示最高质量的
- 对无扩展名 URL，检查响应头的 MIME 类型

**应解决的阶段：**
Phase 26（视频源检测）— 在实现 `addMedia` 时同步实现去重逻辑。

---

### 陷阱 10：Electron 特定的视频/音频播放行为

**问题描述：**
macOS 上 Electron 的音频会话管理与原生应用不同：
- BrowserWindow 未聚焦时音频可能被系统静音
- macOS 的 Now Playing 集成可能不工作
- 全屏模式下的行为与原生应用不一致
- PiP（画中画）支持有限

**如何避免：**
- 播放器窗口设置 `alwaysOnTop` 选项（用户可选）
- 使用 `win.setSimpleFullScreen()` 而非系统全屏
- 在 macOS 上使用 `app.dock.bounce()` 通知用户播放状态
- 考虑使用 `navigator.mediaSession` API 集成系统媒体控制

**应解决的阶段：**
Phase 27（播放器窗口）— 作为 MEDIA-07（播放控制 UI）的增强功能。

---

## 技术债务模式

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `webSecurity: false` 绕过 CORS | 立即解决跨域问题 | 安全漏洞、容器隔离失效 | **NEVER** |
| 不销毁 HLS 实例 | 代码简单 | 内存泄漏 | 仅原型验证 |
| 不处理 CSP 直接用 executeJavaScript | 实现简单 | 大量网站视频检测失败 | **NEVER** |
| 全局 webRequest 拦截所有 URL | 覆盖范围广 | 性能下降 | 仅开发调试 |
| 不限制播放器窗口数量 | 无需管理逻辑 | 资源耗尽 | 仅 MVP（<3 个） |

## 集成陷阱

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| media-sniffer + webRequest | 拦截所有请求 | 使用精确 URL 过滤器 + 异步队列 |
| hls.js + Electron session | 忽略 CORS | webRequest 注入 CORS 头 |
| 播放器窗口 + 主窗口 | 无生命周期关联 | 主窗口退出时 closeAll |
| CDP 检测 + executeJavaScript | 仅用一种方式 | webRequest 为主 + CDP/executeJavaScript 为辅 |
| 媒体面板 + webview | webview 内 IPC 不通 | 使用 HTTP API 或 webRequest 通信 |

## 性能陷阱

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| webRequest 回调阻塞 | 页面加载变慢 | 回调内仅做内存操作 | >100 请求/秒 |
| MutationObserver 风暴 | CPU 持续 >30% | 防抖 + 精细化配置 | 复杂 SPA 页面 |
| HLS 缓冲区溢出 | 内存持续增长 | 限制 maxBufferLength | 长视频播放 |
| 多播放器同时解码 | GPU 负载高、发热 | 限制同时播放数量 | >3 个播放器 |
| 媒体列表 DOM 更新 | 面板打开卡顿 | 虚拟滚动或分页 | >100 条媒体记录 |

## 安全风险

| Mistake | Risk | Prevention |
|---------|------|------------|
| `webSecurity: false` 绕过 CORS | 容器隔离失效 | 正确配置 CORS 头注入 |
| CSP 完全移除 | XSS 攻击面扩大 | 仅放宽 script-src |
| 播放器窗口无 contextIsolation | 恶意视频页面访问 Node.js | 始终启用 contextIsolation |
| 视频 URL 未验证 | SSRF 攻击（通过代理请求内部地址） | URL 白名单或黑名单 |

## UX 陷阱

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| DRM 视频静默失败 | 用户困惑 | 明确提示 DRM 保护 + 提供替代操作 |
| 检测到视频但无反馈 | 用户不知道检测状态 | 实时显示检测进度和结果 |
| 多播放器音频叠加 | 用户体验差 | 聚焦播放器自动暂停其他 |
| 媒体面板无去重 | 重复条目混乱 | 智能去重 + 质量标识 |

## "Looks Done But Isn't" 检查清单

- [ ] **CSP 处理:** 在 YouTube、Bilibili 等严格 CSP 网站上验证视频检测是否正常
- [ ] **webRequest 性能:** 对比有无 media-sniffer 时的页面加载速度（差异 <100ms）
- [ ] **hls.js 播放:** 测试至少 3 个不同 CDN 的 m3u8 流播放
- [ ] **内存泄漏:** 连续打开/关闭 10 次播放器，验证内存无持续增长
- [ ] **DRM 提示:** 在 Netflix/Disney+ 等 DRM 网站上验证友好提示
- [ ] **CORS 处理:** 测试跨域 m3u8 分片请求是否正常
- [ ] **SPA 检测:** 在 YouTube SPA 路由切换后验证视频检测
- [ ] **多播放器:** 同时打开 3 个播放器窗口，验证独立控制
- [ ] **关闭清理:** 关闭主窗口时验证所有播放器窗口同步关闭
- [ ] **现有功能:** 验证 UA-CH 功能（main.js:359）未受影响

## 恢复策略

| 陷阱 | 恢复成本 | 恢复步骤 |
|------|---------|---------|
| CSP 阻断检测 | MEDIUM | 切换到 CDP 注入方案 + 重新测试 |
| webRequest 性能问题 | LOW | 添加更精确的 URL 过滤器 |
| HLS 播放失败 | MEDIUM | 检查 CORS 配置 + 添加错误恢复 |
| 内存泄漏 | LOW | 确保 hls.destroy() 正确调用 |
| GPU 进程崩溃 | HIGH | 实现窗口关闭前的同步清理 |
| 容器隔离受影响 | CRITICAL | 立即回滚 webSecurity 相关改动 |

## 陷阱到阶段映射

| 陷阱 | 预防阶段 | 验证方式 |
|------|---------|---------|
| CSP 阻断脚本注入 | Phase 26 | 在 5+ 个严格 CSP 网站测试 |
| webRequest 性能开销 | Phase 26 | 页面加载速度基准测试 |
| hls.js 兼容性 | Phase 27 | 播放 3+ 个不同 CDN 的 m3u8 |
| HLS 内存泄漏 | Phase 27 | 连续打开/关闭 10 次播放器 |
| DRM 静默失败 | Phase 27 | Netflix/Disney+ 网站测试 |
| CORS 跨域问题 | Phase 26 | 跨域 m3u8 分片请求测试 |
| MutationObserver 性能 | Phase 26 | YouTube SPA 路由切换测试 |
| 播放器窗口生命周期 | Phase 27 | 多实例 + 关闭清理测试 |

---

## 来源

- Electron 官方文档：webRequest API, BrowserWindow, webview Tag
- Chromium 文档：Content Security Policy, Media Source Extensions
- hls.js 官方文档：API Reference, Error Handling
- MDN：MutationObserver, Encrypted Media Extensions
- Electron GitHub Issues：autoplay, GPU, video playback
- 现有代码库分析：main.js, cdp-manager.js, ipc-handlers.js

---

*陷阱研究：多容器隔离浏览器 v2.3 下载管理器 + 自动填充*
*研究日期：2026-08-11*
