# AI 业务契约：Agent配置、角色职责、工作依据与记忆

- Owner：AI（含AI/roles）。拥有Agent/角色配置、职责关联、工作配置快照引用及Agent派生记忆；不拥有Provider协议、Conversation、Task、Operation、权限账本或外部Agent内部运行状态。
- 状态：A为已确认边界；B为候选细化；C为并发/外部实例/来源可信度实验；D10及PRD-D05涉及的共享/保留政策待用户决定。

## 1. A：唯一归属边界

角色、执行主体、模型、连接、Context选择、职责、授权和运行实例是不同对象。Space维护选择关系；AI维护角色/职责配置；connections/api维护Provider调用；connections及外部Agent维护实际调用/实例观察；workflows维护Task与工作轮次；permissions维护许可；conversations维护消息与逻辑生成。角色名称或Prompt不能授予权限。

## 2. AIC-01～AIC-09能力契约

| 锚点 | 对应功能 | 输入 | 输出/事实 | 生命周期与异常 |
|---|---|---|---|---|
| AIC-01 Agent配置 | F02-001/005/006 | Agent身份、名称/说明、提示、模型/连接引用、预期修订 | Agent配置及不可变修订 | 配置不含Key；新配置只影响新工作；旧任务保留原配置版本；并发修订冲突拒绝覆盖 |
| AIC-02 角色与职责 | F02-002/003/004 | 角色定义、执行主体引用、Context/Task等工作范围、预期修订 | 角色配置、职责关联及修订 | 角色可兼任；选择关系归space，职责归AI；秘书/审查等名称不授予写权限 |
| AIC-03 工作配置依据与状态投影 | F02-012 | Agent/角色/职责/模型/连接/来源修订及运行观察引用 | 本次工作不可变配置依据、配置有效性与来源状态投影 | 配置有效、Agent在线、Session可查询、Task完成分别表达；不以最新配置覆写旧依据 |
| AIC-04 运行实例与Session映射 | F02-007/008/009/010 | Agent配置修订、目标Runtime/Connector、外部实例代次、Task/执行关联 | 外部实例/Session定位、能力观察、交接关联和迟到结果来源 | AI不启动或停止外部内部循环；不支持的动作明确拒绝；实例丢失/不可查询保持unknown；替换执行者保留旧映射和回执 |
| AIC-05 Agent记忆对象与版本 | F02-011、F10-011 | 获准来源、Agent/角色范围、内容/摘要、来源版本 | 派生记忆身份、修订及来源引用 | 记忆不是原始来源副本；读写按当前权限；来源不可读时不伪造最新 |
| AIC-06 记忆来源与可信度依据 | F10-012 | 来源owner提供的身份/版本/时间/确认状态 | 来源关联、可信度类别和核验依据 | 用户确认、AI推断、外部资料、待核实观察、过期结论明确区分；模型自述不能补造来源 |
| AIC-07 Agent记忆共享范围 | F10-013 | Agent/角色/Context范围、显式共享设置、目标主体 | 记忆可见范围修订和共享关联 | 共享不等于授权；跨Context读取逐次判权；默认共享范围受PRD-D10 |
| AIC-08 记忆纠错、过期与删除 | F10-015 | 记忆身份/修订、纠错或失效依据、权限 | 新修订、过期或删除观察 | 删除派生记忆不删除来源原件；保留期/永久删除受PRD-D05/D10 |
| AIC-09 用户级偏好与跨项目记忆 | F10-016 | 用户明确选择保存的偏好/沟通约定、来源、可见范围、有效期/撤回意图 | 独立于Agent的用户偏好记忆修订 | 不等同Agent私有记忆或公共策略库；不自动复制到所有Context；只按当前职责和有效范围按需读取 |

## 3. 记忆与数据边界

Conversation短期上下文、Agent派生记忆、用户级偏好、项目基准/工作快照、公共策略与经验库是不同数据类别。F10-014公共策略库尚未确定owner，不得写入AIC-05～09或shared通用表。项目机密不能因角色共享开关写入全局记忆。关闭共享只限制后续受控读取，不声称已删除第三方模型缓存或已外发副本。

## 4. B评审后的稳定不变量

1. 角色选择、职责关联、Task分配和权限授予分开维护。
2. 在途工作固定配置修订；更新配置只影响新工作。
3. 外部Agent实例/Session只是定位与观察，不是WEX身份或权限凭证。
4. 记忆必须保存来源owner和来源版本；模型推断不升级为用户确认事实。
5. Agent记忆共享与用户级偏好分开；任何跨范围读取重新判权。
6. 记忆删除只作用于AI拥有的派生记忆，不删除原始来源。

## 5. 实验与用户决策

并发Agent实例隔离、Session重连/迟到回调、来源冲突合并和可信度自动推断需C实验；共享默认值、公共策略发布、敏感记忆删除/保留需PRD-D05/D10/D13裁决。当前没有Agent Runtime或完整长期记忆产品实现。


## 6. 早期记录与Agent派生记忆边界（PRD-D10，2026-11-01）

前期可保存Agent关联的原始对话记录和操作记录，但它们的权威归属不转移给AI模块：
- 对话/消息记录由conversations拥有；
- 工具调用、外部副作用和操作回执由connections及对应Operation owner拥有；
- AI可以保存Agent与这些记录的关联引用，按当前权限读取；不得复制成第二份权威记录；
- AIC-05所指的AI派生长期记忆、AIC-07共享机制、跨Agent/Context记忆共享暂缓定稿，需后续专项研究；
- 本节不决定记录保留期限、审计保留或外部模型缓存删除能力，分别受PRD-D05和来源/隐私边界约束。


## 7. D01：Agent 工具资格边界（2026-11-01）

AI/roles 负责保存当前 Agent/角色配置中可用的工具能力集合及其配置修订。这是“该 Agent 可以看到/提出哪些工具调用”的资格配置，不是授权账本，也不直接允许执行。

- 工具资格必须由权限判定使用，但 AI 模块不能自行授予全局、Context、资源或动作权限。
- 角色名称、Prompt、模型能力、Task 分配和外部 Agent 自报工具列表均不能代替当前 Agent 的可信工具资格。
- 同一模型被主 AI、秘书 AI 或执行 AI 共用，不合并主体身份、工具资格或对话等级。
- 新配置影响后续工作；在途工作保留当时配置修订，但每次实际操作仍按当前权限修订复核。
- 工具资格配置的新增/移除不等于授权记录的 grant/revoke；两者必须保持不同事实和不同 owner。

详细判定见[ D01–D02 权限矩阵 ](../docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md)。


## 8. 模块独立功能编号与细化契约

本节为 `AI` 模块（含 `AI/roles`）的细粒度功能目录。AIC-01～AIC-09 保留为既有业务契约锚点；新增细分能力使用 `AI-<子域>-NNN`。新编号用于 Agent/角色/资格/配置依据/记忆能力的局部施工，不替换 AIC 锚点，也不改变 F02/F10 全局编号。

**权威边界：** AI 拥有 Agent/角色定义、职责关联、工具资格配置、工作配置快照引用及获准的 Agent 派生记忆。Space 拥有 Context 选择；workflows 拥有 Task/轮次/执行者交接；connections/api 拥有 Provider 协议与真实模型调用；connections 拥有 Runtime/Session 的实际观察和 Operation；permissions 拥有授权决定；conversations 拥有消息与逻辑生成。

| 模块功能编号 | 功能 | 业务行为与边界 | 对应 F | 依赖 | 最低验收条件 | 状态 |
|---|---|---|---|---|---|---|
| AI-AGENT-001 | Agent 定义与生命周期 | 创建、读取、修改、归档独立 Agent 配置；Agent 不要求属于某个 Context，归档不删除历史工作引用。 | F02-001 | shared/storage、space | Agent 可独立存在；改名/归档不改变历史执行身份或外部 Session。 | A |
| AI-AGENT-002 | Agent 配置修订 | 对提示、模型引用、职责偏好和可选配置建立修订；新工作绑定明确修订，在途工作不被静默改写。 | F02-006 | shared/storage、permissions | 并发编辑按预期修订冲突；旧工作仍能读取当时配置依据。 | A/B |
| AI-ROLE-001 | 角色定义与生命周期 | 定义主 AI、秘书、研究、执行、审查、验证等可扩展角色；角色名称和描述不直接授予权限。 | F02-002 | permissions | 重命名角色不改变工具资格、对话等级或资源授权。 | A |
| AI-RESPONSIBILITY-001 | Agent 与角色职责关联 | 允许一个 Agent 承担多个角色、多个 Agent 采用同一角色模板；职责关联由 AI 管理，不合并不同主体身份。 | F02-003 | space、permissions | 兼任职责可独立撤回；角色配置变化不改写历史工作责任记录。 | A |
| AI-SCOPE-001 | 职责范围绑定 | 把角色/职责关联到明确 Context、Task 或工作范围；Space 维护 Context 选择，workflows 维护 Task 分配，AI 不建立第二份成员表。 | F02-004 | space、workflows、permissions | 选择角色不自动创建 Task、不派发、不扩权；范围变化有独立修订。 | A |
| AI-MODEL-001 | 模型与连接引用 | Agent 配置引用 connections/api 提供的 Provider、模型和连接；只保存引用与兼容要求，不保存 Key/Token。 | F02-005 | connections/api、shared/credentials | 替换模型连接不改写历史调用、执行身份或资源授权；失效引用明确报告。 | A/B |
| AI-PROMPT-001 | 提示与行为配置 | 保存 Agent/角色提示、约束、输出偏好和模板引用的修订；提示是行为配置，不是权限或可信身份。 | F02-006 | shared/storage、permissions | 提示更新只影响新工作快照；提示文本不能覆盖权限拒绝或工作范围。 | A/B |
| AI-WORK-SNAPSHOT-001 | 本次工作配置快照 | 为工作绑定 Agent、角色、职责、模型/连接引用、提示和来源修订的不可变快照；运行事实由 workflows/connections 维护。 | F02-006、F02-012 | shared、workflows、connections | 切换最新配置不改变旧轮次；快照可证明工作当时使用的配置依据。 | B |
| AI-TOOL-ELIGIBILITY-001 | Agent/角色工具资格配置 | 保存 Agent/角色可提出或使用哪些工具能力的资格集合及修订；资格不是授权，实际动作仍由 permissions 按主体/入口/资源判权。 | F02-002、F02-003；D01 | connections、permissions、space | 模型/Prompt/角色名称不能自行增加资格；资格变化不自动授予资源访问或副作用许可。 | A |
| AI-RUNTIME-001 | 运行实例绑定与观察引用 | 将 Agent 配置绑定到受支持的内部/外部 Runtime 实例，并引用 connections 提供的就绪/在线观察；不拥有 Runtime 进程生命周期。 | F02-007 | connections、app | 不支持的启动/暂停/释放动作明确报告；配置存在不代表 Runtime 已运行。 | B/C |
| AI-SESSION-001 | 外部 Session 映射 | 保存 WEX 工作/轮次与外部 Agent Session、Turn、实例代次的映射和定位线索；Session ID 不是主体身份或授权票据。 | F02-008 | connections、workflows | Session 丢失、代次不符或不可查询时保留 unknown；旧 Session 迟到结果不能写入新代次。 | A/B |
| AI-EXTERNAL-001 | 外部 Agent 类型与接入配置 | 为 DSH/Hermes 等独立客户端保存可选执行目标、连接引用和能力要求；实际协议、提交、观察、取消和恢复由 connections 对应适配器拥有。 | F02-009 | connections、workflows | 不支持的外部能力不在 AI 配置中伪装；外部 Agent 内部循环和权限不搬入 WEX。 | A |
| AI-HANDOVER-001 | 执行者替换与交接引用 | 为执行者替换提供新旧 Agent/角色/配置修订引用；Task 轮次、责任代次、旧执行状态和最终交接记录由 workflows 拥有。 | F02-010 | workflows、connections、permissions | 更换 Agent 不删除旧结果、不覆盖旧 Operation、不重复执行未知副作用。 | A/B |
| AI-STATUS-001 | Agent 配置与运行状态投影 | 区分配置有效、资格有效、Runtime 在线、Session 可查询和 Task 状态；AI 只聚合自身配置与获准外部观察。 | F02-012 | connections、workflows、permissions | Agent 离线不自动将 Task 标记失败；Task 完成不证明 Agent 仍在线。 | A |
| AI-MEMORY-001 | Agent 派生记忆对象 | 仅在后续获准范围内建立 Agent 派生记忆对象、修订和来源引用；前期优先保存源 owner 的原始对话/操作记录，不复制第二份权威。 | F10-011 | conversations、connections、shared、permissions | 记忆不能脱离来源与版本；D10 未批准前不把派生长期记忆作为前期必备功能。 | B/D |
| AI-MEMORY-SOURCE-001 | 记忆来源与可信度依据 | 区分用户确认、AI 推断、外部资料、待核实观察和过期结论；来源身份/版本由 source owner 提供。 | F10-012 | conversations、connections、space、permissions | 模型自述不能补造用户确认；来源不可读时不伪造最新或可信。 | A/B |
| AI-MEMORY-SHARING-001 | Agent 记忆共享范围 | 配置 Agent 私有、角色共享、Context 共享等范围候选；共享开关只表达可见范围意图，不等于权限授权。 | F02-011、F10-013 | permissions、space | D10 未批准前不启用派生记忆共享；关闭共享阻止后续读取但不谎称删除外部副本。 | B/D |
| AI-MEMORY-CORRECTION-001 | 记忆纠错、过期与删除 | 在政策获准后支持派生记忆查看、纠正、标记过期和删除；只作用于 AI 拥有的派生记录。 | F10-015 | permissions、shared | 删除派生记忆不删除原始对话/Operation；保留期限和永久删除范围须遵循 D05/D10 决策。 | B/D |
| AI-PREFERENCE-001 | 用户级偏好与跨项目记忆 | 独立于 Agent 私有记忆保存用户明确选择的偏好/沟通约定及其范围；不得自动复制到所有 Context。 | F10-016 | permissions、shared、conversations | 只按当前职责和有效范围按需读取；项目机密不写入通用用户偏好。 | B/D |

### 8.1 记忆前期范围与待决边界

- 前期可保存 Agent 关联的原始对话记录和 Operation 记录引用；对话正文仍归 conversations，Operation/回执仍归 connections。
- AI 可按当前权限读取来源并保存必要关联；不得复制为第二份权威记录。
- AI 派生长期记忆、角色/Context 共享、用户级跨项目记忆仍受 PRD-D10 与 D05 约束，不因本节编号建立而自动批准。
- F10-014 公共策略与经验库尚无已批准 owner，不分配 AI 编号，也不塞入 AI 派生记忆或 shared 通用表。

### 8.2 编号映射与维护

- F02-001～012 由本节 Agent、角色、职责、资格、模型引用、配置修订、Runtime/Session、外部接入与状态编号细化。
- F10-011/012/013/015/016 分别映射 Agent 记忆、来源可信度、共享范围、纠错过期删除和用户级偏好编号。
- F10-014 保持无 owner 的远期候选；不得以 AI 或 shared 先行代管。
- AIC-01～09 是原有契约锚点；AI-* 是细粒度施工编号，不重排 AIC 或 F01–F15。
- A/B/C/D 状态沿用产品总表与既有决策；本节不把记忆共享、长期记忆和用户级跨项目记忆从 D 自动升级为 A。



## 文档关联与施工入口

- **模块导航**：[AI README](README.md) · [角色子域](roles/README.md) · [全模块契约索引](../docs/MODULE-CONTRACTS.md) · [文档总索引](../docs/README.md)
- **产品需求**：[F01–F15 产品功能总表](../docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) · [功能—模块契约映射](../docs/product/FUNCTION-CONTRACT-MAP-2026-11-01.md)
- **跨模块依据**：[D01–D02 权限判定矩阵](../docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md) · [connections 契约](../connections/CONTRACT.md) · [workflows 契约](../workflows/CONTRACT.md) · [Space 契约](../space/CONTRACT.md)
- **记忆政策**：PRD-D05/D10/D13 及本文件第 6～8 节；未决共享/保留政策不得按实现方便自行默认。

维护规则：Agent/角色/资格配置写回本契约；Task/轮次事实转交 workflows；Provider/Session/Operation 事实转交 connections；消息原文转交 conversations；任何授权决定转交 permissions。
