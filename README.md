# WEX

> **产品名称：WEX。** 当前仓库：`owla19s-ux/WEXPCeasy`（仅为仓库标识，不是产品名称）。
>
> WEX 是面向个人长期工作的跨平台联通、调度与交互系统。本仓库当前聚焦 **WEX PC 端**。

## 当前项目状态

状态核对日期：2026-11-02（文档入口核对；**不代表代码已重新测试**）

- **当前工程位置：** 基础模块设计与首轮实现验证已完成到第八批；现按用户授权推进 connections 稳定范围的模块施工，0.1.1 版本计划尚未冻结。
- **最近完成：** [第八批交付报告](docs/batch8/REPORT.md)。基础模块复验及 Electron / React 宿主隔离实验已完成；报告记录 Linux E2 证据，**Windows E4 尚未通过**。这不是完整桌面产品交付。
- **已有产品源码：** `shared/`、`permissions/`、`app/`、`connections/src/`。连接模块当前最小范围与验证见 [施工回执](connections/CONFIGURED-DISPATCH-2026-11-02.md)。
- **实验与原型：** Electron / React 宿主实验位于 `experiments/electron-host-spike/`；React Flow 编辑器原型位于 `workflows/editor/prototype/`。
- **主要以契约/说明为主：** `space/`、`conversations/`、`AI/`、`workflows/`、`views/` 等业务域。目录或契约存在不代表产品功能已经实现。

### 规划依据与待闭合门槛

1. **产品功能与第二轮审查：** 已建立 [F01–F15基础功能总表](docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md)、[交互与UI边界](docs/product/INTERACTION-AND-UI-BOUNDARY-2026-11-01.md)、[第二轮需求对冲审查](docs/product/SECOND-ROUND-REQUIREMENT-REVIEW-2026-11-01.md)、[216项模块契约映射](docs/product/FUNCTION-CONTRACT-MAP-2026-11-01.md)和[基础功能施工准备度审查](docs/product/FOUNDATION-READINESS-2026-11-01.md)。第二轮静态审查已完成；CV/API/LOCAL/MODE/SD/VIEW/AIC/SH/APP候选子契约已回写到原owner。F10/F15复合owner已收敛，B级契约已完成技术一致性评审并修订；C实验仍有部分未关闭，PRD-D01～D13已完成部分决策收敛；D01/D02 核心语义已确认，Shell/插件/权限策略/凭证等特殊安全边界仍待确认。
2. **基础模块施工与组合验收：** 需先关闭契约缺口和对应实验/决策门槛，再按模块独立施工并复用H01–H30开展组合验收。
3. **UI与产品验收：** 基础功能及组合链路达到门槛后，才进行UI接线、真实用户操作和最终产品验收。
4. **0.1.1版本计划：** 完整需求确认后再从产品功能底表推导，不提前裁剪完整产品范围。

**文档权威提示：** [文档阅读与维护规则](docs/DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md) 说明最新产品需求、历史规划与实验报告如何区分；不能把过往阶段文档当作实时施工命令。

**当前规划顺序：用户确认D级产品政策/范围 → 在可用真实环境完成必要C实验或明确安全延期 → 确认完整需求基线 → 推导0.1.1版本表 → 基础模块施工与组合验收 → UI接线和产品验收。**

**产品功能规格更新（2026-11-02）：** [F01–F15 完整功能总表](docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) 的 216 项已合并逐项注释和进一步检查点；这不等于功能需求、真实代码或 Windows E4 均已验收。非代码文档重叠/状态风险见 [文档体系审查](docs/audits/DOCUMENT-SYSTEM-CONSISTENCY-AUDIT-2026-11-02.md)。

## AI / 协作者进入仓库的阅读顺序

1. **先读本 README：** 建立 WEX 产品身份、当前阶段、实现状态和工作入口认知。
2. **读 [AGENTS.md](AGENTS.md)：** 获取 AI 的最小强制引导与施工前检查要求。若使用的工具不会自动读取 AGENTS.md，任务发起者必须明确要求先读本 README 和 AGENTS.md。
3. **读 [文档总索引](docs/README.md)：** 根据当前任务定位架构、决策、研究、审查和批次资料。
4. **读取任务依据：** 以用户明确指派的任务为起点；后续正式阶段任务总表建立后，再按任务编号读取对应施工卡。不得自行把历史任务书当成新任务。
5. **读取相关模块：** 施工前必须阅读目标模块的 `README.md`、`CONTRACT.md`，以及实际消费到的提供方契约、相关架构和决策文件。不要求无差别通读全仓。

## API 历史成果与独立实验

[API 复用研究与 Pi AI 兼容验证](docs/research/api/README.md)：已建立历史追踪与可复现实验；整体无退化替换不通过，建议有条件复用部分协议能力。不是正式 API 模块重构或 Windows 验收。

## 产品与技术方向

- WEX 是产品主体；仓库名、目录名和实验名称不改变产品身份。
- 当前 PC 技术路线：**TypeScript + Electron（Windows 桌面宿主）+ React**。
- 工作流编辑器当前方向是 WEX 自研轻量自由画布（React/DOM 节点 + SVG 正交连线为实现候选）；既有 React Flow 原型仅是历史技术实验。工作流业务数据与节点调度由 WEX 自主维护。
- DSH 是独立外部 Agent 客户端；WEX 通过连接器研究任务交接与结果接收，不把 DSH 客户端/运行时搬入 WEX。
- `dsh/` 的 DSH Core + Loader 原生插件兼容实验，与 `connections/dsh/` 的外部 Agent 连接器是两条不同路线。
- SQLite 与用户选择的数据目录是当前持久化方向；具体产品实现与 Windows 行为仍需按实际证据验收。

## 模块与源码导航

完整职责、公开能力和模块契约入口见 [全模块契约索引](docs/MODULE-CONTRACTS.md)。

| 功能域 | 目录入口 | 主要职责 |
|---|---|---|
| 宿主与界面 | [app](app/README.md) · [UI](UI/README.md) · [views](views/README.md) | 启动装配、用户交互、视图呈现 |
| 工作组织与交互 | [space](space/README.md) · [conversations](conversations/README.md) · [AI](AI/README.md) | Space/Context、对话、角色配置 |
| 工作与连接 | [workflows](workflows/README.md) · [connections](connections/README.md) | 工作流/任务事实、受控连接和适配器 |
| 基础保障 | [permissions](permissions/README.md) · [shared](shared/README.md) | 权限决策、存储及共用技术能力 |
| 预留与独立研究 | [plugins](plugins/README.md) · [accounts](accounts/README.md) · [dsh](dsh/README.md) | 插件机制研究、身份预留、DSH 原生插件实验 |

## 权威文档入口

- [文档总索引](docs/README.md)：文档分类、归属与阅读导航。
- [全模块业务契约索引](docs/MODULE-CONTRACTS.md)：模块职责、公开能力、依赖和实现状态。
- [全局架构](docs/architecture/README.md)：跨模块架构和技术边界。
- [架构决策](docs/decisions/README.md)：已确认约束、候选、实验门槛和用户待决事项。
- [研究资料](docs/research/README.md) · [审查报告](docs/audits/README.md)：研究证据、缺口和验证结论。
- [产品需求基线](docs/product/README.md)：F01–F15基础功能、交互语义、UI映射、Owner/B/C/D收敛与需求审查。
- [G1–G7 基础能力落地映射](docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)：基础能力归属及跨对话持续工作要求。
- [第八批交付报告](docs/batch8/REPORT.md)：最近已完成批次的结果与证据。

## 基本协作原则

- 按模块 owner 施工；模块业务事实由对应模块维护，跨模块通过公开契约协作。
- 修改模块行为时，先核对并同步该模块的 README / CONTRACT；不要只改全局说明。
- 明确区分：**已决定、已设计、已编码、已测试、已独立验收**。文档、原型、替身测试不能冒充产品实现或 Windows 实机验收。
- 开始工作前重新读取远端最新 `main` 和实际代码；历史 SHA 仅用于追溯，不能直接当作当前施工基线。
- 默认以 `main` 作为集成主线；只有确有并行冲突或高风险隔离需要时才考虑短期分支。具体仓库操作和 AI 施工细则后续单独建立，不在入口文件内重复展开。
- 未经授权不扩大任务范围、不替用户关闭待决事项，也不把测试通过解释为产品范围已获批准。

