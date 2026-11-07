# WEXPCeasy｜第十轮：文档 CI 严格失败根因及可施工修复任务（2026-11-07）

> **治理范围：**本文件是可核验的问题诊断与后续专项施工说明。当前文档治理授权只修改仓库文档，不修改 `tools/check-docs.mjs`、测试、工作流代码、产品源码、接口、权限或版本计划。执行涉及工具/CI 修改的专项任务时，按根 README 开工、另行确认该施工授权。本轮未声称严格文档 CI 已绿。

## 1. 基线及已确认事实

- 第十轮开始的 `main` SHA：`25497c0f36eb956da945dac22d3e6a61c9e8b2c2`，GitHub 递归树 `truncated:false`；统计 847 个 blob、409 份 Markdown（后续新增本报告会改变数量）。
- 前次实际 GitHub Actions `Documentation audit` 运行 [42368589119](https://github.com/owla19s-ux/WEXPCeasy/actions/runs/42368589119) 的被测 SHA 是 `7a8d4ed4ea82fce4566f6028c0848279355c8e7a`：`node --test tools/check-docs.test.mjs` 四测通过；`node tools/check-docs.mjs --json --strict > docs-audit-report.json` 退出码 1，打印/上传报告步骤被 skipped。
- 现有 `tools/check-docs.mjs` 的 `scopeOf` 只对以 `references/`、`dsh/upstream/` 开头的文档返回 `external-snapshot`，其余全是 `wex-owned`；严格退出条件是 owned issue 数大于 0。缺失链接只看路径存在性，不检查 Markdown 标题锚点。
- 现有 `.github/workflows/docs-audit.yml` 在 `Audit links and exact duplicates` 非零退出时会中断后续 `Print summary and issues` 与 `upload-artifact`，因此**实际 CI 尚未提供完整 `ownedIssueCount` 和各项问题清单**。

## 2. 当前 Git tree 下对四份 A0 外部快照的精确复核

通过 GitHub 逐文件读取四份归档 Markdown，再以当前 `check-docs.mjs` 的 fenced code 去除、普通行内链接识别、去除 fragment/query、相对路径解析规则模拟，并与远端**完整 Git 文件及目录树**逐项比对：

| A0 外部 DSH 快照文件 | 检查到的本地链接 | 缺失目标 |
| --- | ---: | ---: |
| `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/docs/architecture.md` | 47 | **45** |
| `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/docs/cordis-README.md` | 4 | **4** |
| `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/docs/cordis-primer.md` | 4 | **4** |
| `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/docs/scope-README.md` | 6 | **5** |
| **小计** | **61** | **58** |

这些目标大多位于未完整收录的 `references/dsh/source-snapshot/`、`references/dsh/docs/`。按目前检查器的 `scopeOf` 逻辑，上述快照的 **58 个缺失目标会被错误归入 `wex-owned`**，足以解释 `--strict` 退出失败的至少一个充分原因。注意：**58 是这四份文件的可复核局部结果，不是全仓 `issueCount` 或完整 CI 错误总数**；不包含 vendor 下的已正确分类外部错误、不包含其它潜在 owned 错误，也不计 markdown slug。

## 3. 本轮已完成的纯文档修复

- 第七轮审计报告原有两个行内代码示例采用有效 Markdown 链接语法 `[标签](相对路径#片段)`，当前检查器未排除反引号行内代码，可能将其误检成 WEX 自有的 `broken-local-link`。现已改为不构成完整链接语法的“标签 + 相对路径片段”说明，**仅改审计文字、不改检查器行为**，提交 `9d2cc65a`。
- 继续保留四份外部快照及原始引用，没有为了压低 CI 数字而伪造、重写或删去上游文件。
- 单看 Git blob 内容 SHA，没有找到完全相同 blob 的重复 Markdown 组，但这**不能排除**当前检查器对换行差异、首尾空白归一化后认定的重复文件。因此不能宣称 `duplicate-exact = 0`。

## 4. 推荐单独交付的检查器/CI 修复任务（**未执行的代码施工**）

### DCA-01｜外部快照按实际来源精确分类

目标：保留所有问题计数和原始文件路径，只将确定属于外部来源快照的路径改归 `external-snapshot`。

- 在现有 `scopeOf` 的白名单中**精确新增** `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/`，并单独核对是否还存在其它真正外部来源前缀。
- 不得添加通配整个 `docs/A0-`、`docs/`、`dsh/`；不能忽略 WEX 自有 Markdown、当代模块 README 或实验实现说明。
- 原始外部缺失目标仍写入 `issues[]` 和 `externalSnapshotIssueCount`，而非从扫描范围删除。
- 为 A0 外部快照与同目录 WEX 自有归档分别补正例/反例测试；`--strict` 对前者不失败、对后者仍失败。包含目录间转义与归一化的边界案例，避免用路径片段包含匹配误判来源。

### DCA-02｜失败时始终产出可查报告，同时保留失败状态

目标：`docs-audit-report.json` 即使 strict 非零仍要上传，并包含各类问题计数、源文件与目标。

- 调整 `.github/workflows/docs-audit.yml` 的步骤错误处理或 `if: always()`/持久化产物逻辑，使失败也能打印并上传已生成的 JSON。
- **不可**使用 `continue-on-error: true` 后让严格失败变成总体成功；保留 job 的失败结论。
- 处理脚本崩溃/报告不存在/JSON 格式错误，避免打印步骤再次报错覆盖根因。
- 记录 artifact 名、运行 SHA、`ownedIssueCount` 和各 `kind` 数量，支持相同提交复查。

### DCA-03｜链接解析与锚点扩展，分清必修和增强

- 最小必要修复：检查器不要把行内 code span/被转义的 Markdown 伪链接误判成真实链接；测试需覆盖 fenced code 与 inline code 两种情形。
- 增强验收：引用式链接定义、含空格的尖括号链接、相对目录、标题 GitHub slug/重复标题序号、HTML href、图片链接、跨文件导航锚点等。若原有检查器架构不适合一次实现，可先作为报告型非阻塞检查，不得假报覆盖完整。
- 对旧兼容入口的真正反向引用（源码常量、脚本、CI、文档路径）另写专项扫描/人工核验方案，不能仅凭 `check-docs` 绿灯就删除旧文件。

## 5. 必须获得的真实验收结果

1. `node --test tools/check-docs.test.mjs` 全绿，新增外部归档/行内代码/WEX 自有反例断言；禁止删减已有测试。
2. 在同一 Git SHA 执行 `node tools/check-docs.mjs --json --strict`，记录报告中的 `markdownFiles`、`checkedLocalLinks`、`ownedIssueCount`、`externalSnapshotIssueCount` 与按类问题清单。
3. 若仍有 `wex-owned` 问题，逐项修复其来源，不把真正 WEX 断链更名为外部快照；每项都有来源和修复 commit。
4. 通过 GitHub `/actions/runs` 核对**源 SHA 一致**的 `Documentation audit`，确认最后退出结果与 JSON artifact 都符合预期；Windows/Electron 运行验收不由文档检查代替。
5. 未满足上述条件之前，**不得删除** `docs/research/`、`docs/architecture/`、`docs/versions/` 等旧兼容路径文件，也不得宣布“全仓文档治理已通过严格检查”。

## 6. 验收边界

本轮改动是**文档及审计说明**，不是对检查工具或 Actions 的修改。即使本任务书能指导 Codex 施工，也必须由对应的代码施工授权按模块边界完成，不借文档治理越权改源码。当前外部来源快照保留原样，`workflows/grid` 和 Views/Editor owner 冲突仍待后续产品决策。
