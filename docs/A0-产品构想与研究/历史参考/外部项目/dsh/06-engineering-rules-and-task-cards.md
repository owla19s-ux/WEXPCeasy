# DSH 研究：工程规则如何转化为施工卡

- 状态：研究记录 / WEXPC 施工卡方法的候选参考
- 主要来源：[AGENTS.md](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/AGENTS.md)、[文档标准](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/AGENTS.md)、[新增包清单](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)、[LLM 适配器开发指南](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md)、[配置校验器](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/scripts/verify-cordis-config.ts)。

## 1. DSH 如何让工程知识进入施工过程

DSH 没有只依赖一份巨型开发说明。它按用途分配知识的权威位置：

- 根 `AGENTS.md`：全仓必须遵守的短规则与导航。
- 子树 `AGENTS.md`：某个目录独有的施工规则。
- 架构文档：组合关系、核心包、事件域与扩展点地图。
- 子系统参考：类型定义与语义。
- 包级 README：单个模块的公开 API、事件、扩展点、限制和测试说明。
- Cookbook / Checklist：执行具体变更时的步骤和验收要求。
- 机器校验脚本：检查配置、依赖、包结构和其他可机械判断的约束。

这套分层的关键是每条事实尽量只有一个权威位置，其他文档链接到它，避免同一规则在多个文件里逐渐不一致。

## 2. 施工清单是按变更类型定义的

DSH 的 `adding-a-package.md` 不是泛泛的“编码规范”，而是新增一个包时需要处理的文件、导出、依赖、构建引用、README 和验证步骤。LLM adapter cookbook 则定义适配器的协议义务：流式终态、原始 JSON 参数、取消信号、错误类型、不支持参数的处理、续传状态验证与测试。

这说明施工任务应当由**变更类型 + 目标模块 + 所依赖的契约**共同决定，而不是每次都从零生成一段自然语言需求。

## 3. 机器校验与文档规则的分工

文档解释为什么与如何；脚本检查可机械判断的事实；测试检查运行行为；代码审查处理难以形式化的判断。不能用其中一种替代其他三种。

DSH 的配置检查器会解析 Loader 配置，检查元数据字段是否被错误地写成动态表达式、引用的插件包是否能从所属 package manifest 解析、客户端扩展是否声明了正确的客户端入口等。这是把架构边界变成可执行检查的实例。

同时，DSH 自己也记录了限制：包清单字段不一定被运行时强制执行，某些边界仍依赖显式校验和测试。因此 WEX 不应把“存在文档或字段”当成“约束已经生效”。

## 4. 对 WEX 的候选施工卡结构

以下是供后续设计的候选，不是当前正式模板。

### 身份与目标
- Task ID、目标版本、所属模块、变更类型、前置任务。
- 需要实现的可观察行为与明确不在范围内的行为。

### 契约与依赖
- 依据的模块说明、接口版本、数据结构和错误语义。
- 需要的服务、事件、权限和能力声明。
- 允许修改的模块及禁止触碰的内部实现。

### 实施要求
- 必须新增或修改的公开接口、注册声明、配置和文档。
- 生命周期、取消、重试、副作用、并发与状态所有权要求。
- 是否允许新增依赖；若允许，必须说明引入理由和运行时影响。

### 验证要求
- 静态架构规则、格式／类型检查、单元测试、契约测试、集成测试。
- 外部服务或真实桌面运行时测试是否必要。
- 每项验收标准对应的命令、测试名称或可复现证据。

### 回执
- 修改文件和接口清单、提交 SHA、实际执行的验证及结果。
- 未执行的测试、已知限制、偏离施工卡的原因。
- 是否满足下游任务前置条件，以及是否需要更新模块契约。

## 5. 从文档生成施工卡时的约束

1. 施工卡必须引用具体版本的契约或文件路径，不能仅写“遵守架构”。
2. 依赖未满足时，生成器应标记阻塞，不得擅自补设计。
3. 验收条件应可观察、可复现；“代码质量良好”不算验收标准。
4. 任务范围应以模块边界表达，文件清单是初始边界而非绝对限制；若实施发现需要跨界修改，应先回报契约缺口。
5. 任务结束必须更新工程状态：实现状态、验证状态和文档状态分开记录。
6. AI 生成的施工卡需经过规则校验；初期可人工审阅，稳定后再提高自动化程度。

## 6. WEX 需要验证的方向

- 模块文档能否提供足够信息生成可施工任务，而无需 AI 重新发明接口？
- 是否能从模块依赖图自动识别前置任务和冲突修改范围？
- 能否将验收标准关联到可执行测试或架构检查？
- 施工卡能否被多个不同 AI 执行，并产出结构一致的回执？
- 当代码与契约不一致时，系统能否阻止任务被标记为完成？

## 7. 源码入口

- [DSH 根施工规则](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/AGENTS.md)
- [文档分层标准](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/AGENTS.md)
- [新增包施工清单](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)
- [LLM 适配器契约与验证](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-an-llm-adapter.md)
- [Loader 配置机器校验](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/scripts/verify-cordis-config.ts)
- [文档与质量门调度器](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/scripts/run-gates.ts)