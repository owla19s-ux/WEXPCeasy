# WEX 文档体系索引

**最近工程交付：[第八批基础复验与 Electron / React 宿主最小验证](batch8/REPORT.md)** · [Electron / React 实验复现说明](../experiments/electron-host-spike/README.md)。

**阶段规划入口：[阶段路线图](planning/PHASE-ROADMAP-2026-10-31.md)** · [后续施工计划](planning/CONSTRUCTION-PLAN-2026-10-31.md)。最近完成批次：[第八批报告](batch8/REPORT.md)；[第八批任务书](batch8/PLAN.md)仅保留历史范围。

本页是仓库设计、架构、研究、审查、阶段规划与批次交付的统一入口。源码功能域仍按模块就近维护；这里不复制模块私有契约。


## AI 阅读与文档权威顺序

AI/协作者进入仓库时，先读根目录 [README](../README.md) 了解产品身份与当前状态，再读根目录 [AGENTS.md](../AGENTS.md) 确认工作边界，然后按具体任务读取本索引和目标模块文档。任务范围以用户明确指派及后续正式任务总表/施工卡为准；历史批次任务书只记录当时范围，不自动构成当前派工。

模块 `README.md` 用于快速了解职责和目录；模块 `CONTRACT.md` 是该模块当前业务语义、公开能力和依赖边界的主要依据。跨模块问题还需读取相关全局架构与决策记录。若文档与当前代码状态不一致，必须标记差异并核实，不能把设计描述当作已实现事实。

## 文档归属规则

| 类型 | 位置 | 内容与维护原则 |
|---|---|---|
| 产品需求基线 | [product/](product/README.md) | F01–F15 基础功能、交互语义、UI 映射边界与需求对冲；不替代模块契约或版本计划 |
| 模块职责与业务契约 | 各功能域的 `README.md`、`CONTRACT.md` | 模块自己维护；全局索引只负责导航 |
| 全局架构 | [architecture/](architecture/README.md) | 跨模块结构、边界、运行与宿主设计 |
| 决策记录 | [decisions/](decisions/README.md) | 已确认约束、候选、实验门槛、用户待决事项 |
| 研究资料 | [research/](research/README.md) | 需求、生态、技术调查与方案比较 |
| 审查报告 | [audits/](audits/README.md) | 压力审查、差距审计、验证与证据等级 |
| 阶段规划 | [planning/](planning/README.md) | 产品阶段目标、依赖关系、阶段门槛和后续施工顺序 |
| 批次交付 | [batchN/](.) | 按批次保存任务书、结论、原始证据与交付记录；当前批次从施工计划进入 |
| 可执行实验 | 仓库根目录 `experiments/` 及模块内实验目录 | 代码、夹具和可重复运行入口，不等同产品实现 |
| 外部参考 | 仓库根目录 `references/`、`dsh/upstream/` | 保留来源、版本与许可证；不自动成为 WEX 内部契约 |
| 未来需求对冲 | [需求对冲架构](../需求对冲架构/README.md) | 长期需求候选，不自动进入首期施工范围 |
| 历史资料 | [旧资料](../旧资料/README.md) | 已被新结构取代的旧版资料，仅供追溯 |

## 当前状态与规划入口

- 最近完成批次：[第八批交付报告](batch8/REPORT.md)。第八批任务书是历史范围记录，不是当前待执行任务。
- 基础能力规格：[G1–G7 落地映射](planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。这是跨模块能力归属和验收依据，不是完整产品功能表，也不是 0.1.1 版本计划。
- 既有[阶段路线图](planning/PHASE-ROADMAP-2026-10-31.md)和[后续施工计划](planning/CONSTRUCTION-PLAN-2026-10-31.md)保留作研究/历史规划参考；在重新核对并建立新的正式规划前，不把它们或旧批次任务书直接当作当前派工依据。
- **当前工作流画布方向：** [自由画布与节点工作界面设计](architecture/WORKFLOW-CANVAS-AND-NODE-WORKSPACE-DESIGN-2026-11-01.md) · [技术路线研究](research/WORKFLOW-CANVAS-TECHNOLOGY-REVIEW-2026-11-01.md) · [方向决策](decisions/WORKFLOW-CANVAS-DIRECTION-2026-11-01.md)。
- **产品需求基线已建立首轮稿：** [F01–F15 基础功能总表](product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md)、[交互与 UI 边界](product/INTERACTION-AND-UI-BOUNDARY-2026-11-01.md)、[需求对冲与遗漏审查](product/REQUIREMENT-REVIEW-2026-11-01.md)。仍需第二轮逐项评审和用户确认；不代表 0.1.1 范围已批准。
- **待建立：** 0.1.1 版本计划，以及据此形成的阶段任务总表和施工卡。
- [全模块业务契约索引](MODULE-CONTRACTS.md)：模块职责、公开能力、依赖与现有实现状态。
- [基础能力完整性审查](audits/FOUNDATION-CAPABILITY-COMPLETENESS-REVIEW-2026-10-31.md)：基本动作遗漏与复杂组合检查。
- [第六批准备度与实验记录](batch6/README.md)：历史审查依据和实验结果。

## 模块文档引用规范

核心功能域的文档入口按以下规则维护，避免模块契约与全局资料脱节：

1. 每个核心模块的 `README.md` 提供本域 `CONTRACT.md#文档关联与施工入口`、[文档总索引](README.md)与[全模块契约索引](MODULE-CONTRACTS.md)入口；README 不复制整套参考清单。
2. 每个核心模块的 `CONTRACT.md` 必须包含“文档关联与施工入口”，按需链接全局架构、正式决策、相关研究、审查报告、第六批准备度/收敛/待决、实验报告与可复现实验入口。只引用对本域有实质影响的资料，不为凑齐栏目而挂无关文档。
3. 子目录 README 链接回唯一上级 owner 契约；页面、编辑器、适配器或局部实验文档不得建立第二份业务权威。跨域 UI 可以同时链接多个 owner 契约，但必须明确各自职责。
4. `plugins/`、`dsh/`、`accounts/` 等尚无完整模块契约的预留/独立实验目录，必须直接标明当前状态、证据边界和对应全局文档；不能把实验仓位或研究目录描述成产品已准入模块。
5. A/B/C/D 状态在模块、研究和批次之间保持一致：A 是既定约束；B 是候选/推荐；C 是待实验；D 是用户待决。实验只更新证据，不自动批准 B，也不能替用户关闭 D。
6. 文档迁移时同步更新正文链接与索引；旧路径只保留短期兼容指向，不继续维护重复正文。模块契约的业务变更先更新 owner 文档，再更新全局索引与相关入口。

自动检查只验证文件链接、入口章节和部分样本覆盖，不证明语义正确、标题锚点渲染、产品实现或 Windows/外部集成通过；最终验收仍须按相应证据等级进行。

## 维护规则

1. 新的模块业务规则写回对应模块的 `CONTRACT.md`，不要另建一份平行的全局模块契约。
2. 跨模块结构写入 `architecture/`；正式决策及未决政策写入 `decisions/`。
3. 研究与审查报告保留来源、日期、证据等级和未验证限制。
4. 批次报告保留完整历史，不直接覆盖模块当前契约；批次结论需回写模块后才成为其当前施工依据。
5. 旧路径可能暂时保留迁移指向页以兼容历史链接；指向页不是正文，不得继续在旧位置维护。
6. 任何报告、实验或测试通过都不能自动改变用户批准的产品范围、权限政策或正式决策。

- **基础能力落地规格**：[G1–G7 模块落地映射与跨对话持续工作](planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)：将基础能力逐项归入现有 owner，并规定跨 Conversation/模型/Agent 的持久检查点与恢复验收。

- [API 历史复用与 Pi AI 独立验证](research/api/README.md)：历史矩阵、逐项兼容、DEC 对抗实验与 A/B/C 决策；非正式 API 重构。
