# Space / Context｜0.1.1 模块施工规范

> 当前施工模块：Space。施工 AI 只修改源码与测试，不修改本文。**本文描述目标，不代表代码已实现。**
>
> 技术基线：TypeScript 5.9.3、Node.js >=24.9、ESM/NodeNext、strict 类型检查；桌面宿主计划 Electron + React，Space 领域代码不得依赖 React。当前仓库的 `tsconfig.json` 尚未纳入 `space/src/**/*.ts`，`package.json` 尚无 `test:space`；已查询的 `space/src/index.ts` 不存在。开工须先重新核对最新 main。

## 1. 本模块到底管理什么

- **Category**：Space 的分类标签。类别不是目录、权限或组织账号。
- **Space**：组织入口，具有自身 ID、名称和可选工作区目录登记。Space 不等于目录。
- **Group**：Space 内可选的组织分组；不强制每个 Context 经过 Group。
- **Context**：独立的工作对象，有不可变的 **Context ID**、自身配置、存储定位及修订。没有 Space、Agent、Task 或模板也能创建。
- **Placement**：Context 在 Space/Group 中的一个放置关系，有独立关系 ID。同一 Context 可有多条 Placement，始终只有一个 Context 本体。
- **Association / ResourceReference / ToolSelection**：Context 对其他对象、资源或工具的关系记录。关系 ID 与目标 ID 不同；关联不复制目标、不授权、不启动执行。

Space 只拥有这些对象及关系。Agent 由 `AI/` 管理，会话由 `conversations/` 管理，连接和工具真实可用性由 `connections/` 管理，授权由 `permissions/` 管理，任务与调度由其各自 owner 管理。不能在 Space 中建立第二份外域权威状态。

## 2. 数据模型的最低不变量

| 对象 | 必须具备的语义字段 | 不变量 |
|---|---|---|
| Category | categoryId、显示名称、修订 | categoryId 不由名称推导；更改类别不迁移目录 |
| Space | spaceId、名称、类别关联（可选）、工作区定位（可选）、修订 | spaceId 与路径独立；目录失联不删除 Space |
| Group | groupId、所属 spaceId、名称、排序信息、修订 | groupId 稳定；移动不搬资料 |
| Context | contextId、名称、说明（可选）、自身配置、存储定位、修订 | contextId 创建后不可修改；不因重命名/放置变化而改变 |
| Placement | placementId、contextId、spaceId、可选 groupId、修订 | 解除一条关系不删除 Context 或其他放置 |
| Association | associationId、contextId、目标 owner/目标 ID、用途、修订 | 关联不是权限，也不复制目标本体 |
| ResourceReference | referenceId、contextId、名称、原始定位、类型/来源、备注/用途、目标 owner、修订 | 原始路径/URL 不等于资源永久身份 |
| ToolSelection | selectionId、contextId、能力身份、enabled、可选局部配置引用、修订 | Context 启用不等于全局启用或实际调用授权 |

上表是**业务字段语义**，不是冻结的 TypeScript 接口声明或数据库 schema。所有 ID 必须持久稳定、不能因显示名称改变而改变，也不能把旧 ID 分配给新对象。具体 ID 算法（如 UUID 版本）、文件格式和跨目录事务方案尚未批准，不能凭猜测冻结不可逆格式。

## 3. 每个功能的可施工行为

下表中“写入”均要求可信主体/入口、操作意图和预期修订（新建对象除外）；成功返回权威 ID、修订及获准投影，旧修订返回冲突，权限拒绝不产生副作用。提交结果未知时按原意图回读，不能新建意图盲重试。查询必须按真实入口授权。

| 功能 | 操作、输入与结果 | 必须禁止或明确处理 |
|---|---|---|
| F01-001 类别 | 创建/读取/重命名类别；按 categoryId 将 Space 归类，返回类别/归类修订 | 类别不绑定物理目录、不授予权限；类别删除策略待决 |
| F01-002 Space | 创建/按 spaceId 读取/编辑名称和描述；返回稳定 spaceId 与修订 | 归档、恢复、实际删除细节未冻结；删除不得级联删除 Context |
| F01-003 工作区登记 | 按 spaceId 登记用户明确选择的目录，查询定位与观察状态 | 失盘时保留原定位；不得自动生成空目录或搬迁资料 |
| F01-004 Group | 在 spaceId 下创建/读取/重命名/排序 Group；返回 groupId、组织关系及修订 | Group 可选；移动不迁移 Context 文件；跨 Space 移动/删除政策待决 |
| F01-005 Context 创建 | 无 Space 前置条件，创建 Context；返回 contextId、初始修订、存储定位；重启按 ID 读取 | 不把名称或目录当 ID；不隐式创建 Agent、Task、Space |
| F01-006 Context 配置 | 按 contextId 读取/编辑名称、说明及自身配置；返回同一 ID 与新修订 | 不把外域 Agent/会话/权限数据塞入 Context；旧修订不得覆盖 |
| F01-007 多处放置 | 以 contextId、spaceId、可选 groupId 添加 Placement；按 placementId 移动/解除 | A、B 两处引用同一本体；解除 A 不影响 B、本体或目录 |
| F01-008 组合引用 | 按 contextId、目标 owner/ID 添加、查询、解除 Association | 不复制目标、不递归开放其他 Context、不自动授权 |
| F01-009 有效配置 | 返回 Context 自身设置、明确关联及来源/冲突/失效状态 | 覆盖优先级未决；不得静默采用旧配置或擅定默认顺序 |
| F01-010 删除分离 | 支持 Placement/Association 单独解除；可提供只读删除影响预检 | Context 本体破坏性删除暂缓；检查不完整不得删除 |
| F01-011 可见查询 | 按主体、入口、范围查询可见 Space/Group/Context/关系及修订 | 不泄露无权目标的名称、数量、反向引用或存在性 |
| F01-012 接回诊断 | 按 contextId 与记录定位检查失联、重复身份、待接回状态 | 自动物理迁移/自动合并暂缓；不能以同名空对象冒充恢复 |
| RESOURCE-001 多条引用 | 一个 contextId 可新增多条有独立 referenceId 的资源关系 | 不用单个 projectPath 取代集合 |
| RESOURCE-002 描述字段 | 每条引用独立保存名称、路径/URL、备注、类型、来源、用途 | 显示名和路径不是资源真实身份；不存文件正文 |
| RESOURCE-003 编辑 | 按 referenceId、期望修订修改描述或请求重定位 | 真实目标改变时不能静默改指；来源无法核验则标记未决 |
| RESOURCE-004 解除 | 按 referenceId 解除指定关系，返回关系修订 | 不删除目标文件、仓库、产物；不取消 Task |
| RESOURCE-005 状态 | 返回未验证、可用、失联、过期、身份冲突、无权等观察及时间 | 失联不等于已删除；旧观察不冒充当前状态 |
| RESOURCE-006 别名 | 使用资源 owner 的身份依据报告确认相同/可能重复/未知 | 不能靠名称或路径字符串自动合并 |
| RESOURCE-007 版本 | 保存来源 owner 返回的版本/修订观察，标识来源变化 | 不复制来源正文、不代替工作流验收 |
| TOOL-001 工具开关 | 按 contextId、能力身份添加/启用/停用/移除 ToolSelection | A Context 启用不使 B 启用；停用不卸载全局连接 |
| TOOL-002 局部配置 | 保存 Context 专属工具参数和安全凭证引用及修订 | 不改全局 Connection；不存明文 Key；覆盖规则未决则不覆盖 |
| TOOL-003 候选解析 | 返回已选、停用、失联、配置冲突的 Context 工具状态 | 不代表 AI 资格、工作流许可或 permissions 最终授权 |

完整产品需求状态仍以 [F01 总表](../docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) 为准。上表的 B/C/D 候选不因写入本文件就自动成为 0.1.1 强制交付；0.1.1 先完成稳定的 Context、Space、Group、目录登记、关系、资源/工具基础开关和持久化恢复。正式调度器、自由格子工作流、DSH 连接器与插件系统延期到 0.1.2。


## 3.1 Context 对 API、角色与 Agent 的显式引用（0.1.1 必须覆盖）

**Context 必须能主动添加、查询、更换和解除 API 配置引用与角色引用**，不能仅用“组合关联”四个字代替功能。三种概念严格分离：

- **API / Model 引用**：Context 选择一个由 `connections/api/` 管理的 API Connection、Provider/Model 或模型配置对象（以该模块实际公开身份为准）。Space 保存目标 owner、目标 ID、用途、关系 ID 和修订；不保存 API Key 明文、不复制 Provider 配置，也不直接发起模型请求。
- **角色（Role）引用**：Context 从 `AI/` 所拥有的角色定义中选择角色；保存角色目标身份、关系 ID、用途、启用状态（如业务确有需要）及修订。角色的提示词、权限资格和实际定义仍由 AI owner 管理；Space 不创建角色副本。
- **Agent 引用**：若 Context 需要绑定具体 Agent 实例，则单独引用 Agent 身份；**角色引用不自动创建 Agent，API 引用也不自动创建 Agent**。岗位、角色、Agent、API/Model 是不同概念，不能用一个字符串字段混合存储。

| 功能 | 输入 | 成功输出与行为 | 异常与拒绝 |
|---|---|---|---|
| 添加 API/Model 引用 | contextId、API owner 的稳定目标身份、用途、调用主体/入口、操作意图 | 新 associationId、目标身份、关系修订；重启后仍可查询 | 目标不可验证或无权时不伪装可用；不能把 API Key 写入 Space |
| 更换或解除 API 引用 | associationId、明确的新目标身份（更换时）、期望修订 | 原关系按明确意图更新或解除；不修改全局 API 配置 | 不静默改指其他 Provider/Model；不撤销其他 Context 的引用 |
| 添加角色引用 | contextId、roleId（由 AI owner 提供）、用途、操作意图 | 新 associationId、roleId、关系修订；可查询 | 角色不存在、无权或不可用时返回受控状态，不复制角色定义 |
| 更换或解除角色引用 | associationId、新 roleId（更换时）、期望修订 | 只修改本 Context 的关系；其他 Context 不受影响 | 不删除角色，不修改角色全局提示词或权限 |
| 关联 Agent | contextId、agentId、关系意图 | 独立的 Agent 关联与修订 | 不把 Agent ID、Role ID、API Connection ID 混成同一身份 |
| 解析 Context 的 AI 组合 | contextId、可信主体/入口及目标 owner 的当前观察 | 返回已选 API/Model、角色、Agent 的引用及可用/失联/无权状态 | **不自行推断默认模型或角色绑定优先级**；组合选择不等于授权模型调用 |

**验收补充**：创建 Context C，分别添加 API 引用 A 和角色 R；重启后两条关系及各自目标 ID 不变；更换 A 不影响 R，更换 R 不影响 A；同一 API/角色可被另一个 Context 引用；解除 C 的关系不删除全局 API/角色；无权入口不能查询其名称或存在性。API 模型真实调用、角色运行行为由各自 owner 的测试负责，Space 只验证引用、解析和权限隔离。

## 4. 代码与持久化要求

1. 先检查 `space/` 现有文件、`shared/src/index.ts` 的 Store/CAS 与路径出口、`permissions/` 的公开判权能力。不得凭本文臆造依赖函数签名。
2. 在 `space/src/` 建立领域公开入口与必要内部实现，`space/tests/` 建立模块独立测试。内部拆分按真实职责，不预建空层级。
3. 更新根 `tsconfig.json` 纳入 `space/src/**/*.ts`；根 `package.json` 增加 `test:space` 并接入 `npm test`；检查 `tools/check-boundaries.mjs` 是否需声明合法模块依赖。
4. 使用现有技术存储能力，不自建第二套 Store 或权限引擎。公共数据根只保存公共登记/索引；用户选定的工作区和独立 Context 目录保存其所属资料。**目录实际落盘格式、身份清单和跨目录恢复策略是实施前需要明确的兼容性设计点**，不得擅自把所有 Context 正文放入公共数据库。
5. Space 模块不依赖 Electron UI；后续 UI 通过公开端口接线。存储失败、无权、修订冲突、重复请求、提交未知、目录失联均须返回可辨识状态，不得统一吞成成功或“找不到”。
6. 工作模式不得修改 README/CONTRACT/研究文档；仅提交代码、测试与证据。涉及产品政策未决时，停在该功能，不停止其他已明确功能施工。

## 5. 独立验收矩阵

| 测试 | 必须断言 |
|---|---|
| S01 | 无 Space/Agent/Task 创建 Context，重启后 contextId 与配置不变 |
| S02 | Space/Group 重命名和类别变更不修改 Context ID、文件位置或权限 |
| S03 | Context 同时放置于两个 Space；解除其中一处，另一处和本体不变 |
| S04 | 旧修订写入拒绝；重复意图不重复创建；未知结果可回读 |
| S05 | 目录失联后仍保留原身份/定位；重复 Context ID 不自动合并 |
| S06 | 一个 Context 多条资源引用可分别编辑、解除，不删外部资源 |
| S07 | 资源身份无法验证时不静默改指，失联/无权/删除状态不混淆 |
| S08 | A Context 启用工具 X，B 未启用；B 不获得 X；A 不自动获得执行权限 |
| S09 | 无权入口不能通过列表、计数、关联反查推断对象存在 |
| S10 | 解除引用不触发本体删除、外域删除、撤权或任务取消 |
| S11 | Context 显式添加 API/Model 与 Role 引用；重启恢复、更换、解除互不影响；不复制凭证和角色定义 |

执行 `npm run build`、`npm run typecheck`、新增的 `npm run test:space`、`npm test` 和 `npm run check:boundaries`。测试命令、结果、提交 SHA、未验收的 Windows 行为须在回执中写实。模拟依赖通过不等于真实集成通过。

## 6. 施工状态与未决

**已核查的工程事实**：根 `package.json` 与 `tsconfig.json` 的版本、编译配置及 Space 未接线情况；`space/src/index.ts` 未找到。**未核查**：整个 Space 目录是否存在其他正式源码、模块测试、当前 CI 运行结果。**未执行**：本轮产品构建、测试与 Windows 实机验证。

**禁止自行决定**：Context ID 的具体生成标准、身份清单落盘格式、跨目录事务方案、Space/Group/Context 破坏性删除策略、类别重名规则、跨目录物理迁移、有效配置覆盖优先级。先实施与这些决策无关的稳定能力，确实阻塞时列出选项和影响。

历史详细依据：[Space 契约归档](../docs/research/contracts/space/CONTRACT-2026-10-31.md)；[Windows 数据目录要求](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)。研究材料只用于核对，不取代本 README 的施工范围。
