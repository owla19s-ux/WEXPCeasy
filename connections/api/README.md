# connections/api

## API 连接器与其他 owner（2026-11-07）

本模块是独立 Provider/Model 协议 owner；公共配置与外部操作事实通过 `connections/src/index.ts` 公开机制衔接，模型调用的逻辑生成与历史归 Conversations，角色/职责归 AI。**模型产生的工具意图不是授权或成功执行**，不得调用 GitHub/Local 私有实现。API Provider 所需 Node/Python/代理等工具环境如涉及用户环境登记/安装，须分别由 [environments](../../environments/README.md) 与 Local 提供受控能力；API 不成为安装管理器。此前按历史 B1 任务描述的 AI/Conversations 未实现状态不再是当前源码事实。

> **2026-11-06 最新代码状态（main `c7f1c827`，非完整模块验收）**：已有产品公开入口 `connections/api/src/index.ts`，并有 `service.ts`、`model.ts`、`identity.ts`、`transport.ts`、`stream.ts`、`response.ts`、`tools.ts`、`continuation.ts`、`usage.ts`、`json.ts`、`terminal.ts` 等实际实现；`connections/api/tests/` 存在独立测试，`app/tests/api.test.mjs` 存在真实宿主组合验证。已纳入 `npm run test:api` 与根 `npm test`。最新 SHA 的 Foundation verification 为 success。原 2026-11-03/04 “无产品代码”描述只属于历史快照，不能用于重复施工。
>
> **当前目标：B1-03 API 0.1.1 范围收口**。核对现有 Provider / Connection / Model / 非秘密参数与凭证引用、模型观察、请求准备与发送、非流式与 SSE、取消/超时/失败诊断、工具提议与受控续接、配置和操作持久化及重启恢复。按实际测试逐项分类为“已有证据/缺口/未获确认/延期”，先修本版必要缺口，不把持续增加高级 Provider 能力当作 B1 完成门槛。
>
> **责任边界**：本域只做 Provider/Model 协议与请求，不执行模型生成的工具提议；真实副作用走 Connections 受控边界，角色归 AI、消息/逻辑生成归 Conversations，权限归 Permissions，秘密值不能直接进入非秘密配置。Pi AI 兼容实验不等于整体无退化替换授权；不得为赶进度擅换产品协议实现。
>
> **下一阶段交接**：B1-03 给出公开端口、已验证能力、剩余缺口及完整测试命令/结果，由验收模式更新状态；B1 还须完成 AI、Conversations、基础 Connections 与 Data/Logs，之后才能进入 B2 完整业务闭环。源码事实始终以开工时最新 main 为准。
## 2026-10-30 目录职责补充

首版原生 API 客户端：多 Provider 与模型连接、请求及流式结果。厂商协议、鉴权和解析就近放入按需创建的 providers/ 适配器；能力由可信宿主装配并接入 connections 受控边界，凭证与权限由 WEX 统一管理。独立于 DSH，不把模型工具意图直接视作已执行事实。

## 架构责任补充

本域拥有 Provider 请求/流式解析与连接配置，宿主连接边界保存真实调用尝试及回执；`conversations` 维护消息/逻辑生成，任务调度维护工作进展。模型输出的工具意图只能作为下一次受控请求，不能直接执行。API Key 的秘密值归 `shared/credentials`，使用权限归 `permissions`；换 Provider 不改变任务范围。连接器不要求 Cordis 或 WEX 动态插件加载器。

## 直接依赖与施工入口

- [Connections 宿主](../README.md)：公共配置、派发、Operation 与回执归属。
- [本模块历史适配器 CONTRACT](CONTRACT.md)：仅在核对历史协议差异时阅读，不作为当前独立实施权威。

本子模块不承担 A0/A1/A2 总索引；实现及测试以本 README、源码和公开端口为准。

## G2/G6：Provider 请求与工具意图

API 适配器负责 Provider/Model 配置、鉴权适配、请求和流式解析；工具意图只作为结构化提议返回给 Conversations，不在本目录直接执行。Conversations 组织逻辑生成，Permissions 判权，Connections 宿主边界记录 Operation 并派发实际工具。Provider 配置保存非秘密参数和受控凭证引用；Key 由 shared/credentials 保管。新会话/新模型不得继承旧 Operation 或旧授权。

## 独立研究与兼容证据

[历史复用与 Pi AI 验证](../../docs/A0-产品构想与研究/方案与研究/既有研究/api/README.md)及[隔离实验](../../experiments/pi-ai-compat/README.md)：未修改本域正式契约，未替换产品实现。整体无退化替换未通过，具体可复用能力与缺口以报告为准。
