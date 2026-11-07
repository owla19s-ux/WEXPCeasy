# connections/github/UI

GitHub 专属配置或操作面板，由 WEX 页面挂载。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **上级契约：** [connections/CONTRACT.md](../../../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/connections/CONTRACT-archive.md)
- **上级契约：** [UI/CONTRACT.md](../../../UI/CONTRACT.md)
- **全局文档总索引：** [docs/README.md](../../../docs/README.md)
- [提供方边界 Walkthrough](../../../docs/A0-产品构想与研究/方案与研究/架构研究历史/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。
