# GitHub Connector｜正式模块功能与接口契约

> **当前适用**：`connections/github/` 的产品能力目标、Adapter 边界和验证依据；不表示全部已经实现，也不自动改变 0.1.1 版本范围。
>
> 上位产品要求：[A1 F05-012](../../docs/A1-正式产品设计/产品功能总表.md)；运行说明：[README](README.md)；历史 GH-01～GH-12 保留原编号与含义，不另建一套功能编号。

## 1. 功能基线和实现原则

GitHub **官方 MCP Server 是完整功能提供者**。WEX 维护自己的 Connector Adapter，通过 MCP 标准的工具发现和调用提供完整的官方可用工具集，并把能力交给公共 Connections 与各个 WEX 使用者。保留官方工具名和 Schema，不自行挑选几个文件功能代表 GitHub 模块。上游工具可变，故功能覆盖以实际版本与运行配置的 MCP `tools/list` 为准；`tools/call` 执行工具。Octokit REST/GraphQL 只作为 MCP 覆盖缺口的补充路径，不是主要重写方向。

固定上游：`github/github-mcp-server@99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3`。其 `pkg/github/tools.go` 的 `AllTools()` 静态注册清单包含 **136 个工具构造条目**，其中 **36 个细粒度替代工具**、**1 个 insiders UI 条目**。此计数**不是默认可调用工具数，也不是同时启用后的总数**；远程专属工具组、特性标志、工具过滤、运行权限及官方变更都会影响实际发现结果。无需为这 136 个条目建立 136 个 WEX 函数。

### 官方能力域（实际名称以官方目录为准）

| 能力域 | 应支持的使用方式 |
| --- | --- |
| repos / git | 仓库查询、搜索、文件与目录、分支、Commit、Tags、Releases、仓库操作 |
| issues / pull_requests | 查询、创建、修改、评论、审查、合并以及官方细粒度工具 |
| actions | Workflow/Run/Job 查询、日志、可用的触发操作 |
| projects / discussions / notifications | 查询及官方实际支持的交互操作 |
| users / orgs / context | 当前身份、用户、组织与上下文相关查询 |
| governance / code_quality / code_security / secret_protection / dependabot / security_advisories | 治理、代码质量、安全和依赖等官方可发现能力 |
| gists / labels / stargazers / copilot 等 | 官方工具目录实际暴露的能力及部署差异 |

某些官方公开的 REST/GraphQL API 不在 MCP 工具集中。若产品仍要求对应操作，先记录 MCP 缺口，再通过 Octokit 统一 Adapter 补足，不能伪称 MCP 已拥有全部 GitHub API。

## 2. Adapter 对外能力（建议的实现职责，不冒充已存在的 TypeScript 接口）

| 职责 | 期望行为 | 最低可验证结果 |
| --- | --- | --- |
| `start(connection)` | 建立官方 MCP 会话；可按需启停，不强制每次重新启动 | 能与固定版本官方进程完成协议初始化 |
| `listTools(connection)` | 获取工具名、描述、输入 Schema、注解等；处理分页 | 得到完整当前配置清单，不只 `get_file_contents` |
| `callTool(connection, toolName, arguments)` | 调用任一已发现的官方工具；完整传递对应参数 | 同一通用调用路径能调用文件、PR、Actions 等不同类别 |
| `status(connection)` | 报告进程、会话、能力发现和最近观察状态 | 区分未启动、已连接、错误、工具不可用 |
| `stop(connection)` | 关闭会话与运行资源 | 关闭后无残留可调用会话 |

上述名称是**职责示意**，正式函数签名以实现和测试确认；不得先为了管理文档而生成空的接口/文件层级。工具结果要保留 MCP `content`、`structuredContent`、`isError` 等已支持字段，而非只接受某种固定文件返回形状。

### 接入现有公共 Connections 的路径

`connections/src/index.ts` 当前公开 `ConnectionConfig`、`ConfiguredReadAdapter`、`ConfiguredDispatchAdapter`、`createConnectionService`、`OperationLedger` 等。已具备连接配置、受控读写、Operation 和关闭收口，不应重建第二套连接系统。

当前局限：`ConnectionService` 主要按 `read/dispatch`、`target` 和 `read/write` 形态调用；官方 MCP 是多工具、动态 Schema 的通用调用模型。**先实施 GitHub 模块内的通用发现/调用适配并验证**，再决定是否在 Connections 增加一条最小的通用 Capability invoke 公开入口。不得把 PR、Actions、Issues 等操作强行压成“文件读取”或通过删除工具解决接口不匹配。

对跨模块调用方公开的是 **Connection + Capability（工具）引用及调用结果**，不是官方进程、SDK 对象或凭证。Space/Context 负责工具选择和关联，Conversations/AI 负责会话候选及 AI 调用，UI 负责呈现和触发；它们不得直接 import GitHub Adapter 的私有实现。

## 3. GH-01～GH-12 原有功能锚点（保留，不作为完整工具数量上限）

| 编号 | 功能域 | 具体操作/行为 | 验收核心 |
| --- | --- | --- | --- |
| GH-01 | 连接与仓库定位 | 配置连接、凭证引用、仓库身份和可用性查询 | 能建立真实连接并定位目标仓库 |
| GH-02 | 仓库及文件读取 | 元数据、文件内容、目录等已发现读取工具 | 不限于某个固定 UTF-8 文件调用 |
| GH-03 | 分支/HEAD/Commit 查询 | 分支、ref、SHA、Commit 等读取 | 返回真实定位和版本 |
| GH-04 | 文件写入和 Commit | 创建/修改文件、推送及相应提交操作 | 真实远端写入与结果引用可核对 |
| GH-05 | 分支管理 | 创建、更新、删除等官方支持的分支操作 | 返回对应分支与结果 |
| GH-06 | PR | 列表、查询、创建、修改、评论、审查、合并 | 同一通用调用入口覆盖 PR 不同动作 |
| GH-07 | Actions 操作 | 列出 workflow/run、查询与官方可用触发 | 能得到真实 runs 并调用相应动作 |
| GH-08 | Actions 观察 | Job、状态、日志与官方可用证据 | 观察数据来自真实 GitHub 结果 |
| GH-09 | 结果和回执 | 操作 ID、外部定位与实际结果观察 | 复用 Connections 的 Operation，不自建账本 |
| GH-10 | 工具可用性与错误 | 不支持、认证不足、网络/调用错误、取消等 | 不因工具名存在而谎报执行成功 |
| GH-11 | 远端证据引用 | commit、PR、run、文件版本等远端标识 | 结果可交给其它模块关联 |
| GH-12 | 适配器配置/版本/生命周期 | 上游版本、工具集、连接实例、启停/升级 | 更新和状态可查询，不混淆源码与运行服务 |

官方工具覆盖还包括 Issues、Projects、Discussions、Notifications、Organization、Security、Gists、Labels、Copilot 等，不得因未出现在 GH-01～GH-12 的名称里而遗漏。**GH 编号标识产品能力域，官方 `tools/list` 标识实际工具条目。**

## 4. 模块之间的调用责任

| 消费者 | 提供或保存什么 | GitHub 模块负责什么 |
| --- | --- | --- |
| Connections | Connection 配置、公共调用接口、Operation | 实现协议适配、暴露 GitHub capabilities，不复制账本 |
| App | 安装与运行宿主、装配及可信 IPC | 提供进程/会话适配，宿主负责实际运行入口 |
| Space/Context | `SPACE-TOOL-001～003` 工具选择、局部引用与可用集合 | 提供可选择的官方能力，不拥有 Context 关系 |
| Conversations/AI | 普通对话或 Context 对话的工具候选与调用 | 接收经过公共调用入口的请求并返回官方结果 |
| UI | 连接器设置、Context 工具勾选、对话开关及结果呈现 | 提供状态/能力描述；不强制每个官方工具有专属页面 |
| Local | 本地 Git 工作树/文件操作 | 只负责 GitHub 远端 API，避免双重 Owner |

## 5. 实际实施与测试顺序（开发阶段以能力跑通优先）

1. **上游**：完成子模块检出、固定版本官方 Server 运行和协议握手；核查上游运行配置与当前客户端的版本假设是否一致。
2. **全量发现**：`tools/list` 翻页取完工具，观察 `--toolsets=all` 等配置下的实际工具数量/Schema，清楚记录受配置影响的差异。
3. **通用调用**：通过同一 `callTool` 适配调用至少三类差异明显的官方工具（仓库读取、PR、Actions 等）；写操作可先使用模拟 Server/隔离测试仓库。
4. **公共接线**：由 `app/src/foundations.ts` 等宿主装配并通过 Connections 公开端口被不同模块调用；仅在已证实必要时最小调整公共协议。
5. **多入口**：Context 工具勾选、普通对话工具选择、设置中的连接实例与实际调用分别验证，不能用某个 UI 开关代替调用成功。
6. **完整覆盖检查**：比较 `tools/list` 与 Adapter 可调用集合，工具新增不要求每个都重新手写 API；缺口、条件限制、未实测必须单独列出。

**测试状态不可互相代替**：上游源码已引用 ≠ 官方进程已运行 ≠ 工具全量发现 ≠ 通用调用可用 ≠ UI/AI 已接入 ≠ GitHub 真实操作验收。

## 6. 当前源码现状（文档不宣称完成）

- `connections/github/src/index.ts` 现有 Octokit 文件读写和 `createGitHubMcpFileReader` 单文件只读适配；MCP 启动参数固定只开放 `get_file_contents`。
- MCP 测试主要基于模拟子进程、固定文件返回形状、版本与拒绝行为；没有证明完整官方工具可用。
- `app/src/foundations.ts` 装配的 GitHub 官方路径仍是现有读取/文件写入接口，尚无全工具通用调用端口。
- 上游源码已作为 submodule 被引用并有检出脚本，**Windows 构建与分发、官方多工具调用、真实运行兼容与产品入口验收仍未完成**。

施工以 [README](README.md) → 本契约 → 源码和测试为最短阅读路径；版本排期及签收以 A2 为准，不能以本契约全文代替版本范围决策。
