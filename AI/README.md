# AI｜Agent、角色与岗位配置

> Owner：`AI/`。当前正式行为见 [CONTRACT](CONTRACT.md)；0.1.1 工程与签收见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与现有代码

AI 管理三类独立配置：Role（name/prompt）、Position（name/responsibility）、Agent（name/roleId/positionId/model）。`ModelReference` 使用 `connectionId + modelId`；模型合法性通过外部 `VerifyModel` 协作校验。AI 不负责真实 API 传输、Conversations 历史、Space 引用权威、权限、Operation、Task 或 Agent runtime。

`AI/src/index.ts` 已提供配置服务和公开类型，包含 ID/revision、格式规范化、角色/岗位关联、状态与回执校验。持久状态损坏和无效引用不能静默修复。现有 `AI/tests/` 为模块回归入口。**代码仍集中在 `src/index.ts`**；`configuration.ts`、`storage.ts`、`service.ts`、`model-reference.ts` 仅为职责拆分候选，不是已存在的实现。

## 功能与验证状态

| 能力 | 代码状态 | 未完成/未签收 |
|---|---|---|
| Role/Position/Agent 配置 | 已有正式类型、服务与持久记录 | 完整 UI CRUD、修订冲突与重启组合验收 |
| Agent 引用 | Role/Position 和 API ModelReference 已有 | 引用删除/失效、外部模型变更与 Context 绑定 |
| 配置权限与撤权 | 有受控读取/写入边界的设计与调用基础 | 精确可信入口、失权/列表投影、迟到结果 |
| 模型偏好及对话消费 | App/对话有 Agent 读取与选择入口 | 配置变化时的快照、一轮真实请求和恢复 |

## 调整与施工入口

先验证公开调用、配置修订、损坏/收据、模型与角色失效；然后在保持 `src/index.ts` 对外兼容的前提下按职责最小拆分，并补 Context、Conversations 和 UI 的组合回归。不要建立新的运行时记忆、调度器、权限或网络连接器。

阅读顺序：根 README → 本 README/CONTRACT → `src/index.ts` 与 `tests/`。执行 `npm run build`、`npm run typecheck`、`npm test` 与 `npm run check:boundaries` 中可用部分；提交 SHA 和测试来源单独记录。当前仅静态复核，未独立签收。

## 97 项对账｜AI 配置与交互栏对象（2026-11-09）

- 对应第二批 F02 操作检查点和 UIX-04/10/12/18：Role、Position、Agent 的 `list/read/save`、模型引用校验、角色/职责关联均有领域基础；桌面 `app/src/desktop-ai.ts` 目前提供 snapshot/save，`UI/src/ai-settings.tsx` 有配置表单。
- **尚无已确认的删除/归档/停用公开入口**，不可把“可以保存”写成完整 CRUD，也不可未经引用政策自动级联删除 Role、Position 或 Agent。多职责、多角色组合和模型/默认值优先级待合同冻结。
- Space 承担 Context 对 AI 对象的引用；Conversations 保存本轮所用 Agent/模型依据；AI 配置有效性不代表 Agent Runtime 在线。交互栏的 AI/秘书实际对象入口仍为 UI 占位，不能当 AI 配置模块未实现或已完成运行时。
- 本版只对已批准配置动作逐项验证修订/权限/撤权/失联/重启与桌面接线；多 Agent 调度、派生记忆、角色动画留待后续独立规格。
