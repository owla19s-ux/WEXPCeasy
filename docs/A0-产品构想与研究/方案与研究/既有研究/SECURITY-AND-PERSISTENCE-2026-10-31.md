# 安全边界与数据持续性研究（2026-10-31）

## 安全：信任边界、权限检查与隔离（研究候选，未冻结接口）

基线：2026-10-31 读取 WEXPC1 main 的 README、研究决策摘要及 permissions/connections/workflows/shared README；GitHub 搜索快照为 `70406cf3924035b1982e2f8b2a769ca51c9406b8`。仓库仍以职责文档与独立实验为主，下面是研究建议，不是产品实现、安全审计通过或正式协议。

信任边界应分五层：可信应用装配/权限与领域写入口；受限 Renderer 与 preload/IPC；连接宿主与具体适配器；外部 Agent/DSH 插件进程；文件、Git、远端资源。Context/角色/任务名称都是范围资料而非身份凭证；跨 Space 引用、职责分配、工具发现、持有账号均不授予权限。外部文本、产物、仓库内容和插件元数据均按不可信输入处理。[W1][W2][W3]

| 风险等级（本次分析排序） | 关键风险与决策条件 |
|---|---|
| 严重/阻断接入 | 不可信第三方代码进入主进程；插件直接读宿主数据库/凭证；未鉴权 IPC 或越权 shell/path/URL。阻断指具体接入无法满足必要授权或泄露宿主敏感资料的条件，不是否定独立外部 Agent 路线。外部 Agent 保有自身权限是既定边界，WEX 不承诺约束其自主行为；窄接口和独立进程都不能独立证明 OS 隔离。 |
| 高/先做故障实验 | 撤权竞态、回调伪造/重放、提示注入引导跨 Context 取数或外发、取消后继续执行、残留子进程。 |
| 中/纳入验收 | 日志与错误泄密、撤权后的 UI 缓存、依赖更新及版本漂移；资源本身敏感时应上调等级。 |

权限检查点候选：入口先建立宿主认证主体和本次范围 → 排队/准备时判定 → 执行前按当前策略复核 → 每次外部反向取数再次判断目标、动作、范围 → 领域写入口检查版本及业务不变量 → 产物发布/外发另行授权。持久回执只关联当时权限依据和修订，不能变成永久 bearer 授权。审批绑定动作、资源、版本与有效期的表达方式仍待业务契约确认，不冻结字段。排队后撤权必须拒绝后续派发/资料输出；已交给外部的资料无法据此收回。停止等待、请求取消、终止确认、撤权和回滚分别留证，不能用一个 cancelled 覆盖未知副作用。[W2][W3]

注入防线候选：把模型/工具返回作为资料，不能据其中“系统指令”改变目标或授权；权限求值不依赖提示词；能力入口做结构、大小、目标和路径校验；安全敏感 shell 参数、链接开启、文件写入由明确动作约束，避免把自由文本直接解释成命令。Electron 官方要求关闭不可信内容的 Node 集成、开启 contextIsolation 和 renderer sandbox、验证所有 IPC sender、限制导航/窗口与权限请求、避免将 Electron API 暴露给不可信网页。preload 每项能力应窄化，sender 校验之外仍需业务授权。[E1][E2]

恢复的产品边界另于加密可恢复性：重装 Windows 或卸载重装，即使系统仍能解密旧凭证，也不得静默重绑凭证或恢复有效授权；旧批准与许可仅作审计，用户须重新配置凭证与授权。正常重启、普通升级及单纯目录迁移分别处理，不能仅因路径变化一律吊销全部凭证。依据：[旧基线 §5.6](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/docs/PC-PRODUCT-AND-TECH-BASELINE.md)。

插件隔离研究应验证 Windows 实际运行令牌、文件/网络/凭证可达性、环境变量清理、继承句柄和进程树退出；不得默认 Node worker/child_process、Cordis 生命周期、Electron renderer sandbox 自动约束任意 DSH Node 插件。优先独立宿主，进一步选何种 OS 限权机制须实测后决定；尚未选择最终沙箱。

源码取证：`connections/experiment/boundary.mjs` 复制 id/taskId 后授权，attempt 写失败则不派发，readTask 限定本次 taskId 并再次授权，只回 text；未知返回和派发后异常归 unknown，结果保存失败返回 unknown + observed。它没有持久事务、回调认证、重放防护、OS 隔离、在途撤权或资源占用实现；不能把 Object.freeze 当沙箱。其 execute 前仅有最初授权与 readTask 再授权，不构成所有副作用执行前复核的通用保证。[C1]

来源：[W1 README](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/README.md)；[W2 研究共识 §§6–9](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/docs/WEXPC1-RESEARCH-DECISIONS-2026-10-30.md)；[W3 permissions](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/permissions/README.md)；[C1 boundary.mjs](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/connections/experiment/boundary.mjs)；[E1 Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)；[E2 Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)。官方正文已由 urllib 原站读取；未运行 Electron/Windows 安全测试。

## 持久化与长期运行：权威、提交间隙和恢复矩阵（研究候选）

Task/工作轮次/定义修订/验收归 workflows；Operation 的意图依据、派发尝试、观察和回执归 connections 宿主；真实副作用归资源系统。Task 引用 Operation，不双写其正式状态；外部 completed、退出 0、回执保存、验证通过和验收通过是不同事实。shared 只提供存储机制；同库可有多个业务 owner，不同库也不能据此改变 owner。[W2][W4][W5][W6]

| 持久化候选 | 优点 | 限制与取舍 |
|---|---|---|
| 当前状态行 + 追加操作记录 + 定期快照 | 查询和排障成本低，适合窄实验起步 | 更新与记录须同事务；快照记录截止序号/版本，不能漏操作或从派生缓存倒写权威。 |
| 领域事件日志 + 可重建快照 | 保留演化依据，可重建投影 | 事件语义、修订迁移、重复消费和回放副作用隔离成本高；现阶段无证据要求全量 event sourcing。 |
| 仅定期整体 JSON 快照 | 原型简单 | 无法解释崩溃窗口和多入口并发，不宜作长期任务/操作权威。 |

建议先用 SQLite 窄实验验证单库事务：在同一提交中保存派发意图/attempt 与待派发依据，再交给执行器；外部请求不得放进长数据库事务。即便采用 outbox，也只缩小提交—派发间隙，无法把 SQLite 与外部文件/Agent/远端服务做成一个原子事务。不承诺 exactly-once。业务幂等键须由可重复意图/步骤生成，attempt 另编号；只有远端明确支持且作用域、保存期、请求体一致性可验证时才可借它去重。否则 unknown 不盲重试；查询资源版本/产物、人工核对或显式补偿都是候选，补偿本身又是有权限与副作用的新操作。

资源协调必须覆盖 Task 与普通聊天/单次调用；Context ID 不等于资源隔离。规范化文件身份、Git 工作区/元数据、外部 session/远端对象可能跨 Context 冲突。占用与租约/fencing 的算法仍未选定；租约到期只能说明本地所有权变化，不能证明外部已停。结果未知时保留受影响资源冲突，允许无冲突工作继续。关闭图不取消运行，退出/重启/休眠需要独立后台策略，Windows 服务、托盘驻留和外部 Agent 接续目前均未验证。

| 故障/迁移点 | 可知道的事实 | 恢复动作与必须验证 |
|---|---|---|
| 意图事务未提交 | 无持久派发依据 | 禁止外发；验证写失败不会调用外部。 |
| 已提交，尚未派发或派发后未记确认 | 只知可恢复意图，不能仅凭缺少确认断言未执行 | 通过远端操作定位/资源版本核对；未知时不自动重派。 |
| 外部改资源后断连/结果写失败 | 操作可能已生效 | 保存 observed 与未知分开；阻止冲突重派，独立核验归因与版本。 |
| 重启遇到重复/乱序结果 | 同一次尝试可能多次到达 | 去重观察、匹配 attempt/资源版本；不得让旧结果覆盖新轮次或新验收版本。 |
| 数据迁移中崩溃 | schema/文件可能处于不同阶段 | 停写/排空或明确切换屏障，迁移前一致备份，校验版本；同库迁移事务失败回滚，跨文件分阶段恢复，不假设原子。 |
| 复制/移动 Context 或数据根 | 身份与路径可分离，凭证不一定随迁 | 检测重复身份/未决 operation、重新定位资源、校验引用；不能按新路径自动重新执行旧工作。 |
| 恢复旧备份 | 本地历史落后于外部事实 | 给恢复点标记世代/截止位置候选，逐项核对未决与远端资源；不得把备份回滚当外部回滚。 |

SQLite 官方证据限定：WAL 允许读写并发但仅一个同时写事务；同一 WAL 数据库要求同主机，不支持网络文件系统；多个 ATTACH 数据库在 WAL 下不保证整体跨库原子性。WAL 文件属于持久状态，运行中只复制主 db 或任意删 WAL 可丢失已提交数据。备份应研究 Online Backup API（可增量且产生一致目标快照）或经支持的备份方式，不自行复制散文件；数据库备份仍不涵盖外部产物和系统凭证。需实测忙等待/SQLITE_BUSY、长读导致 checkpoint 受阻和 WAL 增长、磁盘满/断电、驱动 fsync 与 Windows 文件锁、备份恢复、迁移中断、连接器重复结果。[S1][S2][S3]

来源：[W4 workflows](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/workflows/README.md)；[W5 connections](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/connections/README.md)；[W6 shared](https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/shared/README.md)；[S1 SQLite WAL §§1/2/4](https://sqlite.org/wal.html)；[S2 Online Backup](https://sqlite.org/backup.html)；[S3 Transactions](https://sqlite.org/lang_transaction.html)。官方正文已原站读取，未执行 SQLite 恢复/并发实验；上述数据结构、幂等键、outbox、迁移和恢复世代均为候选，未冻结 API、表或状态枚举。
