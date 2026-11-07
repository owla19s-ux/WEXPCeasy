# DSH 研究：AI 施工约束与验证

- 状态：研究记录；不是 WEXPC1 已采纳施工规范
- 来源：[DSH 架构文档](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)、[扩展开发指南](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)、各核心包 README 与测试说明

## 1. 观察到的工程方式

DSH 不只在顶层列出模块，也为具体服务维护包级 README、源码地图、公开契约、扩展点说明、已知限制和测试入口。架构文档提供“某种新行为应该挂在哪里”的映射，避免每次加功能都直接修改核心循环。

包清单、类型声明、注册接口和契约测试共同形成约束；不过并非所有清单声明都会自动强制执行，文档本身也明确记录了这种限制。

## 2. 对 WEXPC 的潜在启发

### 2.1 每个模块提供施工所需的完整上下文

模块说明至少需要回答：
- 模块负责什么、不负责什么；
- 对外公开哪些接口；
- 依赖哪些服务，哪些依赖禁止；
- 谁拥有权威状态；
- 生命周期与失败语义；
- 如何运行局部测试和契约测试；
- 新能力应该通过哪个扩展点接入；
- 哪些文件或接口不应由普通功能改动触碰。

### 2.2 将关键架构约束变成自动检查

优先检查：
- 跨模块内部引用；
- 实际依赖与声明依赖不一致；
- 重复能力 ID、循环依赖和接口版本冲突；
- 模块缺少说明、契约测试或错误处理；
- 新增供应商／连接器时修改中央业务循环；
- 注册与停用后仍残留监听、任务或资源；
- 公共接口变化没有同步更新兼容测试。

### 2.3 AI 任务按完整能力链路拆分

施工任务不应只按文件数拆分。一个任务应有清晰的模块边界、接口输入输出、状态 owner、失败条件和验收证据。并行施工前先明确共享接口和互不冲突的修改区域；若没有可证明的隔离边界，应优先单线施工。

### 2.4 验证结果分层记录

至少区分：
- 静态架构检查；
- 单元与契约测试；
- 集成测试；
- 真实外部服务验证；
- 桌面运行时验证。

通过某一层不能自动宣称其他层也通过。尤其模拟适配器测试不能证明真实供应商连接可用；代码能编译也不能证明扩展可热加载。

## 3. 风险与限制

- 目录、README 与类型声明都不能替代机器校验。
- 测试不能证明未测试的运行时隔离安全性。
- 过度拆包会增加依赖管理、构建与版本协调成本；应按稳定边界拆分，而非每个文件一个包。
- 为了追求模块自治而复制共享安全逻辑，会造成授权和审计策略分叉。
- 自动化规则必须与真实代码结构一致，不能只检查文档中声明的边界。

## 4. WEX 候选下一步

1. 先从一个模型协议扩展试点抽取模块契约模板。
2. 让模块清单与注册结果可机器核对。
3. 为跨模块依赖和公开接口建立最小架构检查。
4. 在试点中记录 AI 实际修改的文件范围、违反约束的情况、返工原因和验证证据。
5. 只有经过实际施工验证的规则才升级为 WEXPC1 的候选规范。

## 5. 参考源码

- [DSH 架构与扩展点地图](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)
- [扩展开发指南](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)
- [包清单的静态声明限制](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/util/package-manifest/README.md)
- [客户端模块加载与限制](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/client/modules/README.md)