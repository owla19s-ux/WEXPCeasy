# connections/github｜GitHub 官方 MCP 接入

> Owner：`connections/github`。产品目标见 [A1 功能总表 F05-012](../../docs/A1-正式产品设计/产品功能总表.md)，完整 GH-01～GH-12 行为见 [CONTRACT](CONTRACT.md)，版本签收见 [A2](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。本页是当前施工入口，不以当前实现范围缩减完整目标。

## 职责与实现结构

- 官方能力来源：`upstream/github-mcp-server/` Git submodule，固定上游提交 `99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3`；`npm run setup:github-upstream` 只检出开发源码，不等于已安装可运行 Windows 二进制。官方 Server 不应由 WEX 重写。
- `src/index.ts`：现有 Octokit 文件读写及限定 MCP 文件读取能力、GitHub 专属 target/凭证绑定。当前文件级读取是 UTF-8/1 MiB 的兼容路径，**不是官方工具集的能力上限**。
- `tests/`：专属边界、文件读写和官方集成用例。专属 UI 归 `UI/`；桌面公共设置与实际业务页面归顶层 UI。
- 公共配置、discover/invoke（合入后）、Operation/Receipt 归 [Connections](../README.md)；权限归 permissions、凭证归 shared、可信进程/IPC 归 app、Context 工具引用归 space，模型工具消费归 Conversations/AI，本机 Git 工作树归 Local。

## 当前源码状态（2026-11-08）

| 层次 | main 状态 | 验证与缺口 |
|---|---|---|
| 文件级 Octokit/专用 MCP 路径 | 已有实际源码及调用方 | 保留兼容；真实写入/回读、权限、异常恢复尚需当前 SHA 验收 |
| 官方完整 `tools/list` 和通用 `tools/call` | **当前 main 未确认实现**：读取不到 `connections/github/src/mcp.ts`、`mcp-connections.ts` | [PR #4](https://github.com/owla19s-ux/WEXPCeasy/pull/4) 有 discover/invoke、官方目录及仓库/PR/Actions 只读证据，**PR 证据不能直接标为 main 已合入** |
| 可信桌面任意工具调用 | `app/src/desktop-connections.ts` 当前仅确认文件级动作；未含 `github.tools/github.invoke` | [PR #3](https://github.com/owla19s-ux/WEXPCeasy/pull/3) 有独立双平台与桌面证据，须先确认合并状态及重叠 |
| Context/AI/对话、远端写入、Windows 分发 | 未获得可签收的 main 完整链证据 | 分别验证，不能由 tools/list 成功推定全部功能可用 |

## 继续施工与源码调整

1. **先查最新 main 与 PR #3/#4** 的实际差异、重叠、测试 SHA、上游版本及合并状态；不重复实现已在分支验证的功能，也不误称其已部署。
2. 通用 Adapter 使用 `toolName + 原始 arguments` 和 Schema、content/structuredContent/isError，支持分页目录、连接/凭证绑定、复用/关闭会话、取消及状态不确定；官方工具不逐个重写业务 API。
3. 只在有接口证据时给 Connections 增补通用 discover/invoke；复用既有 configs、授权、Operation、stop，不能另建一套公共权限或账本。
4. 按职责最小拆分 GitHub 源码：MCP 会话/调用、现有文件兼容层、必要 Octokit 补充和凭证绑定；文件名和签名由代码/测试确定，不机械预建目录。旧导出须在调用方迁移和回归通过后才可删除。
5. 验收分别覆盖官方构建/初始化、目录与 Schema、多类真实工具、公共端口、可信 IPC/UI、凭证轮换/撤权、unknown/重启、远端写入回读和 Windows 安装。记录同 SHA CI、真实/模拟来源与未测项。

**本次文档状态：** main 静态核对；没有重跑当前 HEAD 的 CI 或 Windows E4，不对完整 GitHub 模块签收。
