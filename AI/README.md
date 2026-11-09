# AI｜Agent、角色与岗位配置

> Owner：`AI/`。当前正式行为见 [CONTRACT](CONTRACT.md)；0.1.1 工程与签收见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与现有代码

AI 管理三类独立配置：Role（name/prompt）、Position（name/responsibility）、Agent（name/roleId/positionId/model）。`ModelReference` 使用 `connectionId + modelId`；模型合法性通过外部 `VerifyModel` 协作校验。AI 不负责真实 API 传输、Conversations 历史、Space 引用权威、权限、Operation、Task 或 Agent runtime。

`AI/src/index.ts` 已提供配置服务和公开类型，包含 ID/revision、格式规范化、角色/岗位关联、状态与回执校验。持久状态损坏和无效引用不能静默修复。现有 `AI/tests/` 为模块回归入口。**代码仍集中在 `src/index.ts`**；`configuration.ts`、`storage.ts`、`service.ts`、`model-reference.ts` 仅为职责拆分候选，不是已存在的实现。

## 功能与验证状态

| 能力 | 代码状态 | 未完成/未签收 |
|---|---|---|
| Role/Position/Agent 配置 | 已有 `list/read/save`、正式类型和持久记录；桌面已有配置表单 | 删除/归档/停用尚无已确认公开入口；修订冲突与重启组合验收待核 |
| Agent 引用 | Role/Position 和 API ModelReference 已有，Context 关联由 Space 持有 | 引用删除/失效、外部模型变更、Context 关联及本轮快照待核；交互栏实际 AI/秘书入口仍是 UI 占位 |
| 配置权限与撤权 | 有受控读取/写入边界的设计与调用基础 | 精确可信入口、失权/列表投影、迟到结果 |
| 模型偏好及对话消费 | App/对话有 Agent 读取与选择入口 | 配置变化时的快照、一轮真实请求和恢复 |

## 调整与施工入口

先验证公开调用、配置修订、损坏/收据、模型与角色失效；然后在保持 `src/index.ts` 对外兼容的前提下按职责最小拆分，并补 Context、Conversations 和 UI 的组合回归。不要建立新的运行时记忆、调度器、权限或网络连接器。

阅读顺序：根 README → 本 README/CONTRACT → `src/index.ts` 与 `tests/`。执行 `npm run build`、`npm run typecheck`、`npm test` 与 `npm run check:boundaries` 中可用部分；提交 SHA 和测试来源单独记录。当前仅静态复核，未独立签收。
