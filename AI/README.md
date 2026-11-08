# AI｜Agent、角色与岗位配置模块

## 2026-11-08｜AI 源码与文档最新一致性核对

> 本轮静态代码基线：`main@e9ff10c81dc4`；最新 AI 文档提交已重建 CONTRACT/模块边界，本段只补实有代码证据，不把文档设计视为已施工。

- **当前实际公开入口**：`AI/src/index.ts` 中 `Configuration` 分为 `role`（name/prompt）、`position`（name/responsibility）与 `agent`（name/roleId/positionId/model）三类；`ModelReference` 使用 `connectionId + modelId`，`VerifyModel` 由调用方提供。
- **现有实现证据**：配置带稳定 ID、revision；存储状态与收据有格式校验，损坏记录/非法引用不静默修复。Agent 只能引用存在的 Role/Position；这不表示角色/岗位就是权限主体，也不是独立 Agent 推理引擎。
- **待施工或待证实**：`src/index.ts` 仍集中配置类型、校验、持久化/服务逻辑；`configuration.ts`、`storage.ts`、`service.ts`、`model-reference.ts` 属**候选拆分**，不能在 README 中标为已创建。需复核 Context 绑定、模型失效、配置修订、UI/Conversations 正式消费和重启恢复。
- **验收原则**：按现有公开接口兼容迁移、定向回归与跨模块组合证据更新状态，不新建本版未授权的记忆/调度/Agent runtime。



> 当前代码审查基线：`main@4ec86a84f83aad2e6b6ef46a1fc0db103fc015a1`（2026-11-08）。本页为模块施工入口；正式行为和边界见 [CONTRACT.md](CONTRACT.md)。此基线为只读源码核对，**不是**该 SHA 的 CI、真实 Provider 或 Windows 实机验收。

## 1. 定位与范围

AI owner 管理可复用 Agent 配置、角色（Role）与岗位（Position）定义、职责及范围配置、模型/连接引用、配置修订和本次工作配置依据。完整产品目标承接 A1 中 F02-001～012 及 F10 中 AI 相关功能，**不能以当前最简配置结构缩减长期产品目标**。

- AI 维护定义、职责与工具资格，**不授予权限**；实际授权、撤权和操作许可由 permissions 决定。
- Space 维护 Context 对 Agent/Role 的选择与组织引用；AI 维护职责配置，避免重复的 Context 成员表。
- connections/api 拥有 Provider 协议、模型目录、Key 引用与实际模型调用；AI 仅持有必要的模型和连接引用，不存凭证。
- conversations 拥有消息、生成和普通对话；workflows 拥有 Task、轮次、派工、交接和执行检查点；connections 拥有 Operation/回执、连接器与外部运行观察。
- app 负责可信宿主与桌面接线；UI 负责配置界面。外部 Agent 内部循环及 Session 实际状态不归 AI 配置域所有。

## 2. 真实源码与公开能力

| 文件或入口 | 目前职责/事实 |
| --- | --- |
| `src/index.ts` | 目前唯一产品源码：`Configuration`（role/position/agent）、`createAiConfigurations`（list/read/save）、`inspectAiConfigurationStore`、`verifyModelWithApi`；字段规范化、修订/intent 回执校验和持久化数据完整性也集中于此 |
| `roles/README.md` | 角色与职责子域说明；目前尚无独立 `roles/src`，角色基本功能在上级 `src/index.ts` |
| `tests/` | config、corruption、inspection、list、receipt-authorization 五类测试，涵盖修订冲突、权限、引用、损坏与恢复等 |
| `app/src/desktop-ai.ts` | UI 请求捕获、可信授权与 AI 快照/保存接线（不归 AI 源码所有） |
| `app/src/desktop-conversations.ts` | 普通对话发送前读取 Agent、Role、Position、API Model/Connection；不能据此认定完整 Context 职责组合已实现 |
| `UI/src/ai-settings.tsx` | 已有 Role/Position/Agent 基础创建、编辑、读取与模型选项 UI；不是零实现 |

现有配置形状：`role={name,prompt}`，`position={name,responsibility}`，`agent={name,roleId,positionId,model:{connectionId,modelId}}`。**这是现有实现，而非冻结的完整产品模型。** 当前 `save` 对 Agent 要求角色、岗位和模型引用，尚不支持多职责或独立的可选绑定语义。

## 3. 功能清单与状态（源码核对，不代表验收签收）

状态词：已实现未充分验证 / 部分实现 / 未实现 / 需要研究 / 已明确延期。已完成的源码行为仍需当前 SHA 测试与集成证据。

| 产品功能 / 细分编号 | 当前状态 | 必须保留的目标或缺口 |
| --- | --- | --- |
| F02-001 / AI-AGENT-001 | 部分实现 | 单一 Agent 定义、读取、保存已存在；归档/停用/引用生命周期未建立 |
| F02-002 / AI-ROLE-001 | 部分实现 | Role 名称与提示已存在；缺完整生命周期及扩展配置 |
| F02-003 / AI-RESPONSIBILITY-001 | 部分实现 | 固定 Agent→单 Role/单 Position；多个职责与复用关系缺失 |
| F02-004 / AI-SCOPE-001 | 未实现 | 职责范围关系未建立；不能复制 Space 的选择表 |
| F02-005 / AI-MODEL-001 | 已实现未充分验证 | Model/Connection 引用和公开 API 校验存在；失效/多连接/桌面选择仍待验 |
| F02-006 / AI-AGENT-002、AI-PROMPT-001、AI-WORK-SNAPSHOT-001 | 部分实现 | revision、prompt、intent 现有；缺在途工作不可变配置依据与完整变更生命周期 |
| F02-007 / AI-RUNTIME-001 | 未实现 | 运行实例绑定/观察尚无正式 AI 接口；不等于要自建运行引擎 |
| F02-008 / AI-SESSION-001 | 未实现 | 外部 Session/实例代次映射待后续接入研究 |
| F02-009 / AI-EXTERNAL-001 | 已明确延期 | 外部 Agent 接入属后续版本；保留配置目标 |
| F02-010 / AI-HANDOVER-001 | 未实现 | 引用与交接待 workflows/外部实例能力成熟后施工 |
| F02-011、F10-011～013/015/016、AI-MEMORY-*、AI-PREFERENCE-001 | 需要研究 | 派生记忆、共享、过期/删除和用户偏好不在 0.1.1 建立新存储；D05/D10 政策未决 |
| F02-012 / AI-STATUS-001 | 部分实现 | 配置独立；实际 Runtime/Session/Task 状态观察未实现 |
| AI-TOOL-ELIGIBILITY-001 | 未实现 | 资格配置与授权独立；不得凭角色名或 Prompt 推导执行许可 |

AIC-01～AIC-09 与 AI-* 编号保持不变；完整定义见本目录 [CONTRACT.md](CONTRACT.md)。F10-014 公共策略/经验库目前不擅指定 AI 为 owner。

## 4. 已确认问题及处理策略

1. **配置过度固定**：当前 Agent 必填单 Role、单 Position、单 Model，不足以表达多职责/不同 Context 的组合。先研究引用与兼容迁移，再定向扩展，不直接改坏现存 SQLite 数据。
2. **生命周期不完整**：目前主要有 list/read/save；归档/停用、解除引用、被引用对象变更及清理策略需补齐。不能在仍被引用时直接级联删除。
3. **模型选择歧义风险**：`UI/src/ai-settings.tsx` 使用模型记录 id 选择并反查连接；应核实重复 modelId 与不同连接、删除/失效模型的行为，以连接+模型记录引用为准。
4. **真实消费范围有限**：App 已接 AI 配置与普通对话，但 Context 范围职责、配置来源和在途快照还需跨 owner 验证。
5. **源码职责集中**：`src/index.ts` 同时处理类型、校验、存储、服务、API 引用；建议按真实职责拆成 `configuration.ts`、`storage.ts`、`service.ts`、`model-reference.ts`，`index.ts` 保持公开入口。**这是实施建议，不是已创建的目录或冻结接口。** 无需预建 runtime/memory/session 空模块。

建议顺序：现有测试与消费入口核验 → 配置/引用及生命周期补齐 → 最小职责拆分和兼容迁移 → UI/Context/Conversations/API 组合验收 → 更新实施证据。禁止新建第二套权限、Operation 或模型调用系统。

## 5. 直接施工入口及验收

- 阅读顺序：根 [README](../README.md) → 本页 → [CONTRACT](CONTRACT.md) → `src/index.ts`、`tests/`；仅争议处定向查 A1/A0。
- 测试：按根 package.json 现有脚本执行 `npm run build`、`npm run typecheck`、`npm test`、`npm run check:boundaries`；AI 定向用例在 `AI/tests/*.test.mjs`，先构建 dist 再运行相应 Node 测试。记录测试环境、SHA 与失败用例。
- 集成重点：Agent/Role/Position 引用修订与重启、模型合法性与失效、多连接选择、Context 选择和职责分别归属、撤权/列表可见性、在途配置不漂移、UI 修改反馈。
- Windows/真实 Provider 验证须单独证明；模拟测试、文件提交或 CI 绿灯不可替代最终签收。GitHub Actions 先核查 [运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 与对应提交 SHA，不盲目重跑。
- 根 README 规定的施工/文档维护分工保持有效：常规工作模式只能改源码及测试；普通对话验收或明确授权的文档专项才能改本文件及 CONTRACT。

## 6. 版本边界

0.1.1 聚焦现有 AI 配置底座、角色/岗位/模型选择和桌面普通对话的必要基础闭环。多会话外部 Agent、正式调度器/DSH 连接器及派生记忆平台不因本页列出长期功能而自动进入本版。未确认的删除/共享/运行状态语义必须先用源码及实验明确，不以技术便利擅自收缩完整产品需求。
