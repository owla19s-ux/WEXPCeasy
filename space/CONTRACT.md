# Space / Context｜正式模块行为与接口契约

> 文档状态：**现有代码事实 + 已确认产品要求 + 待实现/待实验事项明确分层**。2026-11-08 对照 `main` 源码、A1 F01 与模块测试编制。本契约不会因记录拟议方案而使其变成已验证接口。
>
> 施工入口：[README.md](README.md)；完整产品依据：[A1 功能总表](../docs/A1-正式产品设计/产品功能总表.md)；版本验收：[A2 当前状态表](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。历史 Space CONTRACT 已归档于 A0，不作当前施工权威。

## 1. 契约等级

- **[产品已确认]**：用户/正式 A1 已确认的产品行为和边界；不表示代码完成。
- **[源码已存在]**：当前公开类型、方法或行为可在源码中查到；其运行验证范围须看测试和对应 SHA。
- **[实施建议]**：符合现行产品方向、供施工阶段通过实验证明的最小技术方案；不是已存在接口。
- **[待实验/待裁决]**：依赖上游能力、产品政策或真实故障证据，未确认前不得伪称已实现。

## 2. 产品不变量与数据归属

**[产品已确认]** Category 是 Space 分类，不绑定物理目录；Space 管组织并可登记工作区目录；Group 属于 Space、可选；Context 可不依赖上述组织独立创建，具有不可更改的稳定 ID、自身配置/记录及可选组织关联。目录/主地址/工作区的不同定位不得相互替代。

**[产品已确认]** 当前只要求 Space/Group 的基础单组织归属；旧 `Placement` 多处放置功能 F01-007 已冻结，不得创建新产品实体、独立 placementId 或多处放置接口。现行 `ContextOrganization` 可继续保留。组织变动不移动 Context 数据，不隐式改变主地址。

**[产品已确认]** Context 自身数据、公共登记索引、外部目标资源/配置是不同权威对象。Space 只保存 Category/Space/Group/Context 身份、本域数据及引用/选择事实；不能拥有 AI、API、Conversation、Connection、Local、Environment、Permissions、Task 或 Workflow 的真实状态。

**[源码已存在]** `Registry`（`format:1, domain:'space'`）保存公共 Category/Space/Group、Context 注册定位、意图记录；`Body`（`format:1, domain:'context'`）保存 Context、resources、associations、tools、意图记录。`Registration` 可记录可选单组织 `organization`；`Context` 含 `id/revision/name/description/config/primaryAddress`；`Address` 含 `id/revision/name/address/notes/purpose`、可选 `type/source`，当前 `status:'unverified'`。

**[源码已存在]** Context 创建/接回通过分离的根目录和现有 shared Store/RootLock/身份校验协调；不承诺跨目录原子提交；`recovery.ts` 核验既有本体和唯一已确认创建证明，不能见同名目录就自动创建/合并对象。

## 3. 当前公开 API 与输入输出

**[源码已存在]** 唯一公开入口为 `openSpaceService(options:SpaceOptions):Promise<SpaceOpenResult>`；`SpaceOpenResult` 为 `{status:'ready',service}` 或 `{status:'unavailable',reason}`。`SpaceService` 的公开操作：
- `execute(request:object,input:SpaceCommand,signal?:AbortSignal):Promise<Mutation>`
- `query(request:object,input:SpaceQuery):Promise<QueryResult>`
- `close():Promise<void>`

`SpaceOptions` 当前提供数据根、权限读端口及可选 Owner/派生请求/ID/锁/Store 等注入能力；具体签名以 [src/service.ts](src/service.ts) 为准。调用方不得直接写 Store 或伪造可信授权；`request` 由可信宿主提供，Renderer 不得生成可用的本地权限事实。

**[源码已存在]** `SpaceCommand` 当前已声明：
- 组织：`category.create/edit`、`space.create/edit/directory`、`group.create/edit`。
- Context：`context.create/attach/edit/group`。
- 地址：`address.add/edit/remove`、`primary.select`。
- 关联：`association.add/replace/remove`。
- 工具：`tool.add/set/remove`。
- 不存在 `placement.*`，也没有完整的 `context.config.*` 公开修改命令。

**[源码已存在]** `SpaceQuery` 当前包括 `organization`（category/space/group）、`contexts`、`context`、`context.location`、`context.organization`。`ContextView` 返回本体和可见的 resources、associations、tools；Context QueryResult.complete 为 false 时表示有引用未能投影，原引用仍保留。桌面 detail 将其投影为 associationsComplete；`ToolView` 的 availability 为 available/unavailable/conflict/unknown，并有来源修订和观察时间。当前 Tool 状态投影不代表最终执行资格。

**[源码已存在]** `Mutation` 区分 `committed(id,revision)`、`rejected(reason)`、`unavailable(reason)`、`failed_no_commit(reason)`、`unknown(intent,id?)`。`QueryResult` 正常返回 `status:'ok',value`（可选 `complete`），异常沿用非提交结果。不能用布尔值或构建成功替代事务结果；具体错误 reason 以代码和测试为准，不凭本文凭空增加枚举。

## 4. 功能行为契约

### 4.1 类别、Space、Group、Context

**[产品已确认]** 类别与 Space/Group 名称变化不更换各自 ID；Category 不产生目录；Space 工作区目录的登记/解除不自动创建文件、搬迁 Context 数据或授予文件读取权。Group 是可选组织关系，移动/移出不删除 Context。

**[源码已存在]** `context.group` 通过 `contextId,spaceId,groupId,expectedRevision` 更新可选组织，要求所属 Group 匹配 Space；同一 Context 当前不得通过它跨 Space 迁移，冲突返回受控拒绝；组织修订与 Context 本体修订分离。创建 Context 无 Space/Group 前置条件。

**[待实验/待裁决]** Category/Space/Group 的破坏性删除、归档与恢复策略及跨 Space 移动尚未完备；不能依据历史 Placement 样例强行补齐。

### 4.2 Context 自身配置

**[产品已确认]** Context 可管理稳定身份、名称、说明、自身配置和修订；自身配置不应成为 Agent、API、角色、权限、会话、任务的第二份业务本体。

**[源码已存在]** `Context.config` 存在于本体格式；当前 `context.edit` 只管理名称/说明，没有完整支持配置键增删改的公开命令。不得把初始空对象视为配置功能完成。

**[实施建议]** 在验证业务字段与调用方后，以现有 Context 修订及单本体 Store 为基础提供受控配置变更（具体命令名、字段合法性、局部更新粒度在施工实验后冻结）；显式区分“不填”“清空”“覆盖”，对跨域引用只存目标稳定 ID/配置引用，不存敏感值或外域正文。先做单元及重启回归，再拓展 UI。

### 4.3 地址和资源

**[产品已确认]** Context 可记录多个地址（名称、地址、备注、用途、类型/来源），可明确选择/清除主地址；用途可包含主工作对象、操作位置、产出位置、参考资料。地址添加/修改/解除相互独立；解除关系不删除外部文件、仓库、产物，也不停止任务。用户可保存未验证地址；登记不证明资源可访问。

**[源码已存在]** `address.add/edit/remove`、`primary.select` 支持多个独立记录与主引用选择；`purpose` 可为历史字符串或唯一、完整的非空字符串数组；`type/source` 为可选描述元数据；地址当前持久状态为 unverified。主地址被解除时清除选择，不自动切换其它地址。

**[待实验/待裁决]** 资源真实身份、别名判定、可用性和版本变化必须依目标 Owner 的实际证据；不能凭同名/同路径静默合并或把未验证变成可用。已验证资源改指时的专门重定位策略仍需明确验证。

### 4.4 Association 与 Tool

**[产品已确认]** 引用、配置选择、执行绑定三层独立：引用只表示组合事实；配置选择只保存允许的局部配置/目标引用；执行权限、实际任务输入/输出和连接器调用由消费者、Permissions 与目标 Owner 决定。新增引用不意味着启用全局服务或自动执行。

**[源码已存在]** `Target` 为 `owner,targetType,targetId`，`Association` 额外包含 `id,revision,purpose`；`Tool` 增加 `enabled`。`supportedTarget()` 当前仅接受普通引用 `AI:role/position/agent`、`connections/api:api/model`、`conversations:conversation` 和工具 `connections:tool`。目标验证需要 `OwnerPort.resolve` 的当前合法观察；不匹配/不可证实应拒绝或报告不可用。`tool.set` 仅修改本 Context 的选择事实。

**[实施建议]** 为 A1 F01-008 中实际目标 Owner 支持的资料、工作流、其它 Context 等逐步扩充允许的目标类型及验证器，继续使用已有 Association/专用 Address/Tool 结构；不新建并行关系底座，也不无条件放开 owner/type 组合。实际已发现工具目录由 Connections 提供，Space 持久化选择 ID；真实调用走对应执行 Owner。

**[待实验/待裁决]** 同一 Context 同目标多用途的基数、Context 循环引用策略、Tool 局部参数覆盖以及有效配置默认优先级未冻结；现有同目标重复选择会拒绝。不得静默合并多用途或自动递归获取目标 Context。

### 4.5 有效配置与当前可用性

**[产品已确认]** F01-009 应可给出带来源的 Context 有效组合结果，区分显式选择、默认、不可用、冲突、无权与过期观察；不得使用历史缓存当作当前授权。

**[源码已存在]** Context 查询返回关联及有限 `ToolView` 投影，缺少正式完整的跨 AI/API/Connections 配置覆盖解析公开能力。`OwnerObservation` 目前只能表述可见身份及必要可用性证据。

**[实施建议]** 先提供可解释的显式引用投影及未决冲突信息，使用真实目标 Owner 的公开读取/发现方法；在默认/覆盖规则获确认之前不自定优先级。新的解析接口必须有真实消费者及跨模块测试依据。

## 5. 权限、取消、提交与生命周期

**[产品已确认]** 显示某个 Context、引用、Tool、地址或菜单，不意味着拥有读取、执行或删除权。按真实主体、入口、目标与关联范围判权；读取列表、计数、关联目标、缓存与反向查询都不得泄露无权对象存在性。撤权和来源变动须重判。

**[源码已存在]** 服务通过 Permissions reader 进行精确 scope 判定与提交前重检；公开 `execute` 支持 AbortSignal；写入使用 intent 和 expectedRevision 校验、持久意图记录、未知回执与恢复处理。重新回放同意图时不得绕过当前授权；有些错误必须作为未知而非宣称未提交。

**[产品已确认]** Context 接回必须保留原始 ID 与本体，不因路径暂时失联创建空白替代。关闭/清理要处理 Store/锁生命周期，不能在未确认释放时声称恢复完成。删除引用、解除组织与删除 Context 本体是不同动作；Context 本体破坏性删除目前阻塞。

**[源码已存在]** `recovery.ts` 使用已有 Context Store 的创建证明检查；身份冲突不自动合并；`close()` 清理并释放已获取的资源。现有负例测试含目录失联、提交回复未知、意图回放、修订冲突、撤权等。

## 6. 跨模块接线

| 模块 | Space 可消费的公开事实 | Space 不负责 |
|---|---|---|
| `permissions` | 本次入口/目标权限裁决和重检 | 自定义权限政策或默认授权 |
| `shared` | Store、Root、Lock、通用技术机制 | 把 Space 业务规则转移到 shared |
| `AI` | Role/Position/旧 Agent 的身份和可见状态 | 角色定义、Agent 运行、人格策略 |
| `connections/api` | API/模型配置对象身份及可用投影 | API Key、Provider 协议、实际生成 |
| `connections` | 工具目录和真实能力身份、调用/Operation | 在 Space 内复制派发、回执 |
| `connections/local` / `environments` | 目录/工具/环境的真实观察和执行能力 | 任意本地操作、环境安装 |
| `conversations` / `workflows` | 实际消费者的 Context 选择、引用解析请求 | 消息本体、任务执行与调度 |
| `app` / `UI` | 可信调用入口及视图显示、编辑/选择 | Renderer 直接持有数据库/授权 |

App 中现有 `app/src/desktop-space.ts` 是可信 UI 请求适配，`UI/src/space.tsx` 等是已有前端，不应再创建平行表单。新增 Space 功能需分别核对领域端口、可信宿主、UI 实际入口，不能因为领域单测通过就签收产品可用性。

## 7. 最低验收矩阵

| 编号 | 检查场景 | 必须观察到的结果 |
|---|---|---|
| S01 | 独立 Context 创建、重启、再次查询 | ID/数据稳定，无 Space、Agent 或 Task 自动副作用 |
| S02 | Category/Space/Group 编辑、重排与 Context 组内移动 | 原本体不搬迁，组织修订独立、冲突被拒绝 |
| S03 | 旧 Placement 指令 | 不出现新的 Placement 产品模型；未知命令受控拒绝 |
| S04 | API/Role/Agent 引用添加、替换、解除 | 关系与目标身份分离，不修改目标本体，不复制凭证 |
| S05 | Context 自身配置变更（新增能力） | 输入校验、独立修订、冲突及重启恢复成立 |
| S06 | 多地址、主地址、清除/解除 | 保留其它引用，不删除资源/迁移 Context |
| S07 | 未验证/不可用的资源 | 不冒充可用，不由路径字符串自动确认身份 |
| S08 | 工具添加/停用/移除与两个 Context 隔离 | 选择隔离，不修改全局连接/真实执行资格 |
| S09 | 有效配置（新增能力） | 明确区分显式、来源、冲突/不可用及未确认优先级 |
| S10 | 只读查询与反向关系、权限撤销 | 无权不泄露名称/数量/存在性，旧授权不能重放 |
| S11 | 目录离线/恢复、损坏与身份冲突 | 不生成空白替身，不自动合并、不写坏旧数据 |
| S12 | COMMIT 前/后不确定、幂等重放、取消 | 正确区分 committed/rejected/failed_no_commit/unavailable/unknown |
| S13 | Context 数据根与公共索引分离 | 不假定跨目录原子提交；修复/接回可复验 |
| S14 | App/Space/UI 受控交互及 Windows 路径 | 真实入口和权限/撤权/恢复验证，不以 mock 冒充 |
| S15 | 在途任务与引用停用/解除 | Space 不谎称取消外域执行；新调用重新判权 |
| S16 | 类别读取在创建/编辑前后撤权 | 未授权不能落库或通过原意图回执泄漏 |
| S17 | 删除/迁移未批准功能 | 明确阻塞/未支持，不借测试默许破坏性操作 |

S05/S09 是完整产品目标所需的**后续实现验收**，不是当前已通过断言；S03 不要求重新建立旧多处放置测试环境。现有 `space/tests` 及关联集成测试必须继续回归。历史 `space/evidence/` 为对应提交证据，不表示本次运行签收。

## 8. 施工与文档更新边界

实施顺序：复验既有源码/测试 → 完善 Context 自身配置 → 扩充经 Owner 核验的关联类型与工具接线 → 有效配置投影 → 单模块及跨模块回归 → Windows 真机核验 → 普通对话验收/文档维护更新状态。

只在源码和测试证明 `service.ts/model.ts` 存在独立职责与修改扩散时作局部拆分；兼容接线、测试、迁移消费方通过后再删除旧逻辑。不得重写公共 Connections/Permissions/Operation，也不得将 0.1.2 计划、历史候选或研究建议冒充已批准的 0.1.1 功能。

**当前文档变更不改动产品源码、公共接口、权限政策、A1 或 A2，也不产生新的测试通过事实。**
