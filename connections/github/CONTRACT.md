# GitHub 连接器｜GitHub 官方完整能力接入与独立验收（2026-11-01）

状态：**复用评审与移植规格；WEXPCeasy 目前无 GitHub 产品连接器实现**。上位 owner 为 connections；这份文件只细化 GitHub 适配器，不建立另一套 Operation 或授权系统。

## 一、官方能力作为产品实现基线（用户最新决策）

**明确选择：GitHub 官方组件作为功能提供方，WEX 只实现 Connector Adapter。** 不把旧 WEX/WEXPC 自研 GitHub 模块迁移作为首选，更不重写官方已提供的 REST/GraphQL 工具集。

- **首选 AI 工具接口：** [github/github-mcp-server](https://github.com/github/github-mcp-server)，官方 MCP Server。支持远程或本地部署；按工具集暴露 repos、git、pull_requests、issues、actions、projects、orgs、notifications、discussions、security 等公开能力，工具列表以实际版本和权限的发现结果为准。
- **完整 GitHub API 补全：** [octokit/octokit.js](https://github.com/octokit/octokit.js)，官方 JavaScript/TypeScript SDK。其 REST endpoint methods 根据 GitHub OpenAPI 生成，支持 GraphQL；官方 MCP 未暴露的 API 可通过 Octokit 适配。两者都不能保证某一 Token 或部署下拥有所有能力。
- **能力层次：** GitHub 官方 MCP/Octokit → `connections/github` 统一 Capability/Request/Result Adapter → connections Operation/Receipt → permissions 判权 → workflows Task/Verification/Acceptance。两个官方入口不是两份业务账本，也不能绕开同一授权与操作边界。
- **完整覆盖目标：** 不把既有 GH-01～12 当作所有 GitHub 功能清单的上限。基于官方 MCP toolsets 与 REST OpenAPI/GraphQL 能力发现，形成随版本可更新的能力目录；支持分页、请求限流、认证范围、扩展域和接口弃用识别。未暴露/无权限的能力明确展示 unsupported/unauthorized，不自行伪造“已完整支持”。
- **已有旧代码：** WEXPC Rust [github_dispatch.rs](https://github.com/owla19s-ux/wexpc/blob/main/crates/wex-desktop-service/src/connectors/github_dispatch.rs) 和 WEX Flutter GitHub 连接器降为安全案例及既有测试参考，不作为 GitHub API 功能实现基线，不预设 Rust FFI/旧代码移植。
- **本地 Git 分开：** connections/local 管理本地工作树/index/HEAD；GitHub 远端 API 归此连接器。涉及 push、分支、PR、Actions 的真实远端副作用必须按动作授权。
- **许可与集成：** 接入前核对官方项目许可证、版本兼容、远程 MCP 的认证/网络条件，及 WEXPCeasy Electron 主进程的秘密隔离；Renderer 不直连带凭证的 SDK。

## 二、功能和验收映射

| 编号 | 候选能力 | 输入与授权边界 | 必须验证 |
|---|---|---|---|
| GH-01 | 连接与仓库定位 | 凭证引用、owner/repo、权限范围、当前仓库身份 | 授权仓库与请求目标不匹配拒绝，Token 不进入回执 |
| GH-02 | 只读元数据与文件 | 仓库、ref/commit SHA、路径、内容大小限制 | 路径/编码/大小限制、404/403、重定向及 HEAD 漂移 |
| GH-03 | 分支与 HEAD 读取 | 目标分支、当前 ref、预期 SHA | 默认分支可能变化，不依赖旧名称缓存 |
| GH-04 | Commit/文件写入 | 用户确认目标、修改依据、expected SHA/parent、内容或 patch | stale SHA 冲突拒绝；写后断连按远端对象核对，不能盲重提交 |
| GH-05 | 分支创建/更新/删除 | 仓库、ref、预期目标与版本 | 冲突/分支保护/竞态；删除独立授权，不隐式清理 |
| GH-06 | PR 查询/创建/更新/合并 | base/head、PR 目标、批准的合并动作 | 同意图重复提交不产生多个 PR；合并前重查冲突和 CI 证据 |
| GH-07 | GitHub Actions 查询与触发 | workflow/run、分支、授权、预算/实际配置 | 先读 runs 集合；仅当明确需触发且授权时触发；不以 PR 自动断言 CI 已运行 |
| GH-08 | 运行状态与日志观察 | run/job ID 与观察时间 | pending/queued/in_progress/completed 区分；失败日志有真实来源 |
| GH-09 | 结果未知与回执恢复 | Operation ID、意图、远端 commit/PR/ref/run 定位 | timeout/断连/ACK 丢失必须回读；Not Found 单独不证明未执行 |
| GH-10 | 限流/取消/安全与能力声明 | 401/403/404/409/422/429/5xx、重试限制 | 错误分类清楚；限流不绕权限；不可取消的远端副作用不虚报取消 |
| GH-11 | 远端产物与证据引用 | commit SHA、PR、run、文件版本与目标仓库 | workflow Artifact/Verification/Acceptance 自有归属；路径/文本自报不算验证 |
| GH-12 | 适配器版本、配置与卸载 | 连接修订、GitHub API 版本、Capabilities | 更新配置不改在途 Operation；停用阻止新调用不删除历史 |

## 三、官方接入优先实施顺序

G-B1 **官方能力清单**：读取 GitHub MCP Server 当前工具集/工具 schema、Octokit REST/OpenAPI 与 GraphQL 公开范围，形成“官方 MCP 已覆盖 / Octokit 补全 / 受 API 权限或版本限制 / 不可用”能力矩阵。不得将 GH-01～12 当作固定上限。

G-B2 **连接器基础**：支持受信的远程或本地官方 MCP 连接方式、OAuth/PAT/GitHub App 的适用认证路径及受控凭证引用；能力动态发现、只读操作、限流/分页、错误与结果未知、安全授权。Octokit 作为可选补全适配层，共用 connections Operation。

G-B3 **操作功能验收**：按工具组分批验证仓库/Git/Issue/PR/Actions/Projects/Organization/安全等能力。高危写入、删除、管理类操作按权限精确划分，不因官方模块提供就全部放行。真实 Actions 触发前核对现有 runs 和用户授权，避免额度损耗。

G-B4 **完整覆盖与组合验收**：对照官方当前 API/Toolset 能力目录审查缺口；Workflow/Task → GitHub Adapter → Operation/Receipt → 独立 Verification/Acceptance；能力未覆盖、调用未授权、权限不足必须分别报告。

**验收口径：** “完整 GitHub 官方能力接入”表示尽量覆盖官方支持的接口/工具集合并可随官方版本更新，不是保证所有 API 永远可用，更不是 GitHub 认证可绕过。正式产品代码与真实认证/Windows 验收仍未完成。
