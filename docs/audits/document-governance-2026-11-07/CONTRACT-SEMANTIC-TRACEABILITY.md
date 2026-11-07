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
