# shared

**当前：第七批基础产品实现已落地；稳定实现与限制见本文“第七批实际实现”及[验收报告](../docs/batch7/REPORT.md)。下方阶段描述保留为历史依据。**
实际共用机制。各功能维护自己的业务数据含义；此处不成为集中业务逻辑的杂物目录。

历史初始状态（2026-10-30）：当时本目录只有职责说明，尚无产品实现；该状态已由第七批基础实现覆盖。当前代码与限制以本文“第七批实际实现”及后续批次补充为准。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。

## 与独立权限域的边界（2026-10-30）

权限策略、判定和授权归 [permissions/](../permissions/README.md) ；账号与身份归 [accounts/](../accounts/README.md)。shared 仅维护如存储、系统凭证等真正可复用的技术基础，不设第二套权限状态源。此前文档所列 `shared/permissions/` 属旧目录草案，由独立权限域取代。

## 第三批：模块契约设计入口（研究建议）

覆盖样本 L01/L03/L09。只为真实共用的技术能力制定出口；存储/凭证依赖宿主注入的平台机制，不能反依赖具体 Context/任务/模型业务。独立故障样例应区分技术保存失败与领域恢复决定；不要把所有模块类型集中进 shared 来掩盖循环。

契约就近、公开出口/依赖约束、分层测试和模块施工方法见[统一研究](../docs/architecture/GLOBAL-CONTRACT-MAP-V0.1.md)。本段只给制定契约的依据，不表示公开接口已实现或所有建议已获采纳。



## 第四批：模块业务契约设计

[本模块契约与独立验收规格](CONTRACT.md)列明公开能力、消费依赖、权威/私有边界、失败与未知、修订恢复和可断言样例。能力粒度与新增语义为待评审设计；已定约束、推荐、待实验、待决策分别标明。不是产品实现、正式接口或全部协议已定稿；只施工成熟能力，未决项不靠猜测补全。

## 基础共用机制归属补充（2026-10-31；候选目录，尚未实现）

依据[源码目录 §12](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md#12-基础能力补充后的代码目录归并2026-10-31-审查建议尚未创建源码子目录)与[基础能力缺口审查](../docs/audits/APP-FOUNDATIONS-GAP-AUDIT-2026-10-31.md)，除已规划的`storage/`、`credentials/`，按真实代码与测试需求候选扩展：`logging/`（结构化**运行**日志、输出限额、脱敏、轮转）；`config/`（配置技术写入/版本/迁移、并不解释配置业务含义）；`diagnostics/`（获准收集多来源脱敏诊断与导出）。这些是**未创建的按需子目录**，不要求施工时一次性建齐。

**权威隔离**：可清理的调试日志≠connections持有的Operation回执≠permissions持有的授权审计≠workflows持有的任务/验收证据；通用日志与诊断只能通过关联引用呈现事实，不代替或改写领域账本。配置字段含义、授权和生命周期决定由各提供方拥有。日志写失败的降级与必须先可靠记录的安全审计分别订立契约；普通日志轮转不准意外删除审计/产物来源。秘密与无权路径不得被诊断导出。进程及Windows实际存储/脱敏需故障注入验证。

禁止借共用机制创建万能配置服务、全模块状态仓库、全局查询绕权口或可执行任意文件/SQL的公共能力。


### 第六批施工准备度（2026-10-31）

**黄**：按本目录[CONTRACT第六批条款](CONTRACT.md)执行上述稳定范围；C/D未决能力继续暂缓，绿色不代表全域实现/验收完成。[全域矩阵](../docs/batch6/READINESS.md)、[实验结果](../docs/batch6/EXPERIMENTS.md)、[施工顺序](../docs/batch6/NEXT.md)。


## 模块编号规则

- shared 技术基础细分使用 `SHARED-<子域>-NNN`，详见 [CONTRACT 第 7 节](CONTRACT.md#7-模块独立功能编号与细化契约)。
- SH-01～SH-06 保留为既有能力锚点。
- shared 只提供技术原语；领域业务状态、权限决定、Operation/Task/验收账本和数据保留政策不归 shared。

## 文档入口

- [本域契约及关联依据](CONTRACT.md#文档关联与施工入口)
- [WEXPC1 文档体系总索引](../docs/README.md)
- [全模块契约索引](../docs/MODULE-CONTRACTS.md)

全局架构、决策、研究、审查、实验和当前施工准入范围，以本域 `CONTRACT.md` 的“文档关联与施工入口”章节为准；README 只负责提供入口，不重复维护一份容易漂移的资料清单。


## 第七批实际实现（2026-10-31）

本节为当前产品实现范围，先前“没有产品代码”描述是历史状态。公开入口 `shared/src/index.ts`，真实消费者为 `permissions/src/service.ts` 和 `app/src/foundations.ts`；无反向业务依赖。

- `Store.read/commit/query`：一个命名空间聚合快照及原意图记录；期望修订 CAS；明确 committed / not_committed / unknown。成功及意图记录在同一 SQLite 事务；命名空间在构造时由可信宿主绑定，消费者不取得 DB 句柄。读取故障抛错，不能冒充空库。
- 意图作用域为同一数据库、命名空间及 intent；原提交包含 expectedRevision 与规范 JSON 内容，完全一致重送返回原修订，不同内容冲突。原意图记录当前不自动过期、不提供清理；跨重启保留。unknown 后通过原 intent query/权威记录回读，未确认不重建外部动作。
- `openSqliteStore/createSqliteStore` 为可替换 Node SQLite 适配；`SqlitePort` 是技术驱动接口；对外不承诺跨库/文件/服务原子性。不将本批适配器冻结为全产品存储选型。当前使用 Node 24.22.1 内建 SQLite，未验证 Electron 的 Node 版本适配。
- `inspectRoot` 只读现存 `.wex-root.json`（format=1、id非空）；先用 `lstat` 拒绝符号链接及非普通文件，不自动初始化、移动、修复旧根。检查仍是路径观察，不是抗同用户恶意并发换链的句柄级能力。诊断 missing_path / missing_volume（需平台 ENODEV/ENXIO 证据）/ permission_denied / corrupt / incompatible / identity_conflict / unavailable；ENOENT 不推断缺盘。
- `resolveWithin` 重新核根身份并用 realpath + relative 检查现存路径；拒绝绝对路径与链接逃逸。结果只是当时定位观察，不是抗同用户恶意换链的文件操作凭证；未来真正读写/删除出口仍需句柄级平台校验。
- `RootLock` 可替换。默认 `directoryLock` 是保守合作目录锁：原子 mkdir、随机 owner、释放核对、不自动清旧锁。owner写入失败时仅清理由本次调用创建且内容精确匹配随机token的owner；仅在目录为空时尝试移除锁目录，任何未知内容均保留并继续阻断。进程崩溃会留下锁并阻断，尚无安全自动回收；不是 Windows OS 活性锁/ACL/沙箱证明。
- `createDiagnostics` 只允许技术 code/module/level 白名单，不接受自由消息正文、任意字段或业务证据；sink失败明确返回 failed。普通诊断不是 Operation、权限审计或 Task/Artifact/Verification 账本。没有日志文件轮转/保留策略实现。

测试：`npm run test:shared`。真实 SQLite 与测试专用内存替身共用 `shared/tests/store-contract.mjs` 向量；ACK丢失通过真实 COMMIT 后的传输端口异常注入，另有真实只读与跨进程锁竞争。不以替身证明持久性。SH03–05 的完整备份/Windows凭证/ACL/重装关系恢复均未实现，C/D保留。


## 第八批验证补充（2026-10-31）

当前存储/根锁源码与契约不变；现有SQLite驱动已在Electron45.2.1内嵌Node24.22.1真实建库、事务提交、关闭、独立进程重启回读。无需为本批增加驱动适配；不是Windows锁/ACL/迁移恢复验收。见[第八批报告](../docs/batch8/REPORT.md)与[实验说明](../experiments/electron-host-spike/README.md)。

## G1/G6：持久技术基础的范围

Shared 的 SQLite/路径/提交能力是技术基础，不是资源正文管理器或 Task 检查点服务。各领域在自己的命名空间保存业务事实。当前 `shared/src/diagnostics.ts` 仅为受限诊断 sink，不是持久化日志、查询、轮转或脱敏导出平台；凭证后端也尚未完成。Operation、权限审计和 Task/验收证据仍由各自 owner 保存。

见[基础能力落地映射](../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
