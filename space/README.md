# Space / Context｜模块施工入口

## 2026-11-08｜Space 源码状态复核补充

> 本节基于 `main@e9ff10c81dc4` 的静态入口核对和 2026-11-08 Space 源码/文档提交；不等同完整同 SHA CI 签收。

- **已有正式公开入口**：`space/src/index.ts` 导出 `openSpaceService` 及 Category、Space、Group、Context、Address、Association、Tool 和视图/投影相关类型；Context ID、地址与引用不是仅停留在设计文档。
- **近期行为补强**：此前提交 `3693a8ec`、`beea0ce2`、`c2e68469` 对 Category 创建/编辑中的可见性撤权与准备/回执边界进行了定向修复及负例补充；须以当次测试/当前 SHA 复验，不能将提交直接写作独立签收。
- **未完成证明**：工具关联的真实连接器可用性、失联、撤权后的 UI 展示、权限/恢复组合与 Windows 操作仍需核验。禁止添加已否决的 Placement 实体；Context 关联与实际授权/执行必须分离。
- **维护准则**：以本 README/CONTRACT 规定的既有 Space 职责为准；模块内部定向补缺、查真实调用，不因旧资料再造重复空间/引用模型。



> 仓库：`owla19s-ux/WEXPCeasy`；模块 Owner：`space/`；PC 优先。本文为模块功能、源码和验收入口，不代表全部产品能力已交付。
>
> **权威顺序**：A1 正式产品设计规定完整产品目标；本文说明模块实现与施工入口；[CONTRACT.md](CONTRACT.md) 规定当前确认的模块行为、接口及边界；A2 只记录版本范围和工程验证。A0 按需追溯，不作为直接施工命令。
>
> **状态核对（2026-11-08）**：已对照 `space/src`、`space/tests`、App/UI 接线及 A2；当前只做文档治理。已提交源码/历史测试与本次重新验证严格区分；未重新执行最新 main 的全量测试或 Windows 实机验收。

## 1. 模块定位及产品边界

Space 负责 **Category（类别）、Space、Group、Context 的组织、稳定身份、Context 自身记录及对资源/外部能力的组合引用**。Context 能独立于 Space/Group/Agent/Task/模板创建，拥有持久稳定的 `contextId`；显示名、目录和组织关系变化不改变身份。

- **Category**：Space 的分类，不绑定物理目录、不代表权限。
- **Space**：组织入口，可选择工作区目录；目录不是 Space 身份。
- **Group**：Space 内可选分组；不是目录迁移指令。
- **Context**：独立工作对象，保存自身配置、地址引用、关联关系与工具选择；本体数据与公共登记索引分离。
- **Context 组织关系**：现行实现为可选单一 `spaceId/groupId` 归属（`ContextOrganization`），不新增 `Placement` 产品实体、关系 ID 或多处放置系统。旧 F01-007 多处放置已冻结，不能根据历史表格施工。
- **Address/Association/Tool**：保存独立引用关系和选择事实，不复制目标，不执行工具，不授予权限，不创建外域本体。

**不同位置的含义**：Context 自身数据目录、Space 工作区目录、Context 主地址、操作目录、产出位置、参考资料都可以不同。主地址是用户明确选定的一条引用（可为空），不是 Context 数据根或默认授权；附加地址可多条且独立管理，不要求同一路径或同一来源。

**Owner 边界**：Space 不保存 API Key 明文、Agent/Role 定义、模型调用、会话记录、Task/Workflow 执行状态、全局工具配置或权限政策。AI 管理 Agent/Role；connections/api 管理 Provider/模型；Connections 管理工具调用和 Operation；Local 管文件实际操作；Environments 管环境本体；Conversations 管消息与生成；Permissions 决定授权；App/UI 提供可信入口。跨域通过公开接口组合，不复制权威状态。

## 2. 完整功能覆盖与当前状态

状态术语：**已有实现（有历史测试）**不等于本次验收；**部分实现**表示现有代码覆盖目标的一部分；**未实现**表示缺少目标公开能力；**待研究**指需要上游事实/未决政策；**延期**表示不在当前 0.1.1 强制范围。功能编号来源为 [A1 产品功能总表](../docs/A1-正式产品设计/产品功能总表.md)。

| 功能编号 | 完整产品目标摘要 | 当前源码/验证判断 | 后续处理 |
|---|---|---|---|
| F01-001 | 类别创建、管理及归类 | 创建/编辑/读取已有；删除未实现；类别可见性撤权保护有新增源码/测试待同 SHA 复验 | 保留现有，复验撤权与状态 |
| F01-002 | Space 生命周期 | 创建、编辑、查询已实现；归档/恢复/删除不完整 | 保留基础；破坏性流程不擅自补齐 |
| F01-003 | 工作区目录登记 | `space.directory` 已实现；实际目录状态/迁移不完整 | 补实际宿主场景；不自动搬迁 |
| F01-004 | Group 组织 | 创建、编辑、排序和 Context 组内调整已有；跨 Space 移动有限制 | 保留单组织语义，复验异常 |
| F01-005 | Context 独立创建 | 独立创建、稳定 ID、持久化和重启历史测试已有 | 保留 |
| F01-006 | Context 本体与自身配置 | 名称/说明/ID 已实现；`config` 已存储但无完整公开写入管理接口 | 优先补配置行为与修订 |
| F01-007 | 旧 Context 多处放置 | **已冻结／不实施 Placement**；现有单组织关系不等同多处放置 | 不重新引入旧实体 |
| F01-008 | 组合引用 | API/Model、Role/Agent、Tool 基础引用已实现；资源通过 Address 关联；其它 Context、Workflow 等类型不完整 | 按目标 owner 身份核验渐进扩充 |
| F01-009 | 有效配置解析 | 基础引用/工具可用性投影存在；默认、覆盖和冲突的完整有效配置尚无 | 优先补显式结果；优先级未决不得猜测 |
| F01-010 | 引用解除与本体删除分离 | Address/Association/Tool 解除已有；Context 本体删除尚未实现 | 保留解除；删除/影响检查延期 |
| F01-011 | 可见查询 | 组织和 Context 查询、按权限过滤及重检已有测试 | 补跨入口、撤权、存在性泄漏集成验收 |
| F01-012 | Context 接回/重定位 | `context.attach`、身份及创建证明核验、故障恢复已有；自动重定位/物理迁移不完整 | 保留接回，迁移延期 |
| SPACE-RESOURCE-001～004 | 多地址、描述信息、编辑、解除及主地址选择 | `address.add/edit/remove`、`primary.select`、类型/来源/用途元数据已有历史测试 | 保留，验证 UI/真实引用边界 |
| SPACE-RESOURCE-005～007 | 真实状态、别名识别、来源版本观察 | 地址目前持久状态为 `unverified`；真实 owner 观察、别名/版本未完整实现 | 待 owner 接入验证，非本期全部强制 |
| SPACE-TOOL-001 | Context 工具选择、启停、解除 | `tool.add/set/remove` 已实现，有独立 Context 测试 | 保留，补实际工具发现接线 |
| SPACE-TOOL-002 | Context 级局部配置 | 无完整正式接口/覆盖规则 | 待研究后补齐，不复制凭证 |
| SPACE-TOOL-003 | 工具集解析 | `ToolView` 有 enabled、availability、来源修订与观察时间投影；真实 Owner 接线/执行候选闭环未充分验证 | 部分实现，继续集成 |

**状态解释**：以上以已读取源码与历史测试为据，并非最新 `main` 的完整运行签收。A2 当前 0.1.1 状态见 [功能与工程状态总表](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。自由格子工作流、正式调度器、DSH 连接器/插件系统不因 Space 引用目标而提前纳入 0.1.1。

## 3. 源码与维护职责

| 路径 | 当前实际职责 | 处理 |
|---|---|---|
| `src/index.ts` | `openSpaceService` 与类型公开出口 | 保留，避免暴露内部 Store |
| `src/model.ts` | 对象类型、命令闭集、结构校验、引用目标限制及持久格式不变量 | 保留基线；新增行为若造成独立职责混杂，再定向拆分 |
| `src/service.ts` | 服务装配、权限重检、组织/Context/地址/关联/工具变更、查询、事务协调和关闭 | 局部职责偏集中；按真实修改影响及测试逐步拆分，不整文件重写 |
| `src/recovery.ts` | 既有 Context 身份及创建证明检查、登记恢复 | 保留 |
| `tests/*.test.mjs` | 稳定 ID、组织、地址、工具、权限、持久化和故障注入等测试 | 继续扩展；不删除已有效负例 |
| `evidence/` | 旧提交的验证及施工回执 | 仅作历史证据；不能冒充新 SHA 签收 |

**拟议的职责拆分，不是已存在文件**：视实际实现必要性，可将组织操作（organization）、Context 自身修改（context）、引用操作（references）从 `service.ts` 分离；公共协调、权限、Store、Intent 和恢复机制仍复用既有能力。不要为了目录美观创建空文件；不得建第二套关联或公共权限引擎。

## 4. 公开接口和真实约束

公开入口为 `openSpaceService(options)`，结果为 `ready/service` 或 `unavailable/reason`。`SpaceService` 提供 `execute(request, command, signal?)`、`query(request, query)`、`close()`。详细的当前命令/数据与正式行为见 [CONTRACT.md](CONTRACT.md)；对外消费应依公开入口，不直接读写 `Registry`、`Body`。

现有命令覆盖 category、space、group、context、address、primary、association、tool 的部分操作。`Context` 具有 `config` 字段，但当前命令无完整 `context.config` 修改；`supportedTarget()` 目前只接受部分 AI/API/Tool 类型；新目标类型必须有真实 Owner 验证，不能简单取消约束。`context.group` 是现行单组织调整，不是旧 `placement.*`。

现有写入依赖可信请求、权限重检、意图 ID、预期修订及实际 Store 结果。`committed`、`rejected`、`failed_no_commit`、`unavailable`、`unknown` 不得合并成布尔成功。持久化涉及公共登记与 Context 自身数据目录，不能宣称跨目录原子事务。

## 5. 当前优先级与合理施工顺序

1. **复验底座**：最新 `main`、既有单元/集成与故障测试、类别撤权边界、组织/ID/恢复不变量。稳定代码优先保留。
2. **补 Context 自身能力**：按 A1 明确可管理的 `config` 字段、变更粒度、修订与受控公开操作；不能将任意外域配置塞进 Context。
3. **补引用与工具组合**：保持现有 Address/Association/Tool 记录，按目标 Owner 支持事实扩充类型；接通真实能力发现和状态观察，不用示例 Tool 假定完整能力。
4. **补有效配置解析**：明确区分显式选择、不可用、冲突和来源信息；默认/覆盖优先级未确认的部分返回未决而非自定规则。
5. **跨模块和 Windows 验收**：真实 App/UI/Connections/Permissions/Local 场景、撤权、断线、重启、回执与旧结果隔离。完成本模块证据后，由文档维护/验收流程更新本 README 与 A2。

**不得擅自实施**：Placement、自动物理迁移、Context 破坏性删除、未确定的配置优先级、第二套持久化/连接/权限系统、0.1.2 延期功能。一般技术问题由施工 AI 自行选择可验证方案；产品/权限重大变更单独报告。

## 6. 测试及验收入口

- 本模块：`npm run test:space`（包含 build）。
- 类型/完整回归：`npm run typecheck`、`npm test`、`npm run check:boundaries`。
- 组合：检查 `app/src/desktop-space.ts`、`UI/src/space.tsx`、`UI/src/space-addresses.tsx`、`UI/src/middle-workspace.tsx`、`connections/api/tests/space-integration.test.mjs` 及 Permissions/Local 实际接线。
- Windows 实机：工作区选择、Context 创建/切换、路径失联、文件/目录授权、资源只读与保存、重启恢复、撤权/过期回执。模拟测试不得冒充实机验证。
- GitHub CI：先核对 [Actions 总运行列表](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 与对应 SHA，再判断是否需要新运行。

最低验收：Context ID 不因重命名或组内移动改变；组织变更不搬迁 Context 数据；地址解除不删目标；工具停用不关全局连接；无权查询不泄露外域状态；未知提交不能假报成功；接回不创建同名空对象；Context 配置/组合解析的新增能力须有实际接口测试与跨模块回归。历史 `space/evidence/2026-11-05/resource-tool-fields.json` 曾记录 `test:space 81/81`、`npm test 214/214`，**仅对该历史环境和 SHA 有效**。

## 7. 文档治理规则

默认阅读：仓库根 README → 本 README → [CONTRACT.md](CONTRACT.md) → 对应源码/测试。A1 为完整产品需求，A2 为版本工程状态；A0 仅在需求争议时定向追溯。原归档研究 `docs/A0-产品构想与研究/方案与研究/既有研究/contracts/space/CONTRACT-2026-10-31.md` 不是现行合同。代码施工模式不修改施工文档，文档更新归普通对话验收或明确的文档治理授权。
