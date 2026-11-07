# WEXPCeasy｜文档体系复审第二轮（2026-11-07）

> **性质**：全仓治理基线复核、当前权威文档逐份检查与定向修订；不是新架构设计或业务验收。基线是当前 GitHub `main`，复审前最近 SHA `c82cee1fe50abf1d675efbabde065ded3aec4f47`，本轮审阅和写入期间已有更新，最终 SHA 以 GitHub 提交记录为准。
>
> **范围与证据等级**：本轮使用 2026-11-04 [完整库存](../document-governance-2026-11-04/inventory.json) 的 323 份文档基线进行分类核对，再针对旧清单 **45 份 CURRENT 现行正文**、新近 B1/B3 任务、两份 11-07 UI 设计、environments 和治理回执进行逐项入口与正文检查。45 份 CURRENT 的本地 Markdown 链接做了**基于旧库存及新增路径的目标静态比对**，另核实被标记可疑的 4 个源码/JSON 文件目标。未运行全仓最新文件树递归枚举、完整锚点解析、CI、Windows 实测或 323 份逐字语义审计，**不能将本次结果说成全仓零问题**。

## 1. 文档体系总体判断

继续采用 [现行文档权威与维护原则](../../DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md) 和根 README 所定 **根 README → 目标模块 README → 源码/测试** 的最短施工路径。正式版范围在 [0.1.1 PLAN](../../versions/0.1.1/PLAN.md)，跨模块施工专项在 B3/B1 任务；产品愿景、216 功能、权限已确认政策各保留唯一正文。历史 CONTRACT、MODULE-CONTRACTS、11-04 MODULE-STATUS、实验和旧路线图仅供按日期追溯，不重新指定当前待施工模块。

GitHub `1048b6a6…` → 本轮后续 main 的提交对比显示约 339 个提交、文件列表只返回前 300 项，其中 106 项为 Markdown/TXT 变更。**这不是完整变更文件清单**，再次证明旧库存的数量与状态不能直接作今天的统计。

11-04 的 [报告](../document-governance-2026-11-04/REPORT.md) 记录 **323 份 Markdown/TXT（246 MD、77 TXT）** 是历史完整树快照，不能当成今日文件数量；后续新增的 UI 设计、任务、源码等并不包含在那份库存中。该报告当时 WEX 自有链接检查通过，不代表今日完整仓库已再次自动通过。

## 2. 确认问题与本轮处理

| 编号 | 原位置与问题 | 处理 | 决策等级 |
| --- | --- | --- | --- |
| DOC-R01 | B1-EXECUTION-TASK 仍将 AI/Conversations 称“缺失核心模块”，GitHub/Local 声称无正式 src/tests | 改为对现有代码与测试核验、补缺；原 B1 编号/独立验收范围不变 | A：时间事实修正 |
| DOC-R02 | shared/README 仍称“当前施工模块是 Space” | 指回根 README 与 B3 当前任务；shared 保持独立技术 owner | A |
| DOC-R03 | UI/space/README 子目录无源码却写成整个 Space UI 无实现 | 标明真实代码在 UI/src/space.tsx、space-addresses.tsx；子目录不另造第二套页面 | A |
| DOC-R04 | UI/settings/README 称没有设置 UI，但 Workbench 已有基础设置界面 | 区分“此子目录无文件”“正式 Workbench 有基础设置壳”“模块业务面板未完成”；环境安装仍无实现 | A |
| DOC-R05 | UI/conversation/README 的“无产品实现”易误指 Conversations 领域 | 明确领域已有 src/tests、正式会话页面仍待 B3 D-05 接线 | A |
| DOC-R06 | AI/roles 子目录声明无实现，易误当 AI 领域无角色相关代码 | 标明子目录无独立 src，不否定 AI/src 现有产品能力；细功能按代码核验 | A |
| DOC-R07 | views/README 仍称本域无产品引擎，但 UI 多视图标签已开始落地 | 区分 views 专业视图引擎与 UI 的基础工作窗口/标签两种职责及证据层级 | A |
| DOC-R08 | UI/CONTRACT 再次增加一套现行施工规范，与 UI README 重复且违背文档权威规则 | 当前唯一 UI 施工职责收敛到 UI/README；CONTRACT 保留原历史研究内容和导航，不复制现行规范 | A |
| DOC-R09 | UI V0.6 首页只声明 §§1–8 优先、忽略了新增 §14/§15；§7.5 仍要求第四列承载回执，和默认收起冲突 | 修正优先级、将第四列回执改为未来可选展示，不强制分栏；预览区不再叫常驻第三列 | A |
| DOC-R10 | UI 功能映射仍引用布局草案 V0.4 和“固定四列”措辞 | 修正 V0.6 指针与概念区域/动态共享工作窗口用语 | A |
| DOC-R11 | 根 README 将旧 SHA 的 Renderer/SpacePanel 状态紧贴当前执行导航，易看成最新实现 | 标明当时快照，补 D-08 部分源码实现与**尚未取得新一轮编译/Windows E4 证据**；环境 owner 专项移到按需区 | A |
| DOC-R12 | 10-30 SOURCE-LAYOUT 架构草案仍写“首期 React Flow + DSH”可用闭环、UI/main.* 等规划路径 | 顶部注明已被 0.1.1 正式计划和当前 React/自研共享窗口方案覆盖；原文保留历史溯源 | A |
| DOC-R13 | 11-07 APS/WEX 历史 UI 整理把旧第四列默认对话三段布局称为“当前 PC 布局” | 明确这是已废弃的历史落点，表头标记历史，现行布局转 V0.6 | A |
| DOC-R14 | planning/README 仍把 B1 顺序作为当前统一任务入口，并称模块 CONTRACT 是当前业务权威 | 改指 B3 当前任务和模块 README；B1 保留独立验收 | A |
| DOC-R15 | F/I/U 语义文档的“先完成全部 F01–F15 再做 UI”容易被解释为当前施工阻塞 | 顶部明确是概念/验收依赖顺序，不限制已批准的 B3 基础 UI 施工 | A |
| DOC-R16 | audits/README 未列最新 11-04 完整治理与 11-07 本轮复审 | 补回两个分级可追溯入口，旧审查报告保留 | A |

**处理范围**：只修文档的陈述、入口和相互引用；没有改产品源码、权限策略、功能编号、领域契约、0.1.1/0.1.2 版本边界，也未删历史研究正文。

## 3. 链接与内容检查结果

- 从 11-04 库存提取 45 个 CURRENT 路径，并对这 45 份现行入口扫描 Markdown 相对目标；另读 B1/B3 和两份最新 UI 设计、11-07 状态回执、环境 owner 说明。通过库存路径比对，**没有确认现行自有 Markdown 文件目标断链**。仅提示的目录链接和非 Markdown 源码、JSON 目标需区别处理。
- `dsh/upstream-files.json`、`shared/src/index.ts`、`shared/src/storage.ts`、`permissions/src/index.ts` 四个可疑非 Markdown 目标已单独按远端文件读取确认存在；不是错误。
- 这是**定向的文件目标存在性筛查**，不是最新完整树上的锚点、相对大小写、URL 编码、所有 323 份 Markdown/TXT 或第三方快照的自动校验。禁止把它转写为“全仓链接零错误”。
- 11-04 治理已有完整 inventory/duplicates/links/integrity 原始证据，保留不覆写。历史 SOURCE-LAYOUT、MODULE-CONTRACTS 等若有过时结论，以当前模块 README、产品与版本权威为准，不删除原时点记录。

## 4. 继续保留、不得借治理改政策的事项

1. **Space 内部 Placement**：用户确认不存在 Placement 产品层级；现存内部关系模型如何处理是单独的真实技术/产品决策，不以替换名词或删除历史文档解决。
2. **权限**：D01/D02 已确认政策与安全敏感操作特殊边界的候选状态不同；不能把 B 候选直接转 A。
3. **DSH、插件、自由格子、Scheduler**：职责划分和历史实验保留；本轮文档复审不提前扩 0.1.1。
4. **UI**：当前动态共享工作窗口、只读授权资源预览、基础交互栏已有部分产品源码；正式文件编辑、完整对话页、模块设置、Windows Snap/高 DPI 与安装/恢复证据仍须单独验证。设计文档更新与组件提交不能当作验收。
5. **全量剩余审查**：在具备仓库工作树和测试环境时，必须再跑 `node tools/check-docs.mjs --json --strict`、`node --test tools/check-docs.test.mjs`、`python docs/audits/document-governance-2026-11-04/verify.py --output ...`，检查最新 main 中自有/第三方结果、锚点、大小写、重复及新增文件；随后对 SUPPORTING/HISTORICAL 中容易被当成施工命令的旧文档做定向语义对冲。**未运行，不标通过。**

## 5. 文档维护纪律

- 产品变化：先写各自的唯一权威正文，再更新必要的模块入口、版本施工任务以及相应索引；不要向历史 CONTRACT、根 README、其他索引各复制一份完整方案。
- 代码事实变化：仅引用带 SHA 的证据或明确标为“待核实”，逐项区分文件存在、独立测试、跨模块操作、Windows 实机。
- 真正需要删除文档时：必须检查权威唯一性、反向引用、历史证据、兼容跳转和本地链接；不为了减少数量删除重要研究/外部快照。
- 下一次治理不应凭本报告推定今天 323 份仍是完整数量；必须先重新取得最新文件树及增量清单。
