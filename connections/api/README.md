# connections/api

API 配置与模型协议适配。AI 配置引用连接，不复制密钥；不将工具意图直接当作已执行事实。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 2026-10-30 目录职责补充

首版原生 API 客户端：多 Provider 与模型连接、请求及流式结果。厂商协议、鉴权和解析就近放入按需创建的 providers/ 适配器；能力由可信宿主装配并接入 connections 受控边界，凭证与权限由 WEX 统一管理。独立于 DSH，不把模型工具意图直接视作已执行事实。

## 架构责任补充

本域拥有 Provider 请求/流式解析与连接配置，宿主连接边界保存真实调用尝试及回执；`conversations` 维护消息/逻辑生成，任务调度维护工作进展。模型输出的工具意图只能作为下一次受控请求，不能直接执行。API Key 的秘密值归 `shared/credentials`，使用权限归 `permissions`；换 Provider 不改变任务范围。连接器不要求 Cordis 或 WEX 动态插件加载器。


## 上级契约与文档入口

- **上级业务/职责契约：** [connections/CONTRACT.md](../../connections/CONTRACT.md)
- **适配器子契约：** [Provider适配器子契约](CONTRACT.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [提供方边界 Walkthrough](../../docs/architecture/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)
- [外部 Agent 生态与 Provider 观察](../../docs/research/AGENT-ECOSYSTEM-2026-10-31.md)

本子目录只细化上级模块内部的职责或实现入口，不另建第二份业务权威。若本页与上级契约冲突，以对应 owner 契约为准；实验结论只按原记录的环境和范围解释。

## G2/G6：Provider 请求与工具意图

API 适配器负责 Provider/Model 配置、鉴权适配、请求和流式解析；工具意图只作为结构化提议返回给 Conversations，不在本目录直接执行。Conversations 组织逻辑生成，Permissions 判权，Connections 宿主边界记录 Operation 并派发实际工具。Provider 配置保存非秘密参数和受控凭证引用；Key 由 shared/credentials 保管。新会话/新模型不得继承旧 Operation 或旧授权。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
