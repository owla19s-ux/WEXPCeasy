# Hermes Agent 研究参考（独立于 DSH）

状态：源码/文档研究，非 WEXPC1 正式设计。日期：2026-10-28。
上游：https://github.com/NousResearch/hermes-agent

## 研究导航
- [01｜核心、记忆、提示词缓存与技能](01-core-memory-prompt-skills.md)
- [02｜子 Agent、调度、Gateway 与插件](02-delegation-cron-gateway-plugins.md)
- [03｜与 DSH、WEX 的对照及验证问题](03-wex-comparison-and-validation.md)

## 总结
Hermes 更适合借鉴**长期自主 Agent 的连续工作**：会话缓存边界、跨会话记忆、技能自积累、定时任务、子 Agent 委派、统一多入口。DSH 更适合借鉴能力接缝、运行时组合与生命周期。二者不是同一个项目，均不能直接替代 WEX 的 Space/Context、任务/调度/执行状态所有权。

研究基于公开仓库的 README、AGENTS.md、开发文档及关键 Python 源码的静态阅读；未运行上游测试，也不宣称全部代码路径已审计。未修改 WEXPC1 原设计文档。
