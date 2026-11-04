# 关键设计与文档冲突审查

2026-11-04；本轮只收敛文档，不批准新产品规则。

| 类别 | 问题与双方来源 | 处理与影响 |
|---|---|---|
| A 已修 | [根 README](../../../README.md)已规定最短路径；旧 docs 索引及两份治理规则要求 AGENTS/版本表/CONTRACT 必读 | 统一根 README → 模块 README → 源码测试；版本计划与研究按需。治理规则保留一份正文，历史过程归档 |
| A 已修 | 模块 CONTRACT 变成兼容页，README 等仍链接其不存在的章节 | 直接指向原研究正文及真实锚点；不复制研究正文或恢复已删除的 Space CONTRACT |
| A 已修 | 迁移后的研究 CONTRACT 链接仍相对旧 owner，导致 123 项自有断链 | 按旧 owner 和实际目标重算相对路径；全仓检查所有入链，包括历史报告与 UI 子页 |
| A 已修 | [项目总体说明](../../维加项目总体说明.md)权限段出现“主 AI/秘书 AI 独立用户设置”；[权限矩阵 A](../../product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md)已确认共享对话等级 | 改为共享、用户主动设置；未改四级策略或任何 B 类保护边界 |
| A/B 已修 | [workflows README](../../../workflows/README.md)仍称不新增顶层调度器；[scheduler README](../../../scheduler/README.md)已规划独立模块 | 当前导航改 Scheduler；runtime/ 原文加历史标识，不迁移或编写产品运行时 |
| B 已修 | 旧 MODULE-CONTRACTS、批次准备度与 planning/ 可能被当实时派工 | 原地历史标识并保留原结论、编号和证据；新 docs 索引只导航 |
| C 已修 | 部分模块 README 仍写“实现待核验”，容易与四域现有代码混淆 | 逐模块列源码/测试/出口及实验区别，见 [模块事实表](MODULE-STATUS.md)；Space、AI、Conversations 等未发现产品 src/tests |
| C 保留缺口 | 产品权限矩阵已确认多入口与四级；permissions 实现仍仅 conversation 入口 | 标明实现缺口，未将产品决策降级或放开权限；不在本轮改代码 |
| D 待决 | [产品总体说明 §十五 A](../../维加项目总体说明.md#a-space-的-placement产品概念与内部模型分离)不含第五层 Placement；[Space README](../../../space/README.md)仍有关系 ID、存储与必做断言 | 已修成内部关系候选，不作为第五层 UI 对象。仍需决定多处引用与内部关系是否采纳、持久化和自然组织操作如何对应；不删模型或改变功能编号 |
| D 待决 | [总体说明 §八](../../维加项目总体说明.md#八工作流自由格子交互独立调度器多视图四种不同职责)允许图形交互扩展；[grid](../../../workflows/grid/README.md)目前位于工作流目录 | 四种职责已分别解释；通用自由格子底座是否抽取、哪些视图复用，留待验证，不强制统一引擎 |
| D 待决 | [双插件边界](../../architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)、[插件研究](../../../plugins/README.md)、[DSH 原生兼容](../../../dsh/README.md)、[外部 DSH](../../../connections/dsh/README.md) | 内置适配器、自有动态插件、兼容宿主、具体 DSH 插件、外部 Agent 五类区分；安装/加载/隔离/Service 补齐和跨机制协议尚未冻结，不因实验采用 Cordis 就统一产品协议 |
| D 待决 | [权限矩阵 §6](../../product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md#6-安全敏感操作的专门边界b-候选)为 B 候选；IV 全风险自主、工作流启动确认及共享对话等级为 A | Shell、插件安装、凭证/策略修改的特殊边界及非对话入口具体准入规则仍须确认；不得用文档整理批准 |
| D 待细化 | workflows 维护任务业务，scheduler 声明“运行状态”；旧 runtime 将 Task 推进/检查点混在一起 | 顶层调度职责已确认；任务业务状态与调度运行观察、恢复接口的详细划分留正式施工前核对，不冻结新接口 |

## 版本及基础模块核对

0.1.1 仍为三批基础业务与桌面验收；正式自由格子、独立调度器、DSH 插件机制产品化、外部 Agent 连接闭环在 0.1.2。没有为实验新增首期依赖。AI/角色、Conversations、Connections 的 owner 维持原边界；App 装配、Shared 技术存储不提升为业务总管。多视图基础布局保留在 0.1.1，复杂专业工作台与窗口组织未冻结。

真实争议不会阻塞其余引用和导航修复。以上待决项在本轮均未获得新增授权或实现结论。
