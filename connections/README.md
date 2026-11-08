# connections｜公共连接配置、受控调用与 Operation

> 本页是公共连接层的施工入口。版本任务与验收以 [A2 0.1.1](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md) 为准；根 README 规定施工/文档维护分工。

## Owner 与边界

| Owner | 职责 | 当前状态 |
|---|---|---|
| `connections/src/` | 连接配置、受控 read/dispatch、Operation/attempt/Receipt、生命周期及公共调用契约 | 代码与测试已存在，完整跨模块组合未签收 |
| [API](api/README.md) | 模型连接、协议、请求和结果 | 两种协议路径与基础调用已存在，真实服务待核 |
| [GitHub](github/README.md) | 官方 MCP 能力适配、GitHub 文件兼容 | main 有文件级入口；完整通用工具调用尚不能标记为 main 已合入 |
| [Local](local/README.md) | 受控本机文件/目录及以后批准的 OS 执行适配 | 文件读写、版本绑定、编辑 UI 已有，Windows 实机待核 |
| `dsh/`、`search/` | 外部 Agent 与搜索候选 | 非 0.1.1 默认交付，不因目录存在宣称实现 |
| [environments](../environments/README.md) | 独立环境管理业务 owner | **不是连接器**，当前只有职责 README |

Permissions 决定授权，Shared 保管秘密和技术存储，App 提供可信 IPC/OS 入口，Space 维护 Context 关联，AI/Conversations 维护模型与对话逻辑。Connections 不代管上述业务状态，也不得被其他模块绕过而重复建立外部 Operation。

## 当前公开能力与进度

`connections/src/index.ts` 已导出 `createConnectionConfigs`、`createReadBoundary`、`createConfiguredReadBoundary`、`createDispatchBoundary`、`createConfiguredDispatchBoundary`、`createOperationLedger`、`createConnectionService` 及公开类型。配置修订、目标精确绑定、撤权复核、attempt 和 unknown 原操作回查应复用现有能力。

**当前 main 没有证实通用 discover/invoke**：核对时 `connections/src/capabilities.ts` 不存在，`src/index.ts` 也未导出通用能力接口。[PR #4](https://github.com/owla19s-ux/WEXPCeasy/pull/4) 提供相应独立实现及 Linux/Windows 验证；[PR #3](https://github.com/owla19s-ux/WEXPCeasy/pull/3) 提供桌面接线。必须先核对 PR 是否合入及当前 SHA，不能以 PR 测试绿灯代替 main 实现或签收。

## 施工规则与验收

- 先读根 README、本模块 README、目标子连接器 README、源码与测试。仅跨域接口冲突才追查其他模块。沿公开入口协作，不互相导入业务私库。
- 保留现有 read/dispatch 与配置/账本行为。若新官方工具不能由文件 target 表达，可最小增补通用 discover/invoke；必须验证 connection/tool/arguments 精确绑定、权限、结果保真、停止排空、取消和 unknown。
- 模型建议、发现工具或工具注解不能授予调用权限；外部调用结果失败、业务错误、取消和未知状态必须区分，不能自动重发可能发生副作用的操作。
- 验证层次：模块单测 → 公共 Connections 组合 → 真实适配器 → App IPC → UI/AI/Conversations/Space → Windows 实机。每层单独标注 commit SHA、运行结果及证据，不将跨域任务改造成单模块权威。

本 README 不维护历史研究批次或固定实施顺序；旧资料仅按需追溯。
