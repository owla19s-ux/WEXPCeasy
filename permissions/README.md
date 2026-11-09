# permissions｜判权、授权、撤权与审计

> 唯一权限业务 Owner：`permissions/`；版本交付见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)，D01/D02 的正式决定见 [权限决策矩阵](../docs/A1-正式产品设计/权限决策矩阵.md)。

## 现有能力与策略边界

`src/index.ts` 提供 `createPermissions(Store, TrustPort)` 与 evaluate/recheck/grant/revoke/history 等入口，`src/service.ts` 实现持久授权与受控操作。既有 Conversation 入口有受控允许路径；受限 `local` 入口要求可信宿主提供 `conversation:null`、`entryEnabled:true` 和独立精确 Grant。**task/callback 仍返回 `entry_policy_unresolved`**，不伪造对话 ID 或放宽尚未决策的非对话权限。

授权同时约束主体、入口、模块/对话适用开关、资源、动作、目标和关系版本；角色名称、Context 关联、连接可见或工具发现均不授予权限。既有三层依据“模块启用/全局访问/对话启用”保留；非对话入口只能按另行批准的精确政策实现。

## 当前源码增量与待验证

- `ec5881dd`、`9df59002`、`c2e68469` 已涉及管理授权命令捕获、scope/intent/revision 防重定向及准备/回执恢复的负例。**有提交和用例不等于最新 SHA 测试或独立签收。**
- 需要验证 Store 读取中途、提交/回执恢复和撤权竞态不会让目标/授权语义漂移；失败/损坏/unknown 必须拒绝或保持不可判定，不自动重新执行副作用。
- Windows 正式身份/可信 IPC、权限 UI、跨 Connections/App/Space 联调仍缺完整签收。有限次数、自动审批、特殊信任根和 Task/Callback 不因旧研究文本自动开放。

## 与其他模块及验收

Permissions 维护唯一可修改授权/撤权记录；Connections 持有对外 Operation，App 提供真实用户/OS 可信入口，各领域维护自己的写入/修订规则。取消本地等待、撤权、外部进程终止、远端副作用回滚是不同事实，不能混淆。

默认阅读：根 README → 本 README → `src/index.ts`、`src/service.ts`、`tests/`。运行 `npm run test:permissions` 与可用全仓 build/typecheck/test/boundaries；含 local、拒绝、撤权、管理命令复核及重启恢复用例。附测试 SHA 和真实/模拟证据，不将历史 `1048b6a` 作为最新基线。

## 97 项对账｜F09 与权限 UI（2026-11-09）

第三批检查点覆盖入口/主体、模块/全局总闸、对话许可、操作前及派发前复核、审批/Grant/撤销、审计与资源外发；能力发现、Context Tool 引用、AI 职责均不自动授权。A1 D01/D02 已确认对话 I～IV 级的**产品语义**，不代表当前代码和 UI 完成交付。`UI/src/permission-settings.tsx` 目前只展示当前窗口 scope/准入并支持 snapshot/revoke，未提供四级对话权限编辑。高危专项政策与 Task/callback 的未决范围不能通过 UIX 交互栏入口绕过。撤权不能自动回滚已发生的远端副作用。
