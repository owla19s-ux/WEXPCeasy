> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# WEX 后续施工计划（2026-10-31）

- 规划基线：`main` `4e78382670875628e2675f43c71afa78fabfbcec`
- 规划范围：从第八批开始，面向 WEXPC 首版可用目标。
- 施工方式：按模块 owner 组织批次；真实复杂链路用于组合验收，不作为跨模块串改施工包。
- 上位依据：[阶段路线图](PHASE-ROADMAP-2026-10-31.md)、[第六批模块准入矩阵](../工程研究批次/batch6/READINESS.md)、[第六批施工顺序](../工程研究批次/batch6/NEXT.md)、[第七批报告](../工程研究批次/batch7/REPORT.md)。

## 1. 当前施工基线与先决事项

当前 main 已有 shared / permissions / app 的基础产品实现。第七批最后一轮修复补充了停机重试、锁创建安全回滚和根身份标记检查，但该轮明确没有在提交后重新运行 Node/TypeScript 全套测试。

因此第八批必须先完成当前 HEAD 复验，再开始 Electron 宿主验证。修复前测试数量不作为当前 HEAD 的最终验收结果。

## 2. 批次总表

| 批次 | 施工目标 | owner 模块 | 关键依赖 | 主要交付 |
|---|---|---|---|---|
| 8 | 基础模块最终复验与 Electron / React 宿主最小验证 | app、UI、shared、tools | 第七批当前 HEAD | 安全桌面窗口、Preload/IPC 冒烟、Electron 内存储驱动兼容性证据 |
| 9 | Space / AI 角色 / Views 首轮独立实现 | space、AI/roles、views | 第八批宿主方向通过；shared / permissions 公开面 | 独立 Context、组织引用、角色配置、布局配置与本域测试 |
| 10 | Conversations 独立业务实现 | conversations | shared、space / AI 的稳定公开能力 | 普通对话、消息、段落版本、来源引用和恢复行为 |
| 11 | Workflows 定义与任务证据模型 | workflows | shared、space、AI/roles | 不可变定义、实例绑定、Task、Requirement、Artifact、Verification、等待/阻塞 |
| 12 | API Provider 连接器与普通对话真实接线 | connections/api、shared/credentials、conversations | 第十批对话域 | Provider / Model 配置、凭证隔离、真实请求、流式/错误/中断语义 |
| 13 | Local 连接器 | connections/local、permissions、app | 第八批宿主；权限和连接契约 | 文件读写、终端进程、cwd/环境/超时/取消、Git 基础操作和回执 |
| 14 | GitHub 连接器 | connections/github、permissions | connections 公共边界、凭证 | 仓库读取、授权写入、提交/分支/PR 等实际支持能力、回读核验 |
| 15 | Workflow Runtime / Dispatcher / 资源协调 | workflows/runtime、connections、permissions、shared | 第十一、十二、十三批 | 真实派发、Operation 关联、资源冲突处理、unknown、恢复与验证交接 |
| 16 | DSH 外部 Agent 连接器实机闭环 | connections/dsh、workflows、app | 第十五批稳定派发接口 | 固定版本外部 Agent 接收、执行、产物定位、结果未知、停止/接续证据 |
| 17 | UI 真实接线与软件开发模式 V1 | UI、views、workflows/editor、workflows/modes/software-development | 第九至十六批对应提供方 | 对话/Space/设置/工作流编辑器、基础树形/关系视图、软件开发模板 V1 |
| 18 | Windows 产品化基础能力 | app、shared、permissions、UI | 桌面宿主与主要业务域稳定 | 安装/数据根/凭证/日志/诊断/备份/恢复/升级/卸载路径 |
| 19 | 0.1.1 端到端集成验收与交付准备 | 全部 owner | 第八至十八批达到准入 | 两个真实 WEX 项目、多 Agent、独立审查/验证、恢复和 Windows E4 验收 |

批次可按依赖并行，但并行前必须明确文件所有权和接口责任。第十批与第十一批可在不同 owner 下并行；第十二批依赖第十批的真实消费者；第十三、十四批可分别施工；第十六批不得与 DSH 原生插件宿主实验互相代证。

## 3. 每批统一施工流程

1. **读取基线**：读取最新 main HEAD、模块 README / CONTRACT、全局决策、相关实验、现有源码和测试。
2. **明确范围**：写清本批 owner、允许修改目录、禁止范围、依赖公开能力、未决 C/D 和验收等级。
3. **先测后做**：先写/运行失败测试，区分产品缺陷、契约歧义、环境限制和测试错误。
4. **独立实现**：模块自己维护业务数据、状态、行为和测试；跨域只消费公开面。
5. **消费者对照**：提供者和真实消费者使用相同验收向量；不能只测试提供方 happy path。
6. **真实组合**：按依赖接线，注入失败、超时、取消、迟到、unknown、并发和恢复。
7. **审查修复**：检查模块私有边界、权限绕过、重复权威、依赖环、资源泄漏和旧结果覆盖；发现问题先加回归再修复。
8. **收尾交付**：更新模块契约、README、批次报告、原始测试证据和索引；记录 main SHA、提交、测试命令、真实通过数、未执行项和遗留问题。

## 4. 重点批次的施工边界与验收

### 第八批：基础模块最终复验与 Electron / React 宿主最小验证

- 先重新运行第七批最后修复后的完整测试、类型检查、模块测试、源码边界检查和已有 DSH / React Flow 独立实验。
- 在隔离的最小宿主样本中固定 Electron 版本，核对 Electron 内嵌 Node 版本与 `node:sqlite` 的真实可用性。
- 验证 Electron 主进程启动/退出、单个安全 BrowserWindow、Preload 窄接口、IPC sender 校验、Renderer 安全默认值及 React 资源加载。
- 验证宿主能消费现有 app/shared/permissions 公开面，不暴露数据库连接、全局容器或通用 Node 能力给 Renderer。
- 验证根目录/Session 路径设置的启动时序；不在本批实现完整首次启动选址 UI。
- 若兼容性通过，可落地最小产品宿主骨架；若不通过，先保留实验、记录精确冲突与可替换适配方案，不推翻整体技术路线。
- 不施工完整页面、安装器、自动更新、后台常驻、插件加载器或 Windows E4 全量验收。

独立任务书：[第八批 PLAN](../工程研究批次/batch8/PLAN.md)。

### 第九批：Space / AI Roles / Views

- Space 只维护 Space、可选 Group、Context 本体和放置/资源引用；不复制对话、任务、连接或角色数据。
- AI/roles 只维护角色配置和职责关联；角色、岗位、Agent 执行身份、模型和授权分离。
- Views 只维护布局、视图配置和获准投影引用，不写回 Task / Operation / Permission 真相。
- 三域分别拥有独立测试和存储命名空间；用同一消费样例验证共享 Store 与权限读取，不引入跨域全局状态总管。
- 暂不做长期记忆、自主 Agent 循环、复杂多视图和模板市场。

### 第十、十一批：对话与工作流定义

- Conversations 支持不依赖 Space/Task 的普通会话；消息、段落版本、输入/生成关联、来源引用和持久化由本域维护。
- Workflows 先实现定义、版本、实例绑定、Task、Requirement、Artifact、Verification 与等待/阻塞事实；不把 Operation 状态复制进 Task。
- 本阶段不提前实现真实外部派发、资源锁算法、自动 Acceptance 或持续后台运行。

### 第十二至十四批：连接器

- API：真实 Provider 请求、凭证隔离、流式/中断/错误语义；测试桩与真实服务证据分开，未获授权不调用付费模型。
- Local：文件、终端、Git 作为独立能力；执行前检查目标、权限和资源版本；超时/取消不等于进程已停止。
- GitHub：按实际支持的 API 逐项实现；读、写、提交、PR、Actions 等能力分别声明，不把“GitHub 已连接”写成全能力支持。使用专用测试仓库做破坏性验证，不操作生产仓库。

### 第十五批：Workflow Runtime / Dispatcher / 资源协调

- workflows 拥有 Task、定义/实例修订、任务轮次、Requirement、Artifact、Verification 和最终验收。
- connections 拥有 Operation、attempt、外部调用事实、观察和回执；Task 只关联 Operation，不重复维护操作状态。
- 权限由 permissions 决定；实际副作用入口仍需复核；共享资源冲突覆盖有 Task 和无 Task 的调用。
- 资源身份至少考虑真实路径、Git 工作区/元数据、外部 Session 和远端对象；Context ID 不等于资源隔离。
- 未知结果不盲重派；外部 Agent 无法被内部锁约束时，采用可验证的独立目录/工作树或串行策略，不声称内部锁能阻止外部进程写入。
- 覆盖提交 ACK 丢失、派发窗口崩溃、回执迟到/乱序、撤权、取消、部分完成、恢复和人工接管。

### 第十六批：DSH 外部 Agent 连接器

- 固定 DSH 版本和真实接口；只实现已确认的发现、派发、接收、会话定位、结果/产物查询、停止等能力。
- 先用不产生费用且明确获授权的环境；没有真实可用环境时，报告阻塞，保留替身证据，不以 fake 任务冒充成功。
- 不将 DSH Agent Session/内部工具历史镜像到 WEX；WEX 保存投递、接收、产物位置和独立验收。
- 不将 `dsh/` 的 Core+Loader 原生 Bundle 测试作为外部 Agent 任务成功证据。

### 第十七批：UI 与软件开发模式 V1

- UI 只呈现和提交领域意图；每个页面消费对应 owner 的公开能力，不维护第二套业务 store。
- 完成主导航、独立对话、Space/Context、配置入口、连接状态、Task/Agent/证据和诊断反馈。
- React Flow 工作流编辑器至少能创建/编辑/保存版本化定义，并与 workflows 权威数据接线；画布布局不是执行事实。
- 软件开发模式作为可选模板：能新建或关联真实项目，组织需求/功能层级，关联任务、Agent、Context、本地/GitHub 资源，并提供基础树形/关联视图。
- 同时验证无模板普通 Context、独立聊天仍可用；AI 生成的结构先形成草案，用户确认后才写入，不自动授权或启动任务。

### 第十八、十九批：Windows 产品化与完整验收

- 安装目录与公共数据根分离；Space 工作区、独立 Context、外部资源可单独定位；主要数据遵循用户选择位置，系统凭证等例外明确说明。
- 凭证与普通配置分离；重装系统或卸载重装后必须重新配置凭证、重新授权；正常重启和普通升级不能被错误地当成重装。
- 完成日志/诊断、备份恢复、格式迁移、升级失败回滚、默认卸载保留数据及显式清理边界。
- 真实 Windows 安装、窗口、路径/ACL、凭证、休眠/关机、备份恢复与重装场景按 E4 留证。
- 端到端验收至少覆盖普通聊天、本地文件/终端/Git、GitHub、软件开发模板、两个不同 Agent 的非重叠并发施工、独立审查、真实测试、失败修复、中断恢复和旧 WEX 项目接回。
- 未通过 Windows 实机的部分保持未验收；不得用 Linux、模拟器或文档推演替代 E4。

## 5. 长期保持的工程规则

- 默认 main 小批量施工；短期分支只用于并行冲突或高风险隔离。
- 不为普通改动触发 Actions；当前阶段明确不主动运行 GitHub Actions。
- 不为“完成一批”强制创建 PR；归档不等于合并，提交必须回收到 main。
- 每个批次至少持续完成一个有实质产物的工作单元，不因一次工具调用就停止；发现缺陷应在授权范围内修复并复测。
- 代码、契约、报告、测试证据必须同步；报告不得把历史测试数冒充最新结果。
- 发生产品范围、权限政策、目录结构、持久化格式或用户待决事项变化时，先记录影响并交用户裁决。

## 6. G1–G7 基础能力与跨对话持续工作补充

[基础能力落地映射与跨对话持续工作规格](../../../planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)是本计划的跨批次验收补充，不是新增七个施工批次，也不改变既有批次顺序和 owner。

执行时必须遵循：

1. G1–G7 按映射归入现有模块；施工范围落在对应 owner 目录，不创建万能资源、搜索、配置、Agent 或状态中心。
2. G3 是真实副作用入口的前置门槛。当前非对话入口 `entry_policy_unresolved` 保持阻断；Task/Local/GitHub/外部回调不得用伪造 Conversation ID 或继承对话授权绕过。
3. 第十、十一、十五批共同完成跨对话持续工作：Conversation 保存交互/输入依据，Workflows 保存 Task 检查点，Connections 保存 Operation/外部观察。任何一方不得复制另一方的权威状态。
4. 新 Conversation/模型/Agent 接手时，先读取 Task 当前修订、核对资源版本、查询原 Operation、复核权限和冲突，再决定是否派发；不允许通过重发消息或整任务重跑替代恢复。
5. G4 的连接器能力按实际声明 query/progress/cancel/resume；取消请求不等于停止确认，unknown 不自动重试。
6. G5 内部检索由各 owner 提供获准查询，UI 聚合；外部 Search/Fetch 仍归 `connections/search`。
7. G6 配置归各模块、凭证归 `shared/credentials`、诊断技术入口归 Shared/App；Operation、授权审计、Task/验收证据仍由原 owner 保存。
8. G7 文件选择/拖入/粘贴与附件预览属于 UI 输入体验；真实文件访问经 App/Connections 窄能力，Renderer 不获得任意文件系统权限。

本计划后续每批任务书必须从上述映射提取本批相关条目，并写明本批实现范围、未实现项、真实消费者及组合验收。不能把文档回写、隔离实验或替身测试描述为产品闭环完成。
