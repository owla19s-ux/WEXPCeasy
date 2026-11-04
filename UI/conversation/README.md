# UI/conversation

对话页面。页面自身的弹窗、按钮和局部交互就近维护，简单时放一个页面文件；业务调用 conversations。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **上级契约：** [UI/CONTRACT.md](../../UI/CONTRACT.md)
- **上级契约：** [conversations/CONTRACT.md](../../docs/research/contracts/conversations/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [全局契约地图](../../docs/architecture/GLOBAL-CONTRACT-MAP-V0.1.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。

## G7：输入与附件交互

页面负责文本输入、系统文件选择、拖入/粘贴、附件预览/移除及来源/可用性提示。附件可作为本轮临时输入，也可由用户明确选择关联原文件或导入持久资料；三者不能默认等同。实际读取通过 App/Connections 窄能力，Renderer 不直接访问 Node、任意文件路径、数据库或凭证。生成派发后输入快照不可被后续编辑改写。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
