# conversations｜普通对话、消息与逻辑生成

> Owner：`conversations/`；当前 0.1.1 任务与签收见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。普通对话不必先创建 Space/Context、Task 或工作流。

## 职责与现有实现

`src/index.ts` 已有会话/消息/段落、`select`、`append`、`resend`、生成轮次、保存/恢复与状态/授权处理；`tests/` 有相关模块测试。顶层 `UI/src/conversation.tsx` 已有正式对话组件，提供历史、新建、Agent 选择、发送、段落引用、编辑重发、流式展示入口、停止等待和原 Operation 结果核对。**“对话 UI 尚未接线”的旧阶段结论已失效。**

Conversations 管逻辑生成和用户消息历史；API 管真实 Provider 与协议、Connections 管外部 Operation/回执、AI 管 Agent 配置、Space 管 Context 引用、Permissions 管授权。当前背景选择与 Space 组织引用不可双写一份权威。模型工具提议须经 Connections/Permissions 调用，不能从消息文本执行。

## 功能状态与缺口

| 能力 | 现状 | 未签收部分 |
|---|---|---|
| 新建、历史、消息与段落 | 领域代码与正式 UI 已有 | 当前 SHA 端到端、异常/撤权及重启恢复 |
| 选择、追加和编辑重发 | 基础命令与 UI 操作已存在 | 多轮真实请求、版本冲突、迟到结果不覆盖新轮次 |
| 生成与取消 | 逻辑轮次、状态/恢复与 UI 停止等待入口已存在 | 真正流式、取消竞态、EOF/unknown/回执回查 |
| 文件引用与可见段落选择 | `ce278758` 新增对话文件引用与段落选择相关代码/测试；`UI/src/conversation-files.tsx` 已进入代码差异 | 文件来源权限、实际读取、发送与段落操作的真实桌面闭环仍待验 |
| 流式轮次隔离及恢复 | `ef3cd5fc` 提交了相关修复，Conversations 和桌面测试发生变更 | 取消竞态、迟到流、unknown、重启后的同 SHA 与真实 Provider 验收待核 |
| 高级分支与采纳 | 不得以现有 `append/resend/select` 冒充 | 生成期间追加队列、采纳/拒绝、完整分支语义按正式范围另定 |

## 2026-11-09 代码进展说明

最新核对 main `a91aacf3`，已确认相关源码/测试提交，但并未取得此 SHA 的完整 Actions 结果或真实 Provider 端到端结果。此前的“未签收”门槛不因提交存在而改变；详见 A2 当前基线记录。

## 施工与验收

先查模块已有生成测试和桌面 IPC，再核实真实请求 → SSE 显示 → 成功定稿或取消/unknown → 保存/恢复的全链；覆盖失权、重发、旧消息/旧流片段隔离、损坏存储、重复请求与工具副作用不重放。源码按消息/生成/持久化实际职责定向拆分，不另建 Provider、权限或账本。

测试从根 package.json 的 build/typecheck/test/boundaries 入口选用；关联当次 SHA、真实服务和模拟证据。历史 CV-01～16 是需求锚点，并非全部已交付。本模块当前未独立签收。
