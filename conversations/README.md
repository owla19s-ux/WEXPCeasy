# conversations｜普通对话、消息与逻辑生成

> Owner：`conversations/`；当前 0.1.1 任务与签收见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。普通对话不必先创建 Space/Context、Task 或工作流。

## 职责与现有实现

`src/index.ts` 已有会话/消息/段落、`select`、`append`、`resend`、生成轮次、保存/恢复与状态/授权处理；`tests/` 有相关模块测试。顶层 `UI/src/conversation.tsx` 已有正式对话组件，提供历史、新建、角色/岗位与显式模型选择（兼容旧 Agent）、发送、段落引用、编辑重发、流式展示入口、停止等待和原 Operation 结果核对。**“对话 UI 尚未接线”的旧阶段结论已失效。**

Conversations 管逻辑生成和用户消息历史；API 管真实 Provider 与协议、Connections 管外部 Operation/回执、AI 管角色/岗位等设定、Space 管 Context 引用、Permissions 管授权。当前背景选择与 Space 组织引用不可双写一份权威。模型工具提议须经 Connections/Permissions 调用，不能从消息文本执行。

## 功能状态与缺口

| 能力 | 现状 | 未签收部分 |
|---|---|---|
| 独立普通对话 | 独立会话创建/列表/读取、消息与段落及正式 UI 已有 | 归档/删除/恢复等完整生命周期与当前 SHA 真链待核；Context 对话单独核对 |
| 选择、追加和编辑重发 | 基础命令与 UI 操作已存在 | 多轮真实请求、版本冲突、迟到结果不覆盖新轮次 |
| 生成与取消 | 逻辑轮次、状态/恢复与 UI 停止等待入口已存在 | 真正流式、取消竞态、EOF/unknown/回执回查 |
| 文件引用与可见段落选择 | `ce278758` 新增对话文件引用与段落选择相关代码/测试；`UI/src/conversation-files.tsx` 已进入代码差异 | 文件来源权限、实际读取、发送与段落操作的真实桌面闭环仍待验 |
| 流式轮次隔离及恢复 | `ef3cd5fc` 提交了相关修复，Conversations 和桌面测试发生变更 | 取消竞态、迟到流、unknown、重启后的同 SHA 与真实 Provider 验收待核 |
| 高级分支与采纳 | 不得以现有 `append/resend/select` 冒充 | 生成期间追加队列、采纳/拒绝、完整分支语义按正式范围另定 |

**Issue #11 接线（2026-11-09）**：同一 `ConversationPanel` 可独立使用，也可带当前 `contextId` 创建、列出、打开、发送和核对关联会话。会话关系只存于 Space Association；Conversation 本体、消息和原存储格式不变，附件 FileReference.contextId 不代表会话归属。Context 请求先验证当前关联，再绑定 Context 范围的 Conversations/API 权限与 preparation.context；普通请求仍为 null。角色、岗位和组合沿用同一生成、取消、重发与恢复机制。模型须显式选择，不采用默认/继承规则。

创建会话与关联是两个 owner 的提交：关联拒绝/不可用时返回 `conversation_created_unlinked:<id>`；关联回执 unknown 时保留 unknown、原 intent 和已创建会话 ID，保留已创建会话供发现核对，不假装跨 Store 原子提交或自动重复创建。Context 视图关闭/切换时可请求取消在途轮次；这只停止本地等待，不承诺远端停止。历史、关联、生成回执与 UI 内存草稿的恢复范围不同。跨 Context 移动/共享政策及高级组织仍未决。

## 2026-11-09 代码进展说明

最新核对 main `a91aacf3`，已确认相关源码/测试提交，但并未取得此 SHA 的完整 Actions 结果或真实 Provider 端到端结果。此前的“未签收”门槛不因提交存在而改变；详见 A2 当前基线记录。

本轮验证：`app/tests/desktop-business.test.mjs` 覆盖无 API 保存/编辑、独立设定真实本地 HTTP/SSE、取消/重发、Context 引用与生成范围、撤权、多 Context 隔离及新窗口重启不重发。UI 既有 fixture 扩充到 10 个场景；本地 JSDOM 运行通过，Electron/Windows 和真实 Provider 验收单独记录于 A2。

## 施工与验收

分别核验段落选择/引用、编辑重发、流式暂态与持久定稿、停止等待与真实远端停止、Agent/模型本轮依据、文件引用及受控工具结果。普通历史切换不自动重派；Context 环境退出可请求停止当前轮次，窗口内草稿与崩溃后持久恢复是不同承诺。


先查模块已有生成测试和桌面 IPC，再核实真实请求 → SSE 显示 → 成功定稿或取消/unknown → 保存/恢复的全链；覆盖失权、重发、旧消息/旧流片段隔离、损坏存储、重复请求与工具副作用不重放。源码按消息/生成/持久化实际职责定向拆分，不另建 Provider、权限或账本。

测试从根 package.json 的 build/typecheck/test/boundaries 入口选用；关联当次 SHA、真实服务和模拟证据。历史 CV-01～16 是需求锚点，并非全部已交付。本模块当前未独立签收。
