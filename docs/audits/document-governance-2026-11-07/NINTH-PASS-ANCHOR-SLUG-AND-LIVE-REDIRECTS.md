# WEXPCeasy｜第九轮：现行模块章节锚点与仍在消费的兼容路径（2026-11-07）

> 文档治理专项，非源代码施工。开始时最新 `main@09afdd4dd8cb4d379a29a30dff1211f5dff48adb`；先读 GitHub 未截断递归树，再按文件读取当代 README、CONTRACT、A1/A2 目录与检查脚本。提交仍仅修改文档。

## 1. 标题锚点的定向核验范围

- 读取 **36 份现行入口/模块/子模块 Markdown 文档**（两批各 18 份），提取普通行内含 `#fragment` 的**相对链接**：第一批 16 个，第二批 7 个，共 23 个（其中部分目标重复）。这不是仓库 408 份 Markdown 的全部锚点。
- 阅读其关键实际目标标题原文，按 GitHub 常用 slug 处理：小写、去除标点、保留中文与字母数字、空格转连字符，抽查路径、标题内容及锚点组合。经核对：UI/App 指向 Windows 数据设计第 12 节、Views 第 5 节、Plugins 第 2 节、Workflows 第 6 与 6.4 节、AI 第 8 节、Conversations 第 5 节、Connections 第 7 节、Permissions 第 11 节、DSH 双路线与生命周期、历史 CONTRACT 的“文档关联与施工入口”标题均存在且 slug 对应。
- 未观察到上述目标的明确锚点不匹配，**但并未运行 GitHub 实际导航逐链接点击或所有文档的标题锚点完整解析**。其它引用式链接、重复标题自动编号、网页锚点、HTML 连接仍待验证。

## 2. 旧路径是否仍被现行代码消费

GitHub 仓库内容搜索关键词：
- `docs/versions/0.1.1/`：命中治理报告、A2 历史追踪与 JSON 库存，未在**此次返回的搜索结果**里找到当前 `src/`、测试或 CI 的固定路径消费。
- `docs/research/contracts/`：主要命中 `connections/local/README.md` 与 `permissions/README.md` 对旧位置的**链接显示文字**，但这两个 Markdown 链接的真实 URL 已指向 A0；其余主要是历史和审计库存。
- `docs/architecture/`：命中旧研究原文、历史镜像、迁移说明、若干含“历史路径”文字的 README，以及此前的审计 JSON，不能直接当作仍存在的程序依赖。

**边界：** GitHub 搜索结果不能证明字符串无其余命中、未索引的文件无引用或脚本/CI 从未动态构造路径；本轮没有执行完整的 1055 条 Git tree 文件内容扫描。此结果只是缩小下一步追溯范围，**不批准删除任何兼容页**。

## 3. 实际修复与提交

| 文件 | 旧导航 | 新导航 | Commit |
| --- | --- | --- | --- |
| `UI/conversation/README.md` | `docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md` 根级兼容入口 | `docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md` | `c89f82a5` |
| `workflows/editor/prototype/README.md` | `docs/architecture/WORKFLOW-CANVAS-AND-NODE-WORKSPACE-DESIGN-2026-11-01.md` 旧架构跳转页 | `docs/A1-正式产品设计/架构与决策/工作流画布与节点界面设计-2026-11-01.md` | `465de16e` |

这两处改动没有变更既有产品设计、工作流技术路线、UI 功能、接口、测试或原型内容。修改后再次读取两个 README 和两个 A1 目标，确认源文件中的链接与目标正文路径均存在。

## 4. 自动检查工具的局限仍需保留

`tools/check-docs.mjs` 现有 `--strict` 只根据它识别的本地链接路径、完全重复文档和分类结果返回失败；没有完整标题锚点及跨文件代码字符串反向引用算法。因此即使以后严格脚本绿灯，也应与本轮定向审计及实际 SHA 的人工/工具锚点检查分开记录。

## 5. 待解决和禁止擅自裁决

- `workflows/grid/README.md` 与 Workflows Editor / Views 对布局/修订权威的描述冲突已记录在第八轮；**本轮不将 Grid 宣布为新的 Workflow Definition 或 Views 数据 owner**。
- `docs/A0-...` 的 DSH 不完整上游快照及 `dsh/upstream/vendor/` 的缺失引用保留原样，不为制造“零断链”伪造上游正文。
- **未运行**本地 `node tools/check-docs.mjs --json --strict`、源码边界检查、自动化测试或 Windows 实机验收；未删除历史兼容路径。
- 下一阶段应优先建立全仓代码字符串/Markdown 复杂引用反向矩阵、自动化锚点核验，以及按文件制定旧兼容页删除资格清单，再由可执行完整工作树的环境跑严格校验。

## 6. GitHub Actions 实际核验：Documentation audit **失败**，不再作为待运行推测

在第九轮完成文档修改后，直接读取 GitHub `/actions/runs` 当前运行集合，并检查 `Documentation audit` 于 **`main@7a8d4ed4ea82fce4566f6028c0848279355c8e7a`** 的运行 `42368589119`：

- 运行详情：[Documentation audit #42368589119](https://github.com/owla19s-ux/WEXPCeasy/actions/runs/42368589119)。
- job `audit` 中 `node --test tools/check-docs.test.mjs` **4/4 测试通过**；下一步 `node tools/check-docs.mjs --json --strict > docs-audit-report.json` **退出码 1，工作流失败**。
- 因 `.github/workflows/docs-audit.yml` 逐步执行且 shell 在失败时中止，`Print summary and issues` 和 artifact 上传步骤均是 **skipped**。故此日志**不能直接给出本次全部 owned issues 清单**，不能声称只剩某一个问题。
- 读取同一时间多次近期运行可见此检查持续失败，而非单个最新提交偶发。

**一个可复核的严格检查冲突：**

1. `tools/check-docs.mjs` 的 `scopeOf` 将且仅将路径以 `references/`、`dsh/upstream/` 开头的文件视为 `external-snapshot`；其余（包括 `docs/A0-产品构想与研究/历史参考/外部项目/dsh/source-snapshot/`）标成 `wex-owned`。
2. 上述 A0 内的 `docs/architecture.md`、`cordis-README.md`、`cordis-primer.md`、`scope-README.md` 已直接读取到指向未完整收录的 `references/dsh/source-snapshot/`、`references/dsh/docs/` 的 Markdown 链接。第七轮完整 Git tree 证实其中多个目标不存在。
3. 由当前检查器的代码路径可推得：这些**归档上游快照内的缺失链接被算成 owned broken-local-link**，足以触发严格检查失败。**这是已确认的至少一个失败来源，不等于完整失败清单已定位。** 另外仍需核对重复文档等其它 owned issues。

**处理边界与后续修复任务：**

- 不得为通过严格检查而静默修改、补造或删除上游源码快照及原始引用。
- 后续若获授权调整检查工具/CI，应将 A0 的外部来源快照精确分类为 `external-snapshot`（不能粗暴忽略整个 A0），并保持它们在报告中可见但不误当 WEX 业务文档失效。
- 改善 `.github/workflows/docs-audit.yml` 的失败回执：让报告在 strict 非零退出后仍能打印及上传，最后保留正确失败退出码；否则无法逐项核对其它真正 WEX 自有断链与重复文件。**这些修改属于工具与工作流代码，本轮文档专项未授权，故仅登记缺口，不擅自修改。**
- 工具修复后必须在同一 SHA 重跑实际 Actions，并核对 `docs-audit-report.json` 的 `ownedIssueCount`、各 issue 明细及新引入的误分类，不得把单个测试 4/4 当全仓 strict 验收通过。
