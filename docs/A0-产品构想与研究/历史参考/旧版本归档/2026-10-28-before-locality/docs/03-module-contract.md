> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 03 — 模块契约规范

> 一个“完整模块”不是靠目录存在定义的，而是靠它能回答五个问题：拥有什么数据、对外提供什么、依赖什么、失败/证据如何表达、如何独立验证。本文给出可执行的契约模板。

## 1. 模块五问

任何候选模块，先回答这五个问题。答不全的，不是模块，是功能或 UI。

1. **数据归属**：它拥有哪些持久化数据？这些数据的唯一写入口是谁？
2. **公开能力**：它对外提供哪些能力（能力 ID、参数、副作用、审批、证据）？
3. **依赖边界**：它依赖哪些契约/平台接口？绝不依赖哪些模块？
4. **失败与证据**：它如何表达失败、结果未知、外部回执、可核对证据？
5. **独立验证**：如何在不启动整个应用的情况下测试它？测试命令是什么？

## 2. `MODULE.md` 必填结构

每个模块根目录必须有 `MODULE.md`，固定章节如下（不要求字数，但必须回答）：

```markdown
# 模块：<名称>

## 1. 职责
一句话说明它负责什么。

## 2. 非职责
明确列出“看起来相关但不归它管”的东西。

## 3. 公开能力
| 能力 ID | 说明 | 副作用 | 审批 | 幂等 |
|---|---|---|---|---|

## 4. 公开接口
- 构造/注册入口
- 配置类型
- 事件（如果有）

## 5. 依赖
- 允许依赖（契约/平台 trait）
- 禁止依赖（其他模块/UI/具体存储实现）

## 6. 数据与迁移
- 拥有的表/文件/命名空间
- 迁移文件位置与顺序
- 迁移策略（向前兼容/显式升级）

## 7. 失败与证据
- 错误映射表（外部错误 → 统一分类）
- 结果未知的处理
- 产生的回执/证据类型

## 8. 安全
- 需要的凭证/权限范围
- 脱敏要求
- 绝不做什么（例如不记录 token）

## 9. 测试
- 契约测试命令
- 单元测试
- fixture/回放
- 不依赖什么（网络/真实凭证）

## 10. 已知限制
- 当前不支持的能力
- 平台差异
- TODO（带触发条件）

## 11. 修改规则
- 哪些改动是本模块内自治的
- 哪些改动需要跨模块协调/ADR
```

### 2.1 写作要求

- 用“事实”写，不用“愿景”写；未实现的能力标 `未实现`，不写成已支持。
- “非职责”比“职责”更重要：它防止 AI 把相邻功能吸进模块。
- 失败/证据必须写具体（例如“写后回读 commit sha 下的文件内容”），不写“处理错误”。
- 已知限制要带“触发条件”（何时应该补）。

## 3. `module.toml` 元数据

机器可读，供 arch-check、模块索引、启动校验使用。

```toml
id = "github"
name = "GitHub"
version = "0.1.0"
contract_version = "0.1"

# 维护者（人或 AI 的标识；不写个人隐私）
owner = "capability-team"

# 对外能力 ID（必须与 capabilities.rs 一致，由工具校验）
capabilities = [
  "github.repo.read",
  "github.file.read",
  "github.file.write",
  "github.issue.list",
  "github.issue.create",
]

# 允许依赖的 crate/模块（由 arch-check 校验，不允许“全部允许”）
dependencies = [
  "platform/contract",
  "platform/host",
  "platform/secrets",
]

# 明确禁止依赖（用于评审与工具提示）
forbidden = [
  "modules/ai-api",
  "modules/local-files",
  "apps/*",
]

# 数据命名空间（表名前缀/文件命名空间）
storage_namespace = "github"

# 平台支持
platforms = ["windows"]
```

规则：

- `dependencies` 只写契约/平台，不写其他业务模块。
- `capabilities` 必须与代码声明一致；不一致则 CI 失败。
- `owner` 用于“谁负责响应契约变更”，不是权限。

## 4. 能力描述符

能力是**数据**，不是代码分支。推荐字段：

```rust
pub struct CapabilityDescriptor {
    /// 稳定 ID：<module>.<resource>.<action>
    pub id: CapabilityId,
    pub version: SemVer,

    /// 标题/说明（可本地化）
    pub title: String,
    pub description: String,

    /// 参数 schema（JSON Schema 或等价类型描述）
    pub params_schema: SchemaRef,

    /// 作用资源类型
    pub resource_kinds: Vec<ResourceKind>,

    /// 副作用：不产生 / 可能产生 / 一定产生
    pub side_effect: SideEffect,

    /// 审批：自动 / 询问 / 拦截
    pub approval: ApprovalClass,

    /// 幂等：天然幂等 / 需要幂等键 / 不可重试
    pub idempotency: Idempotency,

    /// 超时（毫秒）
    pub timeout_ms: Option<u64>,

    /// 期望证据（用于回执/验证）
    pub evidence: EvidenceSpec,

    /// 需要的授权范围（声明，不是授予）
    pub required_scopes: Vec<ScopeRef>,

    /// 运行状态：可用/不可用/未配置（运行时填充，不是静态声明）
    pub availability: Availability,
}
```

### 4.1 命名约定

- 模块：小写连字符 `ai-api`、`local-files`。
- 能力：`<module>.<resource>.<action>`，如 `github.issue.create`、`local-files.file.read`。
- 动作使用动词原形：`read`、`write`、`list`、`create`、`delete`、`run`、`cancel`。
- 不要用模糊动作：`execute`、`process`、`handle`（它们说明不了资源与副作用）。

### 4.2 副作用与审批

| 分类 | 含义 | 默认审批 |
|---|---|---|
| `None` | 只读、无外部状态变化 | 自动 |
| `Possible` | 可能产生副作用（如动态执行） | 询问 |
| `Guaranteed` | 一定产生外部状态变化 | 询问/拦截 |

审批类别是**默认策略**，实际判定还要叠加：连接是否启用、凭证是否有效、资源是否授权、用户/会话策略。

### 4.3 证据规格

`EvidenceSpec` 说明“执行成功后应留下什么可核对证据”：

- `None`：无（只读查询通常可无）
- `ExternalId(field)`：外部系统返回的标识（commit sha、issue number、run id）
- `ContentDigest`：内容摘要（回读校验）
- `Artifact(path)`：产物路径
- `Custom(schema)`：模块自定义（但必须可序列化、可展示）

证据不是验证。验证记录引用证据，并说明判断方法与结论。

## 4.4 能力三层：定义 / 可用性 / 权限（V0.2 补充）

能力不是“一个静态清单说了算”。必须分三层，任何一层都不能替代另一层：

| 层 | 回答什么 | 数据来源 | 什么时候算 | 不能用来做什么 |
|---|---|---|---|---|
| **定义层** | 这个能力是什么：ID、参数、副作用、审批默认类、幂等、证据形态 | 模块的能力声明（`capabilities.rs` / `module.toml`） | 构建期/注册期 | 不能判断“现在能不能用” |
| **可用性层** | 当前这个 Connection / Session 能不能用：凭证是否有效、Provider 是否可达、平台是否支持、运行态是否就绪 | 连接目录 + 凭证状态 + Provider 观测 + 运行态 | 运行期，按连接/会话实时计算 | 不能当作权限决定 |
| **权限层** | 当前主体在什么条件下可以执行：主体、动作、资源、审批、撤销版本 | 策略判定（执行点） | 每次调用执行时 | 不能由声明或可用性推导 |

落地规则：

1. **`module.toml` 只是构建/注册清单**：用于 arch-check、模块索引、启动一致性校验；**不是运行时能力目录，不是 UI 数据源，不是权限依据**。
2. **运行时能力发现按 Connection 计算**：同一个模块可以注册多个 Connection；每个 Connection 的可用能力受凭证、Provider、平台、策略影响。UI 展示的是“当前可用性观察”，不是静态清单。
3. **声明 ≠ 授权**：能力声明里的 `required_scopes` 只表达“需要什么范围”，不表达“谁被授予”。
4. **执行时重核**：即使 UI 显示可用、能力声明存在、连接已认证，执行点仍要重新判定权限与撤销状态。

这条区分直接回应“静态清单不能判断能力可用”的质疑：静态清单只负责定义，可用性由连接与运行态负责，权限由执行点负责。

## 5. 公开面规范

### 5.1 允许导出

```rust
pub struct GithubModule { ... }

impl GithubModule {
    pub fn new(deps: GithubDeps) -> Self;
    pub fn register(self, registry: &mut Registry);
}

pub struct GithubConfig { ... }  // 只在组合根/设置服务使用
```

### 5.2 禁止导出

- HTTP 客户端、分页器、限流器；
- 具体 action 函数；
- 内部 DTO/协议类型；
- 内部状态结构；
- `pub mod api;` / `pub mod actions;`。

### 5.3 跨模块使用方式

只允许：

1. 通过能力 ID 调用（`Invoker.invoke`）；
2. 通过事件订阅；
3. 通过契约中的共享 DTO（只读）。

禁止：

1. `use github::...`（除公开面）；
2. 直接读另一个模块的数据库/文件；
3. 直接调用另一个模块的 action。

## 6. 配置规范

配置分三层：

| 层 | 例子 | 存放 | 谁写 |
|---|---|---|---|
| 应用级 | 语言、主题、窗口布局 | 全局设置 | 设置服务 |
| 模块级 | GitHub 默认 API 版本、默认仓库 | 模块配置 | 模块/设置服务 |
| 实例级 | 某个 Connection 的仓库、分支 | 连接配置 | 连接管理 |

规则：

- 配置结构由模块定义，模块负责校验；
- 凭证不进配置，只存 `credential_ref`；
- 配置变更要能触发生效/重连/失效，而不是重启应用；
- 模块不得读取不属于自己的配置段。

## 7. 数据与迁移

- 每个模块声明 `storage_namespace`；表/文件以命名空间区分。
- 迁移文件放 `modules/<name>/migrations/`，命名 `0001_xxx.sql`。
- `platform/store` 汇总迁移并按模块注册顺序执行；迁移记录带模块 ID 与版本。
- 迁移必须显式；不静默改旧数据；破坏性迁移要先备份/可回滚。
- 模块删除时，其数据处置（保留/归档/删除）必须有明确规则，不默认级联删除。

## 8. 测试要求

每个模块至少三类测试：

1. **契约测试**：用 `tools/testkit` 验证能力描述符与执行结果符合公共契约（参数校验、回执形态、错误分类、未知状态）。
2. **单元测试**：参数转换、错误映射、状态转换、边界值。
3. **回放测试**：外部协议用 fixture 回放，不打真实网络。

集成测试放 `apps/` 或 `tests/integration/`，用 fake 平台/服务组装，验证跨模块链路。

## 9. 文档同步规则

- 改公开能力 → 必须同步 `MODULE.md` 能力表 + `module.toml` capabilities。
- 改错误语义/结果未知处理 → 必须同步 `MODULE.md` 失败与证据。
- 改数据/迁移 → 必须同步数据与迁移章节。
- 改已知限制 → 同步限制章节，不能只在 PR 描述里说。
- 不同步视为未完成，CI 可检查 `module.toml` 与代码声明一致性。

## 10. 模块成熟度分级

| 级别 | 特征 | 要求 |
|---|---|---|
| L0 草案 | 只有想法/接口草图 | 不进入主分支 |
| L1 可编译 | 有实现、无完整测试 | 只能内部试用 |
| L2 契约完整 | 有能力声明、契约测试、MODULE.md | 可被 UI/Agent 使用 |
| L3 生产可用 | 有回放、错误处理、证据、限制说明 | 可进入发布 |
| L4 可替换 | 有第二实现或明确替换路径 | 长期维护目标 |

**不要把 L1 说成 L3。** 模块存在、能编译、测试通过、真实服务通过、产品验收通过，是不同状态。
