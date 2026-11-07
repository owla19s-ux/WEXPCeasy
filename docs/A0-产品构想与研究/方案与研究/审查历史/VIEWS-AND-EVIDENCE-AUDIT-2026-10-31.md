# 视图生态与设计—源码—实验一致性静态审计

审计时间：2026-10-31。只读 GitHub main，固定提交 **70406cf3924035b1982e2f8b2a769ca51c9406b8**（main 提交接口与递归树已核对）。下文为静态源码/文档核查，本次未安装依赖、未运行测试、未触发 Actions、未改远端。源码链接均固定该 SHA。

## 结论

React Flow 保持首期二维工作流编辑重点；当前实现仅独立编辑草稿原型。专业视图、多图映射、状态传播及三维都没有产品实现。现有方向无需换引擎；最有价值的收敛是把业务对象/关系、视图出现/布局、运行与核验状态分别维护，并去除文档时间线造成的“已验证/待验证”歧义。

## 声明与源码核对

| 声明 / 设计 | 静态证据与分类 | 判断 |
|---|---|---|
| views 为专业视图归属，当前仅说明 | [views/README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/views/README.md)；递归树 views 下只有该文件 | 一致：职责规划，无引擎代码 |
| React Flow 仅交互渲染、不拥有执行语义 | [App.tsx](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/src/App.tsx)、[model.mjs](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/src/model.mjs) | 基本一致：model 无库 import，toFlow 输出普通对象；App 不导入连接器/调度/权限 |
| 4 节点、3 连线、增删改名移动连接、修订冲突 | model 初始草稿、applyEdit 分支；App 事件适配 | 有实际代码，但仅本地单草稿；baseRevision 检查不等于多人并发控制 |
| 定义与布局独立 | [editor README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/README.md) 对正式方向有此要求；[model.d.mts](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/src/model.d.mts) 的 Draft 同含 position、viewport、业务字段 | 已明确承认实验偏差。正式拆分未实现，不能称已完成业务/布局独立迁移 |
| 人与 AI 统一编辑 | App 常规编辑调用 applyEdit | 仅证明入口可复用；没有真实 AI、授权、并发服务。重置直接恢复种子，是已披露的原型管理例外 |
| viewport 保存恢复 | model 有 viewport 命令，但 App 未传 viewport/defaultViewport/onMove 等受控适配，使用 fitView | 当前仅种子字段，未接视口持久化；文档限制正确 |
| 按类型拆节点 | [nodes/index.tsx](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/src/nodes/index.tsx) 分派四文件，nodeTypes 在模块级定义 | 属呈现结构整理；业务 kind 是字符串，未知种类降级 NodeShell，不能推断专业规则兼容 |
| 任务执行/进度投影/多图传播 | views 与 [workflows README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/README.md) 分配 owner；App 无任务或多图实现 | 规划，非产品能力。编辑器关闭不取消任务、撤权缓存处理均未运行验证 |
| 测试构建通过 | [验证报告](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/VERIFICATION-2026-10-30.md)、[原型 README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/README.md)、[App.test.tsx](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/editor/prototype/src/App.test.tsx) | 历史报告称拆分后 5 模型+6 DOM/TS/Vite/HTTP 通过；本次只核对报告与测试源码，不复验。jsdom/HTTP 不证明鼠标拖拽、布局、连线命中或 Electron |
| 所有域已有实现 | [根 README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/README.md) 明确大多数只有职责文档、未交付 WEX 应用 | 现行摘要准确；不能用目录存在证明实现 |

源码风险仅作后续实验输入：App 每次节点位置变更都 structuredClone 整个 Draft、整图投影并同步 localStorage 全量 JSON 写入；4 节点样本无法证明大图/高频拖动性能。readDraft 仅浅层形状检查，connect 检查端点与重复 source-target，却未验证业务端口、环路、显式边 ID 唯一、专业类型/版本；不能提升为正式契约或任意缓存导入校验。

## 官方生态核对及适用边界

通过 Context7 读取官方文档摘录；ELK 通过官方 GitHub README。通用 web 搜索及直开均返回工具错误，故改走以上官方来源。它们是当前文档，不是对原型锁定 React Flow 12.12.0 的兼容性/性能实测。

| 技术 | 官方证据 | 对 WEX 的研究判断 |
|---|---|---|
| React Flow | [ReactFlowProvider](https://reactflow.dev/api-reference/react-flow-provider) 要求同页多 flow 各有独立 Provider；[性能建议](https://reactflow.dev/learn/advanced-use/performance) 强调稳定组件/回调、避免全 nodes 订阅，选择状态分开 | 适合继续首期节点编辑。每张图自己的 UI store/viewport/selection；业务引用与状态 owner 由 WEX 保持。Provider 不提供跨图业务同步或授权 |
| Cytoscape.js | [初始化](https://github.com/cytoscape/cytoscape.js/blob/unstable/documentation/md/core/init.md)、[batch](https://github.com/cytoscape/cytoscape.js/blob/unstable/documentation/md/core/batch.md)：一 core 对应一图，支持 headless，batch 减少样式计算/重绘 | 可作为未来关系分析/图算法与密集关系图候选；需要独立适配与交互验证，无理由据此替换已选首期编辑器，也不能承诺固定节点上限 |
| ELK/elkjs | [官方 README](https://github.com/kieler/elkjs/blob/master/README.md)：只算布局、不渲染；layered 适合有方向和端口的图；layout 异步、可用 Worker | 与 React Flow 互补，非替代引擎。未来按视图生成布局快照，异步结果必须核对输入修订，避免覆盖较新的手动坐标；该修订策略是建议，非已实现 |
| Three.js | [官方 cleanup](https://github.com/mrdoob/three.js/blob/dev/manual/pages/cleanup.html)：geometry/material/texture 等 WebGL 资源需显式 dispose | 仅未来三维呈现候选；不是关系数据库、图算法或业务同步层。需研究拾取、标签、二维对应与资源释放，当前不纳入首期必需链路 |

规模不设未经测试的“可支持万节点”承诺。后续 PC 窄实验可分 100/500/1000 节点、不同边密度/节点复杂度、单图与三图，分别测首次可交互、拖动帧时、编辑提交时延、布局耗时、内存及关闭视图资源释放；与真实专业样本共同决定优化/替代需要，节点数量不能独立代表负载。

## 旧耦合、重复与保留建议

1. 文档状态堆叠：editor README 首段仍说节点拆分后未重跑；原型 README 前部写5+5、拆分节写未重跑，末尾才补5+6通过。根摘要已纠正。建议只在各入口保留“最新状态+历史报告链接”，历史段显式历史日期/基线；无需再建平行架构文档。
2. 定义/位置同 Draft、单一 localStorage KEY、全量保存是刻意缩小的实验布局。保留其不可变编辑、失败先不提交、选择与持久数据分离等行为证据；不要直接搬为 views 正式多图存储。
3. [模型协调实验](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/experiments/model-coordination-spike/README.md) 与 [运行时加载实验](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/experiments/runtime-loader-spike/README.md) 保留来源和故障证据。两者 README 仍提 Rust/Tauri 下一步，应标明历史试点，不覆盖新 TS/Electron 基线；它们不验证当前视图集成，本次未审其全部源码。
4. 不因实验位于 workflows 就迁移/重写全部视图；不为“每种图/同名节点”复制状态机或创建新系统。先以一个 Task 在执行图、架构图、验收图的不同投影验证唯一 owner、来源版本、暂停传播/恢复和失效展示，仍保持领域修改经唯一入口。

## 检查边界

已读：固定 SHA 递归树、根 README、views/workflows/editor/prototype README、验证报告、App/model/声明/DOM 测试、节点注册及 package.json；模型协调和加载实验 README。未逐文件检查全仓、全部历史旧资料、DSH/连接器实验实现、安全/许可证全量合规、锁文件完整性或依赖漏洞；没有运行源码、浏览器、Windows/Electron、跨图/撤权/恢复或规模测试。未确认任何新协议/接口签名，未作删除或远端更改。

