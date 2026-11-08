# connections/api — 模型 API 连接与协议适配

> 维护 Owner：`connections/api`。Windows PC 优先。当前产品基线：OpenAI Chat Completions 兼容协议；长期完整需求不限定于此。
>
> 施工默认阅读：仓库根 README → 本 README → [正式 CONTRACT](CONTRACT.md) → 对应源码/测试。只有遇到需求、版本或历史争议时才定向参考 A1/A2/A0。

## 1. 定位和边界

API 是可独立完成单次模型调用的连接器，管理非秘密 Provider/Connection/Model 配置、能力及参数观察、请求准备和真实协议适配，接收模型响应、流式片段、工具提议及用量结果。

- **本模块负责**：Provider/Protocol 适配、模型目录/探测、连接配置、请求构造、发送和解码、工具格式、分级错误/超时、用量观察。
- **公共 Connections 负责**：受控操作边界及 Operation/attempt/回执；不能在 API 内另建权威操作账本。
- **Permissions / Credentials 负责**：授权/撤权与安全密钥存储；API 不持久化明文 Key。
- **Conversations / AI 负责**：生成轮次和消息历史 / Agent、角色与模型偏好；API 不内置完整聊天数据库或任务路由策略。
- **App / UI、Space、Environments / Local**：可信交互入口、Context 引用及本地运行环境/操作；API 不管理安装器、驱动或工具执行。
- 模型产生的工具调用只是结构化**提议**，不等于获授权或已执行 GitHub/Local。

## 2. 完整功能和实际状态

需求来源：[A1 F04-001～013](../../docs/A1-正式产品设计/产品功能总表.md)；功能行为、状态分类和验收约束见 [正式契约](CONTRACT.md)。**本表是源码与测试静态审查，不是最新 SHA 的 CI/实机签收。**

| 功能 | 目标摘要 | 当前判定 | 关键缺口 |
|---|---|---|---|
| API-01 Provider 配置 | 多连接、协议/URL、CRUD/复制/引用保护 | 配置 CRUD、两种协议 ID 与桌面连接协议选择已接线、待最新 SHA 运行验收 | 完整 UI 操作与真实厂商验收 |
| API-02 模型能力目录 | 登记/刷新/探针、能力与限制 | 部分实现 | 多模态方向、来源/目录交互 |
| API-03 凭证与诊断 | 安全 Key、轮换、分级真实测试 | 部分实现 | 多账户/真实厂商验收 |
| API-04 请求与流式 | 非流式/SSE/取消/终态/错误 | Chat 已实现；Anthropic Messages 文本路径已接线、待本 SHA 验收 | 多模态、推理、完整真实厂商验收 |
| API-05 工具调用 | Schema/提议/续接 | 部分实现 | 跨协议及真实受控工具轮次 |
| API-06 用量与成本 | token/缓存/推理、费用及来源 | 部分实现 | 价格、估算与用户展示 |
| API-07 本地 Provider | 本地服务兼容端点 | 部分实现 | 运行时诊断；远期完善 |
| API-08 模型选择与路由 | 显式模型、能力/候选匹配 | 部分实现 | 策略与调用方集成 |
| API-09 超时与重试 | 分级超时/分类/安全新 attempt | 部分实现 | 有依据的重试策略 |
| API-10 故障切换 | 后备模型、授权、兼容性和来源 | 未完整实现 | 自动策略尚待批准 |

0.1.1 的实施边界与实际验收统一见 [A2 当前功能与工程状态总表](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)，**不因本表列有长期目标就把全部原生协议、自动路由和故障切换直接纳入当前版本**。

## 3. 当前公开入口与源码

公开接口：`src/index.ts` 导出 `createApiService`、`createApiTransport`、`decodeChatStream`、`decodeChatResponse` 及其类型。新增能力优先保持这些既有调用方兼容。

| 源码 | 当前职责 | 审查/施工关注 |
|---|---|---|
| `src/service.ts` | 配置写读、权限复核、模型观察、请求准备 | 保留统一服务入口；内部定向拆职责 |
| `src/model.ts` | 领域类型、参数/能力规则、状态解码与兼容校验入口 | 后续只按真实职责和数据迁移证据拆分 |
| `src/endpoint-policy.ts` | 端点 URL / 本地回环 HTTP / Base 与 Request 模式校验 | 纯规则，保持既有 `endpoint()` 公开调用语义 |
| `src/config-mutations.ts` | Connection / Model 的纯内存配置变更 | 权限、删除租约和两阶段存储提交仍归 Service |
| `src/preparation-parameters.ts` | 参数来源合并、能力规格校验 | 未冻结来源优先级，冲突仍显式拒绝 |
| `src/observation-reconciliation.ts` | 探针结果与既有能力证据合并 | 防止文本/流探测清空已验证能力 |
| `src/transport.ts` | HTTP 派发、凭证、诊断/探针、取消与接收 | 保留公开发送入口和受控 Operation |
| `src/protocols/index.ts` | 显式协议 ID 注册与选择 | 当前注册 `openai-chat` 和 `anthropic-messages`；按能力拒绝未实现的目录/探针 |
| `src/protocols/openai-chat.ts` | Chat 路由、探针、目录解码、响应格式与身份 | 旧实现兼容、仍需回归 |
| `src/protocols/anthropic-messages.ts` | Anthropic 原生文本请求、Header、目录列表、文本探针、非流及增量 SSE 解码 | 目录分页未完成；工具、思考/多模态未开放；不推断完整 Provider 支持 |
| `src/network-diagnostics.ts` | HTTP 状态、网络错误及响应头安全摘要 | 通用传输诊断，不管理 Provider 协议 |
| `src/stream.ts` / `response.ts` | OpenAI Chat SSE / JSON 解码 | 保留成熟实现，不误标为通用 Provider |
| `src/tools.ts` / `continuation.ts` | Schema、工具片段/续接 | 保留既有防重复/来源校验 |
| `src/usage.ts` | Provider Token/缓存/推理用量 | 成本来源仍待补充 |
| `src/json.ts` / `identity.ts` / `terminal.ts` | 公用解析、身份、终态辅助 | 仅在实际需要时改动 |

不机械创建 `config/`、`protocols/`、`transport/` 等空目录。先按函数职责与独立测试确定最小提取范围。旧兼容实现只有在调用方迁移、回归验证和持久化恢复成立后才可删除。

## 4. 直接依赖与测试入口

- 上级：[Connections](../README.md) 公共 Operation/受控调用；由可信宿主注入 Permissions、Credentials 与数据 Store。
- 真实宿主装配：`app/tests/api.test.mjs`；业务使用者：AI、Conversations、App/desktop UI，均只通过公开能力接线。
- 模块测试：`connections/api/tests/config.test.mjs`、`config-mutations.test.mjs`、`preparation.test.mjs`、`preparation-parameters.test.mjs`、`observation-reconciliation.test.mjs`、`endpoint-policy.test.mjs`、`protocol.test.mjs`、`protocol-registry.test.mjs`、`anthropic-messages.test.mjs`、`anthropic-transport.test.mjs`、`anthropic-probe-adoption.test.mjs`、`network-diagnostics.test.mjs`、`transport.test.mjs`、`tools.test.mjs`，及目录下其他测试。
- 常用命令：`npm run test:api`、`npm run typecheck`、`npm test`、`npm run check:boundaries`；先确认当前 `package.json`，本次未执行这些命令。
- CI 检查先查看 [Actions 全运行列表](https://github.com/owla19s-ux/WEXPCeasy/actions/runs)，核对实际提交 SHA、对应测试及日志；不能用以前 SHA 的绿灯签收新实现。

## 5. 当前优先级：先稳固 API 底座，再扩大协议覆盖

**P0 底座收口（当前施工主线）**

1. 对最新 main SHA 逐项核对 Foundation、B1/B2/B3、Windows 安装与真实 Electron 操作；失败先定位根因并修复，不重复触发已在运行的 Actions。特别注意 UI 字段变更引发的验收脚本漂移。
2. 稳固 Connection / Model / Protocol 配置、修订与复制、引用保护删除、旧配置恢复；明确 Provider 身份与协议选择互不绑定，保留稳定公开端口。
3. 贯通连接地址、凭证绑定/轮换/撤销、权限复核、请求快照、Operation 与回执、取消、超时、断线及 unknown/blocked 分类；避免另一套权限或操作账本。
4. 完善模型目录/能力观察/参数规格与来源冲突、显式零值/默认/禁用、工具提议和结果、流式/非流式终态、usage 来源；基于真实回归证据补足边界，不以大量新抽象代替测试。
5. 完成 API 模块、真实本地 HTTP、App/AI/Conversations/桌面 UI 端到端与恢复回归；将测试装配、实际商用 Provider、Windows 实机分别标记，不能互相替代。

**P1 协议覆盖（底座稳定后推进）**

- 国内和国外各优先考虑三个主流服务商作为适配与兼容目标；**具体国内名单尚未冻结**。选择时按实际可用 API、用户需求和官方协议核定；不强行把每家一对一映射到一份重复实现。
- 保持按协议独立文件、Provider 复用兼容协议、特殊能力局部扩展。当前 `openai-chat` 和 `anthropic-messages` 属已存在实现；暂缓继续扩展 OpenAI Responses、Gemini 等原生协议及 Anthropic 的高级能力，不删除已完成的兼容代码。
- 完整 A1 功能目标仍保留，但不因协议候选名单将全部实现直接塞进 0.1.1；交付范围由 A2 决定。

每阶段记录实际提交 SHA、通过和失败的测试、未验证场景及公开接口影响。文档更新与源码施工分工保持既有规则。

## 6. 协议研究与历史材料

当前协议注册表有 `openai-chat` 与 `anthropic-messages` 两个入口。桌面 API 设置页已增加协议选择与模型 `max_tokens` 编辑，并通过可信宿主白名单校验输入；是否实际通过 Windows UI 操作与最新 SHA 构建，仍依赖对应验收。Service 的请求准备、Transport 的探针/目录/发送按 `resolveApiProtocol(connection.protocol)` 选择适配器，未知协议拒绝。Anthropic Messages 已实现原生文本发送、JSON/SSE 解码、基础用量转换、单页模型目录刷新及最小文本生成探针，通过原生 `/messages`、`/models` 与 `x-api-key` 请求；已采纳的原生探针可记录 `max_tokens` 参数要求。目录分页、工具调用、推理续接和多模态尚未接通，不得视为完整服务商功能。现有 `ApiProtocolAdapter` 仍是逐步完善的运行接口，未来需按真实协议能力分离可选操作而不是强迫各协议复用 Chat 工具语义。Gemini、Responses 等其他原生协议尚未实现。跨 Provider 请求/流式/工具/usage 应通过正式 Protocol Adapter 兼容机制扩展，不以任何单个 SDK 替换整个产品协议。

- 历史研究和 Pi AI 隔离实验仅在需要兼容证据时查阅：[A0 API 研究](../../docs/A0-产品构想与研究/方案与研究/既有研究/api/README.md)、[Pi AI 实验](../../experiments/pi-ai-compat/README.md)。
- 长期功能以 A1 为准，0.1.1 的实际施工及签收以 A2 为准。历史研究不是独立施工命令。
