# UI/settings

配置页面和设置入口。加载连接器等模块的专属配置面板，不复制面板实现。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **上级契约：** [UI/CONTRACT.md](../../UI/CONTRACT.md)
- **上级契约：** [permissions/CONTRACT.md](../../docs/research/contracts/permissions/CONTRACT-archive.md)
- **上级契约：** [shared/CONTRACT.md](../../docs/research/contracts/shared/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [源码目录与 Windows 数据布局](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)
- [安全与数据持续性](../../docs/research/SECURITY-AND-PERSISTENCE-2026-10-31.md)

本目录负责页面/面板局部组织，不拥有领域业务状态、权限或验收事实；业务语义以对应 owner 契约为准。

## G6：模块配置、凭证与诊断入口

设置页挂载各模块自己的配置面板，不接管配置字段或建立全局配置中心。凭证配置只通过受信任宿主入口操作，不回显秘密；日志/诊断导出必须由各 owner 提供获准且脱敏的内容。普通运行日志、Connections Operation、Permissions 授权审计和 Workflows 任务/验收证据分开呈现，不能用一个日志列表替代权威记录。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
