# conversations｜普通对话、消息与逻辑生成

> Owner：`conversations/`；当前 0.1.1 任务与签收见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。普通对话不必先创建 Space/Context、Task 或工作流。

## 职责与现有实现

`src/index.ts` 已有会话/消息/段落、`select`、`append`、`resend`、生成轮次、保存/恢复与状态/授权处理；`tests/` 有相关模块测试。顶层 `UI/src/conversation.tsx` 已有正式对话组件，提供历史、新建、Agent 选择、发送、段落引用、编辑重发、流式展示入口、停止等待和原 Operation 结果核对。**“对话 UI 尚未接线”的旧阶段结论已失效。**

Conversations 管逻辑生成和用户消息历史；API 管真实 Provider 与协议、Connections 管外部 Operation/回执、AI 管 Agent 配置、Space 管 Context 引用、Permissions 管授权。当前背景选择与 Space 组织引用不可双写一份权威。模型工具提议须经 Connections/Permissions 调用，不能从消息文本执行。

## 功能状态与缺口

| 能力 | 现状 | 未签收部分 |
|---|---|---|
| 独立普通对话 | 独立会话创建/列表/读取、消息与段落及正式 UI 已有 | 归档/删除/恢复等完整生命周期与当前 SHA 真链待核；Context 对话单独核对 |
| 选择、追加和编辑重发 | 基础命令与 UI 操作已存在 | 多轮真实请求、版本冲突、迟到结果不覆盖新轮次 |
| 生成与取消 | 逻辑轮次、状态/恢复与 UI 停止等待入口已存在 | 真正流式、取消竞态、EOF/unknown/回执回查 |
| 文件引用与可见段落选择 | `ce278758` 新增对话文件引用与段落选择相关代码/测试；`UI/src/conversation-files.tsx` 已进入代码差异 | 文件来源权限、实际读取、发送与段落操作的真实桌面闭环仍待验 |
| 流式轮次隔离及恢复 | `ef3cd5fc` 提交了相关修复，Conversations 和桌面测试发生变更 | 取消竞态、迟到流、unknown、重启后的同 SHA 与真实 Provider 验收待核 |
| 高级分支与采纳 | 不得以现有 `append/resend/select` 冒充 | 生成期间追加队列、采纳/拒绝、完整分支语义按正式范围另定 |

**版本修订（2026-11-09）**：0.1.1 已批准一个 Context 与选定主 AI 的**最小可恢复基础对话**；完整 Context 多会话列表/关联解除/自动工具消费仍未纳入该最小交付。当前 Conversation 类型没有 Context 关联属性；桌面 Conversations 操作和 API 请求准备使用 context:null；Workbench 的 ConversationPanel 是独立普通对话入口，附件中的 FileReference.contextId 不能当作会话归属。原 0.1.1 B1-05/B3-03 明确要求独立普通对话、消息/段落、生成/重发；B2 另有 Context 关联 Agent/模型、API→Conversations 的基础组合。完整 Context 进入会话、会话列表/新建/切换、关联与解除、每轮自动引用解析及工具使用需待版本明确后细化，不能先作为本版验收阻塞。切换 Context 或旧流不能污染新会话。不要为此重建另一套会话数据库；跨 Context 关联规则、默认值与自动使用规则尚需冻结。

## 2026-11-09 代码进展说明

最新核对 main `a91aacf3`，已确认相关源码/测试提交，但并未取得此 SHA 的完整 Actions 结果或真实 Provider 端到端结果。此前的“未签收”门槛不因提交存在而改变；详见 A2 当前基线记录。

本版新增验收：打开 Context→使用已选主 Agent→创建/恢复一个持久关联会话→受控调用 API 流式回复→取消、未知结果及重启恢复。普通不关联 Context 的 Conversation 必须继续可创建和读取；会话关联不得复制消息数据或假定 `FileReference.contextId` 就代表会话归属。旧流与请求必须按 Context、Conversation、generation 和 Agent 绑定，不得切换后污染当前显示或悄悄改用其他模型。

## 施工与验收

分别核验段落选择/引用、编辑重发、流式暂态与持久定稿、停止等待与真实远端停止、Agent/模型本轮依据、文件引用及受控工具结果。对话视图切换不应自动取消或重派，窗口内草稿与崩溃后持久恢复是不同承诺。


先查模块已有生成测试和桌面 IPC，再核实真实请求 → SSE 显示 → 成功定稿或取消/unknown → 保存/恢复的全链；覆盖失权、重发、旧消息/旧流片段隔离、损坏存储、重复请求与工具副作用不重放。源码按消息/生成/持久化实际职责定向拆分，不另建 Provider、权限或账本。

测试从根 package.json 的 build/typecheck/test/boundaries 入口选用；关联当次 SHA、真实服务和模拟证据。历史 CV-01～16 是需求锚点，并非全部已交付。本模块当前未独立签收。
