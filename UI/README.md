# UI

> **当前代码事实（2026-11-07，`main bd72dfea`）**：正式 `UI/src/index.ts` 定义受限桌面桥、`UI/src/renderer.tsx` 运行 React，`UI/src/space.tsx` 与 `space-addresses.tsx` 提供 Space/Context 操作页面。Renderer 当前主要挂载宿主状态及 SpacePanel；Agent、Conversations、设置页、多视图未有完整正式页面接线验收。历史 2026-11-04 的无产品 UI 判断已失效。

WEX 内置界面。主入口已经采用 React/TypeScript，负责导航、加载页面和挂载模块面板；模块业务由各自 owner 维护，UI 仅调用受限宿主桥。不得把旧研究中的“语言未定”作为当前开工事实。

状态：已具备正式 UI 入口、Space 页面及基础测试/桌面验证；仍为 **B3 部分实现**，不是完成的 Windows 交付。当前功能到 UI 的映射和 PC 设置页设计以 `UI/CONTRACT.md` 与 0.1.1 B3 任务书为准。

[源码目录与 Windows 数据要求](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。



## 第四批：模块业务契约设计（历史研究）

[本模块契约与独立验收规格](CONTRACT.md)列明公开能力、消费依赖、权威/私有边界、失败与未知、修订恢复和可断言样例。能力粒度与新增语义为待评审设计；已定约束、推荐、待实验、待决策分别标明。不是产品实现、正式接口或全部协议已定稿；只施工成熟能力，未决项不靠猜测补全。

## 基础桌面交互补充（2026-10-31；候选目录，尚未实现）

依据[源码目录 §12](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md#12-基础能力补充后的代码目录归并2026-10-31-审查建议尚未创建源码子目录)与[基础能力缺口清单](../docs/audits/APP-FOUNDATIONS-GAP-AUDIT-2026-10-31.md)，在现有页面与模块面板挂载原则下，将通知呈现/历史入口候选归于`notifications/`，跨模块搜索/跳转交互候选归于`search/`。二者**尚未创建且无需提前建立**，简单交互可直接写在使用它的实际页面。设置页负责挂载各模块自身配置、诊断、日志浏览/导出入口，不能因此接管底层配置或审计权威。

通知/搜索必须经领域公开的获准查询构建结果，不能绕过权限或把缓存当最新业务事实；撤权、目标失联、旧通知跳转及旧搜索结果须重新校验来源。主UI只保存临时焦点与交互，不维护第二套Task、Operation、许可、连接状态。Windows菜单、系统托盘、快捷键和拖放按app平台接线与UI实际交互协作，不为每种原生功能建独立目录；高DPI/键盘/无障碍支持随真实窗口验收。

验收需检查通知误报、无权搜索泄漏、跨窗口过期结果、旧缓存、消息/日志导出脱敏及程序未配置完整时的可用性；目前只有设计，没有桌面成品。


### 第六批施工准备度（历史：2026-10-31）

**黄**：第六批[历史条款](CONTRACT.md)记录当时准备度，不是当前施工命令；C/D未决能力继续暂缓，绿色不代表全域实现/验收完成。[全域矩阵](../docs/batch6/READINESS.md)、[实验结果](../docs/batch6/EXPERIMENTS.md)、[施工顺序](../docs/batch6/NEXT.md)。


## 文档入口

- [本域契约及关联依据](CONTRACT.md#文档关联与施工入口)
- [WEXPC1 文档体系总索引](../docs/README.md)
- [全模块契约索引](../docs/MODULE-CONTRACTS.md)

当前施工范围与必要契约摘要以本 README 和根 README 为入口；历史契约及其关联资料只供按需追溯，不自动派工或批准候选政策。


## 第八批验证补充（2026-10-31）

**历史第八批结论（2026-10-31）**：当时正式页面/IPC 尚未产品化；隔离React最小页面已验证窄preload状态查询、错误反馈与Renderer无Node。负例探针属于测试preload，不是公开产品API。AST新增禁止UI直接导入permissions等特权领域；业务事实仍由owner持有。见[第八批报告](../docs/batch8/REPORT.md)与[实验说明](../experiments/electron-host-spike/README.md)。

## G5/G7：内部检索与输入附件

UI 聚合各业务 owner 的获准查询并负责导航；外部互联网 Search/Fetch 不等于内部检索。输入页支持文本及后续文件选择/拖入/粘贴、附件预览和来源提示，但文件访问通过 App/Connections 窄能力，Renderer 不直接读取任意路径。UI 可呈现 Task 检查点与“继续”入口，点击后先交 Workflows 核对，不直接派发。

跨域要求见[基础能力落地映射](../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
