> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# WEX｜G1–G7 基础能力落地映射与跨对话持续工作规格

日期：2026-10-31  
代码基线：`owla19s-ux/WEXPCeasy@6e0fb4561ef9481b9c9615820eecf64c54c039a0`（仓库标识；产品名称为 WEX）  
性质：基础能力审查后的模块落地规格与跨模块验收依据。它补充现有模块契约和施工计划，不冻结 TypeScript 签名、IPC、数据库 schema、文件格式或插件协议，不代表产品代码已经实现。

## 1. 目标与约束

本规格回答两件事：G1–G7 分别由哪些现有模块承担；如何把这些基础动作组合成不依赖某次对话、某个模型或某个 Agent 实例的持续工作能力。

遵循以下边界：

1. 不增加一级模块，不建设万能 Resource Center、全局配置中心、统一业务数据库、通用事件总线或完整 Agent Runtime。
2. 每个领域继续拥有自己的业务事实；共享技术能力不成为第二份业务权威。
3. Space/Context 是持久工作资料与组合关系入口，不等于项目专用目录，也不授予权限。
4. Conversation 是交互和逻辑生成历史；Task 是持续工作的状态与检查点；Operation 是一次真实外部调用及其观察。三者不能合并。
5. 外部资源、模型、Agent 和进程的状态必须由对应连接器核对；超时、断连、进程退出和 not found 不自动证明未执行。
6. 持续接续不等于应用关闭期间后台持续运行，也不承诺 exactly-once。

## 2. 当前实现状态（以本次基线源码为准）

| 基础能力 | 当前状态 | 说明 |
|---|---|---|
| G1 资源引用与附件 | 已设计，产品业务实现未开始 | Space/Conversation/Workflows 有契约；Local 尚无产品实现；缺少端到端资源引用与附件闭环 |
| G2 原生 API 工具往返 | 已设计，产品实现未开始 | API 与 Conversation 有职责描述；尚无产品级真实模型调用和受控工具往返 |
| G3 非对话权限入口 | 部分实现，存在明确阻断 | Permissions 已实现对话范围判定；非对话入口仍返回 `entry_policy_unresolved` |
| G4 调用状态、进度与恢复 | 已设计，产品闭环未实现 | Connections 有 Operation 契约；Workflow Runtime 尚无产品实现 |
| G5 内部检索 | 边界已识别，产品能力未实现 | 各领域尚无统一可用查询闭环；外部 Search/Fetch 不等于内部检索 |
| G6 配置、凭证、日志 | 窄基础已实现，其余缺失 | Shared 有 SQLite/路径/诊断 sink；没有完整凭证后端、持久化日志平台或全模块配置闭环 |
| G7 输入与附件体验 | 已设计，产品 UI 未实现 | Electron/React 只有隔离实验；没有正式对话输入、文件选择/拖入/粘贴和附件预览 |

本仓库当前只有 `shared`、`permissions`、`app` 具备基础产品源码。Space、Conversations、AI、Connections、Workflows、UI 等目录目前以 README/CONTRACT 为施工规格；本批只把职责和验收要求写入正确 owner，不创建空壳 `src/` 目录或伪造实现状态。

## 3. G1–G7 责任矩阵

| 能力 | 唯一业务 owner / 实际执行方 | 消费方与 UI | 基础行为与边界 |
|---|---|---|---|
| G1 资源引用/附件 | Space 管 Context 组合引用；Connections/Local 解析和访问本地资源；Workflows 管 Task 输入/Artifact 引用；Conversations 管消息输入来源 | UI/Space、UI/Conversation | 区分外部关联、WEX 持久资料、会话临时附件、工作产物；引用不复制、不授权；版本/定位必须可核验 |
| G2 API 工具往返 | Conversations 管逻辑生成与循环；Connections/API 管 Provider 协议；Connections 宿主边界管 Operation/真实派发 | UI/Conversation；Permissions 提供当前判定 | 普通内容或工具意图 → 权限判定 → 受控派发 → 工具结果回注 → 继续生成/定稿；普通对话不强制 Task |
| G3 权限入口 | Permissions | App 注入可信主体/入口；Conversation、Workflow、Connections 为消费者 | Conversation、用户直接操作、Task 派发、外部回调各自绑定真实入口；不伪造 conversationId、不继承旧许可 |
| G4 进度/结果/取消 | Connections 拥有 Operation/attempt/观察；Workflows 拥有 Task 业务状态与恢复决定 | UI 呈现，App 协调生命周期 | 声明连接器实际支持的 query/progress/cancel/resume；区分请求停止与确认停止；unknown 不盲重试 |
| G5 内部检索 | 各业务 owner 提供自己的获准查询 | UI 聚合搜索与导航；Connections/Search 仅负责外部互联网 Search/Fetch | 结果保留来源与修订；打开时重查和判权；不建设跨域第二份内容索引 |
| G6 配置/凭证/日志 | 配置归各模块；秘密归 Shared/Credentials；运行日志/诊断由 App 装配技术入口；Operation/授权审计/Task 证据仍归原 owner | UI/Settings 展示模块面板与获准诊断 | 不建立全局配置中心；凭证引用不等于授权；诊断 sink 不等于持久日志平台 |
| G7 输入/附件交互 | Conversations 管输入和消息来源；Space 管 Context 关联；Connections/Local 执行获准资源访问 | UI/Conversation、UI/Space、App 窄文件选择能力 | 文本、文件选择/拖入/粘贴、预览/移除、来源提示；Renderer 不直接获得任意文件系统权限 |

### 3.1 资源与附件的四种语义

| 类型 | 含义 | 权威/保存位置 |
|---|---|---|
| 外部关联 | 原文件、目录、仓库或远端对象仍在原处 | 来源 owner/连接器；Context/Task/Conversation 只持引用和来源观察 |
| WEX 持久资料 | 用户明确导入并保存到用户选择的数据根的资料 | 由实际资源 owner 管理字节和身份；Space 只管理关联；导入必须显式 |
| 会话临时附件 | 只供一次输入/生成使用的附件 | Conversations 保存输入来源/版本依据；不自动进入 Context 长期资料 |
| 工作产物 | 某个 Task/轮次生成或修改的文件、报告、数据 | Workflows 管 Artifact/Verification 事实；实际字节由相应资源 owner 管理 |

文件路径不是永久身份；文件名相同不等于同一资源；引用不代表读取、修改、复制或外发许可。是否导入、是否仅关联由用户明确选择。底层复制/导入协议、稳定身份和迁移方式在对应实现契约中再确定。

## 4. 跨对话、跨模型、跨 Agent 持续工作

### 4.1 持久事实分工

| 内容 | 保存 owner | 不应存在哪里 |
|---|---|---|
| 长期资料、Context 组合和资源引用 | Space + 被引用资源 owner | 某一轮对话摘要或 Agent 私有记忆 |
| 工作目标、范围、验收条件、进度和检查点 | Workflows | Conversations 消息、UI 临时状态、Shared 通用快照 |
| 输入消息、生成历史、段落版本和来源快照 | Conversations | Task 的重复副本 |
| 实际派发、attempt、外部观察、停止结果和 Operation unknown | Connections | Task 状态机或日志文本 |
| 角色配置、职责和配置修订 | AI/roles | Operation/Task 或权限账本 |
| 当前授权、审批、撤销和依据 | Permissions | Context、角色配置或连接器缓存 |
| 技术提交、路径、凭证保管与诊断机制 | Shared/App | 各领域私有业务状态的集中副本 |

### 4.2 Task 检查点最小内容

Task 检查点必须让新对话/新执行者能判断“下一步是否安全”，而不是只生成一段自然语言总结。语义上至少包含：

- 目标、工作范围、验收条件及各自修订；
- 当前阶段/工作轮次、已完成项、未完成项和阻塞；
- 输入资源引用、来源 owner、使用时版本/观察；
- 关联 Operation 引用及最后可知状态（不复制 Operation 账本）；
- Artifact、Review、Verification 和适用的 Acceptance 依据；
- 当前责任主体、采用的角色/配置修订和交接事实；
- 下一步建议动作、前置条件及需要用户裁决的事项。

不保存 API Key、可重放授权 token、模型隐藏上下文或“Agent 一定仍在运行”的推断。检查点字段和格式尚不冻结。

### 4.3 新会话恢复流程

1. 打开原 Context/Task，读取其最新已提交修订；读取失败不能显示为空白新项目。
2. 核对 Task 输入引用及真实资源当前版本/可用性。
3. 通过原 Operation ID/关联查询外部尝试、Agent Session、进程或远端对象；not found/timeout 不自动等于未执行。
4. 检查既有产物、人工修改和 Verification 是否仍适用于当前输入/规则版本。
5. 重新核对当前 permissions、资源冲突和执行配置；旧批准、旧模型或旧 Agent 身份不自动延续。
6. 根据证据选择继续观察、继续无副作用工作、请求人工裁决，或明确创建新轮次。
7. 只有在原副作用已核清、资源和授权条件重新满足后，才允许新的派发。

恢复核对不能通过“重新发送上一条消息”“重新运行整个 Task”或“清空 unknown”替代。

### 4.4 强制组合验收样例

| 样例 | 必须证明 |
|---|---|
| 上下文耗尽后新建 Conversation | 能从 Context/Task/Operation/资源版本恢复工作事实，不依赖旧模型上下文 |
| 更换 Provider 或 Agent | 旧输入、责任轮次和 Operation 归属不被改写；新执行身份重新判权 |
| 外部副作用已发生但回执未保存 | 新会话查询原 Operation/资源事实，不创建第二次派发 |
| 文件在两次对话间被人工修改 | 旧 Artifact/Verification 不冒充适用于新版本；需要重核验 |
| 任务入口权限已撤销 | 新会话不能使用历史 allow 或旧缓存继续外发/写入 |
| 同一 Context 被多个 Space 引用 | 关系共享不合并授权；一个入口无权不影响另一个入口依法判定 |
| 外部盘失联后重新接回 | 保留原引用和未决状态；核对身份/版本后再继续，不创建空 Context |
| 普通聊天无 Context/Task | 仍可独立发消息、保存历史和使用获准工具，不强制建立工作流 |
| 应用退出/系统关机 | 不宣称后台仍执行；重启后先核对未知操作，不能盲重派 |

## 5. 对应模块目录与施工落点

| 目录 | 本次需要落实的内容 | 代码状态/施工位置 |
|---|---|---|
| `space/` | Context 资源引用、持久资料关联、获准查询 | 当前先维护 CONTRACT/README；后续按第九批建立本域实现与测试 |
| `conversations/` | 普通对话、工具往返、输入/附件来源快照、会话查询 | 当前先维护 CONTRACT/README；后续第十批产品实现 |
| `AI/roles/` | 角色/模型连接配置、职责修订与运行身份分离 | 当前先维护目录说明；不建立长期记忆服务 |
| `permissions/` | 非对话入口策略、可信事实与执行前复核 | 已有产品代码；非对话仍阻断，先补契约与策略/消费者测试 |
| `connections/api/` | Provider/Model 配置、请求/流式、工具意图适配 | 当前只有 README；后续第十二批 |
| `connections/local/` | 文件/目录读取、资源身份/版本观察、明确导入/写入动作 | 当前只有 README；后续第十三批 |
| `connections/search/` | 外部 Search/Fetch | 当前只有 README；不承接内部检索 |
| `connections/` | Operation/attempt、结果/unknown、查询与取消能力声明 | 当前契约和隔离实验；后续真实产品连接闭环 |
| `workflows/`、`workflows/runtime/` | Task 检查点、Operation 引用、恢复/冲突/验收 | 当前只有契约/目录说明；第十一批定义与证据，第十五批运行时 |
| `shared/storage/`、`shared/credentials/` | 技术提交/回读、平台凭证保管 | Storage 已有窄实现；Credentials 未实现 |
| `shared/src/diagnostics.ts`、`app/` | 诊断/日志技术入口、生命周期接线 | 现有 diagnostics 只是受限 sink；持久日志/导出和正式宿主待做 |
| `UI/conversation/`、`UI/space/`、`UI/settings/` | 输入附件、Context 资料操作、设置/诊断入口 | 当前只有目录说明；第十七批真实 UI |
| `views/` | 只呈现各 owner 的获准投影和来源修订 | 维持投影层，不拥有检索/任务/操作真相 |

不要因为目录存在就创建空的 `src/`、全局接口或新子系统。真正开始模块施工时，再按本域公开契约和测试入口建立源码。

## 6. 与现有批次的关系

G1–G7 是跨批次基础能力验收项，不是新的七个施工批次：

- **第九批**：Space/AI Roles/Views：G1 的 Context 关联与资料定位、G6 的角色配置修订。
- **第十批**：Conversations：G2 逻辑生成与工具往返的对话侧、G7 输入/附件来源快照、G5 会话查询。
- **第十一批**：Workflows 定义/Task/Artifact/Verification：G1 Task 引用、跨对话检查点数据语义、G5 Task 查询。
- **第十二批**：API：G2 Provider 请求、流式和工具意图协议；配置与凭证引用。
- **第十三批**：Local：G1 资源解析/文件访问、G7 文件选择背后的受控资源能力、G4 真实进程/文件结果观察。
- **第十四批**：GitHub：G1 远端仓库/对象引用和版本观察，G4 远端操作回执。
- **第十五批**：Workflow Runtime：G4 Operation 关联、资源冲突、恢复核对、Task 检查点读取/推进。
- **第十七批**：UI：G5 跨域检索聚合、G7 输入/附件/资料交互、Task 接续入口。
- **第十八批**：Windows 产品化：G6 系统凭证、持久日志/诊断、备份恢复和重装接回的实机验收。

**G3 是跨批次前置门槛**：任何真实 Task 派发、Local/GitHub 副作用或外部回调上线前，必须有对应可信入口策略、消费者测试和执行前复核；当前 `entry_policy_unresolved` 不能被跳过。真实连接器不得先于该门槛开放写操作。

## 7. 不纳入本轮的范围

不因 G1–G7 自动批准：完整 Agent Loop/长期记忆、公共策略库、知识图谱、向量数据库、万能资源管理器、通用事件总线、后台常驻、自动定时执行、云同步、账号体系、市场、复杂富文本/语音输入、全局配置中心或通用插件平台。相关长期研究仍按既有决策管理。

## 8. 维护与验收规则

- 模块行为变化先更新对应 owner 的 CONTRACT，再更新该模块 README/子目录入口；本文件只维护跨域映射和组合验收。
- 每项能力实现时至少包含本域正例、拒绝/失败/unknown、并发或修订冲突样例，以及真实消费者对照；不得只用永远成功的替身。
- 报告必须区分源码存在、单元测试、真实适配器、跨模块组合和 Windows E4 证据。
- 不主动触发 GitHub Actions；本规格提交本身不构成代码实现或验收通过。
