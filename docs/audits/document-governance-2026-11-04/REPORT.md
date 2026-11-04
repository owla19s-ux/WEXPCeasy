# 全仓文档治理施工回执

日期：2026-11-04（上海时间）。执行前远端及本地 main：`1048b6a615554d80693830ced4b33b9cee4cffa5`。初始工作区干净、无开放 PR；未发现其他已公开的施工改动。无法观察其他执行者未提交的私有工作区；提交前再次核对远端并采用非强制更新。

## 完成范围

- 完整 Git 文件树盘点 Markdown、TXT 与其他说明格式；[完整清单](inventory.json)逐份记录用途、模块、状态、重复/冲突标记及动作。
- 根 README、AGENTS 兼容入口、docs 索引、版本计划和模块 README 阅读规则统一；原六轮治理过程保留[历史正文](../../research/document-governance/CONSOLIDATION-2026-11-02.md)，旧路径仅作兼容，现行规则只维护一份。
- PROJECT 压缩为概要与架构入口；产品机制统一链接《维加项目总体说明》，功能总表 216 个编号全部保留。
- 按原 owner 修复已迁移 CONTRACT 的相对链接；引用兼容页不存在章节的链接改到归档正文。Space 旧 CONTRACT 保持删除状态，全部内部入链指向现行 README 或历史正文。
- 当前调度导航改独立 scheduler；历史 runtime、批次、研究契约保留原结论并明确状态。Placement 标为内部关系候选，未增第五层产品对象。
- 核对 19 个模块/子域的源码、测试与公开出口，README 增加真实快照；区分设计、实验、产品、单测、组合和 Windows 证据，见[模块事实](MODULE-STATUS.md)。
- 重复治理覆盖完全相同正文及近重复候选，见[逐组结果](duplicates.json)。相同批次日志和不同外部快照各有出处，不删除；兼容导航有独立用途。没有为减少数量清除有效知识。

## 数量与权威

统计口径为完整 Git 清单中的 `.md/.mdx/.txt/.rst/.adoc/.org`；HTML 原型仅为 React 挂载页，JSON/YAML/TOML 为配置/证据附件，不计正文。Markdown 与文本证据分开，避免只数 Markdown 而漏掉测试记录。

| 项目 | 整理前 | 整理后 |
|---|---:|---:|
| Markdown | 242 | 246 |
| TXT 原始证据/外部说明 | 77 | 77 |
| 文档合计 | 319 | 323 |
| 删除 | — | 0 |

Markdown 目录分布：docs 102→106、references 32→32、旧资料 18→18、dsh/upstream 5→5、其他 85→85。现行职责入口 CURRENT 45、有效补充 SUPPORTING 105、历史 HISTORICAL 134、外部 EXTERNAL 39。

新增四份 Markdown：治理 REPORT、CONFLICTS、MODULE-STATUS，以及由旧治理正文归档形成的一份正文。旧治理路径保留兼容指向。完整目录分布、主要状态、类别统计以 inventory.json 为准；CURRENT 表示需要持续维护的职责入口，不代表全部功能已批准或实现。SUPPORTING 是按需有效资料；HISTORICAL 保留历史证据；EXTERNAL 保护第三方。

[处理记录](changes.json)列全部新增/修改文件及原因；[完整性结果](integrity.json)记录前后树核对、迁移路径、零删除、216 编号不变及全部源码/配置/测试/第三方文件哈希不变。既有产品源码、业务接口与权限策略均未修改。

## 冲突结论

已修复 A 类规则/导航错误、B 类历史适用性、C 类代码状态描述。真正待决事项见 [冲突表](CONFLICTS.md)：Placement 内部关系取舍、自由格子通用化、插件安装/隔离与跨机制协议、特殊权限边界，以及任务业务状态和调度观察的详细接口划分。只保留未决，不批准新架构或策略。

0.1.1 仍为三批基础模块、组合及桌面验收；自由格子工作流、正式调度器、DSH 插件机制产品化、DSH 连接器及外部执行闭环后置 0.1.2。没有新增本版依赖或改动功能编号。

## 验证与限制

| 命令/核对 | 结果 |
|---|---|
| `npm ci` | 依赖安装成功；锁文件未改 |
| `npm run typecheck` | 通过 |
| `npm test` | build、133/133 测试与 AST 模块边界检查通过 |
| `node --test tools/check-docs.test.mjs` | 4/4 通过 |
| `node tools/check-docs.mjs --json --strict` | WEX 自有问题 0；第三方 67 项单列，含 66 个缺失文件目标与 1 组重复正文 |
| `python docs/audits/document-governance-2026-11-04/verify.py --output docs/audits/document-governance-2026-11-04/links.json` | 自有本地文件、大小写、编码和 ATX 标题锚点 0 问题；第三方 66 个原始缺失文件目标 |
| 全树哈希保护、216 功能编号集合核对、`git diff --check` | 通过 |

[完整链接结果](links.json)保留每个外部快照问题、未探测的远端 URL 和方法限制；[原检查器结果](legacy-links.json)保留独立核对。新检查器覆盖内联/引用式/HTML 链接、相对路径、中文路径/URL 解码、大小写、同页与跨页 ATX 锚点、重复标题后缀和显式 HTML ID。未声称远端 HTTP 全部可达、动态生成锚点或 Setext 标题渲染已验证。仓库没有自有链接依赖未覆盖的 Setext 标题。

没有运行真实 Provider、GitHub 写操作、外部 DSH、完整 Electron 或 Windows 实机；历史实验记录未冒充本轮实测。没有开展 216 条功能的逐条产品验收，本轮完整性检查为编号、来源、链接和文档职责，不替代业务验收。

执行前已查看 Actions 总运行集合：基线 Foundation verification 成功，Documentation audit 失败；本轮本地复现断链后已修复，不盲目重跑旧 CI。提交后 CI 需按实际提交 SHA 另行核对，旧成功不算新提交证据。

## 提交与复核

本回执随治理提交保存；实际提交 SHA 与执行后 HEAD 以本文件 Git 历史中的本轮提交及最终交付消息记录，避免在提交正文内自引用未来 SHA。完整文件变化可用 `git show --stat <本轮SHA>` 和 changes.json 复核。

后续按根 README 返回 Space 当前施工；上列产品待决项按实际受影响功能再处理，不再让历史文档成为默认开工前置。
