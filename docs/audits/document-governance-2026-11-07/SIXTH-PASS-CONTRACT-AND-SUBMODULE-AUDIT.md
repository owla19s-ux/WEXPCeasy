# WEXPCeasy｜第六轮：CONTRACT 权威与源码子目录文档审查（2026-11-07）

> 仅文档治理，不变更产品源码、接口、权限、功能编号、模块边界、依赖清单或版本范围。以开始时最新远端 main `e72956fdae6bf40672a28557f41018a9d28847b5` 为检查起点，所有后续修改以 GitHub 单文件 SHA 校验提交。

## 一、CONTRACT 文档权威分类

检查 `connections/`、`connections/api/`、`connections/local/`、`AI/`、`conversations/`、`shared/`、`permissions/`、`app/`、`workflows/`、`views/`、`plugins/`、`UI/` 十二份 `CONTRACT.md`：

- 前九份均为短兼容页，明确当前施工从模块 README 进入，历史研究归档到 A0；其中 `connections/CONTRACT.md`、`AI/CONTRACT.md`、`conversations/CONTRACT.md` 仍指向 A0 迁移前的 `docs/research/contracts/`，已修复为归档后正文（`6d2cbcac`、`f98a5ba`、`4571ff4d`）。
- `views/CONTRACT.md`、`plugins/CONTRACT.md`、`UI/CONTRACT.md` 保存独立的第四批业务/交互研究正文，不宜在本轮直接删除或压缩。其内容已有历史研究标记；进一步修订对应 `views/README.md`、`plugins/README.md`、`UI/README.md` 的引用措辞，明确候选功能编号/测试样例不是当前接口冻结、版本派工或验收结果（`985a2497`、`6c4966bd`、`c2c1be4b`）。
- `connections/github/CONTRACT.md` 的 GH-01～GH-12 同时承担目标与分项验收参考，不能当短兼容页删除。当前状态以 GitHub README 和 A2 总表为准，未完成项目不能用完整目标表伪装已实现。

## 二、第二层子模块文档清查

检查并修复 10 份更深层目录的历史引用：

`connections/api/UI/README.md`、`shared/permissions/README.md`、`connections/search/README.md`、`shared/storage/README.md`、`connections/github/UI/README.md`、`workflows/editor/README.md`、`shared/credentials/README.md`、`workflows/runtime/README.md`、`tools/README.md`、`workflows/modes/CONTRACT.md`。

更改只针对已确认的旧 `docs/research/`、`docs/architecture/`、`docs/audits/`、`docs/planning/` 与早期根索引兼容路径，分别指向 A0 研究/历史正文或 A1 已确认设计。上述 10 文件的提交分别为 `de43c467`、`2828e537`、`c191f5e4`、`6a95b2f9`、`61957ae8`、`a94556fa`、`eb33fb2b`、`5f8aaa6a`、`a44cd72b`、`5d37bbc0`。

后续进一步修正：

- `shared/storage/README.md`：明确旧 2026-10-30 的“无产品实现”属于子目录历史状态；正式 `shared/src/index.ts` 已公开 SQLite Store、Root/Path 端口，不能另建第二套共享存储。Windows ACL 与跨存储恢复仍需独立验收（`e38d719e`）。
- `shared/credentials/README.md`：明确共享 Vault 出口及 App 的 Windows safeStorage 适配已有源码，不等于实机凭证迁移/撤权竞态已验收，也不能重复造凭证库（`460a99b9`）。
- `connections/api/UI/README.md`、`connections/github/UI/README.md`：领域连接器源码与独立可用的设置面板分开陈述，标明当前 Workbench 的对应按钮未接通；现行 UI 入口指向 `UI/README.md`，历史 `UI/CONTRACT.md` 仅追溯（`edecfe5e`、`12100fe3`）。
- `workflows/editor/README.md`：将新调度 owner 明确指向 `scheduler/`，不再说 `workflows/runtime` 维护新调度；自由格子仍属 0.1.2 后置方向（`68c9f42e`）。
- `workflows/runtime/README.md`：历史派发/恢复职责不再视作现行施工授权；保留原研究与故障注入样例，当前调度 owner 为 `scheduler/`（`e71d1a10`）。

## 三、核验边界

按 GitHub 远端读取确认 **10 个关键 A0/A1 新目标文件存在**：Connections/AI/Conversations 历史 CONTRACT、MODULE-LOCALITY、旧编辑器 UI 研究、WINDOWS-LIFECYCLE、WORKFLOW-CANVAS 技术研究、第六批 CONVERGENCE、源码/Windows 数据设计、正式工作流画布设计。该检查未验证每条相对链接的锚点、大小写、外部链接与所有更深层子目录，更没有执行代码测试。

GitHub 文本搜索旧 `docs/research/contracts/` 可看到现行文档、迁移历史记录和库存 JSON；搜索结果可能是旧索引与历史字面说明，不能据出现次数机械删除文件。原始审计材料、批次 evidence、第三方快照保留。

## 四、尚待完成

1. 取得最新完整 Git tree/工作树，执行文档工具 `node tools/check-docs.mjs --json --strict` 与对应测试，逐条验证本轮改过的链接及锚点。
2. 对其余低层目录与包含旧源码状态的文件完成逐文件业务/证据核验；已确认的 owner 不能因目录名被重复实现。
3. 真实编译/模块测试、边界检查、Windows E4 均未在本轮运行，不能标通过。
4. 旧兼容页删除仍受全仓反向引用零残留、独立证据不丢失、路径/锚点检查通过三道门槛限制；**本轮未删除任何兼容文件**。

## 五、续查补充：第二层目录与 App 通信研究

在记录本批审计后，又检查了 `dsh/runtime/README.md`、`workflows/modes/README.md`、`workflows/modes/software-development/README.md`、`app/COMMUNICATION.md`，确认存在引用旧兼容页的相对 Markdown 链接，已转向 A0/A1 唯一正文：

| 文档 | 修改内容 | 提交 |
| --- | --- | --- |
| `dsh/runtime/README.md` | 第六批实验→A0；双插件正式边界→A1；历史 DSH 差距审查→A0 | `ce20a79f` |
| `workflows/modes/README.md` | Windows 数据规则→A1；第六批研究→A0 | `40c6f06d` |
| `workflows/modes/software-development/README.md` | 数据规则→A1；旧功能全景研究→A0 | `48887907` |
| `app/COMMUNICATION.md` | 第四批 Agent/安全/Windows 生命周期/契约压力研究→A0 | `5ae04d2d` |

`app/COMMUNICATION.md` 是第四批旧通信设计稿，其候选 IPC 组织方式与接口不因引用修复而获得当代实现授权。仍须以 `app/src`、`UI/src/index.ts` 与当前授权契约核对。

本续查同样没有执行源码测试或全仓锚点检查；旧路径兼容文件仍全部保留。
