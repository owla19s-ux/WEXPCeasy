# connections/api｜模型连接与协议适配

> Owner：`connections/api`；长期功能见 [A1 F04](../../docs/A1-正式产品设计/产品功能总表.md)，正式行为及接口约束见 [CONTRACT](CONTRACT.md)，0.1.1 范围及签收见 [A2](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责边界

API 独立管理非秘密 Provider/Connection/Model、模型能力观察、请求准备、发送/流式解码、诊断、用量与工具提议。**API 可独立发起一次模型请求，不依赖 Conversations 创建会话。** Connections 持有 Operation，Permissions 判权，Shared/可信宿主持有 Key，Conversations 管历史与轮次，AI 管角色/岗位/Agent 偏好，App/UI 负责可信桌面入口。工具提议绝不等于工具已执行或获授权。

## 当前功能状态（2026-11-08，源码静态核对）

| 功能 | 目前实现 | 仍需完成/证明 |
|---|---|---|
| API-01 连接/Provider | 配置 CRUD、协议与 URL、复制/修订、桌面协议选择 | 真实多账号/厂商与完整桌面操作 |
| API-02 模型与能力 | CRUD、目录/探针、能力证据，新增可选按输入/输出方向的 text/image/audio/video/file `modalities` | 多模态真实请求、能力来源/版本恢复及 UI |
| API-03 凭证/诊断 | 可信凭证引用、基础诊断及探测 | 真实 Provider、轮换/失效/失败分类 |
| API-04 请求/流 | `openai-chat` 与 `anthropic-messages` 独立协议文件；文本请求、JSON/SSE、取消/超时基础 | 原生协议完整覆盖、复杂模态及真实流式端到端 |
| API-05 工具 | Schema、工具提议和部分续接基础 | Anthropic/其他协议工具格式及真实授权轮次 |
| API-06 用量 | 基础 usage 来源和字段处理 | 价格/币种/估算展示 |
| API-07 本地 Provider | 兼容回环 HTTP | 本地运行时与服务状态验收 |
| API-08/09 模型选择、错误 | 显式绑定、参数冲突拒绝、超时/错误分类 | 跨调用方候选策略与安全重试 |
| API-10 故障切换 | 尚无完整策略 | 方案与授权/版本范围待决 |

上述“已有”仅表示源码/测试存在，**不等于最新 SHA CI 或真实厂商签收**。

## 公开入口与源码职责

| 路径 | 当前职责 |
|---|---|
| `src/index.ts` | 保持对外 `createApiService`、`createApiTransport` 与解码/类型兼容 |
| `src/service.ts` | 配置、观察、请求准备及服务组合；按真实职责再拆分 |
| `src/model.ts` | 类型、配置/观察及持久状态校验；`ModelObservation.modalities` 已是可选方向证据，不等于多模态输入已支持 |
| `src/transport.ts`、`src/stream.ts` | 请求发送、取消/超时与流式解码 |
| `src/protocols/index.ts` | 注册 `openai-chat`、`anthropic-messages`，按 protocol 而非 Provider 名称选择；未知协议拒绝；probe 版本匹配 |
| `src/protocols/openai-chat.ts`、`anthropic-messages.ts` | 各自 wire 请求、返回/探针/目录适配；Anthropic 现阶段主要是文本，工具/分页/推理/多模态不能标为完成 |
| `src/endpoint-policy.ts`、`src/tools.ts`、`src/usage.ts`、`src/preparation-parameters.ts` | 端点策略、工具格式、用量与参数来源/冲突处理 |

`Preparation.messages` 仍为文本结构；不能因 observation 有 image/audio/video/file 而宣称这些模态可发送。近期能力方向及跨协议探测证据提交应在当前 SHA 回归后再更新验证状态。

## 下一步调整与验收

1. **先稳固底座**：现有模型观察和请求快照的配置修订、probe 协议版本、恢复、方向拒绝、旧格式兼容及 unknown/取消；先核测试再定向修复。
2. **按协议独立源码文件**：不同 Provider 可共用兼容协议，同一厂商可有多个协议。先完成现有 Chat/Anthropic 路径的真实行为，不为未定国内外厂商名单机械建空协议文件；Gemini/Responses 等原生协议按后续证据接入。
3. **按职责最小拆分**：保持公开 API 与现有消费者兼容，不把 service/model 重写为第二套系统；新增工具、模态与目录操作必须同时有协议支持、拒绝路径、状态迁移测试。
4. **逐层验收**：API 专属测试、build/typecheck、边界、真实 Provider/Key、UI/Conversations 工具轮次、Windows。先查看 [Actions 运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs)，记录测试 SHA；未验证则如实标注。

研究材料只在确有接口争议时查阅；模块 README 不维护另一套历史任务书。
