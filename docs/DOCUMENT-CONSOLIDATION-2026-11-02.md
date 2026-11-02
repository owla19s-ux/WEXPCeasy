# WEX 文档收敛与当前施工阅读规则（2026-11-02）

## 目的与范围

本规则针对 WEXPCeasy 文档多、历史研究与当前施工混用的问题。**不批量删除、不重写历史证据、不把多份 CONTRACT 合成全局大文档**。先收敛当前权威入口，后续按证据处理冗余和失效链接。产品名 WEX，仓库名 WEXPCeasy。

## 唯一的当前施工路径

1. 根 [README](../README.md)：产品身份、当前阶段、真实代码状态。
2. 根 [AGENTS](../AGENTS.md)：仓库施工、安全、测试与回执规则。
3. [0.1.1 正式施工表](versions/0.1.1/PLAN.md)：B1/B2/B3 任务范围和验收门槛；0.1.2 延期边界。
4. **目标模块** README / CONTRACT：该模块 owner、公开能力、输入输出、权限、错误/恢复语义；跨模块时只读取实际消费方与提供方有关条款。
5. 最新 main 的**实际源码、测试、运行证据**：判断实现状态；文档描述不等于已实现。

不要求每次施工通读 216 项总表、所有批次报告或 228 份 Markdown。需要追溯具体需求时才读取 [产品需求总表](product/README.md)；跨模块冲突才读取 [契约索引](MODULE-CONTRACTS.md) 与 [决策索引](decisions/README.md)。

## 三层权威与冲突处理

| 层级 | 内容 | 可做什么 | 不可做什么 |
| --- | --- | --- | --- |
| 当前权威 | 根 README/AGENTS、版本 PLAN、用户已确认决策、产品总表 | 决定本版施工范围、规则、长期需求与政策 | 将未批准候选当正式需求 |
| 模块就近 | 各模块 README/CONTRACT、源码、测试 | 定义 owner/公开语义，提供实现和验证证据 | 用契约声明代码已实现；跨模块复制权威状态 |
| 历史/参考 | 旧规划、batch1～8、实验、审计、references、旧资料、DSH 上游快照 | 追溯当时基线、复现实验、寻找设计依据 | 自动派工、覆盖当前版本决策或宣称当前实测通过 |

**冲突裁决**：用户最新明确批准的版本范围/政策优先；模块契约负责已确定的业务语义；源码和可复现测试决定实际实现与验收事实。历史文件以其日期和 SHA 为准，不因旧文写“最新”就成为当前指令。涉及安全未决时不能自行批准。

## 当前版本界限

- **0.1.1**：Space/Context、Agent、API、Conversations、基础 Connections/Permissions/Data/App，三批实施、Windows UI/安装与恢复。
- **0.1.2**：自由格子工作流、正式调度器、DSH 原生插件系统产品化、DSH 外部 Agent 连接器。
- GitHub 仓库已公开；用户允许使用 Actions 构建与测试，不以额度为约束。仍须区分 CI、真实外部连接、Windows E4 的证据等级。

## 文档维护约束

1. **只保留一个当前版本计划入口**：版本变更修改 `docs/versions/<version>/PLAN.md`，其他 README 链接过去，不复制一份任务正文。
2. **模块契约就近维护**：不将完整业务语义复制到根 README、docs 索引或全局 shared。
3. **研究与历史资料保持原始证据**：不做无证据的“重复文件删除”；归档或迁移前需核查引用、来源、许可证、SHA、相对路径。
4. **旧计划只标历史**：不修改历史任务结果；必要时在入口加当前适用性提示。
5. **变更同步**：每次改变版本范围/owner/公开契约时，只更新唯一权威正文与必要导航，避免多个“最新”并存。
6. **验收分层**：设计完成、产品代码、单元/契约测试、真实组合、Windows 实机分别记录；未运行不宣称通过。

## 本轮处理记录

- 已修复 `docs/planning/README.md` 与 `docs/product/README.md` 中“0.1.1 尚未批准/任务表不存在”的误导。
- 已给 `workflows/README.md`、`dsh/README.md`、`connections/README.md` 增加明确的 0.1.1/0.1.2 适用边界。
- 已统一根 README、AGENTS 和 docs/README 的最短施工阅读路径。
- 本轮**未删除或移动历史资料**，未逐字去重所有 Markdown，未完成全仓链接扫描或 216 项逐条语义审查；后续需另行核查，不应宣称全部完成。

## 后续整理准则

优先修复仍影响 B1～B3 施工的入口和契约引用；其次自动检查相对链接、过期仓库名、重复正文及历史报告引用；最后对有证据的冗余资料进行分组归档。任何迁移都应同步更新引用，并确认源码构建或测试脚本没有依赖文档路径。


## 第二轮核验：旧路径跳转页（2026-11-02）

对下列九组旧路径和新路径读取正文并比较：旧路径均为简短的“文档位置已调整”指向页，**不是两份独立的完整正文**。因此本轮不删除这些兼容入口；只有完成全仓引用迁移、相对链接检查及外部引用影响评估后，才考虑移除。

| 旧路径（docs/ 下） | 唯一正文 |
| --- | --- |
| WEXPC-GLOBAL-CONTRACT-MAP-V0.1.md | architecture/GLOBAL-CONTRACT-MAP-V0.1.md |
| WEXPC-MODULE-LOCALITY-DESIGN-V0.1.md | architecture/MODULE-LOCALITY-DESIGN-V0.1.md |
| WEXPC-PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md | architecture/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md |
| WEXPC-RUNTIME-EXTENSION-CONTRACT-V0.1.md | architecture/RUNTIME-EXTENSION-CONTRACT-V0.1.md |
| WEXPC-RUNTIME-OPTIONS-V0.1.md | architecture/RUNTIME-OPTIONS-V0.1.md |
| WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md | architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md |
| WEXPC-SPACE-AND-WORKFLOW-EDITOR-DESIGN-2026-10-30.md | architecture/SPACE-AND-WORKFLOW-EDITOR-DESIGN-2026-10-30.md |
| WEXPC1-DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md | architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md |
| WEXPC1-RESEARCH-DECISIONS-2026-10-30.md | decisions/RESEARCH-DECISIONS-2026-10-30.md |

**核验限制**：本轮完整递归树共计 229 个 Markdown（包含本轮新建收敛规则）。未完成全部正文逐份扫描和全仓链接检测，不能据此宣布“没有其他重复或失效链接”。

**处理规则**：导航与新施工文档直接引用唯一正文；历史文件可继续引用兼容入口；禁止向旧跳转页追加正文。


## 第三轮：自动化检查落地（2026-11-02）

新增 [tools/check-docs.mjs](../tools/check-docs.mjs) 与 [对应单元测试](../tools/check-docs.test.mjs)，以及 [GitHub Actions 文档审计工作流](../.github/workflows/docs-audit.yml)。

- 递归扫描仓库 Markdown，跳过 `.git`、`node_modules`、构建输出与 coverage。
- 检查 Markdown 相对文件/目录链接是否存在、越界路径、无效 URL 编码、完全一致的正文重复；统计旧路径跳转页。
- 默认报告模式不因旧文档债务中断施工；人工修复后可运行 `node tools/check-docs.mjs --strict` 启用失败退出码。
- `node --test tools/check-docs.test.mjs` 测试检查器；`node tools/check-docs.mjs --json > docs-audit-report.json` 输出可机读报告。
- 工作流在 Markdown 或检查器变更时运行并上传 `docs-audit-report.json`；它是文档质量报告，不代表版本产品验收。

**验证事实**：检查器的两项独立夹具测试已在 Node.js v22.16.0 本地运行通过（缺失链接/完全重复、合法相对链接/锚点）；未获取 GitHub Actions 的运行结果，也未取得整仓报告，故全仓链接和重复检查仍待真实 CI 报告确认。检查器目前只检查本地目标存在性，不检查锚点是否存在、外部 HTTP 链接可达性、语义重复或历史政策冲突；这些不能宣称通过。

**处理原则**：先取得真实报告并区分源码路径、历史兼容路径和真实失效；再按目标 owner 修复，必要时补例外依据。禁止为了让检查变绿而批量删除历史文件或忽略全部错误。
