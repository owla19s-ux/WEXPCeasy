# WEXPCeasy｜第四轮：模块文档与真实源码入口定向对照（2026-11-07）

> 文档专项治理回执。此处仅记录本轮从 GitHub `main` 直接读取的源码/文档与确定性修复，不是 0.1.1 业务功能正式验收，也不是最新 HEAD 全仓执行测试。审查开始时远端最近提交 `d00859adb74b402d02f14334b58174f738bea9a8`。

## 1. 本轮读取的源码证据

| 领域 | 实际读取入口 | 本轮能够证实 | 不得推断 |
| --- | --- | --- | --- |
| Space | `space/src/index.ts`、`space/src/service.ts` | `openSpaceService`、`SpaceService`、`SpaceCommand`、`SpaceQuery`、`Category/Space/Group/Context` 类型及服务存在，写路径经过 PermissionReader 并用 intent/修订核对 | Placement 是正式产品实体；S01–S20 已验收 |
| API | `connections/api/src/index.ts`、`service.ts` | 配置服务、Provider transport、SSE 响应/流解析、工具提议/续接与准备公开类型存在；服务具有 scope 鉴权与修订核对 | 所有 Provider 可用、真实发送和所有高级能力 E3/E4 通过 |
| Connections | `connections/src/index.ts` | read、dispatch、configured read/dispatch、Operation ledger、配置及公开 service 出口存在 | 各外部连接器全覆盖或回执均可证实 |
| AI | `AI/src/index.ts` | role、position、agent 配置的模型引用、持久化校验与历史回执机制存在 | 内置自主 Agent 循环、UI 或长期记忆平台完成 |
| Conversations | `conversations/src/index.ts` | `create/select/append/resend/begin/finish/dispatch/cancel/fail/unknown` 业务变化与消息段落模型存在 | 正式聊天页面、复杂分支、排队和 E4 已验收 |
| GitHub | `connections/github/src/index.ts` | Octokit、官方 MCP Client/Stdio SDK 导入，受控文件读取与写入适配源码存在 | 官方 MCP Server 全工具、远端写验收、Windows 分发完成 |
| App | `app/src/index.ts`、`desktop-main.ts` | 装配出口及正式 Electron 入口已存在；`desktop-main.ts` 当前要求 `--data-root` 与现有数据根标记 | 已提供首次选根向导、安装包或 Windows 实机交付 |
| UI | `UI/src/renderer.tsx`、`workbench.tsx`、`index.ts` | Renderer 挂载 Workbench；Workbench 组合 SpacePanel、MiddleWorkspace、InteractionDock，具有基础设置、布局、辅助区域和输出；桌面桥含 API/Space 技术接口 | 普通聊天、完整 API/Agent/GitHub/Local 设置可点用；Windows E4 通过 |
| 脚本 | 根 `package.json` | `build/typecheck/test/check:boundaries`，模块 `test:space/test:api/test:ai/test:conversations/test:github/test:ui` 及 `build:desktop/verify:desktop` 脚本存在 | 本轮实际执行或通过了上述命令 |

## 2. 已修正的误导性说明

- `UI/README.md`：把旧 `bd72dfea` Renderer/SpacePanel 描述标为历史快照；补当前 Workbench 组件组合及业务设置按钮仍禁用的事实。现行 UI 设计改指 A1、版本状态改指 A2，UI/CONTRACT 和 B3 仅保留历史证据用途。提交 `d0bc2524`。
- `space/README.md`：撤销“当前施工模块固定为 Space”的全仓性暗示，改为用户本次明确授权才以本模块为目标。保留无 Placement 产品实体边界。提交 `e39e0f2d`。
- `connections/README.md`：残留旧 B3 和旧基础审计兼容路径直接指向 A2/A0 正文。提交 `6b1dc80f`。
- `AI/README.md`：旧全局契约地图和第六批研究链接直达 A0 归档原文。提交 `203a2844`。
- `conversations/README.md`：更正“对话页未接入 renderer.tsx”的误导性描述，明确 Renderer 只装配 Workbench，正式聊天页面未在 Workbench 接线；旧历史引用直达 A0。提交 `3892212b`。
- `connections/github/README.md`：B3 D-06/D-06A 改称历史验收细则，当前版本状态以 A2 总表为准。提交 `011088ef`。

## 3. 未解决问题与下一审查范围

1. **Space 产品语义**：现行 README 已声明 Placement 不是产品实体；现存内部模型与用户确认的 Space → 类别 → Group → Context 顺序是否一致仍需单独设计/代码核验。本次不改数据结构、功能编号或权限政策。
2. **真实 UI 功能差距**：正式 Workbench 中普通对话、API/Agent/GitHub/Local 设置按钮禁用。UI 框架出现不等于相关业务入口完成；具体状态须结合 A2 与 B3 验收案例、桥及 React 测试继续核实。
3. **App 首次选根**：当前 `desktop-main.ts` 依赖既存 `.wex-root.json`，尚不构成首次安装体验或数据迁移/恢复能力。
4. **API/GitHub 权限和连接**：代码拥有服务及适配器入口，真实网络行为、环境差异、Provider/GitHub 远端写、回执未知重查与 Windows E4 不得凭静态阅读宣布通过。
5. **文档一致性**：旧章节只因注明 2026-10-31/11-04 才保留历史意义。模块 README/CONTRACT 在当前职责、接口、测试、脚本和 UI 状态上的所有矛盾仍需逐份复核。
6. **验证环境限制**：本轮没有完整可执行的仓库本地工作树，未执行 `npm run build`、`npm run typecheck`、`npm test`、`npm run check:boundaries`、`node tools/check-docs.mjs --json --strict` 或 Windows 实机操作。无 CI/测试通过的新证据，不宣称全仓链接、锚点、接口或业务验收通过。

遵守根 README 的模块 README 施工入口原则。A0 历史文档只为追溯，A1 是已确认产品设计，A2 是当前版本工程状态。继续保留旧路径兼容文件和原始审计证据，待最新 HEAD **全量反向引用、路径、锚点与证据独立性**确认后再统一删除。
