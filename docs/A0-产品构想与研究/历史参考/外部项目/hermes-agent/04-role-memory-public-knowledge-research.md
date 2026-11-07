# Hermes 深挖：角色记忆、项目上下文与公共经验库

状态：候选研究／待设计验证；2026-10-28。**不是已冻结架构，不修改原设计。**

## 用户新设想（保留，不替代原方案）
角色在项目工作时积累的记忆与经验，既应留在角色自身，也可以融合到原先设想的公共数据库；角色配置中可有共享开关。当前仅是设想，未确认共享范围、默认值、权限或存储结构。

## 从 Hermes 源码确认的可借鉴机制
1. `agent/memory_provider.py` 的 MemoryProvider 有 `prefetch`、`sync_turn`、`on_session_end`、`on_pre_compress`、`on_delegation`、`on_memory_write` 等钩子。意味着“角色获取记忆”“执行中积累”“任务结束提取”“委托结果反馈”可以在不同阶段处理，而不必全塞进主 Agent 循环。
2. MemoryProvider 有 `identity_signature`、`get_config_schema` 和 `save_config`，提示记忆提供者身份、配置和生命周期应明确；但不证明 Hermes 已有 WEX 式角色共享开关。
3. `agent/subagent_lifecycle.py` 将委托请求、序列化句柄、状态、取消、恢复分离；任务结果可按 `correlation_id` 关联来源，不应把子 Agent 的结果直接当公共事实。
4. `agent/memory_context.py` 提供记忆上下文清洗与重复回忆条目处理；`agent/prompt_cache_boundary.py` 管稳定提示词前缀。说明“存储记忆”和“每次注入模型的上下文”是两个不同问题。
5. Hermes 的 `AGENTS.md` 要求会话内保持 prompt 缓存前缀稳定。WEX 若将公共数据库实时更新直接写回正在执行的系统提示词，可能增加成本并破坏可重现性；需定义上下文快照版本与刷新时机。

## WEX 需要保留的不同所有权
- **角色记忆**：角色自身经历、偏好、技能与任务经验，归角色记忆 owner；可以记录项目来源，但不自动转移所有权。
- **项目 Context**：项目共享事实、目标、决策与引用，归 Space/Context owner；不等于任何单个角色的私人记忆。
- **公共数据库**：跨角色/跨项目可复用的经验、事件、分析、判断与修订历史，归公共知识 owner；条目需记录来源、证据、适用范围、版本与撤回。
- **Session / Operation**：执行过程、外部副作用与可信回执，归执行记录 owner；公共经验引用其证据，而非复制整个私有会话。

## 候选共享流水线（不是定稿）
角色工作→自身记忆持久化→识别可共享经验→生成带来源的候选条目→范围/敏感性/证据审查→公共库接纳/拒绝→其他角色按授权检索→引用时保留来源与版本。失败经验、冲突判断和被推翻的假设也可收录，必须标注状态，不把它们包装成确定事实。

### 共享开关的关键陷阱
“角色共享开关”只是配置入口，不能单独决定数据能否跨项目公开。角色意愿、项目/Space 策略、数据来源许可、敏感性和接收库策略可能冲突。候选方向是**角色提出共享意愿 + 项目与数据边界裁决 + 公共库接纳**；具体优先级待确认。读取公共库与贡献公共库应分开授权。

## 留给后续架构设计的难题（刻意不擅自定稿）
1. 角色被重置、转岗、替换模型时，记忆 owner 是否随角色身份持续？
2. 同一经验被两个角色反复贡献，如何去重、保留不同证据与相反判断？
3. 私有任务中总结出的通用技术经验，哪些部分可以脱敏共享？撤权后已引用的衍生经验怎么办？
4. 项目 Context 修订与角色会话缓存冻结冲突时，采用何种版本/刷新规则？
5. 角色贡献错误经验后，公共库如何标记争议、回滚及通知依赖该经验的 Agent？
6. 共享开关关闭时，是停止未来贡献、撤回未审核候选，还是请求撤销已入库条目？三者语义不同。
7. 自动共享应怎样通过可信回执、人工审核或验证结果形成质量门？

## 源码
- https://github.com/NousResearch/hermes-agent/blob/main/agent/memory_provider.py
- https://github.com/NousResearch/hermes-agent/blob/main/agent/memory_context.py
- https://github.com/NousResearch/hermes-agent/blob/main/agent/prompt_cache_boundary.py
- https://github.com/NousResearch/hermes-agent/blob/main/agent/subagent_lifecycle.py
- https://github.com/NousResearch/hermes-agent/blob/main/AGENTS.md

不声称 Hermes 已实现 WEX 公共数据库；这里只借鉴机制。
