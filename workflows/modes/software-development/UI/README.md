# workflows/modes/software-development/UI

软件开发模式专属视图，例如需求树、架构映射和施工进度。引用同一批工作数据，不保存第二套任务状态。

**历史（2026-10-30）**：当时该子目录只有职责说明。当前仅作为软件开发模式未来专属 UI 的职责预留，不是已经交付的页面；不因主 UI 已有工作窗口就将软件开发专业视图判为实现，也不在 0.1.1 额外派工。目录不等于运行时业务模块。

[源码目录与 Windows 数据要求](../../../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **现行模式入口：** [workflows/modes/README.md](../../README.md)；[历史模式 CONTRACT](../../CONTRACT.md) 不直接派工
- **现行 UI 入口：** [UI/README.md](../../../../UI/README.md)；[历史 UI CONTRACT](../../../../UI/CONTRACT.md) 不冻结现行 IPC
- **Views 模块入口：** [views/README.md](../../../../views/README.md)；[历史 Views CONTRACT](../../../../views/CONTRACT.md) 不等于专业视图引擎已实现
- **全局文档总索引：** [docs/README.md](../../../../docs/README.md)
- [历史产品功能全景](../../../../docs/A0-产品构想与研究/方案与研究/既有研究/PRODUCT-FUNCTION-LANDSCAPE-2026-10-31.md)
- [历史视图与证据链审计](../../../../docs/A0-产品构想与研究/方案与研究/审查历史/VIEWS-AND-EVIDENCE-AUDIT-2026-10-31.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。
