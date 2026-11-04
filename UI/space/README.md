# UI/space

Space／Context 页面。展示组织与关联，业务调用 space，不把 Context 做成固定软件项目。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **上级契约：** [UI/CONTRACT.md](../../UI/CONTRACT.md)
- **上级契约：** [space/CONTRACT.md](../../space/README.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [Space 与工作流编辑器设计](../../docs/architecture/SPACE-AND-WORKFLOW-EDITOR-DESIGN-2026-10-30.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。

## G1：Context 资料关联

页面需区分关联外部文件/目录、导入持久副本、会话临时附件和 Task 工作产物。关联原文件不复制；导入副本必须由用户明确触发并显示来源；移除 Context 关联不删除源文件、不撤权、不停止 Task。显示的资源路径/名称不能作为稳定身份，失联和版本变化需明确提示。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
