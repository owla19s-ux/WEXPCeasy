# connections/github｜GitHub 官方完整能力接入

## 2026-11-08｜main 复核：官方 MCP 通用接入与 PR 证据须分离

> **本节覆盖下文较早的“当前事实”描述，但不取消 GH-01～12 长期目标或既有实施方案。** 本轮以 `main@e9ff10c81dc4` 核对，属于静态代码/提交审查，未执行本 SHA 的完整 CI 或 Windows 实机测试。

- **主分支可确认**：`connections/github/src/index.ts` 提供现有受控 GitHub 文件适配；`app/src/desktop-connections.ts` 的已核实请求白名单为 `github.create`、`github.read`、`github.write` 等文件级动作，尚不含 `github.tools/github.invoke`。因此桌面通用官方工具目录与调用**不得标为 main 已交付**。
- **PR 验证证据（不等于已合入）**：[PR #4](https://github.com/owla19s-ux/WEXPCeasy/pull/4) 记录了公共 `discover/invoke`、官方 MCP 工具发现、仓库/PR/Actions 实际只读调用和 Operation 回执；[PR #3](https://github.com/owla19s-ux/WEXPCeasy/pull/3) 记录了可信宿主、桌面工具选择/调用及双平台验证。它们有各自的测试 SHA 和 Actions 证据，**必须先查 PR 合并状态与最新 main 路径，再移植或继续施工**；不得把 PR 的绿色结果直接登记为 main 的 B1/B3 签收。
- **当前可执行下一步**：先核对两 PR 的合并、重叠与冲突及固定上游版本，再按已有测试选择最小可复用实现；合入后核验 `connections/src/capabilities.ts`、GitHub MCP 会话适配、App 可信 IPC、UI 消费端的实际文件和同 SHA 测试。仍须覆盖正式打包分发、实际远端写入/回读、Context/对话消费及 Windows 实机。
- **旧路径迁移**：现有 Octokit 文件操作仍属有效兼容路径；仅在新通道已接线、旧调用方迁移和回归通过后才删除。不可用单文件限制替代官方完整工具能力。



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

## 6. 研究复核：通用调用通道与旧适配迁移（2026-11-08）

本节依据官方 `pkg/github/tools.go`、`docs/server-configuration.md`、MCP 客户端协议以及 WEX 现有 `connections/src/config.ts`、`configured-read.ts`、`configured-dispatch.ts`、`service.ts`、`app/src/foundations.ts`、`tests/live-official-components.mjs` 核对；**属于有明确源码依据的施工设计，真实全工具运行和 Windows 产品接线仍未实测，不能标记为完成。**

**确认的技术判断**：已有 Connections 的 Config/Operation/停止收口不需要重造；其公开端口目前是 `read` 和 `dispatch`，不能自然表达 MCP 的任意 `toolName + arguments`。下一步在复用现有生命周期和回执实现的前提下，优先尝试**最小通用工具调用入口**（例如 `discover/invoke`，名称与签名须由实现及测试确定），而不是把一百多种工具塞入单文件 `target` 或挨个重写业务 API。开发期优先证实所有已发现工具可以经过统一调用路径；产品发布阶段的细分策略不作为本次打通的前置。

**旧实现迁移**：保留 `@modelcontextprotocol/sdk`（现有 v1 客户端基础）、官方上游模块和有价值的回归用例；以通用 MCP Adapter 替换 `createGitHubMcpFileReader` 的单文件专用业务路径；`createGitHubFileReader` / `createGitHubFileAdapter` / `createGitHubOfficialClientFactory` 的去留以缺口核对为准。**先迁移 `app/src/foundations.ts` 和消费端并通过测试，再删旧导出，禁止直接删除导致旧调用方断裂。**

**已发现版本差异**：当前 WEX 用 `@modelcontextprotocol/sdk@1.26.0`，已有只读实测使用官方 Server v2.1.0；本仓最新引入的官方上游源码提交不等于已编译/运行的 v2.1.0 二进制，当前专用读取器还硬编码 `mcpVersion='2.1.0'`。须先用固定源码构建出的可执行文件跑初始化、`tools/list` 和 `tools/call`；不宜直接将硬编码版本比较延续到通用 Adapter。MCP TypeScript SDK v2 已有独立客户端包，但**本次并不要求先升级 SDK**；先验证现有 SDK 的实际兼容性。

**最小可验顺序**：官方源码检出与构建 → `--toolsets=all` 下完整 `tools/list`（含分页/Schema）→ 同一通用 `tools/call` 接口测试仓库、PR、Actions 等不同类别 → 经 Connections 公共调用入口触发 → 切换宿主装配 → 删除冗余专用路径。工具因账号权限不可执行与 Adapter 根本无法转发是两种不同结果。

详细接口映射和未决运行事项见 [CONTRACT 第 7 节](CONTRACT.md#7-通用-mcp-adapter-实施映射与验证界限)。

## 7. 模块完整评估后的调整方案（2026-11-08，待源码施工）

> **状态与授权**：本节是只读源码、A1/A2 和测试文件核对形成的**拟实施方案**，不代表已实施或已运行通过；本次仅更新 README，不修改源码、CONTRACT、A1/A2 或运行 CI。是否纳入当前版本，以 A2 已批准范围为准；GH-01～12 的长期完整目标不能因本版较小而删除。执行前重新核对最新 main 及已发生的变更，避免重复施工。本节与第 6 节、CONTRACT 第 7 节相互补充，不另建第二套契约。

### 7.1 总评及功能差距

**结论：保留现有 GitHub 模块及 Connections 基座，补齐官方 MCP 通用 Adapter，定向拆分源码和迁移调用方；禁止推翻重写。** 现有 Octokit 文件读写、SDK/MCP 依赖、上游 submodule、权限/凭证绑定、公共 Operation、文件级独立测试均有价值。当前官方工具完整发现、任意工具调用及多个消费入口的实际闭环**未实现或未获实测证据**。

| 产品锚点 | 静态源码核对结果 | 仍需补齐或证明 |
| --- | --- | --- |
| GH-01/02 连接及仓库文件 | 配置、凭证引用、限定 UTF-8 文件读取已有实现和测试 | 仓库元数据、目录及不同资源的通用工具可访问性 |
| GH-03/05 分支、HEAD、Commit | 现有文件目标含 ref/SHA；无通用 Git 操作入口 | 通过官方工具发现、查询及可用操作 |
| GH-04 文件写入 | Octokit expected-SHA 的 put/Commit 路径、冲突与防重放测试存在 | 新通道兼容、远端写入/回读及回执实测 |
| GH-06 PR、GH-07/08 Actions | 官方能力目标已列于契约，现有产品 Adapter 尚无通用执行入口 | 同一通道发现并调用 PR、Actions 等工具，含日志/运行结果 |
| GH-09/11 回执与证据 | 文件写入复用公共 Operation，保留文件/Commit SHA | 任意工具的结果保真、外部引用、未知结果与查询 |
| GH-10/12 错误、版本及生命周期 | 文件调用有取消/撤权/超时；MCP 每次读取新进程且硬编码 2.1.0 | 多工具状态、版本兼容、会话启动/复用/关闭及断连处理 |
| Issues、Projects、Discussions、Notifications、Security 等 | 属官方工具目录覆盖目标，不能按文件操作成功认定实现 | 以实际运行的 tools/list、工具集及 Schema 统计可转发覆盖率 |

状态口径：**“代码和测试存在”不等于“本轮测试通过”；“上游提供”不等于“WEX 已接入”；“适配可转发”不等于“账号有权执行”；“可被调用”不等于“UI/AI 已连通”。** 当前部分能力为部分实现，完整通用调用尚未实现，真实全工具与 Windows 验收仍待验证。

### 7.2 代码职责和拆分边界

- `src/index.ts` 现混有文件目标解析、Octokit 读写与工厂、MCP Stdio 会话/发现/限定调用、凭证引用与取消/异常处理；按**独立职责及测试影响**定向拆分，不按文件长度或美观机械建目录。
- **优先候选**：`src/mcp.ts`（通用会话、tools/list、tools/call、资源清理）、`src/files.ts`（现有文件专用兼容接口）、`src/credentials.ts`（GitHub 专属凭证引用/连接绑定）、`src/octokit.ts`（必要 REST 补充）；`src/index.ts` 保留清晰公开出口。文件名是候选而非冻结签名；不产生空文件、重复抽象或 100+ 工具专属实现。
- `createGitHubMcpFileReader` 现固定 `--tools=get_file_contents --read-only`、精确 Commit 的文件目标、返回形状和每调用一个 Stdio 进程。它只能作为旧专用读取路径，**不能用它的 UTF-8/1 MiB、文件 ref 和返回规则作为通用 MCP 工具上限**。
- `createGitHubFileAdapter`、`createGitHubFileReader` 和 `createGitHubOfficialClientFactory` 已有调用方与回归测试；先保留。MCP 通用路径与公共接线跑通后，依据**实际未覆盖的 REST/GraphQL 能力与调用方迁移证据**决定保留、兼容封装或删除，不先移除 Octokit。
- 不改写官方 Go Server，也不创建第二套配置、权限、Operation、GitHub 服务总管；GitHub 负责协议和能力，Connections 负责配置、公共调用和账本，App 负责可信进程/IPC，Space 保存工具选择关联，Conversations/AI 负责会话中的工具使用，本地 Git 工作树归 Local。

### 7.3 通用调用与公共层的最小调整

1. **GitHub 内先验证**：固定上游真实二进制 initialize；完整翻页的 `tools/list`（工具名、描述、inputSchema、注解），`tools/call(name, arguments)` 适用于所有已发现工具；保留 MCP 的 `content`、`structuredContent`、`isError` 等真实结果，不强行压缩成文件文本。记录工具集、只读标志、服务版本和能力差异；以运行结果为准，不能硬编码工具总数。
2. **会话生命周期**：验证 Connection/凭证/运行配置绑定、启动、按需复用、断连恢复和关闭；撤权和取消要阻止后续未授权派发，但本地进程终止不能虚称外部副作用回滚。不要将现有 `mcpVersion='2.1.0'` 的精确版本假设直接照搬；先核实固定上游与现有 SDK v1 的实际兼容性，只有实测需要才考虑 SDK 升级。
3. **Connections 只作必要扩展**：现有 `configs/operations/read/dispatch` 及生命周期不取消。若现有 target/read/write 不适合任意 `toolName + arguments`，以独立测试为证据增补**少量通用 capability 发现/调用端口**（如 discover/invoke，实际名称和 TypeScript 签名以实验为准），不可把所有官方工具强塞文件 target，不逐工具另建公共路由。
4. **权限和结果边界**：发现、可用、授权、派发、外部观察分开；复用 Permissions 和 Operation，保留失败、取消、unknown、真实副作用证据。不因重试、重发、重连或取消而自动重复 GitHub 写入。公共调用不能绕过可信授权入口或把凭证交给 Renderer/模型。
5. **正式调用方接线**：`app/src/foundations.ts` 负责统一装配；`app/src/desktop-connections.ts` 与 `UI/src/connection-settings.tsx` 已有 `github.create/read/write` 文件入口，可保留为阶段性 UI，但不应对每个官方工具增加一个 App 专用业务分支。后续由 Conversations、AI、Space/Context、UI 经 Connections 公共能力接口复用同一 GitHub Adapter。无需给每个工具开发专属页面。

### 7.4 连续施工顺序和退出条件

1. **模块内部能力**：先运行现有独立测试并记录真实基线；核验官方 submodule 对应版本的构建、MCP 初始化、不同工具集下完整发现；同一通用接口调用至少仓库/PR/Actions 三类不同工具，读与写按账号能力分开验证。
2. **公共层接线**：在 GitHub 内验证调用形态后，提出有源码/测试证据的最小 Connections 改动；继续复用既有账本、权限、连接配置和停机排空。公共接口修改属于跨 owner 较高风险，需先确认明确施工授权范围，不以本 README 自动授权改动。
3. **兼容迁移**：先添加新实现，兼容旧文件操作，再迁移 App/消费端，执行原文件读写、冲突、unknown、撤权、恢复回归。只有**所有已知调用方已迁移且实测无不可替代缺口**，才删除对应旧导出和冗余代码。
4. **验收收口**：记录独立单测、跨模块测试、真实/模拟工具结果、Windows 安装及重启恢复；覆盖分页/Schema、不同工具、凭证隔离、版本不兼容、取消、断连、结果未知、停止时在途资源、远端回读。先查 Actions 总运行列表与 SHA，避免盲目触发；没有真实调用或 Windows 证据时明确标“未验证”。测试与源码回执完成后，由文档维护方同步 README/CONTRACT 的实现事实及 A2 状态，避免文档先行宣称验收。

**高风险变更**：Connections 公开端口、会话复用与授权、旧路径移除、Windows 进程和远端写副作用。**一般变更**：模块内部职责拆分、接口整理、测试及文档状态修订。任何公共层调整须以实证为前提，禁止因 GitHub 单模块需求而重构整个 WEX。
