# WEXPC 运行时方案比较 V0.1

- 日期：2026-10-29（北京时间）
- 状态：研究与选型建议，未定案、未实现、未验证。
- 目标依据：[运行时扩展契约](RUNTIME-EXTENSION-CONTRACT-V0.1.md)。
- 本轮没有运行加载原型、安装依赖或修改 WEXPC 产品代码。
- 建议优先验证：保留 Rust/Tauri 主程序，以独立扩展进程运行 JS 发布包，UI 独立加载并通过受控消息接口交互。不是直接决定采用 Node 或全仓改语言。

## 1. 比较结论

| 候选 | 满足不停主程序新增模块的方式 | 主要代价 | 判断 |
|---|---|---|---|
| Rust 原生动态库 | 宿主加载发布的 DLL 等 | ABI、平台构建、卸载时残留引用、崩溃影响；UI 另需加载方案 | 不作为首个通用扩展试点 |
| 独立扩展进程，首试 JS 运行时 | 现有宿主启动新进程加载新包；更新时替换扩展进程 | 运行时随包分发、进程开销、消息协议与管理；进程不是权限沙箱 | 首选验证方向 |
| Wasm Component | 宿主按标准接口加载组件 | 网络、流式、取消、宿主能力和语言工具链需要组合验证；UI 仍独立 | 保留替代候选 |
| 全面改成 JS/TS 宿主 | 在统一生态中加载前后端扩展 | 迁移既有权威规则、持久化和平台实现，不能消除生命周期问题 | 当前无证据支持全仓重写 |

以上是工程取舍，不是性能测量或兼容性结论。Rust 原生扩展并非不能做，稳定 C ABI／消息边界等仍可评估；不能直接将普通 Rust trait 当作跨版本插件 ABI。

## 2. 推荐候选如何工作

主程序负责包发现、兼容检查、激活代次、连接身份和权威业务服务；扩展进程负责该扩展的协议实现，通过消息返回流式输出、完整工具意图或错误。

先验证一个扩展包一个工作进程；不强制每个连接一个进程。同包多个连接必须隔离凭证、配置、请求和续传状态。进程共享／池化以后依据实际资源开销决定。

JS/TS 源码由扩展开发方预先构建成 JS 发布产物，依赖一并准备；用户放入完整包后不需要安装 Node、运行 npm 或构建 WEX。若选择 Node，运行时由 WEX 分发并固定兼容版本，不能依赖用户 PATH。

热重载优先采用“排空旧进程、启动新版进程”的边界，避免把修改 import URL 当作完整卸载。主程序不退出，历史状态留在宿主。

建议消息边界包含握手、调用 ID、activation_id、序列号、流事件、取消、终态及退出通知；长度限制、背压和协议 stdout／诊断 stderr 分离需实测。JSON-RPC 或自有定帧协议未定。

## 3. 三个不能误判的地方

### Tauri sidecar 不等于任意扩展自动加载

Tauri 官方 sidecar 机制支持分发与运行外部程序，但 externalBin 是构建配置中的声明。候选方案是随主程序分发一个已知运行时／启动器，再由它加载未知扩展包；不是每新增扩展都修改 externalBin。安装包、签名与 Windows 启动必须验证。

### 子进程不等于安全沙箱

独立进程便于停止、替换并隔离部分故障，但普通进程仍可能拥有当前用户的文件和网络权限。仅规定“走受控服务”不能阻止恶意代码绕过。

在可信自有扩展与不可信第三方扩展之间，产品支持范围尚未确认。首个功能试点可使用可信测试扩展，但其成功不能被报告为第三方安全加载通过。

如果未来要求强制限制任意扩展的文件、网络及秘密访问，必须增加并验证 OS 限制、沙箱或受限运行时，必要时重新评估 Wasm 等路线。不能削弱 WEX 既有权限语义来迁就方案。

### 后端可加载不等于 UI 可加载

Vite 正常生产构建不会因用户目录多出 TSX 就自动编译它。发布包需要浏览器可运行的 UI 产物，以及运行时资源提供、版本 URL、CSP、缓存与挂载机制。

WEX 浏览器宿主与扩展 UI 的接口须独立于 Rust 内存对象和内部 React 状态。

## 4. UI 路线比较

| 方式 | 优点 | 限制 |
|---|---|---|
| 同页面动态模块 | 更自然复用宿主 React 与控件 | 共享执行环境；不能把传入受控客户端当作安全隔离；React 版本和卸载需管理 |
| 独立 iframe／WebView 面板 + 消息桥 | UI 生命周期和依赖较易分开 | 主题、尺寸、键盘、无障碍与交互协调更复杂；具体隔离取决于来源、sandbox、CSP 和 Tauri 权限配置 |

建议先以独立面板验证真实动态资源加载和受控消息桥，不把现有宿主全部命令暴露给扩展。面板携带自己的前端运行产物；公共控件可作为构建依赖复用，不要求运行时共享 React 实例。

消息桥必须根据实际发送端和宿主绑定检查包、激活代次、请求与资源范围，不能信任扩展自报身份。关闭面板后旧通道失效。opaque origin 的消息不能仅用 origin 字符串识别，应核验实际 frame/window 或专属通道绑定。

这是候选；Windows WebView2 下资源协议、iframe 行为与 IPC 权限未测试。若体验或隔离要求不成立，比较独立 WebView 与可信同页面组件，不能用普通网页原型代替 Tauri 验证。

## 5. 凭证与模型请求

优先研究宿主代发受控 HTTP：适配器提供目标、普通头、正文和流解析，宿主按已确认连接绑定注入认证并执行网络限制，返回受限响应流。认证格式、请求签名等厂商差异必须纳入能力接口，避免硬编码 Bearer。

该方案可减少扩展直接接触秘密，但不自动限制普通 Node 进程自行联网／读文件。请求目的地、重定向、配置修订和撤权需要在实际出口检查。复杂签名若需要秘密，应另定义宿主服务，不静默把原始凭证发送给 UI。

目前这部分只是候选机制；在验证前不能宣称秘密隔离完整或所有厂商协议均受支持。

## 6. 最小验证计划（未执行）

1. 固定主程序构建及二进制摘要，启动后保持主进程身份不变。
2. 添加新包，运行时发现并加载之前不存在的协议和配置面板。
3. 两个协议实现消费相同模型接口；本地模拟服务验证协议差异及流事件，真实厂商另验。
4. 同包两个连接并发，检查配置、消息和续传不串用。
5. 在途更新被阻止／排空；扩展异常退出如实结算未知，不重发写操作。
6. 失败激活、重复 ID、协议不兼容不会留下半注册状态。
7. UI 旧激活代次和错误发送端不能调用新处理器；面板重载不丢未提交草稿。
8. 停用清理进程、订阅和 UI；历史记录仍可读取。
9. 记录启动时间、资源占用、流延迟、连续重载后的资源变化；先取基线，不臆造阈值。
10. 在 Windows 安装环境复验；不把 Linux 子进程测试或浏览器页面等同于桌面产品验收。

如 Tauri 动态 UI 资源或进程生命周期不成立，应先改承载方案；如只有恶意代码限制不成立，则明确区分功能加载与安全隔离证据，不混报通过。

## 7. 资料与证据边界

本轮查询日期 2026-10-29。以下为官方文档／平台参考，链接可能随上游更新；实现前固定依赖版本。本稿没有测量运行时。

- [Tauri sidecar](https://v2.tauri.app/develop/sidecar/)：外部程序打包和运行；不能证明未知扩展自动发现。
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)：前端访问核心命令的边界；实际面板配置需验证。
- [Node 子进程](https://nodejs.org/api/child_process.html)：独立进程与通信基础。
- [Node ESM](https://nodejs.org/api/esm.html)：动态导入与按 URL 缓存；不同 query 可形成重复加载，不等于卸载旧实例。
- [Rust 函数 ABI](https://doc.rust-lang.org/reference/items/functions.html#extern-function-qualifier)：跨边界调用需要明确 ABI；具体插件兼容不能靠语言名称保证。
- [WebAssembly Component Model](https://component-model.bytecodealliance.org/)：标准接口与宿主能力路线，具体版本支持需锁定。
- [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)：sandbox 与来源限制；同源并同时允许脚本和 same-origin 等配置不能随意视为隔离。
- [仓库 DSH 研究索引](../../../../references/dsh/README.md)：独立参考资料，不自动作为采纳决定。
- 需求案例库为未来准备，本轮不研究、不修改，也不作为当前选型或试点的前置条件（用户于 2026-10-29 明确）。

## 8. 当前建议与待定项

建议进入试点比较的是“Rust 主程序 + 独立扩展进程（优先研究 JS 运行时）+ 动态独立 UI 面板”。

这不是已选定语言或已批准产品架构。尚需确定并验证：
- 第一阶段扩展的信任范围与必须实现的隔离程度。
- JS 运行时具体版本、分发方式和 Windows 进程管理。
- UI 面板加载方式及主题、键盘、草稿体验。
- 宿主网络／凭证接口是否覆盖目标协议。
- 对应的测试证据、状态恢复与现有资产迁移成本。

先验证一个贯通试点，再决定是否修改全仓技术路线；不继续扩写通用插件平台来代替证据。


## 9. 2026-10-30：DSH Cordis、客户端插件与 Hermes 持久化复核

本节是后续研究结论，修正上文 2026-10-29 尚未考虑 DSH 完整客户端插件能力的比较；原方案仍保留为待验证候选，**未批准语言迁移，也未进行 Windows/Tauri 端到端测试**。

### 已由上游源码说明确认

- DSH 官方架构以 TypeScript/Node 与 Cordis 插件树承载模型适配、工具、会话、Agent Loop；通过 Profile/Bundle 和 patch 组合。启用 HMR 时插件配置可动态生效。注意：这是 DSH 自己运行环境的事实，不能自动推广到 Tauri。
- DSH `packages/boot/plugin-manager` 支持 Web 管理插件启用/停用、安装/卸载外部 bundle；**没有开启 HMR 时要重启才能应用**。不是所有部署模式天然实时生效。
- DSH `packages/client/modules` + `ui-slots` + `ui-renderer` + `hmr` 将浏览器 UI 插件和宿主插件图相联。正常插件启停不必刷新整页；重新构建的 bundle 可替换。但是替换组件的 React 局部状态丢失；失败重载**没有旧代码回滚**；文档明确 Web 传输方案并不直接覆盖 Electron 后端重启。
- Hermes Kanban 使用 SQLite 持久任务，worker 为独立 OS 进程；任务状态与 worker 生命周期分离，但其调度文档明确**单机**，不证明跨机器调度能力。

### 对 WEX 语言与运行路线的具体影响

| 判断问题 | 核对后的结论 | 证据等级 |
|---|---|---|
| TypeScript 能否承担能力注册、插件组合和主业务逻辑 | DSH 已有成熟实现，**可行**；但 WEX 的授权、数据归属、Space/Context 不因此自动具备 | 上游案例确认 |
| UI 插件能否在宿主运行时加载和替换 | DSH Web 方案证明可行；WEX Tauri/WebView2 需要自身验证 | 案例确认，WEX 未测 |
| Rust 是否必须拥有 Dispatcher/Agent Loop | 否；Hermes 使用 Python、DSH 使用 TS，调度是业务机制而非特定语言能力 | 案例确认 |
| 换成全 TypeScript 是否消除 IPC、插件生命周期和系统权限问题 | 否；不同进程和 UI 仍有边界，第三方代码信任问题不消失 | 架构判断 |
| 是否应立即放弃 Rust/Tauri 现有代码 | **不应**；尚无 WEX 的综合迁移成本、Windows 插件与可靠恢复证据 | 未验证，不批准 |
| WEX 只需一种主开发语言是否合理 | **正式技术候选**：TypeScript 主业务 + Rust 可选系统辅助；另一候选为既有 Rust 核心 + TS UI + 扩展进程 | 待实验比较 |

### 既有本地机制实验必须纳入判断

本仓 `experiments/runtime-loader-spike/README.md` 已记录 2026-10-29 的 Node/Linux **8 项通过**：启动后发现新包、子进程调用、静态面板、BUSY 排空、停用、进程替换、重复 ID 拒绝及初始化失败保护。不能再把「动态扩展是否可能」列成零证据空白；但它没有覆盖 Windows/Tauri、真实 React UI、跨进程权限、持久化、实际协议和失败恢复。不能据此声称产品通过。

### 后续只需要针对真正未证实的差异做比较

1. 在 **Windows 安装态**验证原 Rust/Tauri 宿主 + JS 扩展进程 + React 面板的动态加入/停用/重载，复用已有实验，不重写机制。
2. 用一个小型 **TypeScript 宿主对照样例**验证 Cordis 或同类加载模式下，连接器服务、客户端 UI 组件、持久任务数据如何独立于插件 React 状态；重点测重载失败与旧任务恢复，不另造一套插件框架。
3. 记录两条路线**实际要维护的代码边界、打包依赖、安装成本、错误恢复复杂度、迁移现有 Rust 资产的代价**，再决定是否改主业务语言。
4. 不扩展产品范围、不新建第二套工作流/任务管理平台；React Flow 仍是工作流编辑技术首选。

### 参考

- [DSH 官方架构](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [DSH Plugin Manager](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [DSH Client Modules](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/modules/README.md)
- [DSH Client HMR](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/hmr/README.md)
- [DSH 客户端包索引](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md)
- [Hermes Kanban](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/kanban.md)
- [WEXPC1 已执行加载机制实验](../../../../experiments/runtime-loader-spike/README.md)


## 10. 2026-10-30 已确认新实现技术基线（覆盖旧路线优先级）

**用户确认**：WEXPC1 第一优先是开发与维护轻量化，技术路线收敛为 **TypeScript（主要开发语言）+ Electron（Windows 宿主）+ React（UI）**；React Flow 为首期重要工作流编辑器；DSH 通过独立连接器接入、负责外部 Agent 施工。Cordis 和 DSH 插件生态继续作为未来的重要扩展来源，但不作为首批接通 DSH 的前置条件。

本条覆盖 §1、§8、§9 对 Rust/Tauri 主宿主的旧优先级，不删除旧方案作为历史研究；**Electron + TypeScript 是已确认的设计基线，并非已通过 Windows 端到端实测的工程结果**。

### 功能与技术对位

| 功能 | 当前优先实现 | 暂不要求 |
|---|---|---|
| Windows 桌面 | Electron main + preload + React renderer，以 TypeScript 开发 | 继承 Rust Core 或同时维护两种桌面宿主 |
| Space、Context、对话、任务数据 | WEX 自身模块、SQLite 与用户指定目录优先候选 | 完整映射 DSH 内部数据结构 |
| 工作流 | React Flow 节点/连线编辑、用户与 AI 共用编辑能力、明确启动后才运行 | 重新自研基础画布、首期完成全自动多 Agent 工作流引擎 |
| 外部施工 | 独立 DSH 连接器：派发任务、关联会话/回执/文件、支持人工验收 | 搬运 DSH 客户端、复写其 Agent Loop、依赖全量状态同步 |
| 扩展来源 | 保留 Cordis / DSH 插件体系研究及未来复用边界 | 将插件平台作为首期功能前置 |

### Electron 落地必须遵守的边界

1. `app/` 集中管理 Electron 进程生命周期、预加载脚本和主窗口；业务目录保持独立，不要求每个域拥有自己的进程。
2. 保持 Electron 安全默认值：`contextIsolation`、sandbox，禁用 `nodeIntegration`；经 preload 白名单接口与校验过的 IPC 提供本地能力。不因为同用 TypeScript 就允许 renderer 直接访问任意文件或命令。
3. 长时间运行或不可信内容不能简单堵塞主进程；利用适当工作进程并处理退出、异常与恢复。Cordis 插件生命周期**不等于** OS 级隔离。
4. Windows 用户可选择程序和主要数据存储位置。Electron `userData`、`sessionData` 及缓存须在恰当生命周期初始化；不能承诺系统盘零写入，例外应可追踪。
5. SQLite、Electron Forge 和具体插件包格式仍为**技术候选/实现细节**；不把候选当成已经验证或冻结的接口协议。
6. WEX 任务卡、产物位置、验收与组织关系独立持久化；DSH 仅作为外部执行者，不要求内部 Agent/Session 与 WEX Context 一一映射。

### 待实际工程验证，而非继续无限扩展架构

- 打包安装、用户自选数据位置、退出与重开恢复；
- React Flow 基础编辑与流程文件保存；
- DSH 公开接口实际可用的派发、返回和产物获取行为；
- Preload/IPC 权限以及长任务不阻塞 UI；
- Windows 资源占用和异常恢复。

**原则**：首期产出可用 WEX，而非再重建 DSH、Cordis、Agent Loop 或通用项目管理平台；保留现有架构及长期需求文档作为持续增强依据。
