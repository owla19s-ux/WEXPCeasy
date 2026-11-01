# WEX API 历史成果提取与复用基线（APS → WEX → WEXPC → WEXPCeasy）
日期：2026-11-01。性质：跨仓库历史证据索引与研究提取，**不是新 API 设计、不是实现验收，也不变更现有用户决策**。

## 一、阅读优先级与防止重复研究

未来 API 施工必须先读本文件，再读本仓 `connections/api/CONTRACT.md`，并回查所列原始仓库。旧版历史产品政策与当前政策冲突时，以当前用户确认与当前 owner 契约为准；旧版可复用的是已确认 API 业务语义、协议实现与测试证据，不能整份迁移过期权限/产品设定。

必须分别记载 **用户已确认需求 / 研究候选 / 正式代码存在 / 单元测试存在 / 实际运行证明 / Windows 与真实 Provider 验证**。旧仓库的 CI 记录不自动成为 WEXPCeasy 验收。

## 二、APS：已有 Android Kotlin 的多协议实际实现

源仓：[owla19s-ux/APS](https://github.com/owla19s-ux/APS)。

| 历史资料 | 真实成果与复用价值 | 证据边界 |
|---|---|---|
| [API 多协议参考审查](https://github.com/owla19s-ux/APS/blob/main/docs/AI-PROTOCOL-REFERENCE-AUDIT.md) | 2026-10-11 对 openai-kotlin、AI-API-Client、android-ai-chat-sdk 做依赖/适配比较；选择保留现有 OkHttp/Gson/Coroutine 网络栈与薄 Provider Adapter。该结论适用于当时 Android Kotlin，不自动适用于 Electron/TS | 静态审查；文档明确未宣称所有验收通过 |
| [AIProtocol.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/AIProtocol.kt) + [AIConnectorFactory.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/AIConnectorFactory.kt) | 稳定协议 ID、内置 OpenAI-compatible / Anthropic / Gemini，支持按协议 ID 注入额外 Adapter；不要求修改对话页 | 正式源码存在 |
| [OpenAICompatibleConnector.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/OpenAICompatibleConnector.kt)、[AnthropicConnector.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/AnthropicConnector.kt)、[GeminiConnector.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/GeminiConnector.kt) | 三种协议的请求/鉴权/解析处理，适合作为行为对照与 fixture 来源 | Kotlin 实现不可直接当作 TS SDK |
| [AIProfileStore.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/main/java/com/abridgefs/app/ai/AIProfileStore.kt) | 多 Profile、默认项、安全凭证分离、旧数据迁移；不因一项密钥解密失败而抹掉其他元数据 | Android 存储实现不直接迁移 Windows |
| [MultiProtocolConnectorTest.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/test/java/com/abridgefs/app/ai/MultiProtocolConnectorTest.kt)、[OpenAICompatibleConnectorTest.kt](https://github.com/owla19s-ux/APS/blob/main/app/src/test/java/com/abridgefs/app/ai/OpenAICompatibleConnectorTest.kt) | 检查 Anthropic Messages/Gemini generateContent 的 URL、头、请求体和响应；协议工厂注册及兼容调用 | 测试文件存在；本次未重跑 |
| [CURRENT-TASKS.md](https://github.com/owla19s-ux/APS/blob/main/docs/CURRENT-TASKS.md) | 历史记录称多 Profile、Registry、对话选模型、模型目录、SSE 与取消已有提交和对应 CI/单测；真实 Provider/端到端仍待验收 | 历史记录，需逐个核对对应 SHA/运行 |

**APS 的稳定成果**：三个独立 Provider 适配器、Profile/协议身份分离、连接管理及历史迁移、模型目录、流式/取消、替身测试。不要再把“多协议能力”写成从未研究过。

## 三、WEX：完整业务功能与参数/协议描述研究

源仓：[owla19s-ux/WEX](https://github.com/owla19s-ux/WEX)。核心：[WEX-0.1.1-API-CONNECTOR-MATRIX.md](https://github.com/owla19s-ux/WEX/blob/main/docs/baselines/WEX-0.1.1-API-CONNECTOR-MATRIX.md)，约 3.7 万字符，含 A-001～A-035（混合 API/GitHub/Local/Search/公共执行）。

**API 核心 A-001～A-017**：
- A-001～004：Connection 多实例及稳定 ID、Provider/协议/密钥分离、连接诊断、模型目录失败时可手填模型 ID；复制不复制秘密/旧测试成功记录；重命名不破坏会话绑定。
- A-005 与 2026-10-22 专项：max output、temperature、top_p、top_k、惩罚参数；缺省/显式/不支持/未知/冲突区别；用户自定义参数；推理启停/等级/预算；模型支持能力来源及字段忽略事实；多模态文本/图片/音频/视频/文件/工具/结构化输出分别声明。**协议/模型不支持的媒体不得静默忽略。**
- A-006：全局默认只作用新会话；每会话保存独立 Connection/Model 选择。
- A-007～010：DeepSeek、OpenAI 原生、OpenAI-compatible、Anthropic/Gemini 等原生协议差异。
- A-011～014：流式/非流式、停止/取消/超时、Provider 工具提议→WEX 授权/执行→结果回注、多轮处理、失败重试提示、Token/费用来源。
- A-015～017：外部声明式协议目录、协议激活/更新/失败回退；**声明文件只能描述现有执行引擎的能力，不代表任意新传输协议都能零代码热加载**。
- A-018～035 属于 GitHub/Local/Search/通用调度等，不应复制进 API 模块，但 API 的工具调用必须引用其授权执行结果。

WEX API 已细化 Chat Completions / Responses 事件差别、DeepSeek thinking 与 tool-call 后续 reasoning 回传、Continuation 和原生推理 payload、参数描述符与执行器边界、拒绝敏感鉴权 Header 覆盖、流式定稿/工具参数完整性；很多细项仍明确标注 **候选、需核对协议、未冻结 Schema/ABI**，不能假装全已确认或已实现。

## 四、WEXPC：正式 Rust 协议代码和对抗测试资产

源仓：[owla19s-ux/wexpc](https://github.com/owla19s-ux/wexpc)。

- [wex-api crate](https://github.com/owla19s-ux/wexpc/tree/main/crates/wex-api/src)：`lib.rs`、`types.rs`、`encode.rs`、`decoder.rs`、`errors.rs`；纯协议核心（无 I/O、无自动重试、无跨会话全局状态），包含 OpenAI-compatible Chat Completions 编码与 SSE 解码、请求校验、工具参数完成、推理数据与原请求关联的 Continuation、终态/边界限制、脱敏错误分类。**这是正式 Rust 代码，不只是设计稿。**
- [HTTP 服务层 API 测试](https://github.com/owla19s-ux/wexpc/blob/main/crates/wex-desktop-service/tests/api.rs) 已覆盖端点、请求、响应与多个错误/协议场景；本次未运行。
- [API-PC-01 对抗验收 DEC-01～16](https://github.com/owla19s-ux/wexpc/blob/main/reviews/API-PC-01-ADVERSARIAL-ACCEPTANCE.md)：SSE UTF-8/CRLF、缺 finish、截断/矛盾终态、工具碎片、帧/续传大小、Continuation 跨请求、错误脱敏、取消与背压、三类超时、代理重定向、部分结果、副作用隔离、未知参数。**该审查文件自述全部 NOT_RUN；不可把“有测试规范”说成“16 项通过”。**
- 原旧实现的 Rust/Tauri 路线与现 Electron/TypeScript 路线不同；应先比较替换/集成成本与结果退化，不能默认 FFI 或全部移植。

## 五、WEXPCeasy：当前唯一 owner 与已有独立实验

- [connections/api/CONTRACT.md](../../connections/api/CONTRACT.md)：API-01～10，配置、目录、请求/流式、工具意图、Usage、本地模型、路由、重试、故障切换，保留 B/C/D 状态。
- [Provider 边界研究](../architecture/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)：厂商适配/网络会话与 Conversation/Operation/Task/权限权威分离；普通对话不强制创建 Task。
- [模型协调实验](../../experiments/model-coordination-spike/README.md)：历史文档记载 6 组独立替身行为检查和 5 组 SQLite 崩溃恢复场景通过。不能扩展为真实模型、真实付费 API、Windows/产品链路验收。
- **现行原则**：WEX 连接管理、凭证引用、权限、Operation/receipt、消息/Task 仍有唯一 owner；第三方 SDK 只供厂商协议与传输实现。

## 六、Pi AI / DSH 复用位置与差异（源码审查，不是运行验收）

- [Pi AI](https://github.com/earendil-works/pi/tree/main/packages/ai)：官方发布包提供独立 TypeScript 多 Provider、模型目录、动态 Provider、OpenAI-compatible、自定义接口、流式/工具事件、Thinking、基础 Usage/费用、取消、图像输入/部分图像生成。发布包 `@earendil-works/pi-ai` 依赖多家官方 SDK，**不要求 Cordis/DSH Agent**。版本/接口必须安装前锁定。
- [DSH LLM](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm)：独立于 Agent Loop 的逻辑模型服务，但需要 Cordis；[DSH Pi adapter](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/llm/llm-pi-ai) 底层又调用 Pi AI，另接 DSH 凭证/授权/附件等服务。
- **直接复用候选**：现成多 Provider 协议编码解码、模型元数据、事件格式、原生参数适配。
- **薄适配候选**：当前 Connection → Pi Provider/Model 绑定、凭证引用注入、流到 WEX 事件映射、错误与 Usage 来源映射。
- **WEX 必须自己维护**：多 Connection/修订/启停、独立凭证与授权、协议文件验证/回退、Conversation/Operation/Attempt/Task 权威、业务重试与故障切换决策。
- **明确退化风险**：Pi AI README 说明向不支持视觉输入的模型传入图片可被**静默忽略**；与旧 WEX “不能静默丢媒体”冲突。调用前须拒绝或显式诊断。旧 WEXPC Continuation 强绑定 connection/conversation/generation/model/tool-call IDs，不能假定 Pi AI Thinking 数据保真就等于具备同样关联防护。SSE 完整终态、工具完整 JSON、网络安全、超时/背压/参数覆盖仍需 DEC 验证。
- **替换结论状态**：Pi AI 是优先实验候选，**尚未证明能无退化替换旧 Rust 协议核心**；DSH LLM 不因有统一服务层就自动成为更合适的 TS 嵌入实现。

## 七、下一施工批：只做已有成果复用和等价性实验

1. 固定 APS/WEX/WEXPC/Pi AI 的源码 SHA 与运行环境，抽出最小测试 fixture，不重复定义 WEX API 需求。
2. 先复用 APS 三协议鉴权、模型目录、Profile 迁移、流式/取消测试及 WEXPC DEC-01～16，再加 WEX A-005 参数/多模态及协议声明验证用例。
3. Pi AI 独立实验：已覆盖/薄适配/保留旧实现/存在缺口/未能验证五类，逐条留真实测试输出；真实 Provider 请求需许可和费用检查。
4. 比较 Pi AI 全替代、旧 Rust 保留、混合三种路线。原则优先减少跨语言维护，前提是安全和功能不退化。
5. **不施工正式 API 模块，不改产品方案，不触发昂贵 GitHub Actions；只有实验结论充分时才交付决策。**

## 八、原始 Excel 总表状态注意

产品全局总表现行入口是 [PRODUCT-FUNCTION-CATALOG-2026-11-01.md](../product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) 和 [FUNCTION-CONTRACT-MAP-2026-11-01.md](../product/FUNCTION-CONTRACT-MAP-2026-11-01.md)。它们是仓库内 Markdown 资料，**不等于 2026-10-31 的 .xlsx 讨论稿已经在仓库**。截至本次检查，仓库 main 完整树中无 `.xlsx` 文件。若需要原始 Excel 入库，应按原文件字节单独上传，不要把 Markdown 替代品误称原始文件。
