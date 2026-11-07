# WEXPCeasy｜第五轮模块公开入口与文档一致性核验（2026-11-07）

> 性质：文档专项治理中的 GitHub 远端逐文件静态核查与定向修复。检查起点 main `c4ab9b475ef4e206642c978fa7d729c0897545ee`。**不构成完整代码审查、单元/集成测试或 Windows E4 验收。**

## 确定性核对

- `shared/src/index.ts`：正式导出 `openSqliteStore/createSqliteStore`、Store、`inspectRoot/resolveWithin/directoryLock`、诊断、持久诊断、`createCredentialVault`。文档必须区分真实源码已存在与 Windows 凭证/ACL/重装未验收。
- `connections/src/index.ts`：正式导出 ReadBoundary、ConfiguredReadBoundary、DispatchBoundary、ConfiguredDispatchBoundary、ConnectionConfigs、OperationLedger、ConnectionService。历史“只有 DSH 子模块”等描述不得用于当前。
- `connections/api/src/index.ts`：正式导出 `createApiService`、API 模型/连接类型、`createApiTransport`、`decodeChatStream`、`decodeChatResponse` 及工具提议/续接类型；不代表真实 Provider E3 已通过。
- `workflows/src/index.ts`、`views/src/index.ts`、`scheduler/src/index.ts`、`UI/conversation/src/index.ts`：通过 GitHub 按路径查询均返回不存在。**仅证实指定入口未找到，不等于全仓完整递归枚举或断言所有子目录没有实现。** Workflows/调度/自由格子产品化不属于已批准的 0.1.1 施工范围；UI 的基础多视图属 UI，不可混作 Views 专业引擎。
- `UI/src/workbench.tsx`：Workbench 具有基础设置及中间工作窗口，普通聊天按钮禁用；不能据此判定 Conversations 领域代码不存在。
- `package.json`：`npm run build`、`typecheck`、`test`、`check:boundaries`、`test:api`、`test:space`、`test:ai`、`test:conversations`、`test:github`、`test:ui`、`verify:desktop` 脚本存在，**本轮未执行**。
- `tools/check-docs.mjs`：存在可读的 Markdown 检查脚本；当前不以它的存在声称严格检查已通过。

## 修改及提交

| 文件 | 修复目的 | 提交 |
| --- | --- | --- |
| `shared/README.md` | 现行施工权威从历史 B3 切回根 README/A2 主表；修正同一历史契约链接被误标作本目录 CONTRACT | `948ed362` |
| `connections/README.md` | 遗留旧全局地图与第六批链接转 A0 原正文；把“当前版本施工顺序”明确为历史范围说明 | `b050ac27` |
| `workflows/README.md` | 区分指定源码入口不存在、原型性质、0.1.2 版本边界与用户本次未授权施工 | `433a3e93` |
| `views/README.md` | 指定独立产品入口未找到、UI 基础多视图已存在但非 Views 专业引擎 | `85a61cb0` |
| `UI/conversation/README.md` | 指定页面入口未找到且 Workbench 按钮禁用；不误伤 Conversations 领域代码结论 | `6691e2cf` |
| `connections/github/CONTRACT.md` | 当前状态回归模块 README/A2；B3 只保留历史完整目标验收细则 | `a805f84b` |

本轮不修改产品源码、契约行为、权限政策、依赖配置、版本范围及历史原始证据；不建立任何空 src 或测试目录。

## 未关闭的风险与验证门槛

1. 需完整获取最新 Git tree，按模块逐一核对实际 src/tests、模块公开出口、依赖导入、运行脚本与当前 README；现有逐路径请求只能形成**定向证据**。
2. 需要运行 `node tools/check-docs.mjs --json --strict`、`node --test tools/check-docs.test.mjs`、`npm run check:boundaries`、相关模块测试；本轮环境 `git ls-remote https://github.com/owla19s-ux/WEXPCeasy.git HEAD` 返回 `Could not resolve host: github.com`，无法取得执行完整工作树。
3. 真实权限策略与 Windows IPC 主体核验、API/GitHub 外部操作、数据恢复和 Windows E4 不可用源码入口存在性取代。
4. Space 的历史 Placement 产品语义冲突继续冻结，不因文档治理变更内部关系和数据结构。
5. 所有旧兼容路径仍保留，直至**全仓反向引用、文件链接与标题锚点、独立证据保留条件**均有最新 HEAD 上的完整验证结果。当前没有满足统一删除的门槛。

**结论**：本轮消除了六个定向的当前施工导航/实现状态误导，不等于第二阶段全部模块文档深度审查完成。
