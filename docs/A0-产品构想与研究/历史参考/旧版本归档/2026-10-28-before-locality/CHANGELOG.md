> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 变更记录

## V0.2 — 2026-10-28

依据主仓 WEXPC `main` 现状（Tauri + React、`wex-api`、`wex-desktop-service`、`contracts`、不可变回执/检查点）修订。

### 修订

1. **`02-coding-rules.md`**：新增“四种协作形态”（同域组合 / 应用服务编排 / 能力调用 / 事件），明确 invoke 只用于外部副作用；强关联实体优先归并到同一领域模块，而不是拆成多个 crate 互相调用。
2. **`03-module-contract.md`**：新增“能力三层”（定义 / 可用性 / 权限）；明确 `module.toml` 只是构建/注册清单，不是运行时能力目录、UI 数据源或权限依据。
3. **`06-migration.md`**：重写迁移顺序为“资产盘点 → 规则校准 → 适配包裹 → 窄试点 → 收公共机制 → 目录归位（最后）→ 护栏 → 删旧路径”；明确不在活跃主仓上重建新骨架。
4. **`01-repository-structure.md`**：目录树标注为“目标参考形态”，不是施工顺序；补充“逻辑边界 ≠ 物理 crate”。
5. **`README.md`**：加入 V0.2 说明与审计链接。

### 新增

- `docs/audits/WEXPC1-WEXPC-DIFF-AUDIT-V0.1.md`：主仓现状快照、映射矩阵、P0/P1/P2 冲突与缺口、WEXPC1 文档对应关系、建议采纳顺序。

### 未变

- `00-intent.md`、`04-dependency-rules.md`、`05-case-github-issue.md`、`07-guardrails.md`、`08-anti-patterns.md`、`09-glossary.md`、模板与 ADR-0001。

### 已知边界

- 本次审计是目录/文档级轻量审计，未逐行审源码、未运行测试、未核对 Windows 实机。
- 未修改主仓，未搬迁目录，未新建产品代码。
