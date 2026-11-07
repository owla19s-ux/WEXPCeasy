# Hermes｜核心、记忆、提示词缓存与技能

状态：研究参考。

## 1. 窄核心与边缘扩展
根 AGENTS.md 明确两条原则：每次会话的 prompt cache 稳定性很重要；Agent 核心是 narrow waist，能力尽量通过 CLI+skill、service-gated tool、plugin 扩展，避免无限膨胀核心工具表。理由是工具声明通常随每次模型调用发送，会增加上下文成本。

## 2. 提示词层次与冻结
Prompt Assembly 文档把系统提示词分 stable、context、volatile 层；其中 volatile 也在会话构造时进入缓存前缀，不是每轮随意重写。项目上下文文件、记忆快照、技能索引有各自位置。会话内随意替换工具集合或重建 system prompt 会破坏缓存；压缩是特殊例外。WEX 应研究“项目 Context 可更新”与“单次 Agent 会话缓存稳定”如何同时成立，而不是把 Space 最新值每轮强行注入。

## 3. 记忆 Provider 生命周期
`agent/memory_provider.py` 定义可插拔 MemoryProvider：initialize→system_prompt_block/prefetch/sync_turn→shutdown，可有扩展 hooks。外部记忆 provider 由 memory.provider 选择（同一时刻一个），内置存储与插件分开。后台线程通过 contextvars 绑定发起者上下文，避免 profile/secret 范围错位；压缩前 checkpoint 可区分 best-effort 与严格失败模式。

## 4. 学习与技能
README 描述自动生成/迭代技能、跨会话搜索和记忆管理。这里是项目公开的产品能力描述，尚未对技能写入/评估/撤销每条源码路径做实测。WEX 不应把“AI 自动改技能”直接视为可信生产知识；需审查、版本、回退、来源记录。

## 5. 参考
- https://github.com/NousResearch/hermes-agent/blob/main/AGENTS.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/prompt-assembly.md
- https://github.com/NousResearch/hermes-agent/blob/main/agent/memory_provider.py
- https://github.com/NousResearch/hermes-agent/blob/main/README.md
