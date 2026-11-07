# DSH 研究：协议与适配器边界

- 状态：研究记录；不是 WEXPC1 已采纳协议
- 来源：[LLM 类型定义](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/types.ts)、[LLM 服务](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)、[DeepSeek 适配器](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/adapter.ts)、[适配器开发指南](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md)

## 1. 核心分层

DSH 把供应商无关的消息、内容块、流式片段、结束原因和失败事实放在公共 LLM 契约中。具体适配器负责请求序列化、传输、流式协议解析，以及供应商响应到公共语义的转换。

这使上层依赖“生成、增量内容、结束或失败”等稳定语义，而不是依赖某一家模型 API 的原始 JSON。

## 2. 源码中值得关注的协议约束

- 工具调用参数以原始 JSON 字符串流转，避免不同层对对象序列化产生歧义。
- 流式块有稳定的 block index；同一个块的增量复用其索引。
- finish 是终态；适配器需要正确处理结束标记前后可能到达的 usage 数据，不能在终态后继续发送内容。
- 传输／协议失败与供应商在流中表达的失败有明确路径，消费者必须处理两者。
- 取消信号传递到实际网络请求，不能只停止 UI 等待。
- 适配器无法兑现的参数应明确报不支持，而非静默忽略。
- 供应商原生续传状态需要保留必要的无损数据，并验证其适用的历史路由；不能只凭供应商或模型名字猜测状态可复用。
- 连接、模型和配置在一次调用开始时应有一致快照，避免运行中修改设置导致请求语义漂移。

## 3. 对 WEX 的潜在启发

### 协议不等于供应商 API 包装

WEX 的公共协议应描述上层需要的语义；适配器负责将它映射到供应商协议。不能把一个供应商的字段直接变成所有模块必须理解的公共字段。

### 流式事件需要完整状态机

最低限度需要定义：
- 调用身份与关联标识；
- 有序事件／增量内容；
- 终态种类与唯一结算；
- 错误分类与可否重试；
- 取消、超时与断线的区别；
- 背压、缓冲上限和事件序列异常；
- 工具调用提议何时变成可执行的完整请求；
- 供应商特有续传状态的隔离与版本兼容。

### 错误语义必须与重试策略分离

适配器提供稳定错误事实，例如错误码、HTTP 状态、请求 ID、Retry-After；是否重试由调用边界根据副作用、幂等性和结果是否未知决定。不能由所有适配器各自决定同一类业务操作是否重试。

### UI 事件与持久事实需要分开

增量 token 可用于实时呈现，但不能自动等同于持久完成事实。WEX 应明确区分临时流事件、已提交消息、操作状态和最终回执。

## 4. 不应直接照搬的地方

- DSH 的 StreamChunk 是其 Agent/LLM 体系中的协议，不应未经对照就成为 WEX 所有连接器的通用协议。
- 统一接口不意味着所有供应商都支持同样的功能；能力声明、协商和不支持错误仍然必要。
- 保留原生续传数据可能引入供应商绑定与敏感数据风险，需要由 WEX 的连接与凭证模型决定存储策略。

## 5. 参考源码

- [LLM 公共类型](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/types.ts)
- [LLM 服务和适配器注册](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)
- [DeepSeek 适配器](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/adapter.ts)
- [添加 LLM 适配器的协议义务](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md)