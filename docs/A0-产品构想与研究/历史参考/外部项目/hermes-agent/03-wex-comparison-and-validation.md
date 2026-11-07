# Hermes × DSH × WEX｜参考价值与边界

状态：候选分析，不是已采纳的产品范围。

| 关注点 | DSH 主要参考 | Hermes 主要参考 | WEX 需要自定 |
|---|---|---|---|
| 模块化 | Service/Provider/Consumer、Loader、HMR | 窄核心、边缘插件/skills | 功能聚合、模块清单、机器依赖规则 |
| Agent | Tool pipeline、Workflow、Subagent | 公共子 Agent 生命周期与可序列化句柄 | 主 AI/秘书/执行/审查岗位可复任，身份/职责分离 |
| 上下文 | Session 投影、Compaction | 冻结会话前缀、项目文件、MemoryProvider | Space→Group→Context，项目共享、版本和授权 |
| 长期工作 | 事件日志、持久化检查点 | Cron、新会话、自足任务、脚本免模型 | Task/Dispatcher/Execution 独立状态与可信回执 |
| 多入口 | Host/Client remotes、UI slots | CLI/Gateway/桌面统一核心 | Windows 优先、手机远程查看/确认后续 |
| 安全 | Scope 非沙箱、执行前授权 | 委托工具范围、插件加载防卡死 | 独立授权、凭证、审计与恢复机制 |

## 高价值研究候选
1. **Agent 委托句柄**：可序列化、有版本、有超时/取消/未知状态；跨进程、重启和不同模型实现不直接泄露运行时对象。
2. **上下文快照语义**：单次会话稳定前缀与 Space 持续变化分开；明确何时重新装配 Context、何时保留旧版本。
3. **计划任务免模型路径**：脚本/规则可独立完成的工作不必每次消耗主模型；任务产物仍进入统一回执链。
4. **记忆来源与质量门**：长期记忆、可学习技能、项目文件不是同一种事实；自动技能改写必须留来源、版本与回退。
5. **入口与工作身份分离**：消息渠道/设备入口不能直接决定 Agent 权限或项目 Context。

## 需要避免
- 把 Hermes 的个人记忆层直接替换 WEX 的 Space/Context。
- 把子 Agent handle 当权限凭证的唯一来源，或把取消请求当外部操作回滚。
- 为追求缓存稳定而禁止项目上下文更新；正确做法是定义会话边界和版本。
- 因为 Hermes 支持很多入口就立即扩大 WEXPC 0.1.1 范围。
- 把 Python 插件加载当作 Rust/Windows 动态扩展的现成实现。

## 下一步验证问题
- Agent 启动时如何固定 Space/Context 修订与权限快照？中途更新何时可见？
- 子 Agent handle 在重启、超时、父任务结束、撤权后如何查询与恢复？
- 定时任务的 owner、触发去重、结果投递和无模型执行是否复用 WEX Operation？
- 技能自动更新如何审核、回滚并防止污染共享项目记忆？

不修改原设计；后续验证应另建文档或原型。
