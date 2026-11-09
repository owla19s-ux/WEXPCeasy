# AI｜角色、岗位等设定的行为与现有接口契约

> 2026-11-08 只读复核：`main@4ec86a84f83aad2e6b6ef46a1fc0db103fc015a1`。本契约承接已确认的产品**行为与归属边界**；明确标注真实已实现接口、确定的实施原则与未决假设。未执行本轮测试，不得将建议结构当作已运行 API。
>
> 入口：[README](README.md)；历史研究（按需）：[A0 原契约归档](../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/AI/CONTRACT-archive.md)。历史候选不自动升级为施工指令。

## 1. 产品设定与既有接口的区分

> **2026-11-09 用户纠偏（本节产品定位优先）**：Role（角色）和 Position（岗位）是不同类型的**设定**，API/Model 为独立配置，允许按使用场景选择与组合。**Agent 不列为本模块与 Role/Position 并列、必须创建的产品设定类别，也不是对话的已批准强制前置条件**。下文历史 AIC/F02 中的 Agent 目标、旧 `agent` 类型和方法仅作为既存研究/实现事实保留；涉及独立 Agent 产品生命周期的条款不因旧名称而获得新施工授权。实际源码仍有该类型，不在本次文档修改中删除数据或改接口。

## 1. 术语、权威和不变量（已确认产品边界）

- Role 是角色行为、表达和提示等设定；Position 是岗位及工作职责、定位等设定；两者均为独立可复用配置。API/Model 的 Provider 与真实调用归 `connections/api`。旧 `agent` 是当前源码仍持有的组合记录类型，不等于已确认的第三种必须配置的产品设定。
- 角色、岗位、模型连接、Context 选择、工作职责、执行身份均需分离。不同设定可按实际需要选取和组合，**不要求先创建旧 `agent` 并同时绑定 Role、Position、Model 才允许对话**；当前源码的此类必填限制只是需复核的实现偏差。
- **AI owner**：配置、角色、职责关联/资格及修订、工作配置依据与获准的 AI 派生数据。
- **Space**：Context 的配置选择与组织关系；**workflows**：Task、派发、轮次、交接及检查点；**connections/api**：Provider 协议、模型目录与调用；**connections**：Operation/回执与外部 Runtime/Session 的实际观察；**conversations**：对话历史、生成和普通对话；**permissions**：权限与撤权；**app**：可信宿主/IPC。
- Role 名称、Prompt、工具资格、模型能力、Context 选择和外部 Agent 自述均**不授予实际执行权限**。不同 Agent 即使共用模型，也不合并身份、会话或许可。
- 新工作采用确定的配置修订；在途尝试不被最新配置静默改写。配置有效、Runtime 在线、Session 可查询和 Task 状态必须分别表达。

## 2. 当前真实接口（已验证为源码存在；测试结果未在本次重新确认）

`AI/src/index.ts` 导出：

- `ModelReference = {connectionId:string, modelId:string}`
- `Configuration`：
  - `{kind:'role', name:string, prompt:string}`
  - `{kind:'position', name:string, responsibility:string}`
  - `{kind:'agent', name:string, roleId:string, positionId:string, model:ModelReference}`
- `Entry = Configuration & {id:string,revision:number}`
- `createAiConfigurations(store, authorize, verifyModel?)` 返回 `list(request,kind)`、`read(request,kind,id)`、`save(request,{id,intent,expectedRevision,value})`。
- `inspectAiConfigurationStore(store)` 返回 `{status:'ready'|'unavailable'}`，不泄露配置内容。
- `verifyModelWithApi(api,bindModelRead)` 从 API 的受控 model.read 校验模型记录的 id 与 connectionId。

`list` 要求列表范围授权，并对每条返回配置重新检查读授权；`read` 再次检查读取许可；`save` 做修订/intent 校验、Role/Position 引用存在性与读取许可、API model 引用核对和写授权复核。返回可能有 `committed`、`denied`、`invalid`、`reference_unavailable`、`revision_conflict`、`intent_conflict`、`unknown`、`unavailable` 等状态，不能把未知写入当成功。

当前旧 `agent` 配置要求 roleId、positionId、连接及 modelId；桌面入口兼容 `agentId`，并接受独立显式 `selection:{roleId?,positionId?,connectionId,modelId}`（至少一个设定）。发送消费 Role.prompt 与 Position.responsibility，组合超出生成上限时在追加历史前拒绝；确认后重核设定和模型修订。AI 配置存储格式不变。

## 3. 历史功能锚点及分期（不因旧 Agent 名称形成新产品类别）

> AIC-01/03/04/05～08、F02 中沿用的 Agent 标记反映历史研究/代码入口；**不在本契约把 Agent 作为第三类设定或独立产品入口新增施工**。Role/Position/模型引用应首先按不同设定审查，历史关于独立 Agent 生命周期/多 Agent 运行的候选项目待后续另行确认。

| AIC 锚点 | 功能与对应编号 | 行为边界及施工判定 |
| --- | --- | --- |
| AIC-01 | Agent 配置：F02-001/005/006；AI-AGENT-001/002、AI-MODEL-001、AI-PROMPT-001 | Agent 可独立定义/修订/归档；保留修订与引用。Model/Connection 只存引用，不含 Key。归档不得改写旧工作；具体迁移接口需实验确定 |
| AIC-02 | 角色/职责：F02-002/003/004；AI-ROLE-001、AI-RESPONSIBILITY-001、AI-SCOPE-001、AI-TOOL-ELIGIBILITY-001 | Role/Position/职责分离，支持兼任与工作范围，资格只约束可见/可提出能力，不授予执行许可；Context 选择不在 AI 中重复维护 |
| AIC-03 | 工作配置依据/状态：F02-006/012；AI-WORK-SNAPSHOT-001、AI-STATUS-001 | 本次工作须可追溯 Agent、职责、模型/连接与配置来源修订；配置状态与真实运行/Task 状态分离，快照结构和跨 owner 读取待验证 |
| AIC-04 | 实例与 Session：F02-007～010；AI-RUNTIME-001、AI-SESSION-001、AI-EXTERNAL-001、AI-HANDOVER-001 | AI 维护必要引用/定位，不运行外部 Agent 内部循环；外部接入、派发交接及代次协议按后续版本和独立实验推进 |
| AIC-05 | Agent 派生记忆：F02-011/F10-011；AI-MEMORY-001 | 非 0.1.1 实现项；来源事实由原 owner 持有，派生存储暂不冻结 |
| AIC-06 | 来源可信度：F10-012；AI-MEMORY-SOURCE-001 | 用户确认、AI 推断、外部资料和待核实来源不能混为同类；后续研究 |
| AIC-07 | 记忆共享：F10-013；AI-MEMORY-SHARING-001 | 共享意图不等于读取授权；D10 政策未决，不默认启用 |
| AIC-08 | 纠错/过期/删除：F10-015；AI-MEMORY-CORRECTION-001 | 只处理 AI 派生数据，不删除 conversations 或 Operation 原始记录；受 D05/D10 约束 |
| AIC-09 | 用户级偏好：F10-016；AI-PREFERENCE-001 | 用户偏好与 Agent 私有记忆、公共策略库不同；跨项目共享后续研究，不自动复制 |

F10-014 公共策略/经验库目前 owner 未定，不通过此契约擅自交给 AI。

## 4. 配置、引用、状态与生命周期

1. **配置创建和编辑**：调用方提供可信主体请求、目标配置 id、intent、expectedRevision 和配置值；返回明确提交、冲突、拒绝或未知状态。模型引用需经 connections/api 的授权读取核对。
2. **读取和列举**：必须依赖当前授权，列表授权不代替每条记录读授权；读取拒绝不能通过错误或统计泄露隐藏项。
3. **修订/重放**：同一 intent 的命令相同可以返回既有提交回执，不同命令返回 intent 冲突。存储状态损坏、版本未知或回执不一致时拒绝伪恢复，不覆盖受损数据。
4. **关系变化**：Role、Position、模型被 Agent 引用时不能简单无检查级联删除；停用、归档、解除关联及失效投影的状态机尚待实验确定。**不得直接施工未定义的删除策略。**
5. **组合与兼任**：目标支持一个 Agent 对多个职责/工作范围的独立关联；具体 Association 结构、写入 owner 和旧数据迁移须先对照 Space 的唯一关联来源，避免复制成员关系。
6. **工作时快照**：角色提示/模型/职责更新只影响新工作；已开始轮次的原始配置依据需要可追溯，实际授权仍按操作时当前权限重新核对。
7. **Runtime/Session**：Agent 配置存在不代表外部实例在线；失联、不可查询、代次变化与迟到结果要保留不确定状态，AI 不冒充真实执行账本。
8. **记忆**：AI 可引用获准的原始对话和 Operation 记录，但消息及操作记录归来源 owner；不创建第二份权威记录或未经确认的共享平台。

## 5. 直接依赖与消费接口

- **App/UI**：`app/src/desktop-ai.ts` 已提供 snapshot/save 桌面受信入口；`UI/src/ai-settings.tsx` 当前可管理基础配置。新管理操作如需 UI，沿用现有桥，不绕过宿主权限。
- **Conversations**：`app/src/desktop-conversations.ts` 通过独立 selection 或兼容 agentId 读取当前设定与模型配置；Context 消费前验证关联可见性，不复制设定、模型或会话。
- **Space**：存储 Context 对 Role、Position、旧 Agent 及 Conversation 的引用；AI 提供 Role/职责定义及必要公开查询，不能重复保存 Context 权威成员表。
- **Permissions**：授予/撤销权限属于 permissions；AI 只持有配置与资格事实，不建立新的 Grant/Operation。
- **Connections/API**：模型目录和真实调用归 connections/api，AI 不实现 Provider 协议，也不持有 Key、网络请求或模型计费记录。
- **Workflows**：今后基于 AI 配置引用进行工作分配，任务结果和回执归工作流/连接系统。

## 6. 实现调整建议（已形成方向，非冻结接口）

按职责独立性，考虑将现有 `src/index.ts` 中的类型校验、持久化、服务操作、模型引用验证分别整理为 `configuration.ts`、`storage.ts`、`service.ts`、`model-reference.ts`。保持 `index.ts` 导出兼容与现有稳定测试。文件名称是建议，是否拆分由实际依赖/测试验证决定，不为目录数量而拆。

功能顺序：补齐基础操作与引用生命周期证据 → 研究多职责和关联唯一写入口 → 建立兼容层并验证旧数据 → 迁移现有 App/UI 消费者 → 回归通过后删除冗余逻辑。旧 SQLite `version:1` 持久状态不能在无迁移和恢复测试时直接替换。

## 7. 验收矩阵（待执行）

| 场景 | 必须证明 |
| --- | --- |
| 配置 CRUD/生命周期 | 创建、读、改、列表、归档或停用按已批准语义工作；被引用对象不得悬挂或无提示删除 |
| 引用 | Agent 引用不存在/不可读 Role、Position、Model 被拒绝；多连接选择不混淆 |
| 修订/重复提交 | stale revision、同 intent 重放/冲突、并发写入与未知结果恢复 |
| 权限 | 无列表/单条读权限不泄露内容；撤权后禁止新读取/写入；角色名及工具资格不能授权 |
| 持久化 | SQLite 关闭重开结果一致；损坏/未知版本不自动重建、不覆盖 |
| 跨模块 | Context 选择、AI 配置、API 模型、Conversations 的真实公开入口按权限工作 |
| 在途工作 | 修改角色或模型不静默漂移已有轮次/回执；模型失效有明确结果 |
| UI/Windows | 设置界面与模型选择、撤权清空、错误反馈与重启恢复实测 |
| 长期边界 | 未批准的记忆共享、外部自动派发、运行引擎不被基础配置测试假装完成 |

先核对全局 `npm run build`、`npm run typecheck`、`npm test`、`npm run check:boundaries` 及 AI 定向用例。验证必须记录同 SHA、实际命令、日志、测试环境、模拟/真实服务区别；Windows 和 Provider 不以替身结果签收。GitHub Actions 先查运行集合及相应 SHA，不重复触发无意义 CI。

## 8. 待实验与未决（不擅自冻结）

- 多 Role/Position/职责关联的最小数据结构、兼容迁移、缺省绑定以及同一 Agent 在多个 Context 的有效配置解析。
- 归档/停用/解除关联与被引用对象的失效、软删除/硬删除和历史保留语义。
- 模型目录中同名、相同 Provider modelId 但不同记录/连接的选择身份。
- 运行实例代次、Session 不可用/重连、外部能力映射、在途交接来源。
- 记忆对象、来源可信度、共享 D10、删除保留 D05 及 F10-014 owner。

任何未决问题只暂停其受影响行为，其余已明确的模块基础完善可继续施工。对外报告应明确区分**已确认产品要求 / 已核实源码事实 / 实施建议 / 待实验假设 / 当前 SHA 测试证据**，不得将设计承诺写成已实现。
