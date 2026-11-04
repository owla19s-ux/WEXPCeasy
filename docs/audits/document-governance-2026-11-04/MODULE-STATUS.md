# 模块源码与证据核对

基线 `1048b6a615554d80693830ced4b33b9cee4cffa5`。核对完整 Git 文件树、tsconfig include、四域 src/index.ts、App 装配及现有测试入口；“无 src/tests”不排除其他命名实验目录。目录事实不等于业务语义验收。

| 模块 | src / tests 文件数 | 产品公开出口 | 设计、产品与实验区别 | 组合与宿主 | Windows E4 |
|---|---:|---|---|---|---|
| [space](../../../space/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [AI](../../../AI/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [AI/roles](../../../AI/roles/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [conversations](../../../conversations/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [connections](../../../connections/README.md) | 6 / 10 | 有 | 产品源码 6 文件、测试 10 文件，公开入口 `connections/src/index.ts`。本轮根测试覆盖 shared、permissions、app、connections 及边界工具；不代表完整本版验收。 | App 的基础装配/连接公开接口组合有测试；正式 Windows 宿主未验收 | 未验收 |
| [connections/api](../../../connections/api/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [connections/local](../../../connections/local/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [connections/github](../../../connections/github/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [connections/dsh](../../../connections/dsh/README.md) | 0 / 0 | 无 | 没有产品 src/tests；有 experiment/ 独立 headless 实验，不等于正式外部 Agent 连接闭环。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [workflows](../../../workflows/README.md) | 0 / 0 | 无 | 没有产品 src/tests；editor/prototype/ 是独立 React Flow 实验。正式自由格子与调度后置，调度入口为 scheduler/。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [scheduler](../../../scheduler/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [views](../../../views/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [UI](../../../UI/README.md) | 0 / 0 | 无 | 没有本域产品 src/tests；Electron/React 代码在 experiments/electron-host-spike/，不能当正式页面已接线。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [plugins](../../../plugins/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [dsh](../../../dsh/README.md) | 0 / 0 | 无 | 没有独立产品 src/tests；已有 build/checks 与锁定的上游兼容实验。它是独立实验，WEX 正式接线及 Windows 实机未验收。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |
| [shared](../../../shared/README.md) | 4 / 5 | 有 | 产品源码 4 文件、测试 5 文件，公开入口 `shared/src/index.ts`。本轮根测试覆盖 shared、permissions、app、connections 及边界工具；不代表完整本版验收。 | 被 App 基础装配使用；正式 Windows 宿主未验收 | 未验收 |
| [permissions](../../../permissions/README.md) | 2 / 2 | 有 | 产品源码 2 文件、测试 2 文件，公开入口 `permissions/src/index.ts`。本轮根测试覆盖 shared、permissions、app、connections 及边界工具；不代表完整本版验收。 | 被 App 基础装配使用；正式 Windows 宿主未验收 | 未验收 |
| [app](../../../app/README.md) | 4 / 4 | 有 | 产品源码 4 文件、测试 4 文件，公开入口 `app/src/index.ts`。本轮根测试覆盖 shared、permissions、app、connections 及边界工具；不代表完整本版验收。 | App 的基础装配/连接公开接口组合有测试；正式 Windows 宿主未验收 | 未验收 |
| [accounts](../../../accounts/README.md) | 0 / 0 | 无 | 未发现本域产品 src/、tests/ 或公开 index.ts；现有说明是设计/施工目标，不能表述为已实现。 | 无正式宿主接线证明；实验按各自证据解释 | 未验收 |

根 `tsconfig.json` 仅包含 shared、permissions、app、connections 四域；本轮 `npm run typecheck`、`npm test`（133/133）与 AST 边界检查通过。测试包含真实基础实现与受限替身，不能据此宣称真实 Provider、GitHub、DSH 外部服务或 Windows 产品通过。

权限实现仍对非 conversation 入口返回 `entry_policy_unresolved`（permissions/src/service.ts），不等于已完成四级策略、工作流预授权、插件或外部 Agent 准入。产品已确认政策与实现缺口分开；本次没有修改权限策略或源码。
