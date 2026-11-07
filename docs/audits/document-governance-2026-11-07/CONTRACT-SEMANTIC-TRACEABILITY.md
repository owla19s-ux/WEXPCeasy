# WEXPCeasy｜历史 CONTRACT 语义对冲与证据链专项（2026-11-07）

> 性质：文档治理专项审查记录，**不是**新的产品决策、接口定义、源码验收或施工授权。
>
> 起始核验：2026-11-07 `main` 最近提交 `214932f47bab4b0ff69e6bcbdcbe399bf95a2520`。远端仍可能并行更新；任何后续施工须重新读取 HEAD。
>
> 范围：本轮重点核对 Space、Permissions、Connections、UI 的历史契约与现行要求、源码证据，并识别旧索引误导。**并未完成全仓所有旧 CONTRACT 逐条语义对冲、最新完整文件树扫描或测试运行。**

## 1. 证据链与裁决规则

每项条款依次记录：**历史研究原条款（ID、原状态 A/B/C/D）→ 后续产品确认及时间 → 当前模块 README/正式计划的要求 → 实际产品源码的入口和行为 → 独立测试及 CI/Windows 实机证据**。缺少一环必须标为「待核」，不得通过修改历史正文制造一致。

- 历史条款分为：**继承**（仍有效）、**替换**（后续批准决定覆盖）、**延期**（不在 0.1.1）、**待裁决**（尚存结构/政策冲突）、**未实现**（需求已确定但代码缺口）、**证据不足**（源码或测试尚不能证明）。可同时存在“继承+未实现”等状态；禁止混用。
- 当前施工入口仍为根 README → 模块 README → 源码与测试；产品规则以已确认决策和产品正文为准，版本范围以 0.1.1 PLAN 为准。历史 CONTRACT 不能因为正文出现“可施工”“本域规范”“当前”就自动升级为新权威。
- **代码证明现状，不自动批准政策**；源码与已确认决策冲突时，标记实现差异，不能默认为代码设计正确。通过测试只证明覆盖的行为，不推导 Windows 实机或完整业务闭环。
- 不修改归档研究原文；不删除仍有追溯价值的编号、记录或历史证据。影响产品权限、接口或数据迁移的变更，先报告并单独确认。

## 2. 本轮实查对冲矩阵

| 编号 | 历史条款与出处 | 后续确认/当前要求 | 源码或证据 | 分类 / 处理 |
| --- | --- | --- | --- | --- |
| CT-01 | `docs/research/contracts/space/CONTRACT-2026-10-31.md` SPC-02：多处 Placement、解除关系不删 Context | `space/README.md` 明确 Placement 不是产品层级；组织模型与内部关系表达需区别，不得未经确认改结构 | `space/src/model.ts` 当前有 `ContextOrganization` 和 `context.group` 命令；`space/src/service.ts` 有持久化与权限检查路径 | **待裁决 / 部分替换**：保留“不隐删 Context”等不变量；**不能将多 Placement 视为已确认的新 UI 概念，也不能断言已实现历史多处放置**。需单独核对数据语义和迁移风险 |
| CT-02 | Space SPC-01/03/04 与资源引用补充：独立 Context、组合引用、权限隔离；历史研究要求资源 owner 核验 | `space/README.md` §1.1 明确主地址 + 多条名称/地址/备注的附加地址，登记未验证地址不等于实际读取或授权；工具选择与执行绑定分层 | `space/src/model.ts` 有 `Context.primaryAddress`、`Address`、`association.add`、`tool.add`、`primary.select` 等类型与命令；`space/src/service.ts` 显式调用 Permissions 判定与复核 | **继承 / 部分实现 / 证据不足**：字段和受控路径存在；尚未在本轮运行 S01–S20 或完整 Windows 操作，不宣称端到端验收 |
| CT-03 | 历史 Space 契约尾段“模块业务语义以本文件为准”“施工先读 README/CONTRACT” | 根 README、Space README 和 11-07 第二轮治理明确：历史 CONTRACT 只供追溯，当前从模块 README 施工 | 历史文件顶部已有非施工声明，但正文尾段仍保留旧命令式语气 | **替换 / 误读风险**：顶部状态标记优先；保留正文作历史，不批量消灭历史语气，必要时在现行入口添加精准禁止引用说明 |
| CT-04 | `docs/research/contracts/permissions/CONTRACT-archive.md` 权限体系的原始能力编号及候选细则 | `docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md` A 明确入口独立授权、四级对话、IV级授权内全风险自主、工作流启动一次确认；B 特殊信任边界尚待确认 | `permissions/README.md` 明确 `permissions/src/index.ts` 已有 evaluate/recheck/grant/revoke/history；非对话入口仍 `entry_policy_unresolved` | **产品规则继承 + 未完全实现**：不能用历史候选覆盖现行 A，也不能用产品 A 推导代码已经支持非对话入口；正式 IPC 身份与资源侧判权仍待验证 |
| CT-05 | 历史 Connections/C01–C05：Operation 唯一权威，连接器不自批权限、不维护 Task | `connections/README.md` 当前分公共连接宿主、API、GitHub、Local；`environments/` 是并列 owner，不是 Local 连接器；DSH 外部连接器延期 0.1.2 | `connections/README.md` 列出 `connections/src/`、API/GitHub/Local 正式源码和测试；GitHub 官方 MCP/Octokit 尚待完整接入 | **继承 / 缺口与延期并存**：保留 Operation 唯一维护与 owner 分工；旧研究“只有 DSH”“Cordis 默认”“无产品公共源码”等时间事实不能派工 |
| CT-06 | `UI/CONTRACT.md` 第四批 UI 草案：窄桥、提交未知反馈、无权数据不泄露；原始状态说正式产品 UI 未实现 | `UI/README.md` 与 11-07 PC V0.6、B3 D-08/D-09 是现行施工依据；UI CONTRACT 已加历史声明，不再兼任现行规范 | UI README 列出正式 React 入口、Space 页面及共享工作窗口相关增量，但完整对话/设置/Windows 交付仍未验收 | **原则继承 / 实现状态替换**：保留安全与结果反馈研究，禁止将“无产品 UI”或旧固定列布局当作今天代码状态 |
| CT-07 | `docs/MODULE-CONTRACTS.md` 第四批索引含“当前实现与证据状态（2026-10-31）”和“README + CONTRACT”施工措辞 | 现行 `docs/README.md` 已明确该索引为历史；11-07 SECOND-PASS 也确认旧索引不派工 | 旧表中的“Space/AI/Conversations 无正式实现”“UI 仅隔离原型”与当前模块 README 代码事实不同 | **已被替换的状态快照 / 二次误读风险**：不可将历史表迁成当前完成率；可以定向引用其条款编号和源文件 |
| CT-08 | 0.1.1 之前研究包含工作流自由格子、Scheduler、DSH 插件和外部 DSH 连接器等设计 | `docs/versions/0.1.1/PLAN.md`：这四项延期 0.1.2；根 README 和 Connections README 均重申 | 历史实验及部分源码不能证明已进入正式产品验收 | **延期**：历史技术价值保留，不允许由合同/研究条款反向扩版 |

## 3. 本轮禁止直接交 Codex 猜测的事项

1. **Space 的多处放置能力与 Context 组织关系**：核实实际源码是单位置还是多位置、历史持久化格式是什么、是否有迁移需要；用户不认可 Placement 产品层级，不能自行补 UI 或变更数据结构。
2. **Permissions 非对话入口**：需按已确认矩阵和真实可信身份设计最小独立入口；不能拿对话许可代替 Task/UI/回调许可。特殊信任边界仍是 B，不因 IV级政策被默认放开。
3. **GitHub 官方模块**：按 connections/github 独立 owner 审核依赖、运行方式、具体官方能力接入及真实集成测试；不能把已有基础读写适配称为官方集成完整。
4. **UI 历史固定列/旧 Renderer 状态**：按最新 V0.6 和实际共享工作窗口检查；现行源码变动本身不构成 Windows 验收。
5. **旧 CONTRACT 的验收样例**：逐条找真实测试文件、断言和最近有效 CI SHA；没有运行证据一律记“待验证”，不自动判绿。

## 4. 后续完整审查应形成的条款级账本

对每份历史 CONTRACT 逐条增加记录字段：

`contract_path | clause_id | original_grade | original_claim | subsequent_decision_path+anchor | current_owner_readme+anchor | code_path+symbol | test_path+assertion | test_run_sha/environment | classification | conflict/severity | required_decision | next_action`

优先顺序按误施工风险：**Permissions → Space → Connections/子连接器 → App/Shared → AI/Conversations → UI/Views → Workflows/插件及延期域**。逐条对冲后再考虑裁撤兼容入口；旧研究本体只归档不覆盖。

### 验证限制

本次使用 GitHub 连接器定向读取文档和源码，**未克隆完整工作树、未执行测试、未验证完整相对链接/锚点，也未完成全部契约逐条对冲**。本报告仅建立可继续核验的证据与冲突清单，不能作为 0.1.1 模块签收。


## 5. 第二轮深入对冲：Permissions 与 Space（2026-11-07）

> 本节核对当前 main 的正式源文件及测试**文本**，并读取已有执行回执；**本轮未实际执行测试**。它纠正上文 CT-01/CT-04 的粗粒度描述，以本节较新核对为准。避免把未复跑的历史绿灯写作本次验收。

### 5.1 Permissions 条款级对冲

| 追踪 ID / 历史条款 | 产品决策及现行要求 | 最新源码与直接测试证据 | 对冲结论 |
| --- | --- | --- | --- |
| PER-01 / PERMISSIONS-EVALUATION-001：每次按可信主体、入口、目标与动作判断 | 精确判定，不默认允许；来源不明拒绝/不可判定 | `permissions/src/service.ts:2-18,43-63` 的 `Scope/Facts` 和 `evaluate`；`permissions/tests/local.test.mjs` 对跨主体、窗口、Context、目标、动作及代次隔离有测试 | **继承 / 基础实现有源码与测试**；实际 Windows 身份绑定仍待核 |
| PERMISSIONS-ENTRY-001 / G3：入口独立，非对话不冒用 Conversation | 对话、本地 UI、Task、回调分开策略；用户已批准独立入口与默认拒绝 | `service.ts:50-56`：`local` 接受 `conversation:null`，但必须由可信宿主给出 `entryEnabled:true` 且存在精确 Grant；`conversation` 需要非空 Conversation；`task`、`callback` 仍 `entry_policy_unresolved`。测试：`permissions/tests/local.test.mjs`，集成 `permissions/tests/local-space.test.mjs`、`app/tests/context-groups.test.mjs` | **部分实现 / 纠正现行文档事实**：不再说“所有非对话入口均拒绝”；本地入口仅受控实现，Task/Callback 仍阻断 |
| PER-02 / PERMISSIONS-GRANT-001：精确许可与审批 | 不允许 AI 自批或自然语言伪授权 | `service.ts:64-82` `trust.canManage` 前后核验、CAS/意图结果；`permissions/tests/local.test.mjs` 的独立 Grant/窗口测试 | **基础授权写入实现；交互式待批/审批策略仍未证明**，不能把 grant 等价为完整审批流程 |
| PER-03 / PERMISSIONS-REVOCATION-001 / RECHECK-001：撤权与执行前复核 | 撤权不能复活过去许可，不宣称已停止外部动作 | `service.ts:84-90` 的 `recheck`，`local.test.mjs` 的撤权/重新授权旧决定失效测试；`space/src/service.ts:35-38,46-59` 使用复核 | **继承 / 基础实现有测试**；副作用边界与撤权竞态尚未被本轮证明 |
| PER-04 / HISTORY-001：历史与可见查询 | 旧 Grant 是审计事实，不是当前有效授权；普通可见性应按许可限定 | `service.ts:91-96` `history` 仅在 `TrustPort.canReadHistory` 允许时返回完整记录 | **部分实现**：可信管理历史入口存在，普通用户按范围投影、分页、最小披露未证 |
| D01 / D02 四级对话、工作流启动一次确认、AI 资格链 | `docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md` 标为 A 已确认（特殊信任边界为 B） | `Facts` 仅含基础开关/来源和局部 `entryEnabled`；`service.ts` 未提供对话四级/工作流节点许可计算；模块 README 自认未落地 | **规则已确认 / 仍未完整实现**：不得用现有基础 Grant 冒充四级/节点策略，也不得把 B 特殊边界升 A |

**纠错依据**：`permissions/evidence/2026-11-05/local-entry.json` 报告已有 `npm run test:permissions` 14/14、`npm test` 223/223 及类型检查通过；此为 **2026-11-05 历史回执**，并明确真正 app/OS/IPC 身份接入未完成、模块未签收。本轮只读验证了其对应源文件和测试文件确实存在，未复跑这些命令。现行 `permissions/README.md` 中“非对话入口仍返回 entry_policy_unresolved”的笼统描述已落后于本地受控入口实现，需定点纠正。

### 5.2 Space 条款级对冲

| 追踪 ID / 历史条款 | 当前要求 | 最新源码与测试证据 | 对冲结论 |
| --- | --- | --- | --- |
| SPC-01 独立 Context 身份与组织本体 | Context ID 稳定，目录和组织变动不隐式搬正文 | `space/src/model.ts:3-8,24-25,56-58`；`space/tests/space.test.mjs` 的进程重启、目录保持测试 | **继承 / 正式实现可定位**；测试本轮未复跑 |
| SPC-02 多处 Placement | 用户确认 **Placement 非产品层级**；保留“解除关系不删本体”的基本边界，是否支持多处引用须另判 | `model.ts:24,41,56` 每个 Registry `Registration` 仅有可选单个 `organization`；`service.ts:72-80` 更新该组织对象，跨 Space 返回 `cross_space_move_unconfirmed`；`space/tests/space.test.mjs` 明确把 `placement.add` 断言为 `unsupported_command` | **历史多 Placement 行为并未成为当前公共命令**；不能向 Codex 派工“实现 SPC-02 所有多处放置”，但也不能仅凭当前单位置代码擅自裁决长期多位置能力 |
| Context 分组移动（后续新增） | 分类/Space/Group/Context 组织操作应保留身份，不搬资源；Context 不是目录别名 | `service.ts:72-80,211-215,239-247` 单组织记录、乐观修订、独立读取；`space/tests/context-groups.test.mjs` 含分组移动、重启恢复、旧修订、丢 ACK、离线目录和损坏拒绝；`app/tests/context-groups.test.mjs` 含真实 App/Permissions/Space/SQLite 组合（宿主身份为测试夹具） | **已实现相应有限范围并有独立测试文件**；Windows/真实 UI 与跨 Space 策略未验收 |
| SPC-03/06 ResourceReferences 与主地址 | 主地址为选择，不等于目录/权限；附加地址含名称、地址、备注，可未验证 | `model.ts:6-8,30-49` 的 `primaryAddress` 与 `address.add/edit/remove`、`primary.select`；`space/tests/space.test.mjs` 的主仓/操作/产出/参考四条独立地址测试 | **继承 + 后续细化已实现基础功能**；不推断任意真实远端资源操作已完成 |
| SPC-03 Tool/Association 不授权 | 工具资格、Context 开启、实际执行授权分离 | `model.ts:9-21,30-49` 的独立目标/关系与工具结构；`space/src/service.ts` 的权限/owner 检查；`space/tests/space.test.mjs` 的 Role/API 引用隔离测试 | **继承 / 基础关系实现**；工具真正执行属于其他 owner，不能据此宣称链路闭环 |

### 5.3 新增确认的问题与分级

- **DOC-P01（高）**：`permissions/README.md` 的“所有非对话入口阻断”表述落后于 `2026-11-05` 本地入口实现；**修正文档事实**，同时保留 Task/Callback 未开放、Windows IPC 未验收的明确限制。
- **DOC-S01（高，产品裁决边界）**：旧 SPC-02 多处 Placement 与当前单组织接口不是同一能力。历史行为不能自动派工；如要多 Space 引用需明确用户语义、唯一性、关系生命周期、迁移与测试，不借文档治理改源码。
- **DOC-T01（中）**：`space/tests/space.test.mjs` 存在“real permissions blocks local entry”的测试名称，但其测试夹具传入 `conversation:'none'` 且没有 `entryEnabled`，断言的是**不符合新本地入口规则的旧式请求被阻断**；不得把该单测解读为“所有合法 local 入口不能授权”。`permissions/tests/local.test.mjs` 已覆盖合规 local 正例。
- **DOC-E01（一般）**：已读取历史通过回执和具体测试文件，但未获得本轮执行环境的最新结果；本审查不更新模块签收状态。

### 5.4 下一阶段条款

沿用同一方法定向核对 `connections` 公共派发与 `connections/api`、`connections/github`、`connections/local` 的历史条款、正式出口和测试，尤其注意 GitHub 官方组件尚未完整集成、环境管理独立 owner，以及 Operation 结果未知不得自动重派。未审其他 CONTRACT 不标为已收敛。


## 6. 第三轮深入对冲：Connections 公共边界与 GitHub 官方组件（2026-11-07）

> 依据当前 `connections/src/`、`connections/github/src/index.ts`、`app/src/foundations.ts` 和既有测试源文件。仍是静态源代码与测试内容审查，没有本轮最新 CI 或 Windows 运行证据。

| 条款与来源 | 当前源码及测试追踪 | 结论和 Codex 边界 |
| --- | --- | --- |
| 历史 Connections `CONTRACT-archive.md` C01：连接配置、能力发现，不因启用获得授权 | `connections/src/index.ts` 已公开 `createConnectionConfigs`、`createConfiguredReadBoundary`、`createConfiguredDispatchBoundary`；`connections/src/configured-dispatch.ts` 受配置绑定 | **保留所有权与配置限制，基础能力存在**；不可把历史“无产品连接协议”视为新建要求 |
| C02：记录意图、单次派发、禁止未知副作用自动重试 | `connections/src/operations.ts` 的 `prepared/dispatched/observed/unknown`，`connections/src/dispatch.ts` 包含 `already_recorded_no_automatic_retry`，异常观察进入 unknown；相关测试：`connections/tests/operations.test.mjs`、`dispatch.test.mjs`、`durable-dispatch.test.mjs` | **继承并有真实源码/测试文件**；只证明提供方存在，不自动宣称所有连接器真实外部效果已验收 |
| C03/C04：查询、停止、恢复不可伪造远端状态 | Operation ledger 可回读观察，测试有持久化/异常样例；未审到全部远端 stop/continue 的统一真实实现 | **部分实现/证据不足**；不能把本地取消等同于 GitHub 远端撤销 |
| C05：外部反向调用必须独立认证并按最低权限提供能力 | 核查公共公开出口没有充分证明通用外部回调身份认证及真实 IPC/Windows 边界 | **待验证/不可自动开放** |
| GitHub 官方 SDK：历史 `connections/github/CONTRACT.md` 完整目标 GH-01～GH-12 | `connections/github/src/index.ts:1-9,110-188` 已真正导入 `Octokit`、`@modelcontextprotocol/sdk`，提供 `createGitHubOfficialClientFactory`；`app/src/foundations.ts:5-6,177-204` 装配官方客户端；`connections/github/tests/official-client.test.mjs` 测试禁自动写重试、Key隔离、授权复核、SQLite 重启后 unknown 不重派 | **部分实现，必须纠正“尚未接入官方组件”的旧结论**。有真实 SDK 代码 ≠ 覆盖 GitHub 官方全部能力或完成真实外部写入验收 |
| GitHub 官方 MCP：原方案选官方 MCP Server，Octokit 补缺口 | `connections/github/src/index.ts:188-298` 的 `createGitHubMcpFileReader` 使用 SDK + Stdio、受信运行命令与 SHA-256 固定校验；`connections/github/tests/mcp-client.test.mjs` 通过模拟 MCP 服务进程测试初始化、读取、取消、超时、撤权、哈希校验与秘密隔离 | **实际已有受限 MCP 读取适配**；不要重新发明 MCP 客户端或宣称全部 MCP 工具集已装配；真实官方 server 运行/分发需另验 |
| Local 与 environments 边界 | `connections/local/src/index.ts` 已有受控文件/目录读取、文件更新适配；`connections/local/README.md` 与 `environments/README.md` 明确不同 owner | **保留**：环境生命周期不并入 Local；Shell/安装器与完整本地 Git 不因现存文件功能自动纳入首版 |

### 6.1 本轮纠正与任务状态

**DOC-G01（高）：** `connections/github/README.md` 顶部仍称“SDK/MCP 尚未完整产品化”，这句话若限定“**完整能力/交付**”仍然成立；但不能缩写成“官方组件尚未接入”。已有官方 `Octokit`、MCP SDK、受控读取及 App 装配源码，后续先做能力覆盖与交付缺口审计，绝不重复集成基础客户端。

**DOC-G02（高）：** GitHub GH-01～GH-12 是**长期完整目标/条目索引**，不是全部已实现，也不是全部 0.1.1 必做；必须按 B3 D-06/D-06A 与正式版本计划分别划分已实现、已测试、需真实远端、需 Windows 分发、延期。

**DOC-C01（中）：** 保持 Operation 单一账本，严禁具体连接器另建正式尝试账本；外部写入发生后失败、超时或连接断开需要核对原 Operation，不能把 REST/MCP 超时当确定未写入。

**限制：** 尚未执行 `npm test`、`npm run test:github`（实际命令需按 package.json 核验）或 Actions 全部运行集合的 SHA 检查；没有验证 GitHub 实例的真实读写权限、官方 MCP Server 二进制分发和 Windows 实机运行。代码存在不等于业务验收。


## 7. 第四轮条款对冲：App / Shared / AI / Conversations（2026-11-07）

> 核验本轮开始时 main `a824ceba2d3b...`。本节直接读取现行 README、四份历史 CONTRACT、正式代码的公开出口及关键测试文本；**未运行本轮测试或 Windows 实机**。以下「有测试」指测试源码可定位，不代表当前 SHA 已通过。

| 历史条款 | 当前设计/owner 边界 | 最新产品源码与测试定位 | 分类及派工限制 |
| --- | --- | --- | --- |
| APP-01 数据根/安装接入 | App 决定可信启动与用户数据根；Shared 仅验证根和路径，不得在失盘时静默建空业务数据 | `app/src/desktop-main.ts` 已有 Electron 启动、根选择及凭证适配入口，`app/src/foundations.ts` 已有真实模块装配；`app/README.md` 明示 Windows 安装、首次选根、重装恢复仍待验收 | **继承/部分实现**：不要因历史“仅 headless”重新建桌面启动入口；也不能据现有 `desktop-main` 宣称安装完整 |
| APP-02 可信装配/窄 IPC | 宿主提供可信事实，不复制 Space、AI、Conversation、Operation 或 Permissions 权威 | `app/src/index.ts` 导出 `assemble` 与 `startFoundations`，`app/src/foundations.ts` 公开注入 Permissions、Shared、Space、Connections、API、AI、Conversations；已有 `desktop-*.ts` 正式入口 | **继承/部分实现**：基础宿主已有，Windows 真身份/IPC/来源绑定还须以具体调用和测试逐项核对 |
| APP 生命周期/恢复 | 关闭窗口不等于停止工作；不同 Owner 的在途状态分开恢复 | `app/src/foundations.ts` 装配、生命周期与停机；`app/README.md` 列有连接排空证据，仍未宣称完整 Windows 恢复/安装 | **继承/部分实现**：不得把关闭进程当 Task/Operation 已完成；不能凭最小停机测试推导外部 Agent 终止 |
| SH-01/02 数据根、SQLite/CAS/Intent | Shared 管技术持久化，不管理领域业务语义 | `shared/src/index.ts` 导出 `inspectRoot`、`directoryLock`、`openSqliteStore`；`shared/src/storage.ts` 存在 `Store.read/commit/query`、快照/期望修订/意图；领域消费于 `app/src/foundations.ts` | **继承/基础实现存在**：跨库原子、Windows ACL/进程竞态不因此成立 |
| SH-04/05 凭证引用与系统后端 | 业务只保存凭证引用；真实秘密不进入普通配置和日志，授权另由 Permissions | `shared/src/credentials.ts` 有 `createCredentialVault`、Cipher/Binding/Access；`app/src/desktop-credentials.ts` 有 `createWindowsCredentialCipher` 并调用受限 `safeStorage` 抽象；测试 `shared/tests/credentials.test.mjs`、`app/tests/desktop-credentials.test.mjs`、`app/desktop/tests/credential-storage.mjs` | **原“未实现”状态已替换为部分实现**：已有源码与测试，不可重复造 Vault；实际 Windows 系统身份/凭证恢复与卸载重装仍未验收 |
| SH-06 技术诊断 | 技术日志不替代业务账本，不泄漏秘密 | `shared/src/persisted-diagnostics.ts` 导出 `createPersistedDiagnostics`；`shared/tests/persisted-diagnostics.test.mjs` 测试 SQLite 重启回读、字段白名单、容量失败保留、提交 unknown 与损坏拒绝；`app/src/foundations.ts` 装配 | **部分实现且测试存在**：旧“仅受限 sink、无持久技术诊断”不能用于现行施工。完整日志轮转/Windows 目录/脱敏实测仍待验 |
| SH-03 备份与恢复 | 技术原语不决定领域对象和跨模块恢复政策 | Shared 当前公开出口未见完整全域备份/恢复流程；`shared/README.md` 仍列为规划 | **未确认完整实现/待证**：已有 SQLite 重启和领域恢复不等于全量备份恢复 |
| AIC-01/02 Agent/角色/职责 | Role、Position、Agent、Model 引用与权限分离 | `AI/src/index.ts:6-10` 的 `Configuration` 明确 `role`、`position`、`agent` 三类；`createAiConfigurations`、`verifyModelWithApi`；`AI/tests/config.test.mjs` 验证修订、模型引用与拒绝 | **继承/基础配置实现**；角色配置不是自主 Agent Runtime，亦非授予权限 |
| AIC-03/04 运行实例/Session 映射 | 配置引用与实际执行 Session/外部代理是不同对象 | 当前 AI 公开入口主要为配置与模型引用验证；`AI/README.md` 将自主引擎及外部 Session 生命周期留待后续 | **部分实现/长期能力未证**：不得让 Codex 在 0.1.1 因历史条款补全自主循环或 DSH Session |
| AIC-05～09 派生记忆、共享、用户偏好 | D10/保留策略未批准，前期不建立长期记忆平台 | `AI/src/index.ts` 所读公开配置类型未定义长期记忆实体；`AI/README.md` 明示当前不冻结记忆模型 | **延期/待裁决**：旧契约完整需求是历史追溯，不是当下施工授权 |
| CV-01/02/03 会话、消息、序列项 | 独立 Conversation 不依赖 Task/Context，消息属于本域 | `conversations/src/index.ts:5-25` 的 `Message/Segment/Generation/Conversation` 和 `createConversations`；`conversations/tests/conversations.test.mjs` 验证消息、重启恢复及损坏拒绝 | **继承/基础实现**；正式 UI 交互另验 |
| CV-04/06/07/08/09/12 段落选择、重发、生成、工具往返 | 区分原消息、修订/重发、逻辑生成和 Operation；未知副作用不可盲重试 | `conversations/src/index.ts:18-26` 目前有 `select`、`append`、`resend`、`begin`、`finish`、`dispatch`、`cancel/fail/unknown`；`createConversationGeneration`；`conversations/tests/conversations.test.mjs` 包括取消与迟到回执情形 | **部分实现**：现有 `append` 是消息加入/保存命令，不能自动认定支持历史 CV-07「生成期间独立追加队列」；`select` 不等于 CV-15 采纳/拒绝；流式对接和正式页面另验 |
| CV-05/15/16 分支、采纳、序列项局部补充 | 独立分支与主线采纳不同于消息选中；复杂交互不应借普通消息操作冒充 | 当前 `ConversationChange` 没有显式 `branch`、`accept/reject` 或单序列项修订命令；`conversations/README.md` 也未宣称完整分支实现 | **仍属缺口/待版本核对**：不凭历史 CV 编号自动扩 0.1.1；也不据源码缺少同名命令断言用户需求已废止 |

### 7.1 高优先级的施工误判

- **DOC-SH01（高，事实过时）**：`shared/README.md` “凭证与安全存储：历史设计”“SH-06 仅 sink”的旧阶段描述需要改成**已有 Vault、Windows 安全存储适配和持久诊断源码/测试，真实 Windows 安全与运行恢复仍未验收**；不可复制创建另一套凭证库/诊断账本。
- **DOC-AI01（中）**：历史 AI 契约的 AIC-05～09 不足以授权 0.1.1 建记忆平台；`AI/src/index.ts` 的角色/岗位/Agent 配置已经实现对应基本对象。
- **DOC-CV01（高，功能等价风险）**：消息段落 `select` 与「明确采纳/拒绝」不同；当前 `append` 不自动证明“生成中追加下一轮输入队列”，`resend` 不证明历史分支/局部修订齐备。验收需要按业务行为查而不是按方法名计数。
- **DOC-APP01（高，安全）**：App 已有正式 Electron/React 宿主和业务装配，但不能借宿主存在而放行尚缺可信身份确认的 IPC/Task/回调；继续引用 Permissions 受限 local 入口政策和严格操作授权。

### 7.2 证据限制

没有最新全仓构建、真实 Windows E4、完整进程/文件系统或凭证系统验收；测试文件存在与其历史报告分开记录。以上代码路径是可继续逐断言核验的具体定位，不构成自动签收。
