# Hermes｜子 Agent、定时任务、Gateway 与插件

状态：研究参考。

## 1. 公共子 Agent 生命周期
`agent/subagent_lifecycle.py` 提供面向插件的不可变请求/句柄，而非暴露 AIAgent 对象；插件通过 `PluginContext.subagent_lifecycle` 使用。请求含 goal/context/role/model/provider/allowed_toolsets/blocked_tools/working_directory/parent_session_id/correlation_id/timeout 等；返回可序列化、带版本的 opaque handle。状态包括 PENDING、STARTING、RUNNING、SUCCEEDED、FAILED、INTERRUPTED、CANCEL_REQUESTED、CANCELLED、UNKNOWN。脱离活动父 Agent turn 启动会 fail-closed；插件不能凭自身声明绕过委托约束。

**WEX 候选**：调度器只持有任务/子 Agent handle、状态和关联 ID，不直接持有某个运行时的 Agent 对象；区分取消请求与真正取消完成。

## 2. 定时任务与无模型路径
Cron 文档明确：定时任务在新的 Agent 会话中执行，不继承当前聊天记忆，任务提示词需自足。支持脚本预处理并把输出交给 Agent；不需要 LLM 时支持 script-only cron、外部脚本直接发送结果。WEX 应区分计划触发、上下文装配、执行、投递，避免每个定时任务强制启动主 AI。

## 3. Gateway 与多入口
README 描述同一核心服务 CLI、TUI、Telegram/Discord/Slack 等消息渠道及桌面端。Gateway 负责接入与会话绑定，不能把每个渠道的消息事件直接等同为任务事实。API session 绑定在 `gateway/session_api.py` 有持久身份与删除后不复用逻辑。WEX 的 PC/手机/外部客户端也应将入口身份与核心 Context、Task 身份分离。

## 4. 插件加载的实际风险
`plugins/plugin_loader.py` 通过目录发现并导入插件模块，含加载锁、并发等待上限、stalled load 检测。它不是原生隔离沙箱，也不能据此断言任意插件安全或完全热插拔。WEX 应借鉴加载失败和并发重入保护，而非照搬 Python import。

## 5. 参考
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/subagent-lifecycle-api.md
- https://github.com/NousResearch/hermes-agent/blob/main/agent/subagent_lifecycle.py
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/guides/automate-with-cron.md
- https://github.com/NousResearch/hermes-agent/blob/main/gateway/session_api.py
- https://github.com/NousResearch/hermes-agent/blob/main/plugins/plugin_loader.py
