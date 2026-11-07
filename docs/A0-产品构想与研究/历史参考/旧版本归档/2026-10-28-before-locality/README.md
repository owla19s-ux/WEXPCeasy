# WEXPC1 — WEX 架构研究与工程规范仓

> 状态：架构研究阶段。**不是产品代码仓，不是冻结设计，不直接施工。**
> 主产品仓：WEXPC。本仓只承载“为什么这样分、怎么分、写代码时怎么遵守”的规范与模板；结论以 ADR 形式回迁主仓后才生效。
>
> **V0.2（2026-10-28）**：根据主仓现状审计，补充了“四种协作形态”“能力三层（定义/可用性/权限）”“迁移以资产盘点先行、目录最后动”三处修订，并把目录树明确为**目标参考**而非施工顺序。新增 [WEXPC1 ↔ WEXPC 差异审计](docs/audits/WEXPC1-WEXPC-DIFF-AUDIT-V0.1.md)。

## 本仓要解决的问题

WEX 的功能会长期增加：连接器、工作流、Agent、协作方式、外部服务、设备。如果每次新增功能都要在十几个中央文件里加分支，代码会逐渐失去可维护性，AI 也无法独立施工。

本仓的核心命题只有一句：

**模块边界 = 认知边界 = AI 一次施工的范围。**

围绕这句话，本仓做两件事：

1. **仓库目录调整**：从“按技术层切目录”改为“按完整功能模块 + 公共机制切目录”。
2. **代码编写方式调整**：从“到处加分支、中央注册”改为“能力声明驱动、模块内闭环、公共管线统一裁决”。

这两件事必须同时做。只改目录不改写法，旧写法会把新目录重新长成技术分层；只改写法不改目录，边界没有物理载体，迟早被绕过。

## 阅读顺序

| 顺序 | 文档 | 回答什么问题 |
|---|---|---|
| 1 | [docs/00-intent.md](docs/00-intent.md) | 这套架构到底想干什么，判断标准是什么 |
| 2 | [docs/01-repository-structure.md](docs/01-repository-structure.md) | 仓库目录怎么调整，每一层为什么存在 |
| 3 | [docs/02-coding-rules.md](docs/02-coding-rules.md) | 写代码时具体遵守什么，反例/正例/检查方式 |
| 4 | [docs/03-module-contract.md](docs/03-module-contract.md) | 一个“完整模块”的契约长什么样（MODULE.md / module.toml / 能力声明） |
| 5 | [docs/04-dependency-rules.md](docs/04-dependency-rules.md) | 谁能依赖谁，怎么自动检查，例外怎么走 |
| 6 | [docs/05-case-github-issue.md](docs/05-case-github-issue.md) | 用“新增 GitHub Issue”完整走一遍新写法 |
| 7 | [docs/06-migration.md](docs/06-migration.md) | 怎么从现有仓库迁过来，不大爆炸 |
| 8 | [docs/07-guardrails.md](docs/07-guardrails.md) | CI、工具、脚手架、AI 施工任务包怎么设 |
| 9 | [docs/08-anti-patterns.md](docs/08-anti-patterns.md) | 哪些做法会把架构重新拖回旧状态 |
| 10 | [docs/09-glossary.md](docs/09-glossary.md) | 术语约定，避免同名不同义 |
| 11 | [docs/audits/WEXPC1-WEXPC-DIFF-AUDIT-V0.1.md](docs/audits/WEXPC1-WEXPC-DIFF-AUDIT-V0.1.md) | 与主仓 WEXPC 现状的差异审计：哪些能用、哪些要改、哪些暂不适用 |
| 12 | [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |

模板目录：

- [templates/MODULE.template.md](templates/MODULE.template.md)：每个模块必读的模块说明模板
- [templates/module.template.toml](../../../../../旧资料/2026-10-28-before-locality/templates/module.template.toml)：机器可读的模块元数据模板
- [templates/NEW-MODULE-CHECKLIST.md](templates/NEW-MODULE-CHECKLIST.md)：新增模块/新增能力的检查清单

## 一句话版本（但不要只看这句）

- 目录：`apps/`（程序） + `modules/`（完整功能模块） + `platform/`（公共机制） + `tools/`（护栏） + `docs/`。
- 依赖：`modules` 只依赖 `platform/contract` 与平台接口；`platform` 不依赖任何业务模块；`apps` 是唯一知道全部模块的组合根。
- 写法：先声明能力，再写实现；模块内部私有；跨模块只走契约；权限/记账/回执只在公共管线做；UI 不碰业务状态。

## 本仓不做什么

- 不在本仓写产品功能，不维护可发布构建。
- 不创建“空壳目录”证明架构存在。
- 不冻结最终目录数量、模块数量、接口字段；这些由真实依赖与试点结果决定。
- 不替代主仓的产品范围、版本计划与验收。
- 不保留两套并行实现；实验验证后结论回迁，本仓只保留规范与模板。

## 变更流程

1. 先开 `docs/adr/ADR-XXXX-<topic>.md` 写清：问题、选项、决定、影响面、退出条件。
2. 涉及依赖方向/契约/目录一级结构的变更，必须有 ADR，不能只改文档。
3. 规范文档与模板同步更新；不同步视为未完成。
4. 实验通过前，只写“候选”，不写“已确认”。

## 与主仓的关系

- 主仓 WEXPC 是唯一产品实现与长期维护仓。
- 本仓（WEXPC1）是**可丢弃的架构试验场 + 规范来源**。
- 试点验证后：规范/ADP 回迁主仓；试验代码不直接搬，按结论重写或适配。
- 两个仓都能构建产品，是重复真相的开始；本仓不追求这个。
