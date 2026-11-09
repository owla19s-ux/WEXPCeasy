# connections/github｜GitHub 官方 MCP 接入

> Owner：`connections/github`。产品目标见 [A1 功能总表 F05-012](../../docs/A1-正式产品设计/产品功能总表.md)，完整 GH-01～GH-12 行为见 [CONTRACT](CONTRACT.md)，版本签收见 [A2](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。本页是当前施工入口，不以当前实现范围缩减完整目标。

## 职责与实现结构

- 官方能力来源：`upstream/github-mcp-server/` Git submodule，固定上游提交 `99d6d6503a7b2a133e2f8a595d6d0ba24b4086d3`；`npm run setup:github-upstream` 只检出开发源码，不等于已安装可运行 Windows 二进制。官方 Server 不应由 WEX 重写。
- `src/index.ts`：只做公开导出，保留全部既有工厂和类型。
- `src/mcp-options.ts`：唯一 MCP 运行配置类型；`mcp.ts`：初始化、分页目录、任意调用、身份/哈希校验、逐次凭证解析、会话失效与资源释放。
- `src/mcp-connections.ts`：按 Connection 捕获配置、替换及关闭 MCP Adapter；这是唯一通用会话装配路径，不保存权限或 Operation。
- `src/mcp-file-reader.ts`：既有 v2.1.0、UTF-8/1 MiB、固定提交文件只读兼容路径，保持原行为，不代表通用 MCP 的上限。
- `src/file-target.ts`、`file-adapters.ts`、`official-client.ts`：文件 target、文件兼容适配与 Octokit 补充；`credentials.ts`：凭证引用/绑定，不保管秘密。
- 配置、read/dispatch/discover/invoke、Operation 归 Connections；权限归 permissions；秘密归 shared；可信运行时、Native 与 IPC 归 App；UI 只消费 DesktopBridge。

## 源码与验证边界

通用 MCP 与公共 capability 实现已在施工基线 main 中存在；历史 PR #4 对应核心文件与其 HEAD 相同。此次保留该底座，复用 PR #3 的 App/IPC/UI 手动入口并适配当前签名，未引入旧的 `connection-adapter.ts` 或第二套公共接口。

本地定向回归覆盖分页/Schema、原始参数与 MCP 结果、逐次凭证检查、轮换、撤权、取消、初始化清理、传输失败 unknown、IPC 拒绝伪造字段及 Native 拒绝。Fixture 子进程不是官方服务实测。双平台官方源码构建、仓库/PR/Actions 只读与真实 Electron 用例由 `github-generic-mcp.yml` 单独执行，结果须核对运行 SHA 和产物。

当前 `UI/src/connection-settings.tsx` 有连接与文件交互，`UI/src/github-tools.tsx` 提供通用目录、Schema、JSON 参数和手动调用；需按工具/版本/Operation 分开验收，不把官方工具改写成另一套 WEX API。

未签收：真实远端业务写入/回读、完整官方工具逐项执行、Windows 手工安装验收、正式二进制分发与默认桌面运行时装配、Context 内对话→能力发现/选择→授权→MCP 调用→Operation 回执→原会话显示的完整组合闭环（尚未正式确定版本归属）。原 0.1.1 仍要求基础 GitHub 受控读写、回执以及 Context→Connections 基础调用。工具可见或只读注解均不授予执行权限。

**Context 的 Tool.enabled 与 GitHub 工具可执行是两回事**：Space.tool.add/set/remove 保存局部引用/启用，不代表官方 MCP runtime 在线、工具 Schema 有效、本轮对话被授权或远端动作已成功。真实调用继续经公共 Connections discover/invoke、精确参数授权与 Operation；GitHub 连接器不创建 Context/Conversation 事实，也不逐个重写官方工具。

## 继续施工与源码调整

1. **先查最新 main 与 PR #3/#4** 的实际差异、重叠、测试 SHA、上游版本及合并状态；不重复实现已在分支验证的功能，也不误称其已部署。
2. 通用 Adapter 使用 `toolName + 原始 arguments` 和 Schema、content/structuredContent/isError，支持分页目录、连接/凭证绑定、复用/关闭会话、取消及状态不确定；官方工具不逐个重写业务 API。
3. 只在有接口证据时给 Connections 增补通用 discover/invoke；复用既有 configs、授权、Operation、stop，不能另建一套公共权限或账本。
4. 按职责最小拆分 GitHub 源码：MCP 会话/调用、现有文件兼容层、必要 Octokit 补充和凭证绑定；文件名和签名由代码/测试确定，不机械预建目录。旧导出须在调用方迁移和回归通过后才可删除。
5. 验收分别覆盖官方构建/初始化、目录与 Schema、多类真实工具、公共端口、可信 IPC/UI、凭证轮换/撤权、unknown/重启、远端写入回读和 Windows 安装。记录同 SHA CI、真实/模拟来源与未测项。

本页描述源码能力与验收边界；当前提交测试及 Actions 证据见集成 PR 与 A2，不对完整 GitHub 模块或 Windows E4 签收。
