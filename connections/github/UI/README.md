# connections/github/UI

GitHub 专属配置或操作面板，由 WEX 页面挂载。

**历史（2026-10-30）**：当时本子目录只有职责说明。当前 `connections/github/src/` 已有正式 GitHub SDK/MCP 基础连接器代码；但 `UI/src/workbench.tsx` 的 GitHub/Local 设置入口仍禁用。不能因为连接器存在就声称专属面板已交付，也不为本子目录预建空 UI。目录不等于运行时数据路径。

[源码目录与 Windows 数据要求](../../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **正式 owner 与历史研究**：[GitHub 模块入口](../README.md)、[Connections 模块入口](../../README.md)；[历史连接契约](../../../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/connections/CONTRACT-archive.md)
- **现行 UI 入口**：[UI/README.md](../../../UI/README.md)；[UI/CONTRACT.md](../../../UI/CONTRACT.md) 仅作历史研究
- **全局文档总索引：** [docs/README.md](../../../docs/README.md)
- [提供方边界 Walkthrough](../../../docs/A0-产品构想与研究/方案与研究/架构研究历史/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。
