# DSH 源码研究参考

- 状态：研究资料 / 非 WEXPC1 设计决策
- 建立日期：2026-10-28
- 研究对象：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- 目的：从实际源码提取模块化、插件扩展、协议、生命周期与 AI 施工约束方面的可借鉴机制。
- 边界：本文档夹仅用于研究和对照，**不自动并入 WEXPC1 当前设计，不代表采纳 DSH 的技术栈或架构**。所有结论都需结合 WEX 的目标、运行时要求与试点证据再决定。

## 文档导航

1. [能力接缝、注册与依赖注入](01-capability-seams-and-registration.md)
2. [协议设计与适配器边界](02-protocols-and-adapters.md)
3. [插件清单、加载与生命周期](03-manifest-loading-lifecycle.md)
4. [AI 施工约束与可验证模块边界](04-ai-construction-and-verification.md)
5. [组合架构与模块边界](05-composition-and-package-boundaries.md)
6. [工程规则如何转化为施工卡](06-engineering-rules-and-task-cards.md)
7. [插件管理、热更新与运行时边界](07-plugin-management-and-runtime-boundaries.md)
8. [需求驱动的架构反向压测](08-requirement-driven-architecture-stress-tests.md)
9. [作用域工具解析与权限边界](09-scoped-tool-resolution-and-policy.md)

## 当前源码入口

| 主题 | DSH 路径 | 参考价值 |
|---|---|---|
| 能力接缝 | [docs/capability-seams.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md) | 服务定义、提供者、消费者之间的边界 |
| LLM 公共服务与类型 | [index.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)、[types.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm/src/types.ts) | 公共协议、注册表、流式调用与错误语义 |
| DeepSeek 适配器 | [adapter.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/adapter.ts) | 真实传输、取消、超时、协议转换 |
| 工具注册与执行 | [tools README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/README.md) | 工具注册、策略拦截、执行与结果处理 |
| 包清单 | [manifest README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/package-manifest/README.md) | 包身份与声明字段；同时展示声明不等于运行时强制执行的限制 |
| Scope 生命周期 | [scope README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/scope/README.md) | 注册可见性、所有权和释放 |
| 客户端模块加载 | [client modules README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/modules/README.md) | 前端模块清单、按需加载、图更新与失效限制 |
| LLM 适配器开发指南 | [adding-an-llm-adapter.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md) | 协议义务、错误、取消、流式终态和验证 |
| 扩展开发指南 | [extension-cookbook.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md) | 功能应挂接到哪个扩展点，而非修改中央循环 |
| 架构与组合 | [architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[packages/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md) | 插件树、profile/bundle/package 的职责边界 |
| 新增包施工清单 | [adding-a-package.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md) | 新模块所需文件、依赖、导出、构建引用与验证 |
| AI 工程规则 | [AGENTS.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/AGENTS.md)、[docs/AGENTS.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/AGENTS.md) | 工程知识分层与规则权威位置 |
| 机器校验 | [verify-cordis-config.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/scripts/verify-cordis-config.ts)、[run-gates.ts](https://github.com/deepseek-ai/deepseek-harness/blob/master/scripts/run-gates.ts) | 把依赖、配置与验证要求变成自动检查 |
| 插件管理与热更新 | [plugin-manager README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)、[app-boot README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md) | 区分安装、配置应用、加载成功与实际激活状态 |
| 需求反向压测 | [需求驱动架构审查](08-requirement-driven-architecture-stress-tests.md) | 用角色、API、任务与权限场景验证底层抽象是否真正满足产品需求 |

## 初步结论

- DSH 的关键价值不只是“能装插件”，而是把能力定义、提供者注册、消费者调用和生命周期清理分离。
- 公共协议统一语义，具体适配器承担厂商协议转换；上层循环不应堆积厂商特判。
- 注册、作用域和生命周期可以帮助模块解耦，但 DSH 的同进程插件 Scope **不是安全沙箱**。
- 客户端的动态加载能力不等于后端任意原生代码都能无重启热加载。必须分别研究后端执行环境与前端贡献机制。
- 包清单是声明数据；必须核对实际 Loader 是否执行兼容性、完整性和权限检查，不能把字段存在误当成安全保证。

## 研究纪律

每条研究结论需区分：
- **源码事实**：由具体实现或当前文档直接支持。
- **架构推论**：从源码行为推导出的设计含义。
- **WEX 候选**：可能适用，但尚未验证。
- **不采纳／限制**：不符合 WEX 目标或存在明确风险。

本文档夹不冻结 WEX 的语言、ABI、目录、包格式、协议或运行时方案。
- [10：批量工具执行与子 Agent 生命周期](10-tool-batch-and-subagent-lifecycle.md)

- [11：跨领域可借鉴机制](11-cross-domain-reference-value.md)

- [12：插件 HMR 与热插拔机制](12-hmr-hot-plug-runtime.md)

- [13：凭证、配置、压缩与 Workflow](13-credentials-settings-compaction-workflow.md)

- [14：Session 重放、只读投影与 UI 插槽](14-session-projection-ui-extension.md)

- [15：持久化、远程边界与研究总审](15-persistence-remote-boundaries-and-final-audit.md)


## 2026-10-30 补充：DSH 前后端插件体系的可复用边界

背景：WEXPC1 正评估 TypeScript 单主语言、Electron 桌面宿主、Cordis 插件体系及 React Flow。旧 Rust/Tauri 路线和运行时扩展候选属于历史研究，不因本节自动删除或改变正式版本。

### DSH 源码事实与关键入口

| 机制 | 源码/说明 | WEX 候选用途 | 限制 |
|---|---|---|---|
| Cordis `Context` / `Fiber` / `inject` | [vendored Cordis](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/cordis/README.md) | 服务注册、依赖、可逆注册与卸载 | 并非 OS 沙箱；直接复用须核对具体版本/许可 |
| Profile / Bundle / patch | [architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) | 通过配置组合连接器、Agent、工具 | DSH 特定包与 profile，不可直接当 WEX 产品目录 |
| Client Modules | [modules README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/modules/README.md) | 跟随宿主模块图增删、动态资源与样式卸载 | 浏览器实现，Electron 打包后的资源交付与 CSP 需适配 |
| UI Slots / Renderer | [client README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md) | 功能自带面板、统一插槽挂载 | 需要 WEX 定义自己的页面插槽而非直接使用 DSH 页面 |
| UI 插件管理器 | [ui-plugin-manager README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/README.md) | 插件列表、启停、按包/实例设置面板 | DSH `pluginManager` 和 profile patch 是特有依赖 |
| Host/Client 业务通信 | [web client architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/web-client.md) | 类型化 Host API，客户端查询与操作 | Electron main/preload/renderer 仍需设计最小桥接边界 |

DSH `ui-plugin-manager` 的实证插槽：`plugins.item`、`plugins.bundle.config`、`plugins.row.config`；插件注册配置面板而不是修改设置页。DSH `Client Modules` 随宿主插件图装卸模块，停用时等待清理异步 effects，释放不再使用的资源和样式。其 HMR 替换存在 React 局部状态丢失及失败不自动回滚的限制，WEX 的表单草稿应独立于被替换组件保存。

### 复用决定与边界（建议，不是工程完成）

1. **优先直接依赖 Cordis 的稳定公共包**，而非复制 DSH 所有源码；先核对本仓 vendored Cordis 与公开 npm 版本的差异。
2. WEX 特有的 Space、Context、任务、执行回执、权限仍由 WEX 拥有；Cordis 负责插件生命周期和服务组织，不自动成为 WEX 的业务数据库或权限系统。
3. **UI Slots/Client Modules 是强参考、候选复用实现**，尚不能等同于可独立 npm 安装的稳定库。先核查模块入口和 DSH 私有依赖，再评估移植量；WEX 只添加所需 UI 插槽，不复制 DSH 整套 Web 页面。
4. DSH 插件的兼容分两层：纯 Cordis 公共服务插件较容易复用；依赖 DSH 专属 `ctx.tools`、`ctx.sessions`、`ctx.llm` 或浏览器 client 的插件需适配。**不承诺所有 DSH 插件直接安装可用**。
5. Electron 只负责 Windows 桌面宿主入口、窗口和受限 IPC；插件有副作用时仍由 WEX 按真实授权和操作状态执行。内部可信插件与外部第三方不可信代码必须区分信任与安全隔离。
6. 每项复用先分 `已有组件直接调用 / 需要少量适配 / 依赖 DSH 整体不能直接搬用` 三类，不得把参考机制再规划成平行自研系统。

### 对 WEXPC1 功能目录的影响

- `connections/`：Cordis 插件注册 + 服务/能力描述 + 模块自带设置 UI。
- `UI/`：定义 WEX 页面与 Slots 的位置，不在中心页面写每个连接器的配置细节。
- `workflows/`：React Flow 工作流编辑与任务调度；可通过插件发现工具，但任务记录独立持久化。
- `shared/`：统一权限、凭证引用、可靠数据保存等，不随插件卸载而丢失。
- `app/`：Electron 启动、插件装配、主窗口、进程 IPC；不承担具体连接器实现。

**研究状态**：本节为上游官方文档与既有代码组织的研究核对，未执行 WEX 在 Electron 上动态加载/卸载 DSH 插件的实测，未触发 Actions，未变更产品代码及正式版本范围。


## 插件机制原始文件

[2026-10-30 原始快照、许可证、逐层适配审查](source-snapshot/README.md)。快照是只读研究资产，不是已接入插件引擎。
