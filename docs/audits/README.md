# 架构审查与验证报告

本目录保存对架构、依赖、模块边界、安全和真实业务压力的审查结论。报告必须区分静态推演、替身测试、本地真实机制、真实外部集成和 Windows 实机证据；不得把低等级证据外推为产品验收。

## 审查报告

- [2026-11-07 第九轮锚点、旧路径消费与真实 CI 失败诊断](document-governance-2026-11-07/NINTH-PASS-ANCHOR-SLUG-AND-LIVE-REDIRECTS.md)：核对 36 份模块/入口文档中的 23 个相对章节链接、修复两处绕行兼容页的现行导航；**Documentation audit 在 `7a8d4ed4` 失败**，确认 A0 归档的外部 DSH 快照未被现行检查器正确分类，仍待完整问题清单和同 SHA 严格复验。
- [2026-11-07 第八轮锚点与旧路径反向引用专项](document-governance-2026-11-07/EIGHTH-PASS-ANCHORS-AND-REVERSE-REFERENCES.md)：现行入口关键标题定向核对、旧兼容路径搜索结果分类、末级 UI 文档修复和 `workflows/grid` owner 冲突记录；未执行全量锚点/代码字符串检查。
- [2026-11-07 第七轮完整 Git 树与 Markdown 路径核验](document-governance-2026-11-07/SEVENTH-PASS-CURRENT-TREE-LINKS.md)：先取未截断递归树（基线 844 个 blob、406 份 Markdown），后在新增记录的 407 份 Markdown 上完成**普通行内相对链接目标存在性**分批检查；DSH 上游快照的缺失目标单列。不等于全部锚点、引用式链接、脚本反向路径或构建测试验收。
- [2026-11-07 第六轮 CONTRACT 与子目录审查](document-governance-2026-11-07/SIXTH-PASS-CONTRACT-AND-SUBMODULE-AUDIT.md)：区分现行模块 README、兼容 CONTRACT、历史候选规格，并修复第二层源码目录资料引用；尚未完成全仓链接与测试验收。
- [2026-11-07 第五轮源码入口核验](document-governance-2026-11-07/FIFTH-PASS-MODULE-ENTRYPOINT-RECONCILIATION.md)：公开入口存在性与历史状态区分；不得当作功能验收。
- [2026-11-07 文档体系第二轮复审](document-governance-2026-11-07/SECOND-PASS.md)：现行权威文档逐份检查、过时状态修正、链接静态抽查及未覆盖项，**不等于全仓自动验收**。
- [2026-11-04 全仓文档治理回执](document-governance-2026-11-04/REPORT.md)：完整当时库存、历史归档、链接和模块事实快照；原始分类统计不代表最新 HEAD。

- [非代码文档体系重复、冲突与权威漂移审查（2026-11-02）](DOCUMENT-SYSTEM-CONSISTENCY-AUDIT-2026-11-02.md)：首轮目录及关键正文审查，含 DOC-01～12 风险清单；尚未完成全量链接和语义 diff。


- [架构验证顺序与版本门槛](ARCHITECTURE-VALIDATION-ORDER-AND-VERSION-GATE.md)
- [DSH / WEXPC1 能力差距矩阵](DSH-WEXPC1-GAP-MATRIX-V0.1.md)
- [WEXPC 源码边界只读审查](WEXPC-SOURCE-BOUNDARY-READONLY-2026-10-28.md)
- [WEXPC1 架构压力测试任务书](WEXPC1-ARCHITECTURE-STRESS-TEST-TASK.md)
- [复杂业务契约压力审查（第五批）](COMPLEX-CONTRACT-STRESS-REVIEW-2026-10-31.md)
- [桌面应用基础能力缺口审计](APP-FOUNDATIONS-GAP-AUDIT-2026-10-31.md)
- [视图与证据链审计](VIEWS-AND-EVIDENCE-AUDIT-2026-10-31.md)
- [基础能力完整性审查与能力组合矩阵](FOUNDATION-CAPABILITY-COMPLETENESS-REVIEW-2026-10-31.md)

第六批关键机制实验、模块准备度和组合验收见 [第六批交付](../batch6/README.md)。实验代码与原始输出分别保存在 `experiments/` 和批次证据目录，不以报告替代可复现测试。

## 归入 A2 的版本证据

- [0.1.1 功能反向覆盖](../A2-版本与工程状态/0.1.1/证据/216项功能反向覆盖-2026-11-07.md)
- [0.1.1 条款源码测试追踪](../A2-版本与工程状态/0.1.1/证据/条款源码测试追踪-2026-11-07.md)

旧审查按当时 SHA 解释，不能覆盖新版本工程状态。

## 治理审计归属与保留原因

- `document-governance-2026-11-04/` 含报告、冲突记录、模块状态快照以及 JSON 盘点/链接检查/验证脚本，**暂时整组原位保留**，避免拆散原始检验数据。其“模块无源码”判断只对 11-04 指定 SHA 有效，不是当前状态。
- `document-governance-2026-11-07/` 保留治理过程 REPORT/SECOND-PASS，核验正文已收敛到 [A2 版本证据](../A2-版本与工程状态/README.md)，旧路径仅作引用兼容。
- 更早的静态架构/功能/视图审查已归入 [A0 历史审查](../A0-产品构想与研究/方案与研究/审查历史/APP-FOUNDATIONS-GAP-AUDIT-2026-10-31.md)。

以上材料均非当前版本功能、施工指令或验收通过的独立权威；等第二阶段更新源码模块文档后再删除遗留兼容页。
