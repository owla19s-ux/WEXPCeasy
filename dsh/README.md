# dsh — DSH 插件机制独立构建与验证

> **代码事实核对（2026-11-04，基线 `1048b6a`）**：没有独立产品 src/tests；已有 build/checks 与锁定的上游兼容实验。它是独立实验，WEX 正式接线及 Windows 实机未验收。 开工须重新核对最新 main。

本目录保存版本锁定的 DSH 插件基础机制。WEX 自有插件机制在 [plugins/](../plugins/README.md)，外部 DSH Agent 连接器在 [connections/dsh/](../connections/dsh/README.md)，两者不由本目录替代。

> **版本边界（2026-11-02）**：DSH 原生插件系统产品化与 DSH 连接器均推迟到 **0.1.2**。下文阶段目标及 Linux 实验为历史/后续研究依据，不能当作 0.1.1 任务。见 [0.1.1 计划](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 当前状态（2026-10-30）

已在 Linux / Node 24.22.1 上完成 **Cordis Core + Loader 的真实独立编译与模块加载验证**：

- 四个完整 vendored 包：cosmokit、schemastery、Cordis Core、Loader；源码/原包清单不改写。
- TypeScript 项目编译生成 JS、声明及 source maps，再由独立 esbuild 入口打包，保留原包 exports 和 schemastery 的 ESM/CJS 输出形式。
- 真实磁盘插件通过 Loader 导入，验证 Service 注册、异步初始化、依赖等待与恢复、调用、配置重载、卸载、相同 ID 重新加载与清理。
- 默认 native import fallback 和 `--expose-internals` Node 内部加载路径均已运行。
- 51 个上游文件逐字节匹配锁定 commit 的 Git blob；依赖版本和 npm integrity 保存在锁文件。

另已实际运行本仓 hello Bundle 样本的裸包名导入、卸载、同进程重加载与清理；配置仅由测试提取单条 insert 子集，详见 [原生包样本验收](NATIVE-PLUGIN-COMPATIBILITY-2026-10-30.md)。

这证明基础机制可以独立构建，不代表已实现 WEX 集成、DSH Bundle/Profile/商店兼容、源码 HMR 或 Windows Electron 验收。Plugin Manager / App Boot / Manifest 仍仅保留先前研究入口，未参与构建。**WEX 适配器与公共契约未开发。**

## 复现

要求 Node >=24.9.0、npm、可访问 npm registry；从仓库根目录执行：

```sh
npm ci --prefix dsh/runtime --ignore-scripts --no-audit --no-fund
npm run --prefix dsh/runtime build
npm test --prefix dsh/runtime
node --expose-internals dsh/checks/test-loader-runtime.mjs
```

构建入口和锁文件在 [runtime/](runtime/README.md)；生成内容在忽略的 `runtime/.build/`，包解析链接在忽略的 `dsh/node_modules/`。不直接对含 `workspace:~` 的上游 package.json 执行 npm install。这里的构建器是 WEX 维护的独立验证工具，不是 DSH 原 monorepo 构建系统。

## 来源、边界与升级

- 固定来源：`DeepSeek-AI/deepseek-harness@f3803c96974ad4a94195fb97e5c637e9c2a3afe3`。
- [版本与历史](UPSTREAM-LOCK.md)、[逐文件 blob 清单](upstream-files.json)、[源码审查](PLUGIN-MECHANISM-REVIEW.md)、[实际构建报告](BUILD-VERIFICATION-2026-10-30.md)。
- `upstream/` 保持原路径、源码、许可证、包清单和构建配置；WEX 构建工具与测试单独维护。未复制 DSH Agent 客户端。
- Cordis 的可选 include peer 与 Loader 的可选 native addon 未安装；本阶段不运行需要 include 的 Core CLI，不依赖 native addon。
- 更新时先锁定完整新 commit、比较源码/依赖/许可证，再更新 blob 清单与依赖锁、干净重建并运行兼容测试。测试失败时保留原版本，不凭接口未变承诺适配器兼容。
- Cordis 同进程插件不提供系统沙箱，安装目录分离不等于权限隔离。

运行时安装位置仍仅为已有规划：用户选择的数据根下 `plugins/wex/`、`plugins/dsh/` 分离，插件包与配置、数据分别管理。本批不实现安装器，不修改 Space、工作流、权限或产品范围。

## 双插件体系架构基线（2026-10-30）

已确定 WEX 自有插件与 DSH 原生插件**安装管理和机制职责独立**，但可复用 Cordis 的基础生命周期技术；DSH CLI 仅是 DSH 子系统可选管理依赖，非 WEX 主程序启动前置。具体跨机制接口及 Windows/Electron 解析仍待验证。详见 [双插件体系与双机制分层基线](../docs/A1-正式产品设计/架构与决策/DSH与WEX双插件边界-2026-10-30.md)。

## WEX 对内置 DSH 插件宿主的阶段限定（2026-10-30）

本目录的 Cordis Core + Loader 是 **DSH 原生插件专用兼容基础**，不是 WEX 自有插件或连接器的强制底层。运行不了但必须使用的 DSH 插件，按实际依赖选择增补必要 Service、外部 DSH 连接器或 WEX 功能适配。优先评估独立工作进程而非直接运行在 Electron 主进程；具体 IPC 尚未定。详见 [双机制架构基线修正](../docs/A1-正式产品设计/架构与决策/DSH与WEX双插件边界-2026-10-30.md)。

## 本阶段交付目标（2026-10-30）

本目录独立目标是 **DSH 插件宿主达到 Windows 真机可操作的兼容测试状态**：Core+Loader 可启动，能载入、执行、卸载真实插件并观察错误。现有 Linux 构建和 hello Bundle 通过不等于真机验收。完整插件市场、Agent 引擎和 WEX 自有动态插件机制不作为前置。独立 DSH Agent 连接器职责见 [connections/dsh/](../connections/dsh/README.md)，不应依赖本宿主运行。具体边界见 [双路线验收](../docs/A1-正式产品设计/架构与决策/DSH与WEX双插件边界-2026-10-30.md#八dsh-双路线验收目标2026-10-30-最新确认)。

## 第二批：依赖缺失与职责限制

[独立生命周期入口](runtime/README.md#独立进程生命周期入口2026-10-30)已在 Linux 验证 hello 加载/卸载、启动抛错和缺失模块；这只证明基础宿主机制，不证明依赖 `sessions`、`tools`、`llm` 或 UI 的任意 DSH 插件可运行。

插件依赖不满足时由宿主记录未就绪/失败及缺少的服务，停止发布依赖该插件的可用能力，不能伪造服务或宣称兼容。应根据实际需求选择补充已验证的最小服务、改用独立外部 DSH，或明确不支持；选择仍属后续个案，不默认搬入完整 Agent 引擎。

宿主拥有插件加载/停止及服务就绪观察；`connections` 宿主边界拥有对 WEX 暴露能力的授权与操作回执；`workflows` 拥有任务、核验与验收。插件内部调用 Cordis Service 不自动经过 WEX 权限边界，不能将其误称为已授权的 WEX 内部调用。完整隔离能力待平台实验，同进程 Loader 不是沙箱。


## 第五批复杂压力审查补充（2026-10-31）

依据：[第五批覆盖、冲突与再审查记录](../docs/A0-产品构想与研究/方案与研究/审查历史/COMPLEX-CONTRACT-STRESS-REVIEW-2026-10-31.md)。以下细化均为 **B 推荐未批准、E0 静态审查**；A 仅沿用原有 owner/边界。C 实验与 D 政策不因本节入仓而关闭，未冻结接口或新增首版能力。

### 多插件同Service、升级和外部Agent交错（F04，B/C）

DSH宿主唯一维护原生包/版本、Service依赖、就绪、加载/卸载与实例代次；WEX自有插件的注册规则仍在plugins研究，不因复用Cordis变成同一安装清单。外部DSH Agent的会话和运行归connections/dsh适配，不能和本宿主实例互换。

建议两个插件P1/P2消费Service S时分别维护依赖依据；S升级/消失影响依赖者就绪，connections使对应出口过期并阻止不适用的新派发；原实例回执只归原尝试，不能因能力同名绑定新实例。升级计划应说明依赖兼容/配置迁移/在途Drain或阻塞及回退条件；算法尚未选定，不能自动强卸载后宣布任务停止。插件内部直接Node/Service副作用不能保证由WEX截获，必须披露真实限制。

重新加载不自动重试失败Operation；卸载失败/残留进程保留证据，app协调宿主释放，workflows决定工作后续。不能为补一个缺Service未经论证引入完整Agent引擎。断言：P1/P2共享S，P1卸载不移除仍需的S；S不兼容升级不能继续发布旧就绪描述；旧P1回调不注册为新P1身份；外部Agent断连不影响原生宿主被错误重启。真实Core+Loader依赖生命周期已有局部Linux证据，但该多插件升级/回执组合仍E0，需固定真实第三方包与Windows补证。


第六批：[最新准备度/证据及限制](../docs/A0-产品构想与研究/历史参考/工程研究批次/batch6/EXPERIMENTS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 文档入口与证据边界

- [文档体系总索引](../docs/README.md)
- [全局架构：双插件体系边界](../docs/A1-正式产品设计/架构与决策/DSH与WEX双插件边界-2026-10-30.md)
- [运行时扩展契约研究](../docs/A0-产品构想与研究/方案与研究/架构研究历史/RUNTIME-EXTENSION-CONTRACT-V0.1.md)
- [DSH 能力差距审计](../docs/A0-产品构想与研究/方案与研究/审查历史/DSH-WEXPC1-GAP-MATRIX-V0.1.md)
- [第六批实验与证据](../docs/A0-产品构想与研究/历史参考/工程研究批次/batch6/EXPERIMENTS.md)

本目录当前为预留机制或独立实验，不等于完整产品模块已获施工准入。研究/实验结果只证明其明确记录的范围；不得外推为完整 WEX 集成、Windows 实机或生产可用性。
