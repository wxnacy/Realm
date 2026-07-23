# 测试模式

**分析日期:** 2026-07-23

## 测试框架

**当前状态:**
- 未配置测试框架
- 无测试文件
- 无测试配置文件（jest.config.*、vitest.config.*、.mocharc.*）
- package.json 中无测试脚本

**推荐方案:**
- 单元测试：Vitest（快速、原生 ESM 支持）
- E2E 测试：Playwright（Electron 支持良好）
- 配置位置：`vitest.config.js`（根目录）

## 测试文件组织

**推荐结构:**
```
src/
├── __tests__/              # 测试目录
│   ├── main.test.js        # 主进程测试
│   ├── preload.test.js     # preload 测试
│   └── renderer.test.js    # 渲染进程测试
├── containers/
│   ├── container-manager.js
│   └── __tests__/
│       └── container-manager.test.js
└── ...
```

**命名规范:**
- 测试文件：`*.test.js` 或 `*.spec.js`
- 测试目录：`__tests__/`
- 文件名与被测模块同名

## 测试结构

**推荐套件组织:**
```javascript
describe('ContainerManager', () => {
  describe('initContainers', () => {
    it('should load default containers when no saved config', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should load saved containers from config', () => {
      // ...
    });
  });

  describe('createContainer', () => {
    it('should create container with valid id', () => {
      // ...
    });
  });
});
```

**模式:**
- 使用 `describe` 分组相关测试
- 使用 `it` 描述单个行为（不使用 `test`）
- 使用 Arrange-Act-Assert 模式
- 每个测试只验证一个行为

## Mocking

**主进程 Mock:**
```javascript
// Mock electron 模块
vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn().mockResolvedValue(),
    on: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  session: {
    fromPartition: vi.fn().mockReturnValue({
      cookies: { get: vi.fn().mockResolvedValue([]) },
      clearStorageData: vi.fn(),
    }),
  },
  BrowserWindow: vi.fn(),
}));

// Mock electron-store
vi.mock('electron-store', () => {
  return vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }));
});
```

**渲染进程 Mock:**
```javascript
// Mock window.realmAPI
const mockRealmAPI = {
  getContainers: vi.fn().mockResolvedValue([]),
  getCurrentContainer: vi.fn().mockResolvedValue('default'),
  switchContainer: vi.fn().mockResolvedValue(true),
  createContainer: vi.fn().mockResolvedValue({ id: 'test', name: 'Test' }),
  deleteContainer: vi.fn().mockResolvedValue({ success: true }),
  getContainerCookies: vi.fn().mockResolvedValue([]),
  setContainerCookie: vi.fn().mockResolvedValue(true),
  clearContainerCookies: vi.fn().mockResolvedValue(true),
  onContainerSwitched: vi.fn(),
};

Object.defineProperty(window, 'realmAPI', {
  value: mockRealmAPI,
});
```

**需要 Mock 的内容:**
- Electron 模块（app、ipcMain、session、BrowserWindow）
- electron-store
- window.realmAPI（渲染进程）
- DOM 操作（如需测试渲染逻辑）

**不应 Mock 的内容:**
- 纯业务逻辑函数
- 数据转换函数
- 状态管理逻辑

## 测试数据

**容器数据工厂:**
```javascript
// test/fixtures/containers.js
const createContainer = (overrides = {}) => ({
  id: `container-${Date.now()}`,
  name: '测试容器',
  color: '#3B82F6',
  icon: '📌',
  ...overrides,
});

const DEFAULT_CONTAINERS = [
  { id: 'default', name: '默认', color: '#6B7280', icon: '🌐' },
  { id: 'work', name: '工作', color: '#3B82F6', icon: '💼' },
  { id: 'personal', name: '个人', color: '#10B981', icon: '👤' },
  { id: 'finance', name: '金融', color: '#F59E0B', icon: '🏦' },
];
```

**Cookie 数据工厂:**
```javascript
const createCookie = (overrides = {}) => ({
  name: 'session_id',
  value: 'abc123',
  domain: '.example.com',
  path: '/',
  ...overrides,
});
```

## 覆盖率

**目标:**
- 语句覆盖率：80%+
- 分支覆盖率：75%+
- 函数覆盖率：80%+

**查看覆盖率:**
```bash
npx vitest run --coverage
```

**关键覆盖区域:**
- `main.js`：所有 IPC 处理函数
- `renderer.js`：状态管理和 UI 更新函数
- `preload.js`：API 暴露（通常不需要单独测试）

## 测试类型

**单元测试:**
- 范围：单个函数或模块
- 工具：Vitest
- 重点：业务逻辑、数据转换、状态管理
- 示例：容器创建、ID 生成、配置读写

**集成测试:**
- 范围：多个模块协作
- 工具：Vitest + jsdom
- 重点：IPC 通信流程、容器生命周期
- 示例：创建容器后验证配置持久化

**E2E 测试:**
- 范围：完整用户流程
- 工具：Playwright（Electron 模式）
- 重点：用户交互、窗口操作
- 示例：创建容器 -> 切换容器 -> 验证隔离

## 常见测试场景

**容器管理:**
```javascript
describe('容器管理', () => {
  it('创建容器时应生成有效的 ID', () => {
    const name = '工作项目';
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    expect(id).toBe('------'); // 验证 ID 生成逻辑
  });

  it('不应允许删除默认容器', () => {
    const result = deleteContainer('default');
    expect(result.success).toBe(false);
  });

  it('删除容器后应清理 Session 数据', async () => {
    // ...
  });
});
```

**Cookie 管理:**
```javascript
describe('Cookie 管理', () => {
  it('获取容器 Cookie 应返回数组', async () => {
    const cookies = await getContainerCookies('work');
    expect(Array.isArray(cookies)).toBe(true);
  });

  it('容器不存在时应返回空数组', async () => {
    const cookies = await getContainerCookies('nonexistent');
    expect(cookies).toEqual([]);
  });
});
```

**IPC 通信:**
```javascript
describe('IPC 通信', () => {
  it('应正确注册所有 IPC 处理函数', () => {
    const channels = [
      'get-containers',
      'get-current-container',
      'switch-container',
      'create-container',
      'delete-container',
      'get-container-cookies',
      'set-container-cookie',
      'clear-container-cookies',
    ];
    channels.forEach(channel => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function)
      );
    });
  });
});
```

## 运行命令

**推荐配置（package.json）:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

*测试分析: 2026-07-23*
