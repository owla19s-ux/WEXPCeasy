# API 协议实现复用决策

状态：**有实测依据的技术推荐，不是已获批准的正式API产品重构。** 2026-11-01。

**WEX 可以选 Pi AI 的部分 Provider 协议能力作为后续实现候选；现在不应整体替换旧 WEXPC Rust 核心。推荐 C：SDK 协议复用与 WEX 严格边界组合。** 本批只新增隔离实验和报告，正式 connections/api 没有替换。

## A/B/C 证据比较

| 能力/成本 | A：Pi AI协议实现 | B：保留旧Rust | C：组合（推荐） |
|---|---|---|---|
| 多Provider | 原生Chat/Responses/Anthropic等，模拟通过；Google拒绝custom fetch，不能共享守卫 | 当前核心主力是Chat兼容协议；新增厂商原生要自行维护 | Pi承担已验Provider消息编码/正常化；每族独立验安全与传输，不一套guard泛化 |
| SSE严格性 | 有EOF保护；重复终态/多choice宽松；DONE后数据不可观察 | decoder已有严格单终态、帧/总字节/工具ID/JSON与边界测试 | 保留Rust严格Chat路径及全部负例；或在未来TS受控transport内等价实现后再替换，不做双重业务权威 |
| 推理/签名 | 已实现多协议消息转换；DeepSeek模拟续传通过 | ContinuationScope与有界payload已有正式实现；还不是新WEX完整身份模型 | Pi处理原生payload；WEX封装connection/revision/credentialRef/endpoint/conversation/generation/request/model/toolIds，存储与撤销归原owner |
| 参数 | 大量Options、samplingParams/onPayload扩展快，但会忽略未知或覆盖关键字段 | encode保留字段拒绝与静态错误较严格；原生参数覆盖少 | 用可信映射+能力证据+类型/范围校验；不暴露任意payload/header覆盖；不改变未定四层优先级 |
| 图片/多模态 | text-only会替换图片；vision编码可用；音视频路径与生成尚未验 | 主要文本，无完整多模态实现可搬 | WEX先拒不支持媒体；逐个扩展已验证协议能力，不假称SDK覆盖完整模态 |
| Token/费用 | usage无返回也补0、catalog估价，不能当账单 | Option usage可表达未知，费用完整系统未实现 | 记录原始usage或unknown与估价来源；预算归workflows/用户政策 |
| transport | signal/custom fetch可接Chat/Anthropic；Google不支持；代理/三类真实超时未验 | reqwest阻塞HTTP已接；connect/total/无redirect；取消解除/idle/显式代理仍有缺口 | 不把旧Rust当全网络问题已解决；共用WEX约束但按协议实现，unknown不盲重试 |
| Electron集成 | ESM/Node24方向一致，无Rust FFI；Windows打包未运行 | 需N-API/子进程/IPC等之一，当前没有WEXPCeasy集成验收，不能假定成本零 | 优先TS SDK正常路径；严格Chat有缺口时保留旧资产/路径，必要时才决定Rust桥接形式；本批不造新宿主 |
| 维护成本证据 | 10项直接运行依赖、实验node_modules约106MiB（磁盘目录，非打包体积）；main/npm同版本漂移已出现 | 核心只依赖serde_json，47个协议测试资产；厂商变更要自维护 | SDK减少厂商重复劳动，锁版本/指纹并迁移旧向量防退化；成本不能主观量化为几天/几分 |
| 权威业务边界 | Pi Auth/Models/session机制不得替WEX owner | 旧RustCore/配置也不能整套移植 | 配置/凭证/权限/Operation/Conversation/AI/Task均留现有owner；SDK只作适配实现 |

证据：[历史矩阵](HISTORICAL-CAPABILITY-MATRIX.md)、[逐项兼容矩阵](PI-AI-COMPATIBILITY-MATRIX.md)、[测试报告](PI-AI-TEST-REPORT.md)。没有只按SDK功能数或主观分数选型。

## 可以采用什么

1. **直接复用候选**：已测自定义Provider/手动非工具模型、Chat/Responses/Anthropic的协议编码与事件、DeepSeek推理工具回传、模型目录元数据结构。目录能力与真实支持仍需每Connection证据。
2. **必要薄适配**：Connection快照→Pi Model/Options；受控Key交付；不支持媒体拒绝；参数能力/保留字段校验；最终工具JSON+Schema校验；静态错误/unknown映射；usage来源；WEX事件映射与取消观察。实验只验证其中有限Chat子集。
3. **保留旧实现与测试**：wex-api decoder/encode/types/errors和30+17测试；desktop openai_compatible HTTP/非流接口及21个api测试/3个legacy回归；tool_round/proposals/checkpoints/journal/results及对应恢复/ID复用测试。保留源资产≠要求新架构强制Rust；在等价替代通过前不删除。
4. **存在缺口**：DONE后严格处理、生产者有界背压/满channel join、Google受控transport、独立代理与真实三类超时、安全Descriptor加载/更新回滚、完整参数生效矩阵、多模态范围。不能用实验本地守卫已经通过掩盖它们。
5. **无法验证**：真实Provider账户/费用/目录、Windows/Electron安装与凭证、真实资源竞争/恢复/账本；不能给生产采用证书。

## 下一批真正必要的范围（不用再设计API）

仅在正式模块施工被授权后，按已有API-01～10完成一个实际Provider纵向切片：

- 使用WEX Connection/Model/协议版本/修订与凭证引用，构建不可变请求快照；密钥仅经宿主当前权限准入后使用。shared凭证平台后端未实现，不以Pi auth存储填坑。
- 先为Chat严格处理DONE边界、唯一终态与有界事件供给，复用旧向量并加传输不再发送时的中止/join；若无法低成本完成，继续保留旧decoder路径，别不断扩写一个新SDK。
- 对请求参数做明确生效/不支持结果，对媒体先校验，拒绝保留字段覆盖；使用最终完整工具意图，执行另走permissions/connections。
- Continuation采用原owner受控引用和严格作用域，验证真实工具回合与迟到回执；本批plain envelope不得直接上线。
- 只选用户实际要用的一个Provider做真实最小请求和工具往返，记录费用与端点版本；未有Key时保持明确NOT_RUN。Google/其他Provider在进入施工时单独过transport门槛，不为“多支持一家”放松安全。
- 最后运行同等DEC回归、真实宿主/Windows集成与独立验收。SDK版本升级重跑全部负例，旧快照不被新compat设置追改。

**否决条件已达到**：A整体替换存在可复现退化，本批不再无限研究寻找“所有厂商全通过”。C是有条件的协议复用建议，未关闭产品政策、未选定Rust桥接方案、未重构正式API。DSH LLM仅作既有研究参考，没有引入第四套运行时。
