# connections/github

## 官方组件、模块边界与当前版本（2026-11-07）

本目录是独立 GitHub **远端 API** 连接器，不负责 `connections/local/` 的本地 Git，也不是 [environments](../../environments/README.md) 环境管理器。现有 `src/index.ts` 已实际导入 `octokit` 与 `@modelcontextprotocol/sdk`，提供受控 Octokit 客户端工厂、MCP Stdio 读取适配及有限的 GitHub 文件读写；`app/src/foundations.ts` 已有官方模式的装配分支，`tests/official-client.test.mjs` 与 `tests/mcp-client.test.mjs` 有 SDK/模拟 MCP 进程测试。**因此官方 SDK/MCP 基础代码已经接入；但不能将其等同于完整 GitHub MCP Server 工具集、真实远端写入/分发及 GH-01～GH-12 的整体产品验收。**

`CONTRACT.md` 的 GH-01～GH-12 及更广泛官方覆盖描述属于完整目标及历史研究规格，其“无产品 GitHub 代码”是历史快照。**历史验收细则**：[B3 D-06/D-06A](../../docs/A2-版本与工程状态/0.1.1/历史任务记录/B3-2026-11-07.md)；**当前版本状态入口**：[A2 0.1.1 总表](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)；先核验许可证、官方版本、依赖与运行/分发，再按 M-01 检验连接器 owner 隔离。GitHub MCP 的协议/运行适配归本模块；App 仅负责宿主装配，不能复制 GitHub 协议、凭证或 Operation 账本。0.1.1 必需能力与长期完整官方工具覆盖分别验收。

> **当前代码事实（2026-11-07，`main bd72dfea`）**：`connections/github/src/index.ts` 已存在，`tests/` 下有文件、客户端访问及真实读写测试入口；最新 SHA 的 **GitHub official SDK read acceptance** 工作流成功。仅说明对应读取验收成功，不等于已验收真实写入、官方 MCP Server 完整工具集或 GH-01～GH-12 全覆盖。

GitHub 操作与连接配置。权限使用共用机制；专属面板留在本模块。

状态：已有基础 GitHub 适配代码、真实 Octokit/MCP SDK 导入、受控读取/写入适配及独立测试；**完整官方工具覆盖、受信二进制运行/版本校验、Windows 分发、真实远端写入与回执恢复**仍须依 B3 D-06 逐项核验。0.1.1 必需的基础读写与长期广泛 API 覆盖分别判断；GitHub 专项不阻塞无关 UI。

[源码目录与 Windows 数据要求](../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。

## 官方完整模块源码归位（上游依赖，不等于已经接通）

- **上游源码位置**：[`upstream/github-mcp-server/`](upstream/github-mcp-server/) 是官方 `github/github-mcp-server` 的 **Git submodule**，完整源码仍由 GitHub 官方维护；WEX 不复制、不改写其中的 GitHub 业务实现。
- **当前固定上游提交**：`99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3`。更新版本先审查官方变更、许可证、工具集 Schema、认证和兼容测试，再调整 submodule 指针；禁止自动跟踪不固定的 main。
- **本地获取完整源码**：在仓库根运行 `npm run setup:github-upstream`（等价于固定提交的递归子模块检出并核对）。普通 GitHub 网页与不递归的 checkout 只展示 Gitlink/提交引用，不会把整个上游源文件复制进当前 Git 仓库；首次检出需要能够访问 `github.com`。
- **完整性核对**：检出后检查子模块 HEAD 与固定提交一致，并确认官方 `go.mod`、`LICENSE`、`cmd/github-mcp-server/main.go`、`pkg/` 和 `internal/` 存在。当前运行环境未执行网络检出，不能虚报完整源码已经在所有开发环境落盘。
- **WEX 自有代码位置**：`connections/github/src/` 仅维护 MCP 客户端、GitHub Connector Adapter、能力发现/映射及受控调用；`connections/src/` 管 Connection/Operation，`permissions/` 管授权，`app/` 管宿主与 IPC。不得把第三方上游源码改造成 WEX 公共连接层。
- **构建与分发**：当前仅归位源代码引用，**不包含编译好的 Windows 可执行文件，也未设置安装、更新或打包流程**。后续按官方 Go 构建要求或经校验的官方 Release 二进制处理，运行路径及签名/哈希校验归可信安装路径，Renderer 不得启动任意命令。
- **交付状态警告**：源码归位 ≠ MCP 全工具接通；现有 `src/index.ts` 仍只允许 `get_file_contents` 的只读 MCP 路径，Octokit 仅有少量文件 API。完整官方能力动态发现、适配、审批、对话/Context/UI 使用与真实操作验收尚未完成，不能将本项登记为“GitHub 完整功能已实现”。

## 官方 GitHub 能力连接与验收

- [GitHub 官方 MCP + Octokit 完整能力接入契约](CONTRACT.md)（GH-01～GH-12）。官方 GitHub MCP Server 为首选，Octokit REST/GraphQL 补充能力缺口；WEX 只做受控连接器，不重写 GitHub API。旧 WEX/WEXPC 源码仅作测试与安全参考。

## 直接依赖与施工入口

- [Connections 宿主](../README.md)：公共配置、派发、Operation 与回执归属。
- [GitHub 模块 CONTRACT](CONTRACT.md)：核对该连接器特有的目标行为与未完成项，不能把长期清单视为全部已交付。

本子模块不承担研究及版本资料的全局导航。

## G1/G4：远端资源引用与操作回执

GitHub 仓库、分支、提交、PR 和文件均按远端对象身份/版本观察引用；名称、URL 或默认分支不能替代当前修订核对。每次写操作由 Connections 宿主记录 Operation/attempt，回读远端结果后再报告；提交请求超时或回执缺失时先查询原 Operation/远端事实，不盲目创建第二次提交、PR 或分支。

