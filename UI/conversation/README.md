# UI/conversation

对话页面。页面自身的弹窗、按钮和局部交互就近维护，简单时放一个页面文件；业务调用 conversations。

> **2026-11-07 状态校正**：该子目录目前仍只有职责说明、尚无正式对话页面产品源码；但 **`conversations/src/` 与 `conversations/tests/` 已有领域代码和测试**。不得把“此 UI 子目录未实现”理解成整个 Conversations 模块没有产品实现。本版正式页面仍需按 B3 D-05 接线和验收，不能把领域测试等同可用对话 UI。

这是 UI 页面职责预留位置，不是运行时数据路径、独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **现行 UI 入口：** [UI/README.md](../../UI/README.md)
- **上级契约：** [conversations/CONTRACT.md](../../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/conversations/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [全局契约地图](../../docs/A0-产品构想与研究/方案与研究/架构研究历史/GLOBAL-CONTRACT-MAP-V0.1.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。

## G7：输入与附件交互

页面负责文本输入、系统文件选择、拖入/粘贴、附件预览/移除及来源/可用性提示。附件可作为本轮临时输入，也可由用户明确选择关联原文件或导入持久资料；三者不能默认等同。实际读取通过 App/Connections 窄能力，Renderer 不直接访问 Node、任意文件路径、数据库或凭证。生成派发后输入快照不可被后续编辑改写。

见[基础能力落地映射](../../docs/A0-产品构想与研究/历史参考/旧工程规划/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
