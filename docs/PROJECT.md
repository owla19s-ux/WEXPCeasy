# WEX｜项目概要与架构入口

产品为 WEX，源码仓库为 WEXPCeasy；当前 Windows PC 优先，Android 原型暂停。WEX 是跨平台的联通、调度、交互、知识与生产管理系统。

完整定位、组织方式、地址与工具组合、AI、连接器、插件、工作流、多视图和长期方向统一见 [《维加项目总体说明》](维加项目总体说明.md)。本文不重复维护长篇产品说明，不承担派工或模块接口规范。

## 架构入口

- [Space / Context](../space/README.md)：组织引用与可独立存在的 Context。
- [AI / Roles](../AI/README.md)、[Conversations](../conversations/README.md)：配置、角色及独立会话。
- [Connections](../connections/README.md)：连接配置、受控调用和 Operation 回执。
- [Workflows](../workflows/README.md)、[Grid](../workflows/grid/README.md)、[Scheduler](../scheduler/README.md)、[Views](../views/README.md)：工作定义、视觉组织、执行协调及多视图分别维护。
- [Permissions](../permissions/README.md)、[Shared](../shared/README.md)、[App](../app/README.md)：授权、技术基础及可信装配。
- [插件体系边界](维加项目总体说明.md#七wex-自有插件机制与-dsh-原生插件兼容机制)：内置连接器、自有动态插件、原生兼容宿主与外部 Agent 分别判断。

## 范围与证据

完整需求见 [F01–F15 总表](product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md)，当前版本范围见 [0.1.1 计划](versions/0.1.1/PLAN.md)。自由格子工作流、正式调度器、DSH 原生插件机制产品化及 DSH 连接器闭环后置至 0.1.2。

模块 README 与实际源码、测试决定实现状态；已有基础 TypeScript 代码和隔离实验不等于完整 Windows 产品。文档、实验、单测、组合与 Windows 实机证据须分别核验。

施工从 [根 README](../README.md) 进入，按需资料由 [文档索引](README.md) 检索；权威和维护规则见 [文档治理规则](DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md)。
