# WEX 文档索引

## 环境管理独立 owner（2026-11-07）

[environments 源码维护入口](../environments/README.md) 已创建，为环境管理独立业务模块；Local 是受控本机执行连接器，Connections 是公共调用与 Operation 宿主，三者不得合并职责。目录尚无产品实现。施工范围与版本门槛见 [B3 D-10](versions/0.1.1/B3-DESKTOP-DELIVERY-TASK-2026-11-07.md)。


施工入口：[根 README](../README.md) → 当前模块 README → 源码与测试。这里按需检索，不另立阅读顺序或派工规则。文档职责与冲突处理统一见 [权威与维护规则](DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md)。

## A0 产品构想与研究（2026-11-07）

- [A0｜产品构想与研究](A0-产品构想与研究/README.md)：统一管理前期产品构想与研究资料，内部按 [需求与想法](A0-产品构想与研究/需求与想法/README.md)、[方案与研究](A0-产品构想与研究/方案与研究/README.md)、[历史参考](A0-产品构想与研究/历史参考/README.md) 分类。
- 原始想法及基础设计讨论不自动进入版本；方案实验是验证可行性，不等于正式采用。用户确认后才进入正式产品级整理与任务书，Codex 保留任务书驱动的施工路径。

A0 已归档 94 份研究与历史 Markdown 正文，旧路径保留兼容入口；详细说明见 [A0 迁移记录](A0-产品构想与研究/迁移记录-2026-11-07.md)。

## 正式产品与当前版本

- **[A1｜正式产品设计](A1-正式产品设计/README.md)**：唯一正式产品需求、功能归属、PC UI 定稿与已确认权限政策。
- **[A2｜版本与工程状态](A2-版本与工程状态/README.md)**：版本级功能与实现/验证状态总表，以及历史任务记录。

- [维加项目总体说明](维加项目总体说明.md)：产品机制、场景、方向与明确保留项。
- [项目概要](PROJECT.md)：简短架构入口。
- [F01–F15 功能总表](A1-正式产品设计/产品功能总表.md)：完整需求唯一正文；[产品资料索引](product/README.md)。
- [216 项功能反向覆盖审查（2026-11-07）](audits/document-governance-2026-11-07/FUNCTION-216-REVERSE-COVERAGE.md)：逐 ID 对照 0.1.1 范围/owner/任务与后置边界，单列 F01-007 权威冲突和当前漏项核验优先级；**审查索引不代替产品正式需求或测试结果**。
- **[0.1.1 当前功能与工程状态总表](A2-版本与工程状态/0.1.1/功能与工程状态总表.md)**：唯一版本施工 AI 导航；整合 24 项任务、模块状态、阻塞、CI 与回执。
- [0.1.1 历史计划（仅追溯）](A2-版本与工程状态/0.1.1/历史任务记录/PLAN-2026-11-02.md)：三批范围与验收；四项延期能力见计划，不以历史实验扩版。
- [D01/D02 权限决策矩阵](A1-正式产品设计/权限决策矩阵.md)：区分已确认政策与候选保护边界。

## 模块就近资料

| 领域 | 当前模块入口 |
|---|---|
| 组织与 AI | [Space](../space/README.md)、[AI](../AI/README.md)、[Roles](../AI/roles/README.md)、[Conversations](../conversations/README.md) |
| 连接 | [Connections](../connections/README.md)、[API](../connections/api/README.md)、[GitHub](../connections/github/README.md)、[Local](../connections/local/README.md)、[外部 DSH](../connections/dsh/README.md) |
| 工作与呈现 | [Workflows](../workflows/README.md)、[Grid](../workflows/grid/README.md)、[Scheduler](../scheduler/README.md)、[Views](../views/README.md)、[UI](../UI/README.md) |
| 基础 | [Shared](../shared/README.md)、[Permissions](../permissions/README.md)、[App](../app/README.md) |
| 扩展研究 | [WEX 插件](../plugins/README.md)、[DSH 原生兼容](../dsh/README.md)、[Accounts](../accounts/README.md) |

[条款级需求—源码—测试追踪总账（2026-11-07）](audits/document-governance-2026-11-07/CLAUSE-TRACEABILITY-LEDGER.md) 按历史条款、现行 owner、版本、源码、测试和证据缺口建立 32 条定向索引；[深入语义对冲记录](audits/document-governance-2026-11-07/CONTRACT-SEMANTIC-TRACEABILITY.md) 保留对冲依据。两者均为治理资料，**不能取代模块 README 或版本计划成为施工规范，也不表示已经完成全仓 216 功能项逐条审查**。

[2026-11-07 文档体系复审第二轮](audits/document-governance-2026-11-07/SECOND-PASS.md)记录当前权威入口、过时状态、文档冲突修正及本轮检查边界；[当日状态治理回执](audits/document-governance-2026-11-07/REPORT.md)记录较早的 README/0.1.1 状态纠正；[2026-11-04 模块源码与证据核对](audits/document-governance-2026-11-04/MODULE-STATUS.md)只作历史快照；[旧全模块契约索引](MODULE-CONTRACTS.md)保留历史设计和追溯，不派工。

## 架构、决策、实验与审查

- [架构](architecture/README.md)、[决策](decisions/README.md)：按日期、批准状态和新旧适用性阅读。
- [研究](research/README.md)、[API / Pi AI 独立验证](research/api/README.md)、[历史 CONTRACT](research/contracts/)：实验与研究依据。
- [审查报告](audits/README.md)、[最新复审记录](audits/document-governance-2026-11-07/SECOND-PASS.md)、[11-04 完整治理回执](audits/document-governance-2026-11-04/REPORT.md)：审查范围与未覆盖项分别记录。
- [Electron / React 隔离实验](../experiments/electron-host-spike/README.md)、[工作流交互原型](../workflows/editor/prototype/README.md)：不等于正式产品或 Windows 实机验收。

## 历史与外部资料

- [历史阶段规划](planning/README.md)、[第六批](batch6/README.md)、[第七批报告](batch7/REPORT.md)、[第八批报告](batch8/REPORT.md)：原范围、当时状态与证据。
- [旧资料](../旧资料/README.md)、[历史治理过程](research/document-governance/CONSOLIDATION-2026-11-02.md)：保留可追溯入口。
- [外部参考](../references/)、[DSH 上游快照](../dsh/upstream/)、[未来需求](../需求对冲架构/README.md)：来源、候选与产品规则分开。
