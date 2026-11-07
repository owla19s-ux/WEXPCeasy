> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# WEXPC1 ↔ WEXPC 差异审计 V0.1（轻量）

- 日期：2026-10-28
- 主仓基线：`owla19s-ux/wexpc` main `faf11f31d`（2026-10-27T16:34:53Z）
- 证据范围：主仓递归文件树（371 个文件）、`docs/REPOSITORY-STRUCTURE.md`、`docs/architecture/WEXPC-LIGHTWEIGHT-HOST-ARCHITECTURE-V0.1.md`、`docs/proposals/WEXPC-ARCHITECTURE-DEDUP-BASELINE-REVIEW-V0.6.md`、`contracts/README.md`、`docs/PROJECT-CONSENSUS.md`
- **边界**：本审计是目录/文档级轻量审计，**未逐行审代码、未运行测试、未验证 Windows 实机、未核对 PR 与 main 的逐文件差异**。所有“现状”判断以路径、文件命名和文档声明为依据；涉及具体行为时必须回到源码与运行证据。
- 目的：判断 WEXPC1 的规则哪些可直接用、哪些要改、哪些不适用；**不搬目录、不改主仓**。

## 0. 结论摘要

1. **主仓已不是 greenfield**：137 个 `.rs`、37 个 `.tsx`、8 个 Rust crate、Tauri + React 桌面应用、`contracts/`、52 个 Rust 测试文件、17 个前端测试、不可变回执/检查点。WEXPC1 的“先搭骨架再迁”不适用。
2. **WEXPC1 的目录树不能作为施工令**：主仓已明确“职责模块是逻辑边界，不要求一模块一 crate/进程/数据库”。目录重排应降为 P2，且以审计结果为依据。
3. **四个真冲突**（P0）：双基线、连接器跨层分散、能力声明缺失、权限多入口。
4. **一个需要优先核实的信号**（P1）：`domain/` 与 `application/` 存在三组同名文件（`execution_policy`、`task_records`、`member_brief`），可能是合理分层，也可能是重复 owner；必须审源码确认。
5. **建议顺序**：先规则校准（把 WEXPC1 规则与主仓基线四分类）→ 连接器能力声明/统一调用 → 权限单点 → 窄试点 → 公共机制 → 最后才谈目录与拆 crate。

## 1. 主仓现状快照

| 维度 | 现状 | 证据 |
|---|---|---|
| Rust | 137 个 `.rs`，8 个 crate：`wex-core`、`wex-api`、`wex-desktop-service`、`wex-access-store`、`wex-local-resources`、`wex-workspace-store`、`wex-protocol`（+ `bridge/flutter-rust`） | 递归树 |
| 前端 | `apps/desktop`：Tauri 2（`src-tauri/`）+ React/TS（37 个 `.tsx`、5 个 `.ts`） | 递归树 |
| 测试 | 52 个 Rust 测试文件；16 个 `.test.tsx` + 1 个 `.test.ts`；`reviews/` 有 harness | 递归树 |
| 契约 | `contracts/api_pc_01.rs` + 测试；`docs/INTERFACE-CONTRACTS.md` | 目录 |
| 持久化/回执 | `wex-workspace-store`（organization/tasks/operations/agent_dispatch）、`wex-desktop-service/infrastructure`（immutable_file/sqlite）、近期提交涉及 receipt digest / pre-dispatch marker / journal | 目录 + commit 记录 |
| 文档 | 75 个 `.md`，含轻量宿主架构、去重审查 V0.6、多份耦合/硬编码审计、实现计划 | 目录 |
| 参考资产 | `reference/flutter-android`（83 文件）、`bridge/flutter-rust`（14 文件） | 目录 |
| 当前路线 | “只补缺口，不推翻现有 Core/Dispatcher，不用‘联通’语义重命名代码，不触发无收益重构” | `WEXPC-ARCHITECTURE-DEDUP-BASELINE-REVIEW-V0.6.md` |
| 模块观 | “职责模块是逻辑边界，不要求一模块一个 crate、进程、数据库或网络服务；首版可在现有桌面进程内运行” | `WEXPC-LIGHTWEIGHT-HOST-ARCHITECTURE-V0.1.md` §1 |

## 2. 映射矩阵

处置含义：**保留**（原样用）、**适配**（加接口/声明）、**包裹**（外面加统一层，内部不动）、**替换**（计划退役）、**仅参考**（历史资产）、**冲突**（需裁决）。

| 现有单元 | 现状 | WEXPC1 对应规则 | 处置 | 批次 |
|---|---|---|---|---|
| `crates/wex-core`（access、connection_session、dispatch、dispatch_leases、execution_policy、local_edit、operation、task、task_operation） | 平台无关规则，多责任集中在一个 crate | 领域/机制应分模块；操作账本、调度、任务、权限各有 owner | **包裹/渐进拆**：先建“逻辑模块 owner 表”；operation/dispatch/lease/task/policy 分别标注 owner，不立即拆 crate | P1 |
| `crates/wex-desktop-service/src/domain`（agent_assignment、execution_policy、member_brief、organization、task_records） | 领域对象 | 领域模块应内聚、有明确不变量 | **保留/适配**：domain 内按业务域分组，补模块说明；先审同名文件 | P1 |
| `crates/wex-desktop-service/src/application`（organization、task_records、process_control、tool_reply、member_brief、execution_policy） | 应用服务编排 | 应用服务负责跨领域编排 | **保留**：方向正确 | — |
| `crates/wex-desktop-service/src/connectors`（github/local/process/terminal/git/openai + intent_binding/tool_round/proposals） | 已按连接器分文件，但共享一个 crate，且含调度/提案/回合逻辑 | 每个连接器完整模块；能力声明；统一调用 | **适配（P0）**：保留 crate，先抽能力声明 + 统一 Invocation；验证新增 Issue 的局部性；拆 crate 后置 | P0 |
| `crates/wex-desktop-service/src/infrastructure`（immutable_file、sqlite） | 持久化机制 | 公共 store/ledger 机制 | **保留/升级**：作为 `store`/`ledger` 种子，补事务与恢复契约 | P1 |
| `crates/wex-api`（decoder/encode/errors/types） | API 协议核，独立 crate，有测试 | 契约层的一部分 | **保留**：作为 provider 协议核，不升级为通用契约 | — |
| `crates/wex-access-store` | 私有 ACL、原子替换、读会话、Windows 测试 | 安全机制/凭证与授权 | **保留**：归入 secrets/grant 方向 | P2 |
| `crates/wex-local-resources` | 本地文件读、平台 unix/windows、排除规则 | 能力模块 + host | **保留**：作为 local-files 能力与 host 的种子 | P2 |
| `crates/wex-workspace-store`（catalog、operations、tasks、agent_dispatch） | 一个 store 存多个领域 | 每模块自带数据与迁移 | **适配**：先补 owner 声明；后续按域拆迁移，不急于拆 crate | P1/P2 |
| `crates/wex-protocol` | 严格 JSON 边界 + demo 操作 | 契约/协议 | **替换候选**：demo 操作退役，严格解析技术可保留 | P3 |
| `apps/desktop/src-tauri/src/vault.rs` | 凭证存储 | 公共 secrets | **适配**：作为 secrets 实现，模块只拿引用 | P1 |
| `apps/desktop/src-tauri/src/tool_approvals.rs` | 工具审批 | 权限执行点/审批 | **适配/收敛**：并入统一 policy 执行点，避免与 UI 双判 | P0 |
| `apps/desktop/src-tauri/src/tool_catalog.rs` | 模型可见工具目录 | 能力 registry/descriptor | **适配（P0）**：补 descriptor 字段（副作用/审批/幂等/证据/范围），向 registry 演进 | P0 |
| `apps/desktop/src-tauri/src/github_config.rs` | GitHub 专属配置在 Host | 连接器完整模块 | **适配/后移**：先包裹，后续迁入 GitHub 能力模块；Host 只留平台适配 | P1 |
| `apps/desktop/src-tauri/src/local_access.rs` / `main.rs` | Host 平台入口 | Host 只做平台 | **保留/审计**：确认无业务编排 | P1 |
| `apps/desktop/src`（React） | 37 个 `.tsx`，含 Chat/Connections/ContextBinding/Organization/Projects/Tasks/TaskJournal/ToolReceipts/Process*/Settings 等 | UI 只持展示/草稿；工具列表由声明驱动 | **保留/审计**：检查是否有 UI 权威状态、工具列表是否硬编码；状态投影是否由事件刷新 | P1 |
| `contracts/` | 类型提案 + 测试，独立目录 | 契约 | **保留**：作为 `contract` 种子；不与之另立第二套 | — |
| `reviews/`、`scripts/` | 验收 harness、脚本 | 护栏 | **保留**：并入 testkit/arch-check 方向 | P1 |
| `bridge/flutter-rust` | 旧 FFI | 仅参考 | **仅参考**：不进入 Tauri 路径 | — |
| `reference/flutter-android` | 历史 Flutter UI 与测试 | 仅参考 | **仅参考**：不进入构建 | — |
| `docs/*`（30 份） | 已有多套架构/审计/计划 | 权威 | **主仓权威**：WEXPC1 只做补充与推广，不另立规范 | P0 |

## 3. 冲突与缺口（按优先级）

### P0-1 双基线

**现象**：主仓已有 `WEXPC-LIGHTWEIGHT-HOST-ARCHITECTURE-V0.1`、`WEXPC-ARCHITECTURE-DEDUP-BASELINE-REVIEW-V0.6`、`INTERFACE-CONTRACTS`、`PROJECT-CONSENSUS`；WEXPC1 又有一套目录/编码/契约规范。两套同时“有效”，AI 会按读到的最后一篇施工。

**影响**：比目录不对更严重——同一功能可能被两套规则分别要求，最后产生两套实现或反复返工。

**建议**：
1. 明确主仓文档为唯一权威；WEXPC1 为研究/候选仓。
2. 对 WEXPC1 每条规则做四分类（覆盖/补充/冲突/后置），冲突项以主仓为准或开 ADR。
3. WEXPC1 被采纳的段落标记 `promoted`，未采纳的标记 `candidate`，不保留“既是研究又是规范”的模糊状态。

**验收**：任选一个新功能，能唯一指向一套规则，不需要在两套文档间取舍。

### P0-2 连接器跨层分散

**现象**：GitHub 相关代码同时出现在：
- `crates/wex-desktop-service/src/connectors/github_dispatch.rs` 等；
- `apps/desktop/src-tauri/src/github_config.rs`；
- `apps/desktop/src/GithubToolPolicies.tsx` 等 UI；
- `crates/wex-api` 的协议类型。

**影响**：加一个 GitHub 能力，仍可能跨 3 个 crate + UI，违背“功能完整模块”的目标。

**建议**：
1. 先建“GitHub 能力清单 + 现有实现位置”映射；
2. 把 `github_config` 的**业务配置**从 Host 后移到连接器（Host 只保留平台凭证/网络）；
3. 统一 Invocation 后，UI 不再直连 GitHub 配置/策略。

**验收**：新增 GitHub Issue 能力，改动不出现 `wex-desktop-service` 的公共层和 `src-tauri` 的业务配置。

### P0-3 能力声明缺失

**现象**：`tool_catalog.rs` 是“模型可见工具目录”的起点，但按命名与主仓文档，尚不能证明它包含完整的：
side effect / approval default / idempotency / evidence spec / required scopes / availability。

**影响**：UI、Agent、权限、审计仍可能各自维护一份“工具清单”。

**建议**：
1. 在 `tool_catalog` 上扩展 descriptor 字段，不新建第二套目录；
2. 明确三层：定义（静态）/ 可用性（按 Connection 实时）/ 权限（执行点）；
3. `module.toml` 类清单只用于构建期校验，不做 UI/权限数据源。

**验收**：UI 工具列表、Agent 工具暴露、权限输入都来自同一 descriptor；新增能力不需要改三处。

### P0-4 权限多入口

**现象**：权限/审批相关至少出现在 `wex-core/src/access.rs`、`wex-core/src/execution_policy.rs`、`src-tauri/tool_approvals.rs`、UI `GithubToolPolicies.tsx`。可能职责不同（规则/策略/审批/展示），但缺少“唯一执行点”的明确声明。

**影响**：绕过 UI 直接调 IPC 时，可能出现“UI 判了、后端没判”或“两边判得不一样”。

**建议**：
1. 列出所有权限判定点，标注“规则/决策/执行/展示”；
2. 明确唯一权威决策点在执行路径上；
3. UI 只做预检与展示，不作为安全边界；
4. 撤权后旧判定失效，纳入测试。

**验收**：红队实验——绕过 UI 直接调 IPC，所有越权路径被拦截或进入审批。

### P1-1 `wex-core` 多责任

**现象**：8 个 src 文件横跨权限、连接、调度、租约、执行策略、本地编辑、操作、任务、任务-操作。

**判断**：这不是“错误”，而是早期把规则集中在一个 crate 的正常结果。**不要立即拆 crate**，但需要 owner 表，否则后续每个功能都会往 `wex-core` 加东西。

**建议**：产出“`wex-core` 逻辑模块 owner 表”（文件 → 责任 → 未来归属 → 拆分触发条件）。

### P1-2 `domain/` 与 `application/` 同名文件

**现象**：`domain/execution_policy.rs` 与 `application/execution_policy.rs`；`domain/task_records.rs` 与 `application/task_records.rs`；`domain/member_brief.rs` 与 `application/member_brief.rs`。

**两种可能**：
- 合理分层：domain 放规则/类型，application 放用例编排；
- 重复 owner：两边各存一份规则或状态，随演化漂移。

**建议**：审源码确认；若是前者，在文件名/文档中明确“规则 vs 用例”；若是后者，指定唯一写入口。

### P1-3 持久化多域与迁移归属

**现象**：`wex-workspace-store` 存 organization/tasks/operations/agent_dispatch；`wex-desktop-service/infrastructure` 又有 sqlite/immutable_file；回执/检查点另有机制。

**建议**：先列“数据域 → 权威 store → 迁移 owner”，不急于合并；确保没有同一实体两处写。

### P1-4 契约测试与护栏分散

**现象**：Rust 测试、React 测试、`contracts/tests`、`reviews/harnesses` 各自存在，但没有统一的契约测试套件与依赖方向检查。

**建议**：先做最小 `testkit`（能力描述符校验）与 `arch-check`（依赖边/业务词/循环），接 CI；不要一次做全套。

### P2-1 目录物理重排

**判断**：主仓当前路线是“逻辑边界”，且已明确不要求一模块一 crate。WEXPC1 的 `modules/`、`platform/` 目录是目标参考，不是近期施工项。

**建议**：P2 再评估；先证明规则有效，再动物理结构。

### P2-2 旧资产隔离

**现象**：`wex-protocol` 仍是 demo 操作；`bridge/flutter-rust`、`reference/flutter-android` 仍在仓库。

**建议**：明确标记“仅参考/退役候选”，确保不进入 Tauri 构建路径，避免 AI 误读为现行实现。

### P2-3 文档去重

**现象**：75 个 `.md`，主仓自身也有多份审计/提案/计划；WEXPC1 再加入会造成阅读负担。

**建议**：主仓建 `docs/AUTHORITY.md` 或索引，标出“现行/提案/归档”；WEXPC1 只链接，不复制。

## 4. WEXPC1 文档与主仓对应关系

| WEXPC1 文档 | 主仓对应 | 关系 | 建议 |
|---|---|---|---|
| `00-intent.md` | `PROJECT-CONSENSUS.md`、轻量宿主 §1 | 重叠 | 合并要点到主仓；WEXPC1 保留为研究说明 |
| `01-repository-structure.md` | `REPOSITORY-STRUCTURE.md`、轻量宿主 §2 | 部分冲突 | 降为“目标参考”；不施工 |
| `02-coding-rules.md` | `AGENTS.md`、`DEVELOPMENT-WORKFLOW.md`、`INTERFACE-CONTRACTS.md` | 补充 | 抽取可执行条款进主仓 |
| `03-module-contract.md` | `INTERFACE-CONTRACTS.md`、`tool_catalog` | 补充 | 先补 descriptor 字段 |
| `04-dependency-rules.md` | 轻量宿主 §2 职责依赖图 | 补充 | 改为“逻辑依赖规则”，不强制 crate 边 |
| `05-case-github-issue.md` | 无直接对应 | 实验 | 用主仓真实 GitHub 连接器做试点 |
| `06-migration.md` | `docs/superpowers/plans`、实现计划 | 冲突 | V0.2 已改为“盘点先行、目录最后” |
| `07-guardrails.md` | `DEVELOPMENT-WORKFLOW.md`、`reviews/` | 补充 | 先做 testkit + arch-check 最小版 |
| `08-anti-patterns.md` | 主仓多份 audit | 补充 | 与主仓审计合并，避免两套清单 |
| `09-glossary.md` | 主仓术语文档 | 补充 | 以主仓为准，WEXPC1 只做索引 |

## 5. 建议采纳顺序

### P0（1-2 周，只做规则与清单）

1. 生成 WEXPC1 规则 ↔ 主仓基线四分类表（覆盖/补充/冲突/后置）；
2. 产出 `wex-core` 逻辑模块 owner 表；
3. 产出“权限判定点清单”（规则/决策/执行/展示）；
4. 产出“GitHub 能力 → 现有实现位置”映射；
5. 在 `tool_catalog` 上起草 descriptor 扩展（不接线）。

**P0 结束标志**：没有两套同时生效的规则；四个 P0 冲突都有裁决。

### P1（2-4 周，窄试点）

1. 选 GitHub Issue 或本地文件读，走统一 Invocation + 现有 ledger/回执；
2. 补契约测试（testkit 最小版）；
3. 补 arch-check 最小版（循环/跨层 import）；
4. 验证“模块外改动 ≤2 文件”。

**P1 结束标志**：局部性实验通过；否则改规则，不铺开。

### P2（验证后）

1. 收公共机制（凭证/账本/策略/存储）；
2. 再评估目录归位；
3. 再评估拆 crate（`wex-core`、`connectors`）。

## 6. 不做的事

- 不把 WEXPC1 的 `modules/`、`platform/` 目录直接搬进主仓。
- 不在主仓上重建“新骨架”。
- 不重写 `wex-core`、`wex-api`、`wex-desktop-service`。
- 不引入动态插件/插件市场。
- 不另立第二套 `contract`。
- 不把 WEXPC1 文档当作主仓正式规范。
- 不在未审源码前，按文件名推断“重复 owner”。

## 7. 待确认

1. 主仓是否接受“逻辑模块 owner 表”作为中间产物？
2. 权限唯一决策点放在 `wex-core` 还是 `wex-desktop-service/application`？
3. `tool_catalog` 是否升级为能力 registry，还是并列存在？
4. `domain/` 与 `application/` 的同名文件，是分层还是重复？
5. WEXPC1 的规则由谁批准 promote 到主仓（ADR 流程）？
6. `wex-protocol`、`bridge`、`reference` 的退役/隔离时间表？
