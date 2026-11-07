# DSH 研究：能力接缝、注册与依赖注入

- 状态：研究记录；不是 WEXPC1 已采纳设计
- 来源：[Capability Seams And Core Services](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/capability-seams.md)、[LLM 服务源码](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)、[工具系统说明](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/tools/README.md)

## 1. 观察到的机制

### 1.1 能力接缝由三种角色组成

DSH 将一个可替换能力拆成：
- **Service Definition**：定义公开服务接口。
- **Service Provider**：提供具体实现。
- **Consumer**：通过接口使用能力，通常不导入实现包的内部细节。

一个包可以同时扮演多个角色，但概念上仍需区分。新增能力不能只写实现类，也要定义消费者如何发现和调用它。

### 1.2 注册表让消费者不必了解每个实现

LLM 适配器注册到 ctx.llm；工具注册到 ctx.tools。注册表负责将可用实现提供给消费者。工具声明还能被用于模型请求的工具 Schema 汇总，减少聊天循环中的专用分支。

### 1.3 生命周期和注册所有权关联

DSH 的 Scope 机制让注册的可见范围与释放责任关联：通过特定 scope 注册的监听或条目，可随该 scope 释放。其文档同时指出，这种机制用于可信同进程插件，不是安全隔离边界。

## 2. 对 WEX 的潜在启发

以下仅为候选，不代表已采纳：
- 为每项能力定义公开契约、提供者接口与消费者入口。
- 通过注册表发现能力，不让消费者直接扫描具体模块目录或导入具体实现。
- 注册动作应返回可释放的所有权句柄；停用时能清理注册、订阅和后台资源。
- 能力 ID、版本、提供者实例和激活代次应有明确区分。
- 注册表负责发现与分发，不应接管业务状态的权威所有权。
- 机器可检查的依赖声明应与实际模块引用保持一致。

## 3. 不应直接照搬的地方

- 同进程依赖注入或 Scope 不会阻止可信插件读取进程可访问的文件、内存和凭证。
- 统一注册表本身不等于动态加载器；它可能只接纳启动时已经加载的实现。
- 包清单里的依赖或版本字段若没有被运行时解析和强制校验，就只是声明。
- 不应把所有内部函数都升级成公共服务。只有真实跨模块边界才需要稳定契约。

## 4. WEX 需要进一步验证的问题

1. 注册表如何处理重复 ID、版本不兼容和批量注册失败？
2. 依赖服务停用时，消费者如何停止接收、排空在途调用并释放引用？
3. 注册与撤销是否具备可观察、可重放的状态变化通知？
4. 扩展是可信原生代码、受限 Wasm、脚本，还是独立进程？这决定能力接口的安全性和序列化成本。
5. 是否允许一个扩展同时提供后端服务和 UI 贡献，如何保证它们以同一版本代次激活？

## 5. 参考源码

- [能力接缝总览](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/capability-seams.md)
- [LLM 注册服务与流式调用](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)
- [Scope 注册生命周期](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/scope/README.md)
- [工具注册与执行扩展点](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/tools/README.md)

## 6. 进一步核对的注册表实现细节

对照当前 DSH 源码版本 `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` 的 `packages/llm/llm/src/index.ts`，可以确认几个比概念图更具体的约束：

- `registerAdapter()` 在写入前准备并校验整组 provider routes；任一键冲突时整组注册失败，不留下部分路由。
- 注册返回 disposer；释放时删除该注册拥有的全部路由，并发布 `llm/adapters-updated` 通知。
- 注册句柄提供 `replace()`：先完整校验候选集合，再在一个同步区段替换，避免消费者观察到短暂的空档；已释放的句柄拒绝再次注册，防止资源失去释放所有者。
- DSH 对适配器路由采用“一个 provider route 对应一个所有者”的冲突策略；这不代表所有能力都应采用单提供者模式。源码中的其他能力明确使用命名多提供者注册表，以满足多个实现共存的需求。
- 注册表变化事件只负责通知消费者重新读取当前目录；消费者不依赖事件载荷保存第二份权威状态。

这些实现细节值得 WEX 研究的是**注册的所有权、整组校验、替换原子性和状态通知**，而不是直接照搬“每个 ID 只能有一个实现”。WEX 必须按能力语义决定：某些能力需要唯一所有者，另一些能力需要多个可命名提供者并存。

参考：[LLM 注册实现](https://github.com/DeepSeek-AI/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/llm/llm/src/index.ts)、[provider-routed LLM adapters 设计记录](https://github.com/DeepSeek-AI/deepseek-harness/blob/22ddee3792402c3e3e895a2f60/.agents/notes/implemented/architecture/2026-07-14-provider-routed-llm-adapters.md)。
