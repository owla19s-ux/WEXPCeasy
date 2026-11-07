# WEXPCeasy｜第八轮：现行入口锚点、兼容路径反向引用与末级 UI 导航审查（2026-11-07）

> 文档专项治理，不改变产品代码、接口、权限、版本范围或未获确认的布局 owner。开始基线 `main@39ff7ade61b26b38ae10ac9de074b8ba5ba430e3`；各实际修改以 GitHub 文件 SHA 校验写入。

## 一、先审现有检查器的检测边界

读取 `tools/check-docs.mjs` 后确认：
- 当前实现会递归枚举 Markdown，忽略 `.git/node_modules/dist/build/.build/.next/coverage`，以文件内容哈希发现完全重复文档，统计部分以 `# 文档位置已调整` 开头的重定向页。
- 使用正则检查**普通行内 Markdown 本地目标路径**是否存在，排除 fenced code、外部 URL 和纯 `#` 锚点。
- `--strict` 仅在其识别的 `wex-owned` 类问题存在时设置非零退出码；`references/` 与 `dsh/upstream/` 标为 external-snapshot。
- **不检查** Markdown 标题 slug 与完整锚点、引用式链接、跨文本 code span/字符串的反向引用、全部 HTML href、目标迁移页是否仍具独立事实；还可能把行内代码示例识别为链接。
- 因此后续即使 `node tools/check-docs.mjs --json --strict` 通过，也不能视为完整的标题锚点、跨文件引用和兼容入口删除验收。本批没有修改该工具或运行测试。

## 二、现行入口链接锚点定向阅读

从 `README.md`、`docs/README.md`、`docs/PROJECT.md`、A1/A2 核心索引、`space/README.md`、`UI/README.md`、AI/Conversations/Connections/App/Permissions 等主要 owner README 提取相对 `#fragment` 行内链接，检查了这些关键目标的 Markdown 标题原文：

- `UI/README.md` 链至源码/Windows 数据设计的 `## 12. 基础能力补充后的代码目录归并（2026-10-31 审查建议，尚未创建源码子目录）`，以及 UI 历史契约的 `## 文档关联与施工入口`：对应标题存在。
- `app/README.md` 的 `#7-模块独立功能编号与细化契约`、`#8-可选连接服务的可信装配2026-11-02` 等引用，对应 app 历史契约 `## 7...`、`## 8...` 标题存在；源码/Windows 数据 `## 12...` 存在。
- `AI/README.md`、`conversations/README.md`、`connections/README.md` 指向归档契约的 `## 8`/`## 5`/`## 7` 功能编号与 `## 文档关联与施工入口`，相应章节存在。
- `permissions/README.md` 指向归档契约 `## 11. 模块独立功能编号与细化契约` 及 `## 文档关联与施工入口`，相应章节存在。
- `dsh/README.md` 的“双路线验收”与 `dsh/runtime/README.md` 的独立进程生命周期章节也在实际文件中找到标题。

**结论有限**：以上是标题原文的定向核查，不是 Github 全量 slug/重复标题顺序验证；没有把所有 `407+` 份 Markdown 的 `#fragment` 认定为通过。

## 三、兼容路径反向检索的分类

通过 GitHub 仓库内容搜索分别检索 `docs/research/contracts/`、`docs/architecture/` 与 `docs/versions/0.1.1/`。结果包含：
1. **现行文档中的历史路径说明文字**：如 `permissions/README.md`、`connections/local/README.md` 介绍迁移自旧研究位置，属于字面文本，不等于仍在使用旧页作为实际 Markdown 链接。
2. **旧兼容入口本身和迁移说明**：`docs/WEXPC-*.md`、旧 `docs/architecture/` 入口等，仍可能为其它快照提供路径。
3. **A0 归档、A2 迁移/语义核验、版本历史**：有意保留历史源路径和原始差异依据，不能机械替换。
4. **2026-11-04 审计库存和变化 JSON**：是旧树事实证据，不能因为包含已迁移路径而重新编辑原始盘点。
5. **根 README 中的旧版本位置说明**：必须按实际上下文区别“导航链接”与“历史文字”，不通过关键词命中来直接裁判删除。

仅 GitHub 搜索命中次数、以及第七轮 407 份普通行内链接均指向已存在目标，**都不足以证明反向引用清零**。固定路径还可能出现在源码、脚本、CI、code span、引用式链接或存档报告。继续保留兼容页。

## 四、本轮实际文档修正

- `UI/components/README.md`：原 2026-10-30 无实现描述改成历史快照；当前 React UI 的真实 owner 位于 `UI/src/`，不因 components 空目录就重新造框架；Windows 数据设计及审计资料改指 A1/A0、UI 入口改指 README（提交 `068e5396`）。
- `UI/space/README.md`：Windows 数据规则直达 A1，当前 UI 指向 `UI/README.md`，旧 UI CONTRACT 降为历史研究（提交 `d6db11b3`）。
- `workflows/modes/software-development/UI/README.md`：旧无实现说明加历史时点并注明这是专业页面预留；上级 Modes/UI/Views 现行入口分别改指各模块 README，旧 CONTRACT 保留研究用途，相关历史功能/视图文档直达 A0（提交 `d9e670ba`）。
- 上述三份修改后再次按远端完整 Git Tree 验证其普通行内相对目标存在，**未发现失效目标**。

## 五、待裁决的模块职责冲突：不擅自改产品设计

`workflows/grid/README.md` 写“维护工作流定义、自由格子节点、正交连线、布局、草稿修订及编辑状态”；现有 `workflows/editor/README.md` 和 `views/README.md` 分别将画布交互、视觉布局/修订投影与 Workflows 业务定义分离。若未来把 `grid` 作为新的独立 owner，需要先核对到底是内部组合模块、独立持久化 owner 还是复合 UI 入口，避免建立重复的 Definition/布局/权限状态源。**本轮不更改 grid 数据模型、不新建源码，也不为选择 owner 直接修改已确认产品边界。**正式自由格子与 Scheduler 仍后置 0.1.2。

## 六、剩余验证门槛

1. 最新完整 Git tree 已可由 GitHub 连接器读取（第七轮审计），但**本轮仍未运行** `node tools/check-docs.mjs --json --strict`、`npm test`、`npm run check:boundaries`。
2. 完成全部标题锚点校验、引用式链接/HTML 链接与代码字符串路径回链，保留第三方不完整快照分类。
3. 旧兼容页删除必须逐项证明：目标正文存在、无独立事实或证据、没有当前有效消费、全仓严格检查通过。严禁仅因搜索结果少就立即删除。
