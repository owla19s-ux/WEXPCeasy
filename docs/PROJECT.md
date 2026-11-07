# WEX｜项目概要与架构入口

产品名称为 WEX，当前工程仓库为 WEXPCeasy；现阶段优先 Windows PC，Android 原型暂停。WEX 的目标是提供可组合的工作空间、AI、连接能力与受控工作执行宿主。

## 正式产品与版本权威

- [维加项目总体说明](维加项目总体说明.md)：产品方向、组织机制、地址、工具、AI、连接器、插件及多视图的完整说明；未定事项不因被记载而自动批准。
- [A1｜正式产品设计](A1-正式产品设计/README.md)：F01–F15 产品功能总表、功能归属、已确认权限政策与正式 PC UI 设计。
- [A2｜版本与工程状态](A2-版本与工程状态/README.md)：当前 0.1.1 的批准范围、功能实现/验证状态、阻塞和历史任务证据。以[功能与工程状态总表](A2-版本与工程状态/0.1.1/功能与工程状态总表.md)为唯一版本状态入口。
- [A0｜产品构想与研究](A0-产品构想与研究/README.md)：想法、候选方案、技术验证和历史参考，不直接构成正式施工授权。

## 模块与源码入口

- [Space / Context](../space/README.md)：组织、稳定身份与引用关系。
- [AI / Roles](../AI/README.md)、[Conversations](../conversations/README.md)：模型/角色编排与会话。
- [Connections](../connections/README.md)：公共连接配置和 Operation；具体 API、GitHub、Local 各自维护独立连接器。
- [Environments](../environments/README.md)：独立环境管理 owner，并非 Local 连接器。
- [Workflows](../workflows/README.md)、[Scheduler](../scheduler/README.md)、[Views](../views/README.md)、[UI](../UI/README.md)：任务工作流、调度、视图引擎和桌面交互分域管理。
- [Permissions](../permissions/README.md)、[Shared](../shared/README.md)、[App](../app/README.md)：权限、共享技术基础及可信桌面宿主。

## 范围与证据

0.1.1 以 A2 状态表为准。自由格子工作流、正式调度器、DSH 插件系统及 DSH 连接器的产品化后置至 0.1.2；历史实验或研究条款不自动扩充当前版本。模块 README/CONTRACT、真实源码及测试是核对实现的入口，但设计、文件存在、单测、跨模块集成和 Windows 实机验收是不同证据层级。

施工从[根 README](../README.md)进入，遵循[文档权威与维护规则](DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md)；[docs 总索引](README.md)仅供按需检索。旧 `docs/product/`、`docs/versions/` 与研究路径可能是兼容跳转，不能作为与 A1/A2 并列的现行正文。
