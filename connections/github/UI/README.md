# connections/github/UI

GitHub 专属配置或操作面板，由 WEX 页面挂载。

**历史（2026-10-30）**：当时本子目录只有职责说明。当前 `connections/github/src/` 已有正式 GitHub SDK/MCP 基础连接器代码；但 `UI/src/workbench.tsx` 的 GitHub/Local 设置入口仍禁用。不能因为连接器存在就声称专属面板已交付，也不为本子目录预建空 UI。目录不等于运行时数据路径。

[源码目录与 Windows 数据要求](../../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 直接依赖

- [GitHub 连接器](../README.md)：业务能力和操作结果。
- [Connections 宿主](../../README.md)：受控派发入口。
- [UI 模块](../../../UI/README.md)：页面挂载与窗口交互。

本目录不重复维护连接器契约、历史研究或版本进度。
