# conversations 业务契约：独立对话、消息与逻辑生成

- Owner：conversations。维护Conversation、消息、序列项、逻辑生成、背景快照和来源引用。
- 不拥有Provider协议/Operation（connections）、Task（workflows）、权限（permissions）、Agent配置/记忆（AI）或UI呈现。
- 状态：A为既定边界；B为候选业务细化；流式、取消、提交竞态为C；片段保留政策受PRD-D05。

## 1. A：基础约束

普通会话可以没有Space、Context、Workflow或Task。选择Context作为本轮背景由conversations保存；Context中显示会话引用是space的另一种关系。模型工具调用必须经过permissions与connections受控边界。重发旧消息不重放旧Operation；切换背景不改写已派发输入快照；UI只呈现和提交用户意图。

## 2. CV-01～CV-16能力契约

| 锚点 | F映射 | 输入→权威输出 | 生命周期/异常 |
|---|---|---|---|
| CV-01 会话生命周期 | F03-001 | 会话身份、可信主体/入口、操作意图→会话身份/修订和获准历史投影 | Context/Task可空；创建去重；归档/删除不级联删除来源资料 |
| CV-02 消息与轮次持久化 | F03-002 | 会话修订、消息输入、逻辑轮次关联→消息版本和保存证据 | 区分未提交/已提交/提交未知；unknown按原关联回读 |
| CV-03 稳定序列项 | F03-003 | 定稿消息版本/拆分内容→稳定序列项身份、顺序和所属版本 | 身份不由渲染顺序生成；排序不改身份 |
| CV-04 局部选择与引用 | F03-004 | 序列项/消息版本、选择范围、引用目的→绑定来源版本的引用 | 引用不等于采纳、授权或执行；源修订变化时保留旧版或标记失效 |
| CV-05 分支讨论 | F03-005 | 源消息/序列项版本、分支意图→独立分支身份和回链 | 分支不覆盖主线；合并/采纳显式提交 |
| CV-06 历史消息修改与重发 | F03-006 | 原消息修订、修改内容、重发意图→新消息版本/新逻辑生成及来源关系 | 不复用旧工具授权，不重复旧Operation；并发冲突拒绝覆盖 |
| CV-07 生成期间追加与排队 | F03-007 | 追加内容、目标会话和当前生成关联→队列项/后续输入版本 | 已派发输入快照不可变；取消只移除未派发项 |
| CV-08 流式接收与定稿 | F03-008 | 绑定逻辑生成/attempt的可信片段→暂态片段、定稿消息和来源证据 | 重复/乱序可识别；断流不显示完整成功；提交未知先回读 |
| CV-09 停止与恢复 | F03-009 | 逻辑生成及原Operation定位→停止请求、外部确认/未知观察和恢复线索 | 停止显示、停止等待、远端取消分开；迟到结果归原生成 |
| CV-10 背景与模型快照 | F03-010 | 获准Context/Agent/模型引用及修订→本轮不可变输入依据 | 切换背景只影响新生成；旧轮次保留原依据 |
| CV-11 附件与来源 | F03-011 | 用户选择的文件/图片/文本附件引用、来源版本和用途→临时附件/原文件引用/持久导入副本类型 | 临时附件不自动进入Context；引用与导入不同；读取重新判权 |
| CV-12 工具意图往返 | F03-012 | Provider结构化工具意图→经permissions/connections执行后的真实结果引用 | 模型文本不是命令；拒绝/未知按事实回注；一轮可关联0..N个Operation |
| CV-13 显式转Task | F03-013 | 用户明确采纳内容、目标范围和请求关联→workflows返回的Task身份/修订引用 | conversations不写Task；创建Task不自动启动 |
| CV-14 会话检索 | F03-014 | 获准查询条件、主体/入口和分页依据→会话/消息/序列项最小投影 | 索引新鲜度/授权代次受控；撤权后缓存失效 |
| CV-15 序列项采纳/拒绝 | F03-015 | 稳定序列项版本、用户决定和理由→该项决定修订 | 只改变序列项决定；不自动改需求、建Task、批准权限或执行工具 |
| CV-16 序列项局部补充与修订 | F03-016 | 单项身份/修订、补充或修改内容、来源和主线意图→新序列项版本及来源关系 | 不覆盖其他序列项；分支结论回主线须显式采纳；旧版可追溯 |

## 3. 不同状态不可合并

消息保存、逻辑生成、Provider请求、工具Operation、外部结果、消息定稿是不同对象。停止等待不证明远端停止；流片段不证明定稿已保存；外部completed不证明任务验收；消息重发不证明旧副作用可安全重放。失败至少区分拒绝、未提交、依赖不可用、超时、断连、结果未知、回执保存失败和定稿失败。

## 4. B评审结论与C/D门槛

CV-06与CV-16必须分开：前者修改历史输入并创建新生成，后者只修订一条输出序列项。追加内容进入后续队列，不承诺Provider支持动态改写已派发输入。流式片段保存/保留、取消竞态和迟到回调需C实验；片段与诊断保留受PRD-D05。任何真实副作用仍经connections准入与Operation账本。


## 5. 模块独立功能编号与细化契约

本节为 `conversations` 模块的细粒度功能目录。CV-01～CV-16 保留为既有业务契约锚点；新增细分能力使用 `CONVERSATIONS-<子域>-NNN`。这些编号描述对话业务事实和生成链路，不替代全局交互语义 I01–I16，也不定义具体页面、控件或视觉样式。

**权威边界：** conversations 拥有 Conversation、消息、序列项、逻辑生成、背景快照和来源引用；connections 拥有 Provider 请求与 Operation；AI 拥有 Agent/角色配置；Space 拥有 Context 选择；workflows 拥有 Task；permissions 拥有授权；views 只提供获准检索/投影。

| 模块功能编号 | 功能 | 业务行为与边界 | 对应 F | 依赖 | 关联交互语义 | 最低验收条件 | 状态 |
|---|---|---|---|---|---|---|---|
| CONVERSATIONS-THREAD-001 | Conversation 生命周期 | 创建、读取、重命名、归档、恢复和删除独立会话；Space/Context/Workflow/Task 均可为空。 | F03-001 | shared、permissions | 无 Context/Task 可正常聊天并保存；归档/删除会话不级联删除来源资料。 | I01/I02/I03 | A |
| CONVERSATIONS-MESSAGE-001 | 消息与轮次持久化 | 保存用户输入、模型回复、来源、逻辑轮次关联和消息修订；消息内容由 conversations 拥有。 | F03-002 | shared/storage、connections/api | 断网/重启后区分已提交、未提交和提交未知；unknown 按原关联回读。 | I01/I02/I03 | A/B |
| CONVERSATIONS-GENERATION-001 | 逻辑生成身份与请求关联 | 为每次逻辑生成分配稳定身份，关联输入快照、Provider 请求/attempt、工具 Operation 和输出定稿；这些对象不合并。 | F03-002、F03-008、F03-012 | connections/api、connections、shared | 重发创建新逻辑生成；迟到片段/工具结果只能归属原生成及原 attempt。 | I11/I13 | A/B |
| CONVERSATIONS-SEQUENCE-001 | 稳定序列项 | 将定稿消息拆为有稳定身份、有序且可单独引用的序列项；序列项身份不由渲染顺序或数组下标生成。 | F03-003 | shared、views/UI | 重新排序/重新渲染不改变序列项身份；序列项可追溯所属消息版本。 | I02/I04 | A/B |
| CONVERSATIONS-REFERENCE-001 | 局部选择与版本引用 | 引用消息、段落或序列项时绑定来源消息/序列项版本和选区范围；引用不等于采纳、授权或执行。 | F03-004 | permissions、source owner | 引用历史版本后，原消息修改不改变引用来源；撤权后受限内容不可继续展开。 | I04 | A |
| CONVERSATIONS-BRANCH-001 | 分支讨论与回链 | 从选中内容创建独立讨论分支，保存来源锚点、父分支/主线关联和回链；分支结论不自动覆盖主线。 | F03-005 | shared、permissions | 分支可独立继续；合并/采纳必须指向明确目标和版本，不静默覆盖主线。 | I05/I08/I09/I13 | A/B |
| CONVERSATIONS-RESUBMIT-001 | 历史消息修改与重发 | 修改已发送输入时保留原消息/生成/工具结果，创建新消息版本和新逻辑生成；不重放旧 Operation。 | F03-006 | connections、permissions、shared | 含写文件工具的旧回复被重发时，外部副作用次数不增加；旧授权不复用。 | I03/I11/I13 | A |
| CONVERSATIONS-QUEUE-001 | 生成期间追加与排队 | 允许生成期间追加新输入并形成后续队列项；已经派发的输入快照不可原地修改。 | F03-007 | connections/api、shared | 追加内容明确进入后续队列；当前生成输入和请求哈希不变化；取消只移除未派发项。 | I03/I11/I12 | A |
| CONVERSATIONS-STREAM-001 | 流式片段接收与定稿 | 按逻辑生成/attempt 接收片段，识别重复、乱序、缺口和不完整结束；区分暂态片段、消息保存和正式定稿。 | F03-008 | connections/api、shared | 断流不显示完整成功；重复片段不重复定稿；提交未知先回读；片段保留遵循 D05。 | I02/I13 | B/C |
| CONVERSATIONS-STOP-001 | 停止等待、停止显示与远端取消 | 分别记录停止接收/显示、停止等待、请求 Provider 取消及远端确认；迟到结果仍归原逻辑生成。 | F03-009 | connections、permissions | 点击停止不伪称远端已停止；不支持取消的 Provider 明确报告限制。 | I12/I13 | A/C |
| CONVERSATIONS-CONTEXT-001 | 对话背景与模型输入快照 | 保存当前会话选择的 Context、Agent/角色、模型/连接引用；每轮生成固定输入依据和来源修订。 | F03-010 | space、AI、connections/api、permissions | 切换 Context/Agent/模型只影响新生成；旧生成保留原输入快照和权限依据。 | I04/I06 | A/B |
| CONVERSATIONS-ATTACHMENT-001 | 输入附件与来源 | 管理文本、文件、图片等输入引用，区分临时附件、原文件引用和持久导入副本；保留来源/版本/用途。 | F03-011 | connections/local、space、permissions | 临时附件不自动成为 Context 长期资料；引用与导入不混淆；读取时重新判权。 | I04/I15 | A/B |
| CONVERSATIONS-TOOL-001 | 工具意图往返 | 识别 Provider 结构化工具意图，按主体/入口/动作/目标经过 permissions 判权和 connections 执行，再将真实结果引用回注模型。 | F03-012 | connections/api、connections、permissions | 模型文本中的命令不自动执行；拒绝/未知结果准确回注；一轮可关联 0..N 个 Operation。 | I10/I11/I13 | A/B |
| CONVERSATIONS-TASK-001 | 显式转为 Task | 用户或获准规则明确采纳内容、范围和验收条件后，调用 workflows 创建 Task 并保存返回的 Task 身份/修订引用。 | F03-013 | workflows、permissions | 普通对话不自动成为 Task；创建失败不标记成功；重复意图可回读原 Task。 | I09/I11 | A |
| CONVERSATIONS-SEARCH-001 | 会话检索与历史读取 | 按获准主体/入口查询会话、消息、序列项和来源引用；内部检索聚合可由 views 提供，但消息事实仍归 conversations。 | F03-014 | permissions、views | 撤权后旧缓存不能显示受限正文；分页/索引新鲜度可见；打开详情重新判权。 | I02/I16 | B |
| CONVERSATIONS-DECISION-001 | 序列项采纳、拒绝与待讨论 | 对稳定序列项版本记录用户采纳、不采纳、待讨论或已解决决定及理由；决定不自动改变正式需求/权限/Task。 | F03-015 | permissions、workflows | 勾选/拒绝只改变该项决定；不会隐式建 Task、批准权限、派发工具或验收。 | I09 | A/B |
| CONVERSATIONS-ITEM-REVISION-001 | 序列项局部补充与修订 | 对单个序列项形成补充/修改新版本，保留旧内容、来源、顺序和主线/分支关系。 | F03-016 | shared、permissions | 局部修订不覆盖其他序列项；分支结论回主线须显式采纳；旧版可追溯。 | I03/I08/I09 | A/B |
| CONVERSATIONS-STATE-001 | 消息、生成、工具与定稿状态分离 | 分别维护消息保存、逻辑生成、Provider 请求、工具 Operation、外部结果和消息定稿观察，不共用一个完成状态。 | F03-002、F03-008、F03-009、F03-012 | connections、shared、permissions | 流片段不代表消息已保存；远端取消不等于本地定稿；外部 completed 不等于 Task/Acceptance 完成。 | I02/I12/I13 | A |

### 5.1 基础业务与交互语义的区别

- F03/CONVERSATIONS-* 定义消息、序列项、分支、逻辑生成、追加、重发、工具往返和 Task 转换的业务事实。
- I01–I16 是全局交互语义，conversations 主要使用 I02–I04、I08–I13、I16；不为每种按钮/鼠标动作另建一套 I 编号。
- UI 可以用勾选、段落菜单、追加输入、分支入口、修改重发和状态提示呈现这些语义；页面布局、控件位置和视觉设计后置。
- 勾选消息/段落不等于采纳观点；采纳观点不等于修改正式需求；修改重发不等于重放旧 Operation；停止显示不等于远端停止。

### 5.2 编号映射与维护

- F03-001～016 分别映射本节 Conversation、Message、Sequence、Reference、Branch、Resubmit、Queue、Stream、Stop、Context、Attachment、Tool、Task、Search、Decision 和 Item Revision 能力。
- CV-01～CV-16 是原有契约锚点；CONVERSATIONS-* 是细粒度施工编号，不替换旧锚点。
- I01–I16 继续作为跨模块交互语义目录；本模块只引用适用语义，不重排全局交互编号。
- 新增、拆分或调整对话功能，只在 conversations owner 范围内分配新编号；不重排 F01–F15、CV-01～16 或其他模块编号。
- 流式片段保留受 D05 约束；取消竞态/提交未知按 C 实验管理；本节不把 B/C/D 自动升级为 A。


## D02：对话四级权限的会话边界（2026-11-01）

主 AI、秘书 AI 在真实用户对话中使用四级工具执行自主程度。会话身份、当前 Agent/职责来源和 Context 背景由相应 owner 提供；四级策略、审批和最终判定归 permissions，不由 conversations 自行保存第二份授权账本。

- 主 AI 与秘书 AI 暂时共享当前 Conversation 的同一个四级权限等级，由用户主动设置；未设置时两者均不得自动执行工具。共享等级不合并主体身份、职责或工具资格，其他角色和其他对话不继承。
- Context 背景切换后，对新操作使用当前 Context 工具开关和资源范围重新判权；不得将旧 Context 授权带入新背景。
- 对话中显式创建 Task/启动 Workflow 只授权该启动意图；工作流执行时改按具体节点策略判权，不继承对话等级。
- 修改/重发历史消息创建新逻辑生成，不复用旧工具授权或重放旧 Operation。
- IV级允许在用户明确授予的工具、Context、资源和目标范围内执行全部风险等级操作，不因风险标签本身逐次询问；专门信任边界见PRD-D01/D02矩阵§6。未主动设置等级时，主AI与秘书AI均拒绝工具执行。

详细候选等级与样例见[ D01–D02 权限矩阵 ](../docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md)。


## 文档关联与施工入口

- **模块导航**：[conversations README](README.md) · [全模块契约索引](../docs/MODULE-CONTRACTS.md) · [文档总索引](../docs/README.md)
- **产品需求**：[F01–F15 产品功能总表](../docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) · [交互语义与 UI 映射边界](../docs/product/INTERACTION-AND-UI-BOUNDARY-2026-11-01.md) · [功能—模块契约映射](../docs/product/FUNCTION-CONTRACT-MAP-2026-11-01.md)
- **跨模块依据**：[AI 契约](../AI/CONTRACT.md) · [connections 契约](../connections/CONTRACT.md) · [workflows 契约](../workflows/CONTRACT.md) · [D01–D02 权限矩阵](../docs/product/PRD-D01-D02-PERMISSION-DECISION-MATRIX-2026-11-01.md)

维护规则：消息/序列项/逻辑生成事实写回本契约；Provider 请求与 Operation 事实转交 connections；Agent/角色配置转交 AI；Task 转交 workflows；任何许可决定转交 permissions。
