# UI/components

仅收实际跨页面复用的控件，不提前建设控件框架。

**历史（2026-10-30）**：当时该子目录只有职责说明。当前 React UI 的真实装配入口在 `UI/src/renderer.tsx`、`UI/src/workbench.tsx`，不能因 `UI/components/` 尚无独立组件实现就推断全域 UI 未实现，也不能为了填目录重复造控件框架。目录不等于独立运行模块。

[源码目录与 Windows 数据要求](../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **现行 UI 模块入口：** [UI/README.md](../README.md)；[UI/CONTRACT.md](../CONTRACT.md) 为历史交互研究
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [历史桌面应用基础能力审计](../../docs/A0-产品构想与研究/方案与研究/审查历史/APP-FOUNDATIONS-GAP-AUDIT-2026-10-31.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。
