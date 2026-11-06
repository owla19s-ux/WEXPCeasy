# connections/dsh — 外部 DSH Agent 连接器

## 当前版本边界及 owner（2026-11-07）

本目录是**连接独立 DSH Agent 的外部连接器**，与 `dsh/` 的插件兼容研究不同；当前只有隔离实验及失败回执，未有正式 `src/` 产品实现。按已批准 0.1.1 版本计划，本连接器及外部 Agent 执行闭环**延期到 0.1.2**。上文“首期重点/并行开发”是历史研究顺序，不能作为 0.1.1 Codex 施工指令。未来若其执行环境须安装管理，生命周期归 [environments](../../environments/README.md)，本连接器只负责 DSH 协议与外部 Session 观察；不能另建操作账本。


> **代码事实核对（2026-11-04，基线 `1048b6a`）**：没有产品 src/tests；有 experiment/ 独立 headless 实验，不等于正式外部 Agent 连接闭环。 开工须重新核对最新 main。

首期重点：WEX 任务卡向独立 DSH 运行实例派发任务，取得可获取的会话状态、结果与产物引用。适配 DSH **实际公开**的接口能力，不预设一定能附着现有网页会话、取消内部任务或精确同步其 Agent Loop。

本模块不实现 DSH 客户端，不管理 Cordis 宿主基础设施；仅把 DSH 作为 WEX 的一种可命名外部执行能力。工作流和 Context 不直接依赖 DSH 内部模型；真实回执、结果未知、人工验收等状态由 WEX 保存。

状态：已有独立 headless 进程实验与真实失败回执；尚无成功模型任务或 Windows 端到端验收。

## 独立验收路线（2026-10-30）

**与内置 DSH Core+Loader 插件宿主并行开发，互不作为启动或交付前置。** 本连接器的最小可用闭环是：配置 DSH 外部运行实例 → 验证连接状态 → 以 DSH 实际公开可行的方式派发任务 → 接收或查询可获得的执行结果、会话入口、产物引用 → 向 WEX 返回真实失败/结果未知回执并由 WEX 持久化。不能预设 DSH 具有尚未证实的外部任务 API，也不能将本连接器当作 DSH 插件运行容器。当前已有下述独立实验，没有产品级连接器或成功端到端验收。

架构依据：[DSH 双路线验收目标](../../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)。

## 本批实际实验（2026-10-30）

实现位于 `experiment/`，只用 Node 内置进程 API；不依赖本仓 `dsh/` 的 Cordis 宿主。依赖锁定 npm `@deepseek-ai/dsh@0.2.1-rc.5`，源码研究固定 `ce7073d51254c26cd63b22a60835b8f948deb447`；路径/blob 与发布包散列见 `experiment/source-evidence.json`。

实际入口：`dsh --profile headless --json -` 从 stdin 接收任务，stdout 为 NDJSON，stderr 为诊断；每次独立子进程，shell 禁用。SDK profile 支持 JSON-RPC stdio，ACP profile 支持 ACP stdio；本批不实现这两条更复杂路线，不假设 HTTP API。headless 的 `--session-id` 只恢复已持久化且匹配条件的会话，不是随意附着正在运行的 GUI 会话；本实验暂不暴露恢复参数。

```sh
npm ci --prefix connections/dsh/experiment --ignore-scripts --no-audit --no-fund
npm test --prefix connections/dsh/experiment
npm run --prefix connections/dsh/experiment probe
```

Linux / Node 24.22.1 / npm 11.9.0：锁文件安装通过，13 项进程/协议回归通过。测试中成功输出来自明确标注的子进程替身，不是 DSH 成功任务。

**真实探测**：已启动发布版 DSH，在临时工作目录与 DSH_HOME 中经 stdin 输入 `Reply exactly WEX_DSH_HANDOFF_OK. Do not call tools.`，取得 `session`、turn/step 状态、`turn_end.reason.kind=error`、`MISSING_CREDENTIAL` 和空 `final.text`，进程退出 1。适配器返回 `failed / DSH_TURN_FAILED` 并保留真实 sessionId 与错误原因；probe 也退出 1，不能算成功验收。该探测明确禁用模型 Key，避免调用费用和误用现有 GUI 配置；当前成功任务阻塞为缺少配置完成的模型凭证及其可用网络路线，未要求用户交出 Key。

抓到并修复发布差异：rc.5 的 final 只有 type/text，需读取最后的 turn_end 原因；源码最新版 final 才直接含 sessionId/reason。测试覆盖两种形态、退出码矛盾、会话矛盾、非法/不完整输出、进程信号、超时、输出上限及启动失败。零退出码或助手文本本身不算成功。断连返回 `disconnected` 且 outcome unknown，超时/冲突返回 unknown，均不自动重试；杀掉本地进程不证明外部副作用已撤销，也不承诺清理其全部后代。

模型返回 completed 也只代表外部报告完成，产物核验与最终验收仍归 WEX。后续真机需验证配置真实 Provider 后的成功任务、持久会话恢复、中文路径、长任务断连与 Windows 子进程树清理。Node 以脚本路径启动 CLI，可避开 Windows `.cmd`/shell 引号差异；本批未实测 Windows。

收尾审查修复并验证：后代进程继承管道时，超时会关闭本地管道并立即结束适配器等待，不再等后代退出；半条 NDJSON 后收到退出信号仍记录 disconnected。两项均先复现失败再修复，仍不承诺后代被取消。真实失败记录见 `experiment/probe-result-2026-10-30.json`。

## 架构观察范围

DSH Session、内部 Agent 状态和自身权限由独立 DSH 持有；本适配器只报告可观察事实，WEX 的操作回执由宿主连接边界保存，任务/验证/验收归 `workflows`。sessionId 是外部定位线索，不是 WEX 主体身份或授权票据。

已修改文件后断连时，本适配器报告通信丢失及已知证据，不把文件改动回滚或重派。`workflows/runtime` 决定暂停冲突工作、查询恢复线索与请求独立核验，授权内通过本地/Git 等连接器读取实际版本；无法确定归因时保留未知并升级处理。当前尚无真实恢复/产物归因实验，不能由进程协议测试外推成功。


第六批：[最新准备度/证据及限制](../../docs/batch6/EXPERIMENTS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 上级契约与文档入口

- **上级业务/职责研究（历史）：** [connections/CONTRACT.md](../../docs/research/contracts/connections/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [双插件体系边界](../../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)
- [外部 Agent 生态](../../docs/research/AGENT-ECOSYSTEM-2026-10-31.md)
- [DSH 能力差距审计](../../docs/audits/DSH-WEXPC1-GAP-MATRIX-V0.1.md)

本子目录不另建第二份业务权威。当前稳定职责与施工范围以对应 owner README 和根 README 为入口；历史契约只按需追溯，实验结论仅按原环境和范围解释。

## G4：外部会话接续边界

外部 DSH 的 Session/Agent Loop 仍由 DSH 自身拥有。WEX 保存投递关联、可查询的外部会话定位、Operation 观察和产物引用；恢复时先查询原 Session/Operation，不以新会话重发任务。只有真实接口证明确实支持的查询、停止或接续能力才声明支持；进程退出、timeout、not found 均不自动证明外部任务停止或未执行。

跨对话验收见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
