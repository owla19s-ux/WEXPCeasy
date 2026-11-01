# API 历史能力追踪矩阵

核查日期：2026-11-01。研究回执，非产品契约修订。

## 证据锚点与判读

- WEX 原规范：[完整文件](https://github.com/owla19s-ux/WEX/blob/c7dcf0a9833f66d8c93b5356c2dbfe1bfd882c19/docs/baselines/WEX-0.1.1-API-CONNECTOR-MATRIX.md)，SHA `c7dcf0a9833f66d8c93b5356c2dbfe1bfd882c19`。下表保留全部 A-001～035 及编号专项，未将连接器条目删成少数模型功能。
- APS 原始资料**已找到**：[ai 源码](https://github.com/owla19s-ux/APS/tree/024ca95d542ed7e74e1d7bf726376f36e1d7613d/app/src/main/java/com/abridgefs/app/ai)，SHA `024ca95d542ed7e74e1d7bf726376f36e1d7613d`。本次实际读取 AIConnection、AIProfile、AIProfileStore、AIConnector、AIConnectorRegistry、三协议Connector、ApiEndpoint、ApiErrorSanitizer 及 MultiProtocolConnectorTest/ProviderConnectorErrorRedactionTest。源码存在不是通过证明；未声称 APS 为需求首次提出时间。
- WEX Android：[ai_extension.dart](https://github.com/owla19s-ux/WEX/blob/c7dcf0a9833f66d8c93b5356c2dbfe1bfd882c19/apps/wex/lib/extensions/android_connectors/ai_extension.dart)、同目录 connector_config.dart 及 test/extensions/ai_extension_test.dart 已读取：一组 baseUrl/key/model、禁止重定向与SDK重试，不具备目标多 Connection 配置。凭证存于 secure storage，但旧配置对象仍携带 Key，不照搬成新模块 schema。
- WEXPC 源码基线 `faf11f31d44e4fc4788e766074b8db6b83ab4a1b`。下述 Rust 路径均相对 [wexpc](https://github.com/owla19s-ux/wexpc/tree/faf11f31d44e4fc4788e766074b8db6b83ab4a1b)。正式 main 已集成 wex-api 与 HTTP；其 README 仍写“提案分支”，是过期状态说明，不能单凭该 README 否定主线代码，也不能自称其他执行者已独立签收。
- 当前 WEXPCeasy `609e4142b319fec8800c8aea89bc7aa4ca447d16`：[API-01～10](../../../connections/api/CONTRACT.md) 当前仍为 B 候选语义与 C 真实实验门槛；本批未改它。
- **E-RUST：**本轮读取既有 Actions [40527701505](https://github.com/owla19s-ux/wexpc/actions/runs/40527701505)，job `122271653337` 原始日志，源码 `c1ff8d9e83c920fb3a531926e5dc6aa47039f805`。这是历史已运行证据，不能升级成本次 HEAD 重跑。见[报告](PI-AI-TEST-REPORT.md)。当前环境 rustc/cargo 均 command not found。

状态分别记录：设计已确认/候选/未决，代码无/原型/主线实现，测试本轮通过/历史通过/未运行/证据不足。没有用“有测试文件”代替“通过”。原规范的 Android 特例不是 PC 当前权限政策。

## 全量原编号追踪

| 历史编号 | 原功能描述 | 最早可核来源与变化 | 当前归属/契约 | 实现状态/代码 | 测试状态/路径 | 设计状态 |
|---|---|---|---|---|---|---|
| A-001 | 用户可创建多 Connection，各自名称、Provider/协议版本、Endpoint、认证引用、启停与默认状态；连接身份不随重命名改变，配置修订可识别并发编辑 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/api API-01; connections C01 | APS AIProfileStore/AIConnection 已有多配置；WEX Android 仍单组；WEXPC Core 有 Connection 数据 | APS AIConnectionTest/AIProfileTest；WEXPC organization 测试，均本轮未运行 | 已确认多连接；修订/复制细节候选 |
| A-002 | API Key/Bearer 等凭证独立安全存储，配置仅持有不泄露明文的引用；更换、清除与复制连接默认不复制密钥须有独立结果 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | shared/credentials + permissions; API-03 | APS 元数据与加密 Key 分离；WEX secure storage；WEXPC Credential 脱敏 | APS ProviderConnectorErrorRedactionTest；Rust decoder credential_debug_is_redacted，历史运行见 E-RUST | 安全边界已确认；共享/删除生命周期未决 |
| A-003 | 配置保存、真实连接探测、模型目录、实际生成请求是不同动作与结果；显示错误状态、过期测试 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-03 | APS listModels/testChatCompletion；WEX connector_diagnostics；WEXPC HTTP 诊断 | APS MultiProtocolConnectorTest / WEX connector_diagnostics_test；本轮未运行 | 已确认 |
| A-004 | 从 Provider 查询可用模型；目录不可用时手动配置模型 ID，再实际测试 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02 | APS 三协议 listModels；WEXPC 手动 model 引用，非完整在线目录 | APS MultiProtocolConnectorTest；本轮未运行 | 已确认，能力来源需区分 |
| A-005 | 模型支持的温度、最大输出、推理开关、上下文/多模态参数等按真实协议暴露 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04 | Rust parameters_json 编码；WEX 参数完整产品层无实现证据 | Rust tests/encode.rs / decoder.rs；E-RUST；Pi native/protocols 本轮通过 | 目标已确认，完整参数清单未决 |
| A-006 | 全局默认只初始化新对话；会话分别保存模型、连接；切换时不静默替换失效模型 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | conversations + AI; API-08 | APS AIRequest modelId 覆盖；WEXPC PreparedChat 绑定 connection/model/turn | WEXPC api.rs both_transports_encode_the_same_ordered_transcript；E-RUST | 行为已确认 |
| A-007 | 首个实际验证 Provider/Model，支持真实对话和工具调用链；不得把 DeepSeek Search 等同于模型内置能力 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-04/05 | Rust OpenAI-compatible + reasoning continuation 代码；非真实 DeepSeek 验收 | Rust decoder/encode；本轮 Pi DeepSeek 模拟往返通过；真实厂商未运行 | 历史首选目标已确认，不直接冻结当前版本 |
| A-008 | 以原生 OpenAI API 行为适配已确认优先目标 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-04/05 | 旧 Rust Chat；Pi Responses 实现及本轮模拟终态 | Rust api.rs；Pi protocols.test.mjs；真实服务未运行 | 原生目标已确认，范围未决 |
| A-009 | 自定义 Endpoint、模型 ID、兼容 API 的真实流式与工具能力按服务实际支持情况适配 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-01/04 | WEX Android SDK 与 WEXPC 正式主线兼容 HTTP | WEX ai_extension_test（未重跑）；WEXPC api.rs E-RUST；Pi local HTTP 本轮通过 | 已确认 |
| A-010 | Anthropic、Gemini 和其他平台所需原生协议适配目标继续保留 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-04 | APS Anthropic/Gemini 产品代码；Pi 原生适配源码 | APS MultiProtocolConnectorTest 未重跑；本轮 Anthropic 模拟通过，Google 注入 transport 拒绝已复现 | 方向已确认，协议能力待逐项验证 |
| A-011 | 流式/非流式、推理文本可折叠、停止、超时、取消、错误状态 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-04/09 + conversations/views | APS 流/非流；WEXPC blocking HTTP/SSE；Pi 收集流不是非流 HTTP | Rust api.rs E-RUST；Pi native/adapter 本轮通过，完整兼容不通过 | 已确认，UI未验收 |
| A-012 | Provider 发出 tool call→WEX 查授权/调度→Connector 执行→结果回传→模型继续；多轮工具调用 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-05 + conversations + connections/permissions | WEXPC tool_round/proposals 已接线；流式文本入口仍明确拒工具续传 | Rust api.rs approved_tool_round_trip / tool_round_rejection；E-RUST | 已确认边界，工具非SDK执行 |
| A-013 | 可见小窗提示重试进度/手动重试/取消，保留必要部分输出；副作用未知不盲重试 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-09 + conversations/views | Rust 不自动重试；取消纯标记与阻塞传输解除不同 | Rust api.rs E-RUST；本轮 Pi 取消/超时替身通过；完整队列 join 未运行 | 原则确认，UI细节候选 |
| A-014 | 请求/聊天/模型 Token 用量、按配置单价估算，未知价格显示未知，注明非实际账单 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-06 + workflows预算 | Rust Usage Option；Pi usage与cost估算；WEX完整账单链无证据 | 本轮 omitted usage 零值已复现，adapter保留null；真实账单未运行 | 区分估价/未知已确认 |
| A-015 | `WEX/Extensions/AI-API/Protocols/`，外部 AI 可按模板生成定义文件；用户拷入后刷新、发现、配置、测试 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-01/02 + app装配 | 未找到正式安全 Descriptor 导入执行器实现 | 无运行证据 | 目标确认，schema/安全范围未决 |
| A-016 | 协议文件可启停、更新并在失败后回滚；不破坏此前有效连接 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-01 + app | 未找到正式描述文件刷新回滚实现 | 无运行证据 | 目标确认，迁移候选 |
| A-017 | 声明式文件只表达现有执行引擎支持的功能；需新传输/认证运行机制时仍可能需代码更新 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-01/04 + app | 旧 protocol crate 不是声明式执行器；Pi createProvider 可组装已实现 API | Pi native custom provider 本轮通过；安全文件导入未运行 | 引擎边界已确认，格式未决 |
| A-018 | GitHub Token、安全存储、自身连接测试与仓库能力范围说明 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-019 | 只有一个默认关的“允许 AI 访问 GitHub”；打开可跨 Token 允许的所有仓库/分支/文件持续读写 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-020 | 搜索/列出仓库、目录/文件、分支、提交与差异，自行按用户任务定位 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-021 | 创建/修改/删除、多文件更改、Commit SHA、写后回读及基本版本冲突保护 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-022 | 通过成熟 GitHub SDK/API 接通常用 PR、Issue、Actions 操作 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-023 | Token scope 仍由 GitHub 决定；关开关阻止新调用及迟到读取泄漏，在途写入保留真实结果 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-024 | 通过 Android 系统文件访问机制访问获允许位置；APP OS 文件权限状态显示在右抽屉“权限” | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-025 | 在**连接与服务→本地文件**单独管理 0..N 目录读/写许可、撤权、读写测试，WEX 主目录可被纳入 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-026 | 目录浏览/搜索、读、创建文件/目录、改、保存、重命名、移动、删除、多文件操作及回读 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-027 | 普通与 Context 对话均按真实授权使用 Local，不受 Address 白名单限制；并发操作基础冲突保护 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-028 | **独立连接器**，自己配置、启停/AI 授权、自身测试、搜索/抓取网页、链接和结果回传 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-029 | OpenAI/DeepSeek/其他支持 WEX 工具的模型都可调用已启用的搜索连接器 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-030 | 分开统计 Search/Fetch 请求与模型用量；引用真实来源，不伪造网页 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-031 | 保留 Android 专用独立浏览器扩展与配置/授权/工具接线目标；不与 API/GitHub UI 捆绑 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections/github、local、search、browser + permissions（API只发意图） | 存在对应旧连接器，非本批协议实现复用对象；不评为API已实现 | 本批未运行对应连接器；不得用Pi测试替代 | 历史目标确认；当前政策以对应owner为准 |
| A-032 | Connector 暴露真实能力列表、调用条件和错误状态；不同会话独立选择工具 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections + conversations; API-05 | WEXPC tool_proposals/tool_round；可见性不授权 | WEXPC api.rs E-RUST；本轮两工具意图不执行替身通过 | 已确认 |
| A-033 | WEX Core/Dispatcher 与平台接入层接线；执行策略自动/询问/拦截；请求取消/拒绝/超时/结果回执 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | connections + permissions + workflows | WEXPC tool_round已接线，非移植完整新架构 | WEXPC api.rs E-RUST；本轮边界替身通过，真实调度未运行 | 边界已确认，实现协议候选 |
| A-034 | 配置保存/连接测试/模型测试/工具执行/结果核验相互独立显示 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/03 + connections/views | APS/WEX 诊断代码；完整分层UI不在实验范围 | WEX connector_diagnostics_test 本轮未运行 | 已确认 |
| A-035 | 密钥只能在可信存储/Connector 内部使用；常规聊天内容、日志、导出不得包含密钥 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | shared/credentials + permissions + connections | APS sanitizer、WEX no-redirect、Rust errors/credential | APS测试未重跑；Rust E-RUST；Pi adapter本轮脱敏通过 | 已确认 |
| A-005-P1 标准参数 | 可定义 max output、temperature、top_p、top_k、presence/frequency/repetition penalty；各参数具有数据类型、有效范围及“使用 Provider 默认/显式值/不支持”状态 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 产品原则确认 |
| A-005-P2 参数生效性 | 参数不支持时不盲发送；“接受但忽略”的字段视为该模式下无效，UI 应说明；不得照搬统一默认值 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认原则 |
| A-005-P3 自定义参数 | 用户可增删改参数并设置值、类型、启停；适配层校验重复键、非法类型、保留字段冲突 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认方向 |
| A-005-R1 思考控制 | 以“服务端默认/不启用（若支持）/等级/预算（若支持）”作抽象选择；实际映射由协议能力决定 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认方向 |
| A-005-R2 推理传递 | 必须按 Provider 的消息及工具调用规范处理 reasoning 输出、摘要、签名、持续会话状态；UI 不能承诺总能看到完整思维 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认安全/准确性原则 |
| A-005-M1 模型能力 | 将文本/图像/音频/视频/文件输入及结构化输出、Tool Call、流式、Reasoning 单独标识 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认方向 |
| A-005-M2 附件请求 | 根据当前模型+协议处理 MIME/类型/大小/编码/URL 或文件上传，不支持则拒绝或提示，不静默转成纯文本 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认方向 |
| A-005-R3 最大输出 | 明确生成输出上限可能包含 reasoning tokens；不能统一认为全部用于最终可见文本 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认原则 |
| A-011-T1 分层模型测试 | 配置、模型列表、普通请求、流式、推理、工具调用各给出独立回执及最新测试结果 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 确认 |
| A-017-P1 外部协议文件 | 可声明协议/模型能力、字段映射、参数范围和禁用/忽略情况，必须经校验再用于请求；不承诺任意新传输栈免编译 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 目标确认；格式待设计 |
| A-005-V1 配置覆盖 | **候选解析规则**：先确定 Connection/Model/协议及能力，按“Provider 模板建议 → Connection 显式设置 → Model 显式设置 → 会话显式设置”的优先顺序计算每个参数；逐项支持继承、显式值、服务商默认（强制省略），冲突或不支持时不给出虚假生效结果。显式值包括 0/false；切换模型保留但不盲发不兼容项 | WEX完整规范2026-10-22；APS为早期代码证据；后续WEXPC→API-01～10 | API-02/04/05；conversations或app依专项 | 仅参数编码/消息映射局部实现；完整配置/Descriptor无正式实现证据 | Rust encode/decoder（E-RUST局部）；Pi测试见兼容矩阵；完整专项未运行 | 候选，覆盖层级与优先级未决 |

## 无单独 A 编号的专项，逐节保留

这些 H 标识仅为本次追踪定位符，不是重编号产品需求。

| 追踪标识/原章节 | 关键历史语义 | 状态/实现与证据 | 当前映射 |
|---|---|---|---|
| H01 Connection/Provider/Model 生命周期 | Provider≠Connection≠Model≠授权；复制不复制Key，停用不等于取消 | 原则确认，修订/删除/迁移候选；APS多profile、WEXPC绑定局部实现；本轮只测独立快照 | API-01/02/08、conversations、AI |
| H02 参数继承覆盖与自定义参数 | 0/false/省略/null区别，类型/范围/嵌套/重复键/保留字段 | 四层优先级未决；Rust保留字段拒绝；Pi samplingParams可覆盖model已复现；本批适配只允许小白名单 | API-04；配置编辑仍WEX |
| H03 协议文件与执行器分离/三档扩展 | 换端点、声明映射、新引擎不是同一能力 | 已定边界，格式候选；无安全声明导入产品实现；Pi可执行JS注册不是安全Descriptor | API-01/04、app |
| H04 SDK实现核对/自主架构过渡 | dart_openai 8.0.0不是WEX架构；配置与状态仍WEX | WEX Android已接SDK一组连接；真实多Provider未验收；Pi同样只作实现候选 | 全API契约 |
| H05 AI辅助配置后续版本 | AI可辅助生成/校验配置，不自授执行权限 | 0.1.2/0.1.3历史候选，未批准当前版本；无代码/未运行 | API-01、permissions |
| H06 Descriptor版本/校验/兼容握手 | schema版本、执行器版本、配置修订分开；未知必需拒绝；失败回旧版本 | 设计候选，未冻结schema；无产品实现/未运行 | API-01/02 |
| H07 三协议向量 | Chat delta、Responses item、DeepSeek reasoning+tools不能强压成一种wire | Rust主要Chat；Pi三类模拟本轮通过；非真实Provider验收 | API-04/05 |
| H08 Generation事件/重复乱序/背压 | 绑定request/item/call；部分输出不完成；工具参数完整才提议 | 原约束保留，事件ABI未冻结；Rust解码比Pi更严格；Pi DONE后帧仍缺口；完整背压未验 | API-04/05、conversations |
| H09 Generation生命周期/Operation映射 | 模型回合、逻辑生成、工具操作三套状态；取消不回滚 | 边界确认，具体状态候选；WEXPC tool_round/保存回执局部实现；本轮替身非真实Core | conversations、connections、workflows |
| H10 Core接线/Capability/Dispatcher | 工具可见非获权；真实执行、授权与账本不归模型SDK | 已确认边界；旧WEXPC正式工具回合与测试；本轮替身只测边界次序 | API-05、permissions、connections |
| H11 多模态/推理签名/持续状态 | 不支持图片不得静默忽略；工具轮推理按厂商保留；签名有作用域 | 原则确认，模态范围未决；Rust仅文本；Pi图片降级/跨endpoint同ID续传已复现，WEX必须补防线 | API-02/04/05、conversations |

## WEXPC 可保留的正式代码与证据

| 资产 | 主线实现/实际边界 | 测试证据 | 可复用方式 |
|---|---|---|---|
| crates/wex-api/src/decoder.rs | UTF8/SSE、唯一终态、单choice、工具JSON/ID/role、限额、reasoning payload；纯字节无I/O | tests/decoder.rs 当前30项；E-RUST历史通过，本轮未运行 | 保留实现及全部向量，不能被宽松SDK默认行为替代 |
| src/encode.rs、types.rs、errors.rs | 参数保留字段、ContinuationScope、大小上限、稳定静态错误；旧scope缺request/config revision/credential引用 | tests/encode.rs 当前17项，README仍写15；E-RUST历史通过，本轮未运行 | 旧约束可迁移；不是完整当前WEX身份模型 |
| desktop-service/src/connectors/openai_compatible.rs | 实际reqwest blocking HTTP/SSE；HTTPS/本机HTTP、无凭证URL/重定向、connect/total；流入口拒绝未接工具与continuation | tests/api.rs 当前21项；legacy_api_regressions.rs 3项；E-RUST为旧SHA、api为21项 | 保留可用旧Chat路径；idle/队列取消/显式代理未由该路径证明 |
| tool_round.rs、tool_proposals.rs、intent_binding.rs；tool_checkpoints/journal/results | 提议解析、授权工具回合、身份与回执/恢复；不属于SDK | api.rs工具往返与拒绝、tool_roundtrip/tool_resume/tool_call_id_reuse等；本轮未重跑 | 留给对应owner，不能连同协议替换时删除 |
| reviews/API-PC-01 + reviews/tests/api_pc_01_invariants.rs | 前者最初NOT_RUN审查清单；后者std-only类型提案四项，不是正式crate全覆盖 | 不能由清单状态推断后续无代码，不能由四项推断16组验收通过 | 完整迁移语义见本轮报告 |

**复用不能整仓搬家。** 保留旧资产与测试，不将旧Rust Core、Android配置或Pi Models/Auth当新WEX权威；既定职责按当前owner，尚未确认的schema/参数优先级仍留候选。

