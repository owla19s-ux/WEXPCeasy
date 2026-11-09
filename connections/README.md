# connections｜公共连接配置、受控调用与 Operation

> 本页是公共连接层的施工入口。版本任务与验收以 [A2 0.1.1](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md) 为准；根 README 规定施工/文档维护分工。

## Owner 与边界

| Owner | 职责 | 当前状态 |
|---|---|---|
| `connections/src/` | 连接配置、受控 read/dispatch/discover/invoke、Operation/attempt/Receipt、生命周期及公共调用契约 | 代码与测试已存在，完整跨模块组合未签收 |
| [API](api/README.md) | 模型连接、协议、请求和结果 | 两种协议路径与基础调用已存在，真实服务待核 |
| [GitHub](github/README.md) | 官方 MCP 能力适配、GitHub 文件兼容 | 已有文件兼容与通用 MCP Adapter；产品完整验收仍待完成 |
| [Local](local/README.md) | 受控本机文件/目录及以后批准的 OS 执行适配 | 文件读写、版本绑定、编辑 UI 已有，Windows 实机待核 |
| `dsh/`、`search/` | 外部 Agent 与搜索候选 | 非 0.1.1 默认交付，不因目录存在宣称实现 |
| [environments](../environments/README.md) | 独立环境管理业务 owner | **不是连接器**，当前只有职责 README |

Permissions 决定授权，Shared 保管秘密和技术存储，App 提供可信 IPC/OS 入口，Space 维护 Context 关联，AI/Conversations 维护模型与对话逻辑。Connections 不代管上述业务状态，也不得被其他模块绕过而重复建立外部 Operation。

## 当前公开能力与进度

`connections/src/index.ts` 已导出 `createConnectionConfigs`、`createReadBoundary`、`createConfiguredReadBoundary`、`createDispatchBoundary`、`createConfiguredDispatchBoundary`、`createOperationLedger`、`createConnectionService` 及公开类型。配置修订、目标精确绑定、撤权复核、attempt 和 unknown 原操作回查应复用现有能力。

通用能力已存在：`capabilities.ts` 定义 `ConfiguredCapabilityAdapter`、`capabilityDiscoveryTarget`、`capabilityInvocationTarget` 与 `captureCapabilityArguments`；`ConnectionService.discover/invoke` 复用原配置、受控读取/派发及 Operation 账本。`ConnectionClient` 保留旧形状，`ConnectionCapabilityClient` 为增量端口。发现用 read 授权，任意工具执行用精确参数绑定的 write 授权；`isError` 保留为工具结果，observed 不等于业务成功。

历史 PR #4 的底座已由源码逐文件确认吸收；PR #3 的另一套公共目标与 Session Manager 不引入。App 以当前公开端口装配 GitHub 能力，DesktopBridge 提供经 Native 确认的手动目录与调用。运行时必须由可信宿主提供；默认桌面分发尚未自动装配官方二进制。

## 施工规则与验收

操作验收区分工具发现、精确参数与动作授权、实际派发、attempt、原 Operation 读取、unknown 和停止排空；UI 读取回执不建立第二份账本。工具列表可见、`isError`、observed 与远端业务成功必须分别表述。


- 先读根 README、本模块 README、目标子连接器 README、源码与测试。仅跨域接口冲突才追查其他模块。沿公开入口协作，不互相导入业务私库。
- 保留现有 read/dispatch 与配置/账本行为。若新官方工具不能由文件 target 表达，可最小增补通用 discover/invoke；必须验证 connection/tool/arguments 精确绑定、权限、结果保真、停止排空、取消和 unknown。
- 模型建议、发现工具或工具注解不能授予调用权限；外部调用结果失败、业务错误、取消和未知状态必须区分，不能自动重发可能发生副作用的操作。
- 验证层次：模块单测 → 公共 Connections 组合 → 真实适配器 → App IPC → UI/AI/Conversations/Space → Windows 实机。每层单独标注 commit SHA、运行结果及证据，不将跨域任务改造成单模块权威。

本 README 不维护历史研究批次或固定实施顺序；旧资料仅按需追溯。
