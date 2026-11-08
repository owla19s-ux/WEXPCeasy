# connections/github｜GitHub 官方完整能力接入

> **源码模块施工入口**。产品目标来自 [A1 F05-012](../../docs/A1-正式产品设计/产品功能总表.md)；具体能力/接口及验收依据见 [CONTRACT.md](CONTRACT.md)；版本范围与进度只在 [A2 0.1.1](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md) 判定。本文不单方面将完整目标全部宣布为 0.1.1 必须交付。
>
> **核心目标**：GitHub 官方 MCP Server 提供完整的官方工具能力；WEX 自己编写 GitHub Connector Adapter，通过现有 Connections 公共调用体系供 UI、Conversations、Space/Context、AI 和其他模块复用。**不得将“Octokit SDK 已导入”“单文件读取成功”解释为模块完整。**

## 1. 目录和 owner

| 目录/文件 | 权责 |
| --- | --- |
| `upstream/github-mcp-server/` | **官方完整源码的 Git submodule**，固定官方提交；只作为上游能力来源，不在此重写业务实现 |
| `src/index.ts` 及后续按需拆分源码 | WEX 自己的 GitHub Adapter：连接官方 MCP、工具发现、工具调用、结果转换、连接实例管理 |
| `tests/` | 适配器、官方兼容性、公共 Connections 调用及跨模块回归验证 |
| `UI/` | GitHub 专属设置/操作组件；共享布局及对话 UI 不归此目录 |
| `CONTRACT.md` | **当前正式模块功能与对外接口契约**；含 GH-01～12 的能力锚点 |

上游 GitHub MCP Server 不等于 WEX 自有公共连接层。公共连接配置、受控调用、Operation/Receipt 仍归 [connections](../README.md)；权限规则归 `permissions/`；安装与可信运行宿主归 `app/`；Context 工具组合引用归 `space/`；普通会话工具使用归 `conversations/` 和 `AI/`。本地工作树 Git 操作归 `connections/local/`。

上游来源：[`github/github-mcp-server`](https://github.com/github/github-mcp-server)，当前 Gitlink 固定 `99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3`；MIT 许可证见上游 `LICENSE`。

在仓库根运行 `npm run setup:github-upstream` 获取完整子模块源码并校验提交及关键目录；该命令只完成**开发环境源码检出**，不等于 Windows 可执行文件编译、安装或运行成功。

## 2. 功能目标：完整官方能力，而不是精选文件接口

- **官方工具完整发现**：以固定版本 MCP Server 的 `tools/list`（包括分页、Schema、工具集与配置差异）作为实际可调用能力基线，不把 GH-01～12 或某个常数当成工具总数。
- **通用工具调用**：WEX 适配器用 `toolName + 原始 arguments` 调用官方 `tools/call`，尽量保留官方工具参数/返回结构；不为每个工具单独重写 GitHub API。
- **工具范围**：仓库、文件/Git、Issues、PR、Actions、Projects、组织、通知、讨论、用户、Gists、安全等以官方当前工具目录为准；功能标志替代工具、远程专属工具及权限/部署差异如实记录。
- **账号与运行**：连接实例、凭证引用、MCP 进程/会话、启动/关闭/状态、异常恢复；优先验证本地 Stdio 官方服务，再按实际需要扩展远程 MCP。
- **多处调用**：所有业务入口复用 GitHub Adapter 和 Connections 公共能力，不让 Space/Context/普通对话各写一套 GitHub API；Context 的选择不等于删除全局连接。
- **Octokit 定位**：只有官方 MCP 未覆盖而产品确实需要的 GitHub REST/GraphQL 能力，才作为补足；不把 Octokit 或 MCP SDK 导入视为实现全部 GitHub 功能。

**开发次序**：先保证官方完整工具目录可见、通用 MCP 调用能走通，再接公共 Connections 与多个调用方，最后补专属 UI、稳定性及实际操作验收。不要先以过度收紧的单文件读取规则封死其他官方工具；现有安全与回执边界可以复用，但不应让它们代替能力接入目标。

## 3. 当前事实与缺口（不能当成验收结论）

| 项目 | 仓库已知事实 | 仍须完成 |
| --- | --- | --- |
| 上游完整源码引用 | Git submodule 和固定 SHA 已写入仓库，检出脚本已提供 | 在实际开发/Windows 环境检出、构建、运行验证 |
| SDK/MCP | `src/index.ts` 已使用 `octokit` 和 `@modelcontextprotocol/sdk` | 官方版本兼容及真实多工具 MCP 调用 |
| MCP 调用范围 | `createGitHubMcpFileReader` 当前只使用 `get_file_contents`，每次调用新建 Stdio 进程 | 通用 `listTools/callTool`、工具集管理与会话复用 |
| Octokit | 存在受控文件读写客户端及适配器 | 不能拿两个文件 API 代替完整工具集 |
| Connections 接线 | `app/src/foundations.ts` 已将 GitHub 基础读取/写入装配到 Connections | 跨工具类型通用调用的接口形态与集成测试 |
| 产品入口 | A1 有 Context 工具组合与对话使用方向 | Space/Context、普通对话、设置 UI 真实连接和验收 |

**状态纪律**：既有文件读写的测试不自动签收 PR、Actions、Issues 等工具；Git submodule 完整源码检出不自动签收工具调用；`listTools` 返回完整目录也不自动签收每个工具的实测。已确认的产品目标不能被当前实现范围默默替代。

## 4. AI 施工阅读与执行

1. 先读本 README 和 [CONTRACT](CONTRACT.md)，再读 `src/`、`tests/`、`connections/src/index.ts` 与 `app/src/foundations.ts` 的实际公开接口。
2. 不复制官方 Go 工具业务实现，不引入第二套公共 Connections/Operation，不为每个页面再写 GitHub SDK。
3. 先实现通用官方工具发现和调用，再检查公共接口是否需要最小通用调用扩展；能在 GitHub Adapter 内解决的先在模块内解决。**不得为了迎合现有 read/write 形态删掉官方工具能力**。
4. 当确定需要跨 owner 改接口时，说明证据与最小改动；不自行改变用户确认的产品范围或跨模块职责。施工只改被授权源码/测试；README/CONTRACT 的正式变更由普通对话模式审核。
5. 测试记录需要区分：上游目录存在、MCP 真实运行、工具动态发现、不同工具调用、公共连接接线、UI/AI 使用、远端真实操作。提交 SHA 与对应测试一一对应。

## 5. 直接依赖

- [GitHub 正式契约](CONTRACT.md)
- [公共 Connections](../README.md)
- [GitHub 专属 UI](UI/README.md)
- [A1 产品功能总表 F05-012](../../docs/A1-正式产品设计/产品功能总表.md)
- [A2 0.1.1 版本状态](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)
