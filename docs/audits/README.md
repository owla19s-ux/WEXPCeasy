# 架构审查与验证报告

本目录保存对架构、依赖、模块边界、安全和真实业务压力的审查结论。报告必须区分静态推演、替身测试、本地真实机制、真实外部集成和 Windows 实机证据；不得把低等级证据外推为产品验收。

## 审查报告

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
