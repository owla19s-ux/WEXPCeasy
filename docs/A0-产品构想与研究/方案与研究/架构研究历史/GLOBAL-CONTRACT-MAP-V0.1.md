> **适用性更新（2026-11-04）**：本文保留历史架构推演及已确认约束；旧 workflows/runtime 调度目录方向已由顶层 [scheduler](../../../../scheduler/README.md)取代。当前模块入口与研究契约使用规则见[根 README](../../../../README.md)，不依据历史目录自动派工。

# WEXPC1 模块化施工与契约设计方法研究（全局契约地图修订）

日期：2026-10-31，北京时间。第三批研究；WEXPC1 基线 `70406cf3924035b1982e2f8b2a769ca51c9406b8`。

本文沿用原文件名维护统一方法，未建立另一套顶层架构。[原 2026-10-29 候选地图](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/docs/WEXPC-GLOBAL-CONTRACT-MAP-V0.1.md)可追溯，但其 Rust/Tauri、扩展管理及旧逻辑目录不再作为新实现约束。正式职责以[第二批审查](../../../decisions/RESEARCH-DECISIONS-2026-10-30.md#6-第二批整体职责与依赖方向)及源码目录 README 为准。本批建议均标为建议，不因引用成熟项目而自动成为 WEX 已批准方案。

## 1. 前提、证据等级与研究方法

- 已确认：TypeScript/Electron/React 路线；Context 独立与跨 Space 引用；角色/授权分离；模板可选；连接器与插件机制分开；视图不拥有任务真相。
- 第二批职责细化：组织、消息、任务、操作回执、权限和投影的唯一维护方；不是已经实现的正式接口。旧 [WEXPC 产品基线](https://github.com/owla19s-ux/wexpc/blob/main/docs/PC-PRODUCT-AND-TECH-BASELINE.md)中仍适用的 §0/§2.7 业务原则保留，旧技术与 project_id 耦合不继承。
- 既有实验：[编辑器](../../../../workflows/editor/prototype/README.md) 5 模型+6 DOM/构建/HTTP；[DSH 外部进程](../../../../connections/dsh/README.md) 13 回归，真实探测仅凭证缺失失败；[边界交换](../../../../connections/README.md) 5 替身测试；[Cordis 宿主](../../../../dsh/runtime/README.md) 已有真实加载/卸载/失败实验。全部是既有证据，本批未重跑，不外推 Windows、成功 Agent 任务或产品验收。
- 本批静态阅读官方文档和固定提交源码，另做隔离的 dependency-cruiser 小夹具验证（§7）。未构建/运行 Theia、Backstage、Modulith、Nx 或 Pact，不宣称这些平台通过 WEX 兼容测试。
- 根 `AGENTS.md` 在本次 main 中不存在；本批遵循用户任务和现有 README，不把本次建议偷偷写成强制协作指令。

固定方法：**真实业务链路 → 模块行为分析 → 模块职责归并 → 业务契约 → 实现接口 → 通信协议 → 模块独立施工 → 系统组合验收**。链路是需求样本和组合验收依据，施工卡以模块为单位。先问“谁拥有事实与决定”，再问“消费者缺哪项公开能力”；不能按链路复制状态，也不为每个名词增设模块。

## 2. 开源机制与具体源码证据

以下来源均为官方项目，源码链接固定 commit；网站文档也读取其官方源码。固定快照用于本次研究，不表示选定这些项目的版本作为 WEX 依赖。

### 2.1 Eclipse Theia

T1 文档：[Services/Contributions](https://github.com/eclipse-theia/theia-website/blob/a89aa9287f7cecae94e3caceb1ec8bedc6709cb1/src/docs/services_and_contributions.md)、[Architecture](https://github.com/eclipse-theia/theia-website/blob/a89aa9287f7cecae94e3caceb1ec8bedc6709cb1/src/docs/architecture.md)、[RPC](https://github.com/eclipse-theia/theia-website/blob/a89aa9287f7cecae94e3caceb1ec8bedc6709cb1/src/docs/json_rpc.md)。

T2 源码：[RemoteFileSystemServer 契约/标识](https://github.com/eclipse-theia/theia/blob/2e6065588d8cf4fc82a79b992f3680fd4cd5e809/packages/filesystem/src/common/remote-file-system-provider.ts)；[前端绑定](https://github.com/eclipse-theia/theia/blob/2e6065588d8cf4fc82a79b992f3680fd4cd5e809/packages/filesystem/src/browser/filesystem-frontend-module.ts)；[后端绑定/处理器](https://github.com/eclipse-theia/theia/blob/2e6065588d8cf4fc82a79b992f3680fd4cd5e809/packages/filesystem/src/node/filesystem-backend-module.ts)；[ServiceConnectionProvider](https://github.com/eclipse-theia/theia/blob/2e6065588d8cf4fc82a79b992f3680fd4cd5e809/packages/core/src/browser/messaging/service-connection-provider.ts)（[旧入口弃用标记](https://github.com/eclipse-theia/theia/blob/2e6065588d8cf4fc82a79b992f3680fd4cd5e809/packages/core/src/browser/messaging/ws-connection-provider.ts)）。

实际机制：common 中给出运行时服务标识和 TS 契约，browser/node 分别装配本环境的实现。文件系统前端模块绑定 RemoteFileSystemServer 代理，后端模块用 RpcConnectionHandler 在对应服务路径暴露实现；本地服务和跨环境代理不是同一件事。ServiceConnectionProvider 区分 local/remote；旧 WebSocketConnectionProvider 文件已标 deprecated，不能照旧教程固化该类。

适用 WEX：借鉴“公开能力与实现分离、宿主装配、环境中立契约与 UI/Node 适配分开”。代价是要明确生命周期/数据传输边界；可先用普通函数/构造参数注入，不必引入 Inversify。不可照搬完整 IDE、Express/WebSocket、远端后台和扩展启动图。Theia 源码本身有跨包 lib 深路径导入，因此只采用服务约定不能证明 WEX 私有边界已被工具限制。

### 2.2 Backstage

B1 文档：[Services](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/docs/backend-system/architecture/03-services.md)、[Extension Points](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/docs/backend-system/architecture/05-extension-points.md)、[Modules](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/docs/backend-system/architecture/06-modules.md)。

B2 源码：[ServiceRef/createServiceRef/createServiceFactory](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/packages/backend-plugin-api/src/services/system/types.ts)；[createBackendPlugin](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/packages/backend-plugin-api/src/wiring/createBackendPlugin.ts)；[createBackendModule](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/packages/backend-plugin-api/src/wiring/createBackendModule.ts)；[createExtensionPoint](https://github.com/backstage/backstage/blob/3b9701665d5727cddfdd3889961377e9e129cfaa/packages/backend-plugin-api/src/wiring/createExtensionPoint.ts)。

实际机制：ServiceRef 带公开类型、标识及 root/plugin scope；createServiceFactory 声明依赖并创建实现。Extension Point 是插件提供的受限定制入口，面向扩展同一插件的 module；module 初始化先于该插件初始化，不能当作任意时刻的通用 RPC 服务。createBackendPlugin/Module 的 registerInit 收集 deps/init，createExtensionPoint 产生引用对象。文档所说“无 service factory”不等于注册绝不接受 factory：当前 registerExtensionPoint 源码支持注册期 factory 形式，应区分其与独立 ServiceFactory。

适用 WEX：借鉴提供方维护窄出口、使用方依公开引用、应用集中装配；只有真需跨包/独立发布时才提取契约包。Backstage 将扩展点放 node library package，是为避免扩展模块直接依赖整个插件，不是 WEX 当前必须多包化的理由。不可照搬其插件初始化体系、跨后端服务模式或把 Extension Point 当 WEX 自有插件协议。

### 2.3 Spring Modulith

S1 文档：[边界验证](https://github.com/spring-projects/spring-modulith/blob/e744475adc65af2fd033a57949be55e87209195c/src/docs/antora/modules/ROOT/pages/verification.adoc)、[模块测试](https://github.com/spring-projects/spring-modulith/blob/e744475adc65af2fd033a57949be55e87209195c/src/docs/antora/modules/ROOT/pages/testing.adoc)。

S2 源码：[ApplicationModules.detectViolations](https://github.com/spring-projects/spring-modulith/blob/e744475adc65af2fd033a57949be55e87209195c/spring-modulith-core/src/main/java/org/springframework/modulith/core/ApplicationModules.java)；[ApplicationModule.isExposed/detectDependencies](https://github.com/spring-projects/spring-modulith/blob/e744475adc65af2fd033a57949be55e87209195c/spring-modulith-core/src/main/java/org/springframework/modulith/core/ApplicationModule.java)；[ApplicationModuleTest.BootstrapMode](https://github.com/spring-projects/spring-modulith/blob/e744475adc65af2fd033a57949be55e87209195c/spring-modulith-test/src/main/java/org/springframework/modulith/test/ApplicationModuleTest.java)。

实际机制：ApplicationModules.detectViolations 分开收集模块循环、额外规则和依赖违规；ApplicationModule 用 named interfaces 判定公开类型并验证允许依赖。默认模块层依赖要求无环，外部只能使用公开包/命名接口；显式 open 模块属于例外，不是默认放开内部。ApplicationModuleTest 支持仅自身、直接依赖、全部依赖三种 bootstrap 范围。

适用 WEX：借鉴“业务域边界可验证、公开出口可声明、模块级 DAG、由窄到宽的模块测试”。代价是维护边界和例外清单；不引入 Java、Spring 容器或其包可见性规则。TS 的 private 关键字只管类成员，不能代替域边界检查。

### 2.4 Nx 与 dependency-cruiser

N1 官方说明与源码：[Nx 边界说明](https://github.com/nrwl/nx/blob/753a73b7bfdeedb682a7f685c3a20bf34a35002f/astro-docs/src/content/docs/features/enforce-module-boundaries.mdoc)；[enforce-module-boundaries 源码](https://github.com/nrwl/nx/blob/753a73b7bfdeedb682a7f685c3a20bf34a35002f/packages/eslint-plugin/src/rules/enforce-module-boundaries.ts)。

Nx 的 enforce-module-boundaries 基于 Nx project graph、项目 tags/depConstraints 检查跨项目依赖和循环；它不是“任意目录天然是模块”的检查器。依赖约束是匹配规则的组合，项目化/图配置是采用成本。其语言无关 Conformance 是另一路能力，不能假设与免费 ESLint 规则完全等同。针对单项目内部的 internal 深路径仍要补出口限制；不靠 Nx 自动解决全部私有符号泄漏。

D1 官方规则、CLI 与实际匹配器：[规则参考](https://github.com/sverweij/dependency-cruiser/blob/c5b97371ae93c556c703cfe294af86c9c80ea9fa/doc/rules-reference.md)、[CLI/反向影响/退出规则](https://github.com/sverweij/dependency-cruiser/blob/c5b97371ae93c556c703cfe294af86c9c80ea9fa/doc/cli.md)；[match-dependency-rule](https://github.com/sverweij/dependency-cruiser/blob/c5b97371ae93c556c703cfe294af86c9c80ea9fa/src/validate/match-dependency-rule.mjs)、[解析路径/类型匹配](https://github.com/sverweij/dependency-cruiser/blob/c5b97371ae93c556c703cfe294af86c9c80ea9fa/src/validate/matchers.mjs)。

dependency-cruiser 根据解析后的目标路径、依赖种类、circular/couldNotResolve 等匹配规则；支持 TS 编译前依赖分析、别名解析、反向影响查询和 JSON 图。可独立运行，无需完整 Monorepo 框架。其文件图与 WEX 业务模块图不同，折叠映射后的模块环要额外检查；具体实测见 §7。二者都不能从 import 图证明运行权限、数据权威或业务语义兼容。

### 2.5 消费者驱动契约（CDC）

P1 官方说明：[消费者/提供方验证](https://github.com/pact-foundation/docs.pact.io/blob/e2072af34960cb19d6c132d370c2fd580ec0e55c/website/docs/getting_started/how_pact_works.md)、[适用与不适用范围](https://github.com/pact-foundation/docs.pact.io/blob/e2072af34960cb19d6c132d370c2fd580ec0e55c/website/docs/getting_started/what_is_pact_good_for.md)。

P2 实际源码：[PactV3.executeTest](https://github.com/pact-foundation/pact-js/blob/4f69318161a4ace2e4f035c05240025baf67323e/src/v3/pact.ts)；[Verifier.verifyProvider](https://github.com/pact-foundation/pact-js/blob/4f69318161a4ace2e4f035c05240025baf67323e/src/dsl/verifier/verifier.ts)。

Pact 的消费者测试向 mock provider 发真实请求并校验使用行为，生成交互契约；提供方验证将这些期望对照真实 provider。PactV3.executeTest 启动 mock server、检查 mismatches 并清理；Verifier.verifyProvider 执行提供方验证。这两端验证不可用一个“mock 返回正常”代替。

适用范围：双方可协作、边界稳定且需要独立演进的 HTTP/消息服务。DSH 等第三方不配合时，只能做自己的适配测试/真实探测，不能声称已建立双方 CDC。普通同仓 TS 模块优先使用同一套行为样例对真实实现和测试替身验收；无需 Pact Broker。Pact 验证交互形状/约定，不替代提供方的副作用、权限、恢复业务测试，更不证明部署/网络/并发安全。

## 3. 12 条真实链路到模块能力的覆盖矩阵

每行只抽取需求，不写链路施工计划。“能力”是后续契约的候选行为描述，不是已存在 API 或冻结的能力 ID。

| 样本 | 用户行为与权威数据 | 提取的模块能力 | 必要授权/受控边界 | 正常及异常结果 |
|---|---|---|---|---|
| L01 启动/目录/恢复 | 选择数据根、工作区、接回记录；各领域拥有本体，shared 仅负责技术保存 | app 定位/装配；shared 读写/诊断；各域恢复自身状态 | 本地数据访问范围、系统凭证例外；外部恢复查询再经 connections | 可定位后使用；失联/写失败保留旧引用，不造空对象覆盖；跨目录原子恢复未证实 |
| L02 组织/关联/解除 | Space/Group 放置、独立 Context、组合引用归 space | 创建/查询/修改组织、引用/解除、诊断失效目标 | 当前入口/目标操作资格；目标数据另由原领域检查 | 引用同一本体，解除不删目标；旧修订/无权/目标失联显式返回 |
| L03 连接/发现/授权 | 连接配置归 connections，秘密归 credentials，授权归 permissions | 配置/校验连接、描述能力/可用性、判断资格 | 保存 Key 与使用 Key 分开；发现/选中不授权；调用才进入宿主操作边界 | 可发现但未必可执行；停用/凭证缺失/能力不支持不冒充远端执行失败 |
| L04 AI/职责调整 | AI 配置/职责关联归 AI/roles；Context 选择关系归 space | 配置角色、关联职责、查询本次有效配置依据 | 调整职责与修改授权分别判断，不能合并不同入口权限 | 兼任不合权；在途保持原来源，后续配置不覆盖旧执行事实 |
| L05 对话/编辑/生成/恢复 | 消息/逻辑生成归 conversations；外部调用回执归 connections | 消息/段落/重发管理、获准背景读取、请求模型与回执关联 | 读背景、向外发送资料、调用工具分别受控；不强制 Task | 保存正式消息；断流/迟到/保存失败可诊断，重发不重做未知副作用 |
| L06 任务/分配/执行 | 定义、Task、工作轮次/占用归 workflows；操作归 connections | 创建/分配任务、检查依赖/冲突、请求执行、关联回执 | permissions 判断；runtime 协调；调用边界记尝试；执行方做动作 | 已分配≠已派发≠已执行；拒绝/环境不足/断连分别保留证据 |
| L07 产物/验证/验收 | workflows 拥有产物引用与核验/审查/验收记录；文件事实在来源系统 | 接收来源、核对版本/环境、追加结论、按适用规则验收 | 读取产物/运行验证/写验收结论分开授权 | 外部 completed 不等于通过；版本变化后旧测试不继续证明新版本 |
| L08 任务→视图 | Task 状态归 workflows；映射/布局归 views，专业关系归模式 | 公开可见事实/版本依据、生成/刷新进度投影 | 查询/投影按当前可见范围，缓存不能泄露撤权数据 | 同任务可显示执行完/待核验；投影落后可重建，不反写 Task |
| L09 外部断连/恢复 | 外部会话/文件持有外部事实；WEX 记录已知操作/工作状态 | connections 报观察/定位；runtime 决定恢复；核验模块取证 | 恢复读取/再次执行分别授权；未知冲突范围仍受协调 | 查得证据则归并原尝试；归因不明维持未知，不能盲重派 |
| L10 跨 Context/多 Agent/冲突 | 角色配置非运行状态；runtime 拥有 WEX 内占用，实际资源由适配器识别 | 分离工作身份、识别共享资源、协调/阻止冲突并核验 | 非 Task 受控副作用同样检查占用；不承诺约束外部自发进程 | 无冲突可并行；同资源/未知占用阻派；路径别名/外部写入需实测 |
| L11 插件回调/撤权 | permissions 持有授权事实，领域持有资料，connections 记录受控操作 | 绑定可信来源、最小能力准入、停止新调用、诊断在途结果 | 插件不能自报高权身份；受控回调与 OS 隔离是两层 | 拒绝时不取资料；撤权不等于外部已停或已遗忘；回调身份/重放待验 |
| L12 专业模式/同名节点/映射 | 模式维护专业语义/自有对象，space 维护组合，views 维护呈现 | 产生组合草案、按专业身份解释、提交领域变更、映射对象 | 草案采纳不等于授予工具权；写各领域走其正式入口 | 同名不混机制；缺规则不运行；多域部分失败须可识别，不承诺全局原子撤销 |

L01 同时覆盖安装后的首次进入与重装接回；本批未补第 13 条，因为所需责任已经覆盖。12 条样本未覆盖所有未来需求（如账号云同步/长期策略库），不能以覆盖齐全宣称整个平台已验证。

## 4. 按既有模块归并公开能力与依赖

“依赖”指需要的能力，不等于必须直接 import 对方实现。每项候选公开行为仍须下轮补前提/状态/失败样例，才能确定接口。

| 模块 | 独立维护的对象/状态；候选公开行为 | 需要的能力 / 链路来源 | 可独立施工的验收焦点 |
|---|---|---|---|
| space | 本体、放置/组合引用；组织修改、关联/解除、可见查询与失效诊断 | 授权、存储、目标公开投影/定位；L01/02/04/12 | 多 Space 指同一本体、解除不删、无权目标不泄露；目标目录/查询可用替身 |
| AI / roles | 配置与限定职责关联；配置查询、职责调整和运行依据引用 | 连接元数据、授权/存储；L04/06/10 | 换模型/兼任不合权，在途身份不被新配置覆盖；不实现外部 Agent 循环 |
| conversations | 消息/段落/分支/生成关联；编辑、追加、生成与恢复 | 获准背景、模型调用能力、操作观察、存储；L05 | 无 Context/Task 可用；重发/断流/迟到不重复外部副作用 |
| connections | 连接配置/能力可用性、宿主操作尝试/回执；发现、准入、派发、观察/诊断 | 权限判定、凭证/存储、注入的领域窄能力/资源协调；L03/05/06/09/11 | 拒绝不派发、保存失败可定位、断连未知；协议适配器单独测，真实服务另验 |
| workflows / runtime | 定义、Task、工作轮次/占用、核验验收；分配、推进、证据接收与恢复决策 | 职责/资源事实、授权、执行能力/操作观察、存储；L06/07/09/10 | 分配/执行/核验分开；未知不盲重派；非 Task 入口也守冲突控制 |
| workflows/modes | 可选组合、专业对象/规则；生成草案、专业解释与配置 | 领域公开修改/查询；L02/08/12 | 不复制 Task/权限，同名节点不按标题分派；通用域不回依赖具体模式 |
| permissions | 政策、授权/审批/撤销与决定依据；资格判断和撤权 | 可信请求事实、存储；L02–12 | 自报角色/Context 不能扩权；不通过可变全局对象回查其他域内部数据 |
| views | 视图配置、映射/布局与可重建投影；展示/过滤、发起受控编辑 | 领域可见投影与专业规则；L08/12 | 禁止通过更新投影完成任务；源版本/撤权/失联可表现；画布库可替换 |
| shared（storage/credentials） | 事务/读写、定位基础与秘密保管；技术结果/诊断 | 宿主提供的路径/OS 能力；L01/03/09 | 保存失败不自造业务恢复决定；跨目录不虚报原子性；秘密不进入普通配置 |
| app / UI | app 装配/生命周期；UI 交互状态/页面与模块面板 | 各模块公开入口/适配器与平台承载；L01 及所有用户入口 | 缺某模块能报告不可用；装配测试不等于全产品已运行；UI 不持有正式任务/权限状态 |
| dsh | 独立插件宿主兼容观察；装载/卸载/依赖诊断 | 已验证的上游服务；若对 WEX 交互再走受控连接；L11 | 真正加载/失败/释放；缺 DSH 服务不可伪造就绪；不与外部 Agent 连接器共用加载器 |
| plugins / accounts | 仅预留研究，无本批新增公开能力 | 不作其余模块启动前置 | 不因研究方法而提前写加载器、注册/登录或 SDK |

内部与装配责任另划清：

| 边界 | 私有实现 | 宿主负责什么 | 外部受控及恢复要求 |
|---|---|---|---|
| space / AI / conversations | 实体存储、索引、消息/配置变更细节 | 注入获准的目标查询/调用能力，绑定实际入口 | 外发/工具调用经连接边界；本地实体修改由本域检查授权与修订 |
| connections / 具体适配器 | 网络/进程、厂商错误解析、连接细节 | 绑定真实判权/存储/资源协调与窄回调，不传整套宿主 | 记录操作事实，不能反写 Task；结果未知与回执写失败分别保留 |
| workflows / modes | 任务状态/规则、队列/占用/专业解释 | 将执行出口与观察来源接上，不把编排散进连接器 | runtime 决定恢复，适配器查事实；验收不得由外部模型自批 |
| permissions / shared | 策略求值、授权保存、秘密/数据库实现 | 提供可信事实与平台机制，不接受插件自报身份 | 判权与真实资源限制分别验；技术事务不包远端副作用 |
| views / UI | 组件、投影缓存、布局算法 | 接入获准投影和领域命令 | 编辑不绕领域；缓存失效/撤权不泄露，关图不取消工作 |
| app / dsh | 平台启动/停止与宿主内部实现 | 装配根可引用实现，但业务模块不得反向依赖 app | 进程关闭不等于副作用撤销；独立进程不自动成为安全沙箱 |

### 4.1 防止双向业务依赖

建议按实际需求挑选单向公开依赖，不先批准全互通：

- views 可以消费 workflows/space 的公开投影，后者不 import views 组件来维护自身状态；反向刷新是观察关系，不是反向源码依赖。
- conversations 可以请求连接能力；connections 读取本次任务/背景时只消费宿主注入的窄端口，不 import conversations/workflows 私有存储。普通 API 调用无需先建 Task。
- workflows 请求连接执行；connections 的资源协调/领域回调由 app 装配，不为了互调引入 workflows ↔ connections 的实现循环。资源协调职责仍归 runtime，不另开第二份占用表。
- space 保存引用，目标域保存本体；查询目标显示信息不允许目标域反写一份 space 关系。权限所需事实可由受信任入口提供/验证，不能让 permissions 导入所有领域的数据库。
- consumer 可声明自身真正需要的窄依赖端口，由装配适配到 provider 公开能力；provider 仍拥有业务语义，consumer 不能以自定义端口绕开其前提。不是每次回调都要拆一个独立包。
- app 是实现装配根，不是所有模块通用入口。公共出口不能重导出 app/整个数据库/框架容器或秘密对象；目录 public/index 的存在本身不保证其导出内容合适。

未来依赖表必须分别记录：源码/类型引用、运行时能力依赖、装配实现选择。一个 import DAG 不会自动证明运行时没有循环、死锁或恢复依赖；三者都要审查。

## 5. 契约存放、所有权与分层建议

| 方案 | 收益 | 成本/风险 | 适用条件与建议 |
|---|---|---|---|
| 模块内显式公开出口，行为说明就近 | 修改局部、owner 清楚、同仓同步容易 | 需要工具阻止深导入和导出泄漏 | 当前默认建议；已有实现时才建立少量真实出口，不先生成接口文件 |
| 中央统一契约包 | 容易发现少量真公共概念 | 万能类型库、联动改动与环依赖风险 | 只容纳已经被多域证实共用且无专属业务权的概念；不把所有业务类型搬去 shared |
| 独立接口/API 包 | 可在不安装提供方实现时消费，支持独立版本/环境 | 维护发布、版本组合、兼容与测试成本 | 真正独立发布/第三方使用/不同环境构建，或证实需要打断依赖环时再提取；Backstage 的 node 包是条件性参考 |

提供方维护自己承诺的公开契约；使用方维护“我依赖哪些行为”的需求与消费样例。共享行为用例由双方评审，提供方和替身都须跑；使用方不得自行扩展 provider 能力。需要变更时先提行为缺口，不直接改对方 private 文件。

| 层次 | 必须说明 | 不能替代什么 |
|---|---|---|
| 业务契约 | 目的/owner/消费者；前提与范围；权威状态；正常结果；副作用；拒绝/失败/未知；取消/重复/恢复；权限、修订/来源依据和可观察验收样例 | 不是 TS interface 的注释补丁，更不能从原型函数形状反推正式业务 |
| 实现接口 | 基于已收敛行为选公开操作/输入输出/事件/类型、可见出口与依赖端口 | 类型可编译不证明拒绝无副作用、取消已停止或未知可安全重试 |
| 通信协议 | 仅真实跨环境边界需要编码/传输、身份建立、关联、超时/断连、错误、版本/顺序/大小限制等 | 不要求同进程模块全走 IPC；代理同名方法不证明线上语义兼容 |

同进程可以普通函数/对象调用和显式注入；前端/Node、独立插件进程、外部 DSH 才按各自边界研究桥接。当前不定 IPC channel、JSON schema、数据库表、插件包协议或 DI 框架。

## 6. 版本、兼容与变更影响

- 内部重构：公开行为/导出不变，模块行为及边界检查仍须通过；不因此给每个目录独立发版。
- 兼容扩展：必须让旧消费者的真实预期继续成立。新增可选字段/错误值也可能破坏严格解析或穷尽分支，不能仅按 TS 可赋值性判兼容。
- 破坏修改：参数/返回类型、默认行为、权限前提、取消/错误/未知/恢复含义和副作用变化都需检查；签名未变也可能破坏业务。
- 当前建议按仓库提交/构建锁定完整组合，同时维护公开变更记录与受影响消费样例；契约修订不等于数据版本、进程代次或外部协议版本。单独模块 semver/SDK 发布后置到真正独立分发。
- 影响范围先查公共出口的直接/传递消费者（包括 type-only、re-export 和配置/注册使用者），再检查样例、权限与数据行为。dependency-cruiser 的 reaches/affected 或 JSON 反向图只是候选集合；图不能自动判断语义破坏或找到所有动态使用者。
- 破坏变更要联合审查、同步迁移或提供有期限的适配；不静默宽化授权或把旧未知结果解释成成功。回执/数据迁移和回退能力需另验。

## 7. 自动依赖检查：建议规则与真实工具夹具

建议先用独立工具评估，不为目录边界引入完整 Nx workspace。以下只是研究规则，未安装到 WEX 门禁：

1. 解析真实 tsconfig/别名/包入口后，以模块归属和显式公开出口白名单检查跨域访问；不只拦名叫 internal 的目录。模块内可以用自己的内部实现，模块外不能深导入，re-export/type-only 也纳入。
2. 未经声明的跨域依赖报错；依赖表由真实能力需求逐项产生，不预建全互通。例外注明 owner、理由、范围和复查条件，不能用一个全局忽略掩盖违规。
3. 文件级循环与归并模块后的循环分别检查；纯类型边也记录，不能为了绿灯全部忽略。确有不构成运行环的例外需明确评审，不将其放任为隐藏耦合。
4. cannot-resolve 应导致检查失败；非字面量动态加载无法被静态图完整证明，只允许在声明的装配/外部加载边界处理并做注册/组合检查。路径别名、tsconfig paths、package exports 都不单独构成安全屏障。
5. 浏览器业务/中立公开类型不得依赖 Node/Electron 主进程实现、具体厂商和特定专业 UI；app 的装配例外不传播给业务模块。公开出口不能把内部存储/秘密或 app 容器整体重导出。
6. 公共出口变更触发反向消费者编译与公开行为样例；包/配置/注册/协议使用和跨环境适配另列，不能只测 import 到的文件。

### 7.1 隔离夹具结果（不是 WEX 依赖验收）

本批在仓库外 scratch 安装 `dependency-cruiser@18.7.0`、`typescript@5.9.3`，Linux/Node 24.22.1/npm 11.9.0。未改产品依赖/代码，未运行 Actions。夹具只有 a、b 两个虚构目录，a/public.ts 为准许出口，a/internal/secret.ts 为私有目标；tsconfig 将 `@a/*` 映射到 `a/*`。

执行安装：`npm install --ignore-scripts --no-audit --no-fund dependency-cruiser@18.7.0 typescript@5.9.3`。每个夹具分别运行 `depcruise --config rules.cjs --output-type json a b` 及 `depcruise --config rules.cjs --output-type err a b`。最小规则如下，仅为工具研究夹具：

```js
module.exports = {
  forbidden: [
    { name: 'private-a', severity: 'error', from: { path: '^b/' },
      to: { path: '^a/(?!public\\.ts$)' } },
    { name: 'no-file-cycle', severity: 'error', from: {}, to: { circular: true } },
    { name: 'resolved', severity: 'error', from: {}, to: { couldNotResolve: true } }
  ],
  options: { tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' } }
};
```

| 夹具 | 实际输入要点 | JSON 报告 | err reporter 退出码 |
|---|---|---|---|
| 合法公开引用 | b/use.ts 经 `@a/public` 导入公开 type | 无违规 | 0 |
| 私有类型/别名 | b/use.ts 经 `@a/internal/secret` 导入 type | private-a | 1 |
| 文件环 | a/x.ts ↔ a/y.ts，相互导入值 | no-file-cycle | 1 |
| 仅模块环 | a/use.ts → b/public.ts，b/use.ts → a/public.ts；两个 public 不回引 use | 无文件环；归并得到 a→b 与 b→a | 0，说明不能只检查文件环 |
| 字面量动态私有引用 | b/use.ts 的 `import('../a/internal/secret')` | private-a | 1 |
| 无法解析 | b/use.ts 导入不存在的 a/missing | resolved | 1 |

六个 JSON reporter 命令均退出 0，包括有 error 违规的情况；必须显式解析 `summary.error/violations` 或使用 err reporter，不能“导出图成功”就判通过。夹具 JSON 图可识别反向使用关系，但本批未实测 Nx、computed dynamic import、Electron 条件导出、完整 WEX 依赖图或自动模块 SCC 门禁。模块环例已明确需要按归属映射后再检查，不宣称额外检查器已实现。

## 8. 模块独立测试与系统组合验收

| 层级 | 验收对象 | 依赖未完成时如何测 | 局限 |
|---|---|---|---|
| 模块行为测试 | 本域状态/权限前提/修订/失败/副作用规则 | 注入符合已评审契约的依赖替身，测试真实本域实现 | 无法证明提供方或真实外部环境工作 |
| 公开契约测试 | 使用方依赖的最小行为、输出/错误/取消/恢复承诺 | 同一行为样例运行于真实提供方及替身；consumer 自身也跑使用样例 | 替身只自测不能代表双方契约成立，业务规则另需覆盖 |
| 依赖/类型检查 | 公开出口、跨域 allowlist、环境边界、文件与模块环 | 全部已实现源码/类型都参与解析；新模块只登记真实依赖 | 不证明运行时身份、动态装配或语义正确 |
| 装配/适配测试 | app 注入、生命周期、前端/Node/外部协议连接 | 用真实本地模块组合；外部协议可做标明等级的替身实验 | 未调用真实外部服务不能宣称端到端通过 |
| 系统组合验收 | 用 L01–L12 及故障案例验证模块组合 | 随模块就绪选择覆盖集合，最终补真实外部/Windows | 链路是组合验收，不转成跨全仓的施工单位 |

例如 space 施工可在任务查询替身上验证“引用失效/解除不删除”，workflows 可在执行替身上验证“未知不重派”，connections 可在授权/回执存储替身上验证拒绝与保存失败。之后必须让各真实提供方跑对应样例，再组合；不能因各自 mock 测试都绿而宣布系统通了。

## 9. 多 AI 按模块施工的协作建议

本节是建议工作法，不创建任务平台或多包发布流程：

1. 每批明确模块维护者、允许目录、所消费/提供的能力、公开行为样例与验收；先扫描链路矩阵确认覆盖，交付按模块归并。提供方内部实现不归消费者顺手修改。
2. 使用方缺能力时提出“前提/目标/需要观察的结果/失败例子/已有出口为何不足”；提供方审查是否是已有行为、应新增的窄能力或错误归属。未收敛时标阻塞，不用跨域私有导入临时接线。
3. 公开契约调整由提供方维护，受影响消费者确认使用样例；变更记录列来源、兼容判断、影响集合、迁移及真实测试。登记/通知通过仓库已有记录与提交关联，不让用户人工转发 AI 消息，不自动发送外部消息。
4. 并行任务尽量只改各自模块；app 装配、公共出口、依赖规则/锁文件及共享行为样例由指定维护者串行整合。彼此有接口变更依赖时先收敛契约再并行，不把冲突留到最后强拼。
5. 默认 main 小批提交是既有用户规则；同一可写 checkout 不允许多个 Agent 同时提交。确需并行隔离才使用短期工作树/分支，整合者核对最新 HEAD 后合并内容/验证，禁止强推覆盖。分支不等于独立验收通过。
6. 破坏性公开变更、方向/owner 调整、权限/回执/恢复、跨环境协议及跨模块数据一致性必须联合审查；内部重构不强迫全模块陪改。审查不能由修改者自己单方面宣布兼容。
7. 先跑模块行为/公开样例与依赖检查，再按影响集合扩大编译/组合测试；依赖图不可靠、公共基础/锁文件变更或恢复安全语义变化时扩大回归。尽量本地/云端验证，不盲重跑、不消耗无关 Actions；是否触发另按用户授权及实际工作流配置。
8. 最终提交说明列模块、契约影响、被测实现/替身、测试命令/环境、未覆盖项和 SHA。缺真实提供方时只交付模块级结果，不伪造组合完成。

## 10. 建议的依据、收益、成本与采纳条件

| 建议 | 依据 / 收益 | 成本 | 适用条件 / 当前状态 |
|---|---|---|---|
| R1 提供方就近契约+显式出口 | T/B 的契约与实现分离；减少跨域陪改 | 维护导出审查/消费样例 | 同仓默认建议；独立 API 包须有真实发布/隔离需要 |
| R2 轻量显式依赖、宿主装配 | T/B 的装配分离，避免实现环 | 要维护生命周期与窄适配 | 当前可先用普通注入，不要求容器/ServiceRef 机制 |
| R3 双层依赖图与规则门禁 | S/N/D 加本批夹具；可发现私有/非法/循环依赖 | 配置解析、归属映射与例外维护 | 先用小工具试点，尚未接入 WEX；无须 Nx 迁移 |
| R4 消费期望驱动轻量行为样例 | P 的双方验证思路；其他模块未成时也能做真实本域测试 | 双方维护样例，替身会过时 | 同仓先本地测试；双方独立部署且配合时才评估 Pact |
| R5 仓库组合锁定，独立版本后置 | 当前单应用与 B 的条件性接口包分离；避免发布矩阵 | 需写清语义变更而非只看 semver | 当前建议，真正独立分发/第三方消费再评估 SDK |
| R6 模块维护责任+影响审查 | 用户修改局部性和多 Agent 目标；职责/冲突可追溯 | 公共变更需要协调，可能短暂停并行 | 按模块施工，链路仅分析/组合验收；不是新管理平台 |
| R7 区分三层兼容和证据等级 | T 跨环境、P 交互验证与既有未知结果实验 | 类型、语义、真实协议需分层验证 | 全部模块适用，不因复杂就统一 IPC 或全量端到端测试 |

**已确认**：本批不改顶层架构、不做产品施工；链路用于分析，模块为施工单元；既有 Context/权限/视图/连接职责与版本基线不变。

**建议采纳**：R1–R7 及 §3–§9 方法。它们是从来源推导的 WEX 适配建议，不是外部项目原生保证，也尚未成为正式接口或 AGENTS 强制规则。

**进一步验证**：在第一个真实模块出现后验证公开出口/反向影响/模块 DAG；用真实提供方和消费者同时运行行为样例；验证环境中立类型、装配循环、动态使用者及 Windows 隔离/恢复。工具夹具不证明这些已完成。

**暂不决定**：具体公开文件名/全部依赖 allowlist、独立接口包与 SDK、每模块版本、DI/Pact/Nx 采用、IPC/Schema/数据库/插件协议、完整调度与多视图引擎。

下一批应先选择一个模块编写业务契约草案并由其消费者校验，列清正常/拒绝/失败/未知与恢复；行为收敛后才定实现接口，再按实际运行边界设计协议。不能把 L01–L12 直接改成十二批跨模块链路施工。


## 11. 第四、第五批的后续状态

前文“下一批编写模块草案”为第三批历史建议；当前已形成[模块契约索引](../../../MODULE-CONTRACTS.md)。[第五批压力审查](../../../audits/COMPLEX-CONTRACT-STRESS-REVIEW-2026-10-31.md)在L01–L12/H01–H21基础上补H22–H30，细化运行依赖等待、定义/实例、衍生信息出口、共享Service、预算/外部变化及桌面基础；仍按模块维护，未将R1–R7或第五批B建议升级为A。当前无完整产品import图/组合运行证据，不能宣布无环、未知可恢复或Windows已验收。


## 第六批更新（2026-10-31）

[最新收敛、实验及施工准备度](../../../batch6/DEPENDENCIES.md)取代上述历史准备度结论；F01–F09均有处置，11域分范围准入。B/C/D仍分离，完整业务组合与Windows实机未通过。
