> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 05 — 完整案例：新增 GitHub Issue 能力

> 用一个真实功能走完新写法，验证“新增功能尽量局部完成”是否成立。案例只描述代码结构与改动面，不涉及具体 GitHub API 版本细节。

## 1. 目标

在已有 GitHub 模块上增加两个能力：

- `github.issue.list`：列出仓库 Issue（只读）
- `github.issue.create`：创建 Issue（有副作用）

要求：

- 不改公共调用管线、权限、账本、组合根的业务代码；
- UI 能自动看到新能力（如果 UI 由能力声明驱动）；
- 有契约测试、单元测试、回放测试；
- `MODULE.md` / `module.toml` 同步。

## 2. 旧写法会怎样（反例）

```text
1. 中央工具枚举加 GithubIssueList / GithubIssueCreate
2. 中央 dispatch 加 match 分支
3. 中央权限表加 github_issue 权限
4. 中央 HTTP 客户端加 issue 请求方法
5. 中央错误码表加 issue 错误
6. UI 工具列表手写两项
7. 设置面板加开关
8. 测试加在根 tests/，依赖真实 token
```

结果：一个功能散落在 8 个位置，任何一个位置的维护者都不知道全貌；新增第二个连接器时，同样的 8 处再改一遍。

## 3. 新写法：改动清单

### 3.1 能力声明

文件：`modules/github/src/capabilities.rs`

```rust
CapabilityDescriptor {
    id: "github.issue.list",
    title: "列出 Issue",
    description: "读取指定仓库的 Issue 列表（只读）",
    params_schema: schema! { repo: string, state: enum[open, closed, all]?, limit: int? },
    resource_kinds: vec![ResourceKind::RemoteRepository],
    side_effect: SideEffect::None,
    approval: ApprovalClass::Auto,
    idempotency: Idempotency::Inherent,
    timeout_ms: Some(30_000),
    evidence: EvidenceSpec::None,
    required_scopes: vec![ScopeRef::GitHubRepoRead],
    availability: Availability::Runtime,
}

CapabilityDescriptor {
    id: "github.issue.create",
    title: "创建 Issue",
    description: "在指定仓库创建 Issue（有副作用）",
    params_schema: schema! { repo: string, title: string, body: string?, labels: string[]? },
    resource_kinds: vec![ResourceKind::RemoteRepository],
    side_effect: SideEffect::Guaranteed,
    approval: ApprovalClass::Ask,
    idempotency: Idempotency::KeyRequired,
    timeout_ms: Some(60_000),
    evidence: EvidenceSpec::ExternalId("issue_number"),
    required_scopes: vec![ScopeRef::GitHubRepoWrite],
    availability: Availability::Runtime,
}
```

要点：

- `side_effect` 与 `approval` 是声明，不是授权；
- `idempotency` 声明写操作需要幂等键，防止重复创建；
- `evidence` 声明成功后应留下 issue number。

### 3.2 实现

文件：`modules/github/src/actions/issues.rs`

```rust
pub(crate) async fn list_issues(
    ctx: &GithubContext,
    params: ListIssuesParams,
) -> Result<Vec<IssueSummary>, GithubError> {
    let repo = ctx.resolve_repo(&params.repo)?;
    let token = ctx.credentials()?;           // 只拿引用解析后的凭证
    let page = ctx.api().issues(&repo, params.state, params.limit).await?;
    Ok(page.into_iter().map(Into::into).collect())
}

pub(crate) async fn create_issue(
    ctx: &GithubContext,
    params: CreateIssueParams,
    idempotency_key: &str,
) -> Result<CreatedIssue, GithubError> {
    ctx.ensure_not_duplicated(idempotency_key)?;  // 或由公共账本保证
    let token = ctx.credentials()?;
    let issue = ctx.api().create_issue(&params, token).await?;
    Ok(CreatedIssue { number: issue.number, url: issue.url })
}
```

要点：

- 凭证来自 `secrets`，模块只拿引用；
- 错误在 `errors.rs` 统一映射；
- 写操作使用幂等键，或由公共账本保证不重复；
- 不在 action 里做权限判断（由管线做），也不在 action 里写账本（由管线做）。

### 3.3 错误映射

文件：`modules/github/src/errors.rs`

```rust
pub(crate) fn map_error(err: GithubApiError) -> ErrorClass {
    match err {
        GithubApiError::Unauthorized => ErrorClass::Unauthorized,
        GithubApiError::Forbidden => ErrorClass::Forbidden,
        GithubApiError::NotFound => ErrorClass::NotFound,
        GithubApiError::RateLimited { .. } => ErrorClass::RateLimited,
        GithubApiError::Timeout => ErrorClass::Timeout,
        GithubApiError::Server { .. } => ErrorClass::Unavailable,
        GithubApiError::BadRequest => ErrorClass::InvalidInput,
        GithubApiError::Unknown => ErrorClass::Internal,
    }
}
```

对写操作特别注意：如果请求已发出但没拿到响应（超时/断网），必须返回 `OutcomeUnknown`，而不是 `Timeout` 后自动重试。

### 3.4 测试

文件：`modules/github/tests/contract.rs`

```rust
#[test]
fn issue_capabilities_follow_contract() {
    let descriptors = GithubModule::descriptors();
    testkit::assert_contract(&descriptors);
}
```

文件：`modules/github/tests/actions_issues.rs`

```rust
#[tokio::test]
async fn create_issue_maps_response() {
    let fake = FakeGithub::new().expect_create_issue(Ok(issue(42)));
    let ctx = fake.context();
    let result = create_issue(&ctx, params(), "idem-1").await.unwrap();
    assert_eq!(result.number, 42);
}

#[tokio::test]
async fn create_issue_timeout_is_unknown() {
    let fake = FakeGithub::new().timeout_after_send();
    let result = create_issue(&fake.context(), params(), "idem-1").await;
    assert!(matches!(result, Err(GithubError::OutcomeUnknown { .. })));
}
```

文件：`modules/github/tests/fixtures/issues/*.json`

### 3.5 文档同步

`modules/github/MODULE.md`：

```markdown
## 3. 公开能力
| 能力 ID | 说明 | 副作用 | 审批 | 幂等 |
|---|---|---|---|---|
| github.repo.read | ... | 无 | 自动 | 天然 |
| github.issue.list | 列出 Issue | 无 | 自动 | 天然 |
| github.issue.create | 创建 Issue | 一定 | 询问 | 需幂等键 |
```

`modules/github/module.toml`：

```toml
capabilities = [
  "github.repo.read",
  "github.file.read",
  "github.file.write",
  "github.issue.list",
  "github.issue.create",
]
```

### 3.6 UI

如果 UI 的工具列表由 registry 的 descriptor 生成，则**无需改 UI**。

如果 UI 是手写的，需要改一处——但这是 UI 的债务，不是后端架构成败。下一步应该把 UI 改为 descriptor 驱动，而不是在每个新功能时继续手写。

## 4. 验收标准

| 项 | 标准 |
|---|---|
| 改动面 | 模块外 ≤2 个文件（模块索引/能力清单自动生成则 0） |
| 公共机制 | `invoke`/`policy`/`ledger`/`store` 零改动 |
| 组合根 | `apps/desktop` 零改动（分布式注册）或 1 行 |
| 契约测试 | `cargo test -p github --test contract` 通过 |
| 回放测试 | 不依赖真实网络/凭证 |
| 文档 | `MODULE.md` 与 `module.toml` 同步 |
| 权限 | 写操作默认需要审批；只读默认自动；撤销后失效 |
| 证据 | 创建成功后回执含 issue number |

## 5. 常见错误

1. **在 action 里判断“用户有没有权限”**：错。权限在管线。
2. **在 action 里写账本**：错。账本是公共机制。
3. **把 GitHub 错误码塞进公共错误类型**：错。公共只收统一分类。
4. **把 token 放进参数**：错。凭证只走 `secrets` + 引用。
5. **超时后自动重试创建 Issue**：错。进入 `OutcomeUnknown`，由用户/策略决定。
6. **UI 手写能力列表**：会导致“后端加了、UI 看不到”，应改为 descriptor 驱动。
7. **在能力声明里写权限规则**：声明只表达“需要什么范围”，不表达“谁能用”。

## 6. 这个案例证明了什么

- 功能可以局部完成，前提是 **能力声明 + 注册 + 管线** 三件事到位；
- 公共机制不需要知道 GitHub；
- UI 是否局部，取决于 UI 是否由声明驱动；
- 真正的成本不在写 action，而在**把声明、测试、文档、错误语义做完整**；
- 如果这个案例需要改 5 个以上模块外文件，说明架构还没准备好，不要继续加功能，先修边界。
