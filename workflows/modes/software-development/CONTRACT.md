# software-development 专业模式业务子契约（2026-11-01）

- 上级owner：workflows/modes。不是新的顶层模块，不取代workflows/runtime、space、connections、views或F13。
- 对应功能：F07-013～F07-020。
- 状态：B候选专业对象契约；对象类型/关系语义可评审，存储schema、ID格式、视图协议和自动化政策不冻结。

## 1. 专业对象及唯一归属

| 专业对象 | Owner | 说明 |
|---|---|---|
| Software Project | workflows/modes/software-development | 专业项目身份、说明、基准引用；不等于Context或物理目录 |
| Requirement / Function | workflows/modes/software-development | 需求与功能对象、版本、状态和相互关系 |
| Architecture / Component | workflows/modes/software-development | 架构元素、组件身份及专业关系 |
| Resource Mapping | 专业映射关系归本模式；文件/Git真实资源归connections/local/github | 只保存稳定引用、来源版本和映射目的，不复制文件内容 |
| Work Item Trace | 专业追溯关系归本模式；Task/Artifact归workflows | 不复制Task状态、Operation或Evidence正文 |
| Baseline / Decision | workflows/modes/software-development | 项目基准、决策内容、来源和版本；不替代Git commit或Task快照 |

## 2. 能力子契约

| 锚点 | F映射 | 输入 | 输出 | 生命周期/异常 |
|---|---|---|---|---|
| SD-01 项目对象 | F07-013/019 | 项目身份、说明、目标Context/既有项目引用、预期修订 | 专业Project身份/修订及Context关联引用 | Project可关联Context但不等同Context；创建/关联去重；移除模式不删除项目本体 |
| SD-02 需求与功能对象 | F07-014 | 对象类型、内容、来源、预期修订 | Requirement/Function对象版本及专业关系 | 修改产生新修订；冲突拒绝覆盖；对象不自动创建Task |
| SD-03 架构与组件关系 | F07-015 | 架构元素身份、关系类型、允许端点、来源版本 | 专业架构关系修订 | 需求—架构映射不是执行依赖；未知关系类型拒绝；显示名称不是身份 |
| SD-04 项目资源映射 | F07-016 | 专业对象、真实文件/Git资源引用、来源版本、映射用途 | 映射关系修订及资源来源投影 | 内容/版本归真实资源owner；失联/撤权标示不可用，不造同名副本 |
| SD-05 工作项追溯 | F07-017 | Requirement/Function/Architecture对象与Task/Artifact引用 | 可追溯关系和来源版本 | Task状态/产物状态由workflows维护；删除映射不删除Task/Artifact |
| SD-06 AI结构建议 | F07-018 | 获准对象投影、来源版本、建议范围 | 带来源和目标修订的草案 | 预览不写正式对象；采纳后调用对应owner；模型不得直接写关系或派发 |
| SD-07 基准与决策记录 | F07-020 | 项目对象、选择的对象/资源版本、决策文本、证据引用 | 不可变Baseline/Decision修订 | 基准不覆盖Git/文件当前事实；新旧基准并存；来源失效标记待核验 |

## 3. 与通用工作流的边界

专业模式描述专业对象、关系规则、默认配置和建议视图；workflows/runtime拥有Workflow定义、Task、执行轮次、等待和验收。专业关系、资源映射、视图映射和执行依赖是四种不同关系，不自动转换。实例化只生成可编辑草案和关系建议；逐个调用对象owner提交，部分成功逐项回执。更新/移除模式不删除Task、权限、Context、文件或Evidence。真实文件/Git读取写入仍走connections及permissions。

## 4. 验收样例

1. 创建Project不自动创建Context、Task或目录。
2. 新增Requirement→Architecture关系不生成Workflow执行边。
3. Resource Mapping引用文件v7；文件变成v8后旧映射保留来源并标记待核验。
4. AI结构建议未采纳时，专业对象修订数不变。
5. 删除模式关联后，已有Task、Git提交和验收证据仍可查询。
6. 模式实例化跨域部分提交时，已成功对象保留，未完成对象明确报告，不隐式补偿删除。
