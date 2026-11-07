> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 02 — 代码编写方式调整规范

> 本文不是代码风格（缩进、命名长度），而是**功能落点规则**：一段代码应该写在哪、以什么形式暴露、如何被别人使用、如何被验证。违反这些规则，目录再对也会退化。

## 0. 总原则

一个功能的代码，应当满足：

1. **归属明确**：它完整地属于某一个模块，或明确属于平台机制。
2. **公开面最小**：只有确实需要外部使用的东西才公开。
3. **依赖单向**：模块只依赖契约和平台接口，不依赖另一个模块。
4. **行为完整**：模块自己完成认证适配、参数转换、错误映射、证据提取，不把这些散到外面。
5. **可独立验证**：不启动整个应用也能测。

## 0.1 先分清四种协作形态（V0.2 补充）

在谈“模块之间能不能依赖”之前，先分清协作的性质。把四种形态混成一种，是模块边界争论的根源。

| 形态 | 用在哪 | 实现方式 | 禁止 |
|---|---|---|---|
| **同域组合** | Agent、Task、Workflow、Context 这类强关联实体 | 放在**同一个领域模块**内，直接调用、共享不变量 | 拆成多个 crate 再互相 import |
| **应用服务编排** | 跨领域用例（例如“建任务 + 绑上下文 + 派 Agent”） | 由 `apps/desktop` 或 service 层按顺序调用多个领域模块 | 领域模块 A 直接 import 领域模块 B |
| **能力调用（invoke）** | **有外部副作用**的能力：GitHub、文件、终端、外部 Agent、模型 API | 统一 Invocation → 权限 → 记账 → 分发 → 回执 | 用于进程内领域逻辑；用于纯数据查询 |
| **事件** | 通知“已经发生的事实”：状态变化、进度、审计 | 发布/订阅，携带版本与来源 | 当作命令或 RPC；在事件处理器里反向改模块内部状态 |

由此收窄两条规则：

1. **能力调用只用于外部副作用**，不用于进程内领域协作。领域协作靠“同域组合”或“应用服务编排”。
2. **强关联实体优先归并到同一领域模块**。如果发现必须靠模块互调才能完成一次业务操作，首先要问“它们是不是本来就该在同一个模块里”，而不是放开依赖。

> 这一节是对 R1/R5/R6 的补充，不改变“模块不直接 import 另一个模块内部”的默认规则。真正的解法是**领域归并**，不是放松依赖方向。

---

下面 14 条规则，按“模块边界 / 契约与公共机制 / 状态与协作 / AI 施工”四组展开。每条都给出：规则、为什么、反例、正例、检查方式。

---

## A. 模块边界

### R1. 先声明能力，再写实现

**规则**：新增一个可被外部调用的功能（UI、Agent、工作流都可能调用），先写能力声明，再写实现。

能力声明至少包含：

- 稳定 ID（如 `github.issue.create`）
- 标题/说明
- 参数 schema（含类型、必填、边界）
- 资源类型（这个操作作用于什么）
- 副作用分类（无 / 可能有 / 一定有）
- 审批类别（自动 / 询问 / 拦截）
- 超时
- 幂等性要求（幂等 / 需要幂等键 / 不可重试）
- 期望产生的证据类型

**为什么**：UI 的工具列表、Agent 的可用工具、权限判断的输入、审计记录，都从这份声明来。没有声明，就必然出现“UI 手写一份、后端再写一份、权限再写一份”的三份真相。

**反例**：

```text
UI 里写死：["读文件", "写文件", "GitHub 提交"]
后端 if/else 判断 toolName == "github_commit"
权限代码里再写一份 switch
```

**正例**：

```rust
CapabilityDescriptor {
    id: "github.issue.create",
    params_schema: ...,
    side_effect: SideEffect::Guaranteed,
    approval: ApprovalClass::Ask,
    idempotency: Idempotency::KeyRequired,
    evidence: EvidenceSpec::ExternalId("issue_number"),
    ...
}
```

UI 和 Agent 从 registry 查询声明，不手写列表。

**检查**：新增能力是否只改模块内能力声明 + 实现 + 测试？如果 UI 还需要手改列表，说明声明没有真正驱动 UI。

---

### R2. 模块公开面最小化

**规则**：模块只导出“构造 + 注册 + 配置 schema”。其余全部 `pub(crate)` 或私有。

**为什么**：公开面就是承诺。公开越多，别的模块越容易直接依赖内部实现，模块边界就越容易被绕过。AI 施工时尤其如此：它会“就近”引用看得见的东西。

**反例**：

```rust
// github/src/lib.rs
pub mod api;        // 外部可以直接调 GitHub HTTP 客户端
pub mod actions;    // 外部可以直接调具体操作
pub struct GithubClient { ... } // 外部自己 new 一个，绕过注册/权限
```

**正例**：

```rust
// github/src/lib.rs
mod api;
mod actions;
mod auth;
mod errors;

pub struct GithubModule { /* 依赖通过构造注入 */ }

impl GithubModule {
    pub fn new(deps: GithubDeps) -> Self { ... }
    pub fn register(self, registry: &mut Registry) { ... }
}
```

**检查**：`cargo public-api` 或人工检查 `lib.rs`；如果别的 crate 出现 `use github::api::`，CI 失败。

---

### R3. 可扩展集合不用 enum，用稳定 ID + 声明

**规则**：能力、动作、对象类型、工作流步骤类型，用字符串 ID + 描述符表达，不在中央写 `match` / `enum` 分支。

**为什么**：每加一个连接器/动作，如果都要改中央枚举 + 中央 match，就回到了“功能散落多处”。枚举适合封闭集合（如“成功/失败/未知”），不适合开放集合（如“所有连接器动作”）。

**反例**：

```rust
enum Tool { ReadFile, WriteFile, GithubCommit, GithubIssue, ... } // 每加一个都改这里
fn dispatch(tool: Tool) { match tool { ... } }                    // 再加一个分支
```

**正例**：

```rust
pub struct CapabilityId(String);          // 稳定 ID
trait CapabilityExecutor { fn execute(...); }
// 注册表在启动时收集，不写中央 match
```

**注意**：不是所有枚举都要改。**状态机、错误分类、步骤类型**这类封闭语义，用 enum 更安全。判断标准：这个集合是否由产品/协议固定？固定用 enum，开放用 ID。

**检查**：新增能力是否修改了中央 `enum` 或 `match`？改了就要重新设计。

---

### R4. 模块自带配置、数据与迁移

**规则**：模块的配置 schema、持久化表、迁移文件、fixture，放在模块附近，由工具汇总；不塞进全局大配置对象，不在中央维护巨型迁移。

**为什么**：全局配置对象会变成第二个“中央注册表”——每加一个连接器就加字段，所有代码都 import 它。迁移集中在一个文件，会让多个 AI 同时改时冲突。

**反例**：

```text
config.rs: struct AppConfig { api_key, api_url, model, github_token, repo, branch, browser_enabled, ... }
migrations/0001_all.sql   // 所有表在一个文件
```

**正例**：

```text
modules/github/config.rs          // 只解析 github 段
modules/github/migrations/0001_init.sql
modules/ai-api/config.rs
platform/store/migrate.rs         // 汇总各模块迁移，按注册顺序执行
```

**检查**：新增模块是否只改自己的配置/迁移？全局配置文件是否被修改？

---

## B. 契约与公共机制

### R5. 公共机制只做“多模块必须一致”的语义

**规则**：进公共机制的东西，必须同时满足：≥2 个模块会用、语义在所有模块一致、抽出来后机制里不出现业务词。

**为什么**：公共机制是“唯一实现”，一旦抽错，所有模块被绑死；一旦抽得太细，公共机制会变成业务代码的另一个家。

**反例**：

- 把“GitHub 写后回读”放进公共账本：只有 GitHub 需要，且是 GitHub 语义。
- 把“通用 HTTP 请求”做成一级机制，所有连接器被迫使用同一套错误/重试语义。
- 把“所有权限规则”放进公共 policy：policy 开始知道仓库、目录、Issue。

**正例**：

- 公共：凭证按引用存取、操作先记账再发请求、权限判定组合、回执/未知状态机、事件发布。
- 模块：GitHub Token 怎么放 header、GitHub 错误码怎么映射、写后怎么回读。

**检查**：在 `platform/` 里 grep 业务词（github、issue、repo、token、file path）。出现即违规。

---

### R6. 公共机制里不许出现业务词

**规则**：`platform/*` 的代码、类型名、字段名、注释中，不得出现具体模块的业务概念。

**为什么**：这是“机制 vs 业务”的可执行判据。出现业务词，说明抽象泄漏，未来加第二个连接器时会被第一个连接器的语义绑住。

**反例**：

```rust
// platform/policy/src/lib.rs
pub fn can_call_github(user: &User, repo: &str) -> bool { ... }
```

**正例**：

```rust
// platform/policy/src/lib.rs
pub fn evaluate(req: &PolicyRequest, rules: &[&dyn PolicyRule]) -> PolicyDecision { ... }
// GitHub 的规则在 modules/github/policy.rs 注册
```

**检查**：CI 对 `platform/` 做关键词扫描；评审时人工确认。

---

### R7. 权限只在执行点裁决

**规则**：UI 可以做预检（灰掉按钮），但真正放行必须在公共调用管线。模块只声明“这个能力需要什么权限/范围”，不自己发明授权。

**为什么**：如果权限只做在 UI，绕过 UI（脚本、IPC、Agent、未来插件）就能执行。权限必须是执行路径上的强制检查，不是界面装饰。

**反例**：

```dart
// UI 判断完直接调用
if (userCanWrite) github.commit(...);  // 后端无检查
```

**正例**：

```text
UI 预检（体验） → Invocation → Policy.evaluate（权威） → Module.execute
Module 只声明 required_scopes，不判断“用户是不是管理员”
```

**检查**：尝试绕过 UI 直接调 IPC，是否仍被拦截/需审批？

---

### R8. 每个外部操作都记账，且先记账再发请求

**规则**：有副作用的操作，必须先持久化“意图 + 在途状态”，再发外部请求；收到回执后记结果。超时/断网/取消进入“结果未知”，不自动重试。

**为什么**：如果先发请求后记账，进程崩溃/断电后系统会丢失“可能已经发生副作用”的事实，重启后可能重复执行（重复提交、重复付款、重复删除）。

**反例**：

```text
发 HTTP 请求 → 成功 → 写数据库
（中间崩溃：外部已成功，本地无记录，用户重试 → 重复副作用）
```

**正例**：

```text
Ledger.begin(operation, InFlight)   ← 先落盘
→ 发外部请求
→ Ledger.finish(receipt)            ← Succeeded / Failed / OutcomeUnknown
```

**检查**：杀进程实验（见 07）。重启后是否出现 `OutcomeUnknown`，且没有自动重发？

---

### R9. 执行、回执、验证分开

**规则**：执行成功 ≠ 操作成功 ≠ 目标达成。用不同记录表达：

- Execution：实际调用了什么、何时、结果如何；
- Receipt：外部系统返回的可核对标识（commit SHA、run ID、文件版本）；
- Verification：依据证据判断目标是否达成（测试通过、回读一致、人工确认）。

**为什么**：把三者合成一个 `success` 字段，会出现“HTTP 200 就算完成”“模型说完成了就算完成”的经典错误。

**反例**：

```rust
struct Result { success: bool }  // 无法回答“成功指什么”
```

**正例**：

```text
OperationState::Succeeded { evidence_ref }
VerificationRecord { subject, evidence_refs[], verdict, method, verified_by }
```

**检查**：UI 是否能分别显示“已执行 / 有回执 / 已验证”？如果只有一个绿勾，说明模型错了。

---

## C. 状态与协作

### R10. 一个字段只有一个写入口

**规则**：持久业务字段只能由一个模块/服务写。UI 只持展示状态、选择状态、未提交草稿。缓存是投影，不是第二真相。

**为什么**：双写是长期维护中最难查的 bug 来源。尤其 AI 施工时，两个模块都可能“顺手更新一下”，最后状态不一致。

**反例**：

```text
Rust 保存 workspace 组织；Dart 也保存一份；两边都能改
```

**正例**：

```text
权威：Rust workspace 模块 + store
UI：React Query 缓存（派生），收到事件后失效/刷新
乐观更新：带 revision 提交，冲突则回滚并提示
```

**检查**：搜索同一业务字段的写入点；>1 即违规。UI 只能有「草稿」写入。

---

### R11. 模块发事件，UI 订阅，不反向穿透

**规则**：模块状态变化发领域事件；UI 通过 IPC 订阅事件；不允许 UI 直接回调模块内部，也不允许模块直接操作 UI 状态。

**为什么**：反向穿透会把 UI 生命周期与模块生命周期绑死；模块测试需要模拟 UI；UI 刷新逻辑散落在模块里。

**反例**：

```rust
// 模块里直接调 UI 回调
on_update: Box<dyn Fn(UiState)>
```

**正例**：

```text
模块：events.emit(OperationChanged { operation_id, state })
UI：subscribe("operation.changed") → 更新投影
```

**检查**：模块是否 import UI 类型/回调？事件是否带版本与 topic？

---

### R12. 测试与实现同层

**规则**：每个模块都要能在不启动整个 App 的情况下测：

- 契约测试：用 testkit 验证能力声明与执行符合契约；
- 单元测试：纯逻辑（参数转换、错误映射、状态转换）；
- 回放测试：录制 fixture，不打真实网络；
- 集成测试：只在 `apps` 或专门的集成目录，用假平台/假服务组装。

**为什么**：如果测试必须启动整个应用，AI 无法快速验证模块；测试会退化成“最后手工点一遍”。

**反例**：

```text
所有测试都在根目录 tests/，依赖真实 GitHub Token
```

**正例**：

```text
modules/github/tests/contract.rs       # 契约
modules/github/tests/actions_issue.rs  # 单元 + fixture
modules/github/tests/fixtures/issue_*.json
```

**检查**：`cargo test -p <module>` 是否独立通过？是否依赖网络/真实凭证？

---

## D. AI 施工适配

### R13. 中央文件预算

**规则**：新增一个功能，允许修改的“中央文件”（组合根、契约、平台机制、全局配置、全局路由）数量设上限。建议：

- 新增能力：0～1 个中央文件；
- 新增模块：1～2 个（组合根注册、模块索引）；
- 修改契约：必须走 ADR，不占普通预算。

**为什么**：中央文件修改次数是架构退化的最直观指标。预算超了，说明边界设计有问题，应该改设计，而不是硬塞。

**反例**：

```text
新增 GitHub Issue → 改 invoke、policy、ledger、config、router、UI 工具列表（6 个中央文件）
```

**正例**：

```text
新增 GitHub Issue → 只改 modules/github 内（能力声明/实现/测试/说明）
```

**检查**：统计每个功能 PR 改动的中央文件数；连续超标即架构评审。

---

### R14. 每个改动必须能回答四个问题

**规则**：提交前必须能回答：

1. 属于哪个模块/机制？
2. 公开接口变没变？变了是否版本化？
3. 影响哪些其他模块/UI/数据？
4. 怎么验证（测试/实验/证据）？

答不出来，不应提交。

**为什么**：这四个问题就是模块契约的最小认知负担；答不出来说明改动没有落点，或者边界不清。

**检查**：PR 模板/提交信息中强制四项。

---

## E. 横切规范

### E1. 错误分类

模块必须把外部错误映射到统一分类，至少包含：

- `InvalidInput`（参数/格式）
- `Unauthorized`（未认证/凭证失效）
- `Forbidden`（认证但无权限）
- `NotFound`
- `Conflict`（版本/状态冲突）
- `Unavailable`（网络/服务不可用）
- `RateLimited`
- `Timeout`
- `OutcomeUnknown`（有副作用但结果未知）
- `Internal`

原则：

- `OutcomeUnknown` 不得被自动重试覆盖；
- 错误信息必须脱敏（不含 token、cookie、完整路径）；
- 用户可见错误与内部错误分开（内部保留诊断，外部给可理解信息）。

### E2. 异步与生命周期

- 领域层尽量同步/纯函数；异步在能力模块与平台接口。
- 每个调用都有 `operation_id`；取消/超时/并发隔离按 operation 维度。
- 进程退出前必须保证：在途操作已落盘、可恢复；不允许“退出即丢”。
- FFI/IPC 边界必须有超时与取消，不允许无限等待。

### E3. 配置与凭证

- 配置分层：应用级（窗口/语言/主题） / 模块级（GitHub 默认仓库） / 实例级（某个 Connection）。
- 凭证只在 `platform/secrets`；业务模块只拿 `credential_ref`，不拿明文。
- 密钥不得进入日志、事件、错误信息、UI 状态、导出文件。
- 撤销凭证后，旧判定/旧请求必须失效。

### E4. 日志与可观测性

- 结构化日志，带 `operation_id`、`module`、`capability`、`attempt_id`。
- 默认脱敏；开发模式可开关，但不得把密钥写进日志。
- 关键路径有 tracing span：invoke → policy → module → receipt。
- UI 的错误提示与后台诊断分开；不要把内部堆栈直接给用户。

### E5. 版本与兼容

- 契约有版本；模块声明兼容的契约版本。
- 加字段默认兼容；删字段/改语义必须大版本 + 迁移说明。
- 数据 schema 有版本与显式迁移；不静默改旧数据。
- 模块可以独立升级，但不得要求其他模块同时升级（除非契约大版本）。

### E6. 命名

- 模块 ID：小写连字符（`github`、`ai-api`、`local-files`）。
- 能力 ID：`<module>.<resource>.<action>`（`github.issue.create`）。
- 对象/事件：名词 + 过去式（`OperationCompleted`）。
- 不要用“core”“common”“utils”“helpers”作为模块名；这些名字会吸走无法归类的代码。

### E7. 注释与文档

- 模块级说明放 `MODULE.md`，不要只写在代码注释里。
- 关键不变量写在代码旁边，并说明“为什么”，不写“是什么”。
- 公开接口必须有 doc comment；内部实现只在非显然时注释。
- 已知限制、失败模式、TODO 写在 `MODULE.md`/`docs/notes.md`，不埋在代码里。

### E8. 依赖注入

- 模块不自己读全局配置、不自己 `new` 数据库/HTTP 客户端、不自己取 token。
- 通过构造参数注入：`Secrets`、`Store`、`Clock`、`HttpFactory`、`Policy`（接口，不是实现）。
- 测试用 fake 实现，不需要启动真实平台。

---

## 13. 旧写法 → 新写法对照

| 场景 | 旧写法 | 新写法 |
|---|---|---|
| 新增连接器 | 改中央枚举、注册表、路由、UI 列表 | 新模块 + 能力声明 + 注册 |
| 新增一个操作 | 在中央 `match` 加分支 | 在模块 `actions/` 加文件 + 声明 |
| 权限判断 | UI 判断 + 后端各写一份 | 模块声明 + 公共 policy 统一裁决 |
| 状态更新 | UI/后端双写 | 单一写入口 + 事件投影 |
| 错误处理 | 每个调用点自己写 | 模块统一映射 + 公共错误类型 |
| 配置 | 一个全局大对象 | 模块配置 + 实例配置 |
| 数据库 | 中央大迁移 | 模块迁移 + 平台汇总 |
| 测试 | 启动 App 手工点 | 模块契约/单元/回放 |
