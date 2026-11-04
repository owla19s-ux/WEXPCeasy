> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 第七批：基础模块首轮独立施工与真实验收

日期：2026-10-31。施工起点 main `7b88e16655a970b9f610c0cf462290c150884f64`。本批完成授权稳定范围的正式产品实现；不是完整WEX产品闭环或Windows验收。

## 实际成果与公开消费者

| 模块 | 产品实现 | 公开面与真实消费者 |
|---|---|---|
| shared | 限定命名空间SQLite适配、CAS、原意图查询/去重、三态提交；根身份/诊断、受限路径观察、可替换保守根锁、白名单技术诊断 | `shared/src/index.ts`；permissions消费Store类型/语义，app消费真实平台/存储能力 |
| permissions | 可信宿主事实输入、精确对话范围、三层限制、允许/拒绝/不可判定、授权/撤销修订代次、历史依据、出口前重新检查 | `permissions/src/index.ts`；app装配真实引擎并注入可信事实；无反查领域私库 |
| app | 依赖拓扑与失败诊断、必需/可选能力、降级、窄面注入、超时/迟到隔离、逆序释放与不确定退出；真实基础装配及CLI | `app/src/index.ts`；CLI和本域集成消费者；不提供容器、DB或业务总管 |

没有修改其他业务域实现、引入完整插件平台、复制Python实验为产品，或把SQLite/Windows锁候选升级为全局决策。工程为严格TypeScript、Node内建测试、精确依赖锁；未新增Electron/React空壳或产品页面。

## 修改范围

- 根：package.json、package-lock.json、tsconfig.json、README。
- shared/src、shared/tests：存储、路径、锁、技术日志及独立测试/契约向量。
- permissions/src、permissions/tests：本域数据/行为与权限reader共享验收向量。
- app/src、app/tests：装配、真实接线、CLI及提供/消费/故障集成测试。
- tools/check-boundaries.mjs、tools/tests：TS AST真实源码图与关键反例。
- 三模块README/CONTRACT、docs/README、docs/batch7：当前实现说明、可重现命令、审查和证据。
- `dsh/checks/test-native-bundle.mjs`：仅把测试Loader的baseUrl显式绑定到已有fixture包，避免新增根package.json改变最近包作用域；未改DSH运行时/上游/业务实现。

## 本地真实验证

| 命令 | 结果 | 证据与限制 |
|---|---|---|
| `npm test` | **44/44通过**，含非空源码依赖检查 | [原输出](evidence/foundations.txt)；Node24.22.1/Linux，本地真实SQLite与明确标记替身 |
| `npm run typecheck` | 严格检查通过 | [原输出](evidence/typecheck.txt)；不证明IPC/Windows ABI |
| `npm run test:shared` | 本域真实/替身/跨进程测试通过 | [输出](evidence/shared.txt)；根锁是合作目录锁，非Windows活性证明 |
| `npm run test:permissions` | 本域真实SQLite、存储替身、撤销/未知/损坏拒绝通过 | [输出](evidence/permissions.txt)；可信事实由测试宿主注入，不证明Windows身份认证 |
| `npm run test:app` | 提供方生命周期、消费方相同reader样例、三域真实集成通过 | [输出](evidence/app.txt)；模块缺失、初始化失败/迟到、存储失败、根锁保留、符号链接拒绝 |
| CLI真实启动/释放 | exit=0、ready、diagnostics=[] | [输出](evidence/cli.txt)；已有临时数据根；无窗口、默认无授权 |
| `npm run check:boundaries` | 非空TS源码图、0错误 | [图](evidence/dependencies.json)；覆盖私有深导/反app/shared反依赖/Renderer特权/文件模块环/解析失败/空图/类型import负例；非运行沙箱 |
| `git diff --check` | 通过 | 无Actions/付费API/外部Agent调用 |

44是基础工程测试总数，不包含下表旧实验回归。每项先观察失败再实现；新增既有行为的覆盖测试直接验证当前行为。模块独立脚本不依赖Electron启动。

## 旧实验回归（不升级为产品证据）

- 第六批机制模型18/18：[输出](evidence/mechanisms.txt)。
- 连接/DSH headless协议夹具18/18：[输出](evidence/connections.txt)。
- React Flow原型5模型+6 DOM通过，TS/Vite构建通过：[测试](evidence/editor.txt)、[构建](evidence/editor-build.txt)。构建保留上游use client忽略警告；未改原型产品实现。
- DSH固定Core+Loader的10个检查入口全部通过（含原生Bundle与真实生命周期），四包TS编译/打包通过：[测试输出](evidence/dsh.txt)、[构建输出](evidence/dsh-build.txt)。是原生插件fixture，不是真实DSH Agent任务。
- 文档文件目标检查：[输出](evidence/docs.txt)。不代表锚点/语义全自动证明。

## 真实实现、替身与故障证据

shared真实提供方与内存替身共用 `store-contract.mjs` 的成功、未提交、ACK丢失、旧修订、内容冲突与原关联回读断言。ACK丢失在真实SQLite COMMIT后于技术传输端口抛错；另有SQLite实际只读故障与子进程持锁/竞争，明确区别真实驱动故障与注入传输故障。跨重启去重单独实跑。

permissions真实实现分别消费SQLite及共享存储替身；app消费者与真实permissions/权限替身共用 `reader-contract.mjs` 的拒绝→允许→复核→撤销→依赖不可用观察。替身无持久性/OS可信证明。app提供方用有失败/迟到/释放异常行为的模块，未使用“永远成功”替身替代验收。

最小真实装配证明 app→shared/permissions，授权持久化、撤销后旧决定拒绝、重启后历史保留、存储异常不伪造成功。不包含真实Space、Task、Operation、产物验收或外部派发。

## 失败与修复记录

1. 初次工程无源码/函数，新增测试先失败，之后逐模块实现并全套复测；严格TS捕获装配结果字面量类型扩大，已修正。
2. 集成用例发现数据库符号链接可重定向外部写入：补数据库及journal/wal/shm的链接/文件类型检查和根身份复核；回归通过。仍不承诺抗同用户恶意竞态换链。
3. 独立只读代码审查发现3项Important：稀疏数组生成坏JSON、超时初始化未释放就确认stop、TS类型import绕过依赖检查。均先加失败回归再修复；测试40→44全部通过。没有未处理Critical/Important。
4. 超时释放修复中发现重复失败项/仍初始化计数导致原释放测试失败：成功装配等待所有权转移、失败集合去重并持续保留失败，重新全套通过；不隐藏红测。
5. GitHub逐文件落地额外尾换行使DSH完整性检查拒绝：按全部301个远端blob逐一验证还原，本地基线树与远端 `b367b3bc5b0bcd3bfc3af15b04c2c15fa836288c` 完全一致后重跑。不改上游/不跳校验。
6. DSH回归先因未构建缺包失败，补独立构建后发现根package.json改变Loader最近包作用域，导致裸包fixture找不到；只调整测试baseUrl到既有fixture包，10个检查入口重新全过。

## 未验证、C/D与下一批依赖

- Electron实际窗口/Node SQLite兼容、preload/IPC、React UI、Windows EXE/安装/ACL/凭证/多用户锁/关机重装：**未执行、E4未通过**。
- SQLite适配器、合作目录锁是本批可替换实现；Windows内核锁、句柄级抗重解析点竞态、崩溃残锁安全恢复、磁盘硬故障、备份/迁移/恢复SH03–05仍C。锁目录残留必须明确诊断/人工核对，不能按PID/超时自动删除。
- permissions出口前复核与真正资源/外发动作间无原子性证明，身份/来源认证由未来可信入口接线提供；普通用户历史筛选、有限次数、强审计策略、全量DLP未开放。
- D01–D07保持原状态，未代选非对话第三层、生命周期/Acceptance、审计保留、降级发布或预算政策。
- 直接Git/npm网络不通；依赖复用环境既存且与lock匹配的版本，**联网干净npm ci未验证**。依赖目录/产物不提交。
- 下一批space组织引用、AI/roles配置依据、views布局配置可消费本批Store/权限reader；各自须绑定独立命名空间、提供可信来源和本域修订/可见性规则。当前没有因此新增技术决策阻塞；Windows安全/非对话政策受影响能力继续等待，不阻止稳定绿色范围施工。

## 提交与交付证据

本地通过GitHub连接器读取/写入，提交前复核main；新提交以上述固定基线为父，更新ref携带expected SHA避免覆盖。未创建PR/分支/Release；未触发Actions，提交带skip ci且当前仓库无工作流。

最终main SHA由本报告所属Git提交及交付回执提供（避免自引用提交哈希）；见 [main提交记录](https://github.com/owla19s-ux/WEXPC1/commits/main)。本批文档与代码同一提交交付。

## 第七批收尾修复（2026-10-31）

本次针对首轮验收后的三处可靠性缺口追加局部修复，不改变模块owner、权限语义、存储格式或Windows/Electron未决结论。

- **app停机重试**：assemble 保留释放失败的活动实例；迟到初始化的释放失败也进入待清理集合。stop 返回 incomplete 后允许再次执行，重试未确认的释放；只有释放确认成功才移除实例。startFoundations 外层不再永久缓存 incomplete，provider停机或root lease释放失败后可重试。根锁仍只在所有provider停止确认后释放。
- **shared锁创建回滚**：owner写入失败时，只删除内容与本次随机token完全一致的owner；只尝试移除空锁目录。无法确认所有权或目录含未知内容时保持阻断，不做宽泛递归删除。
- **根身份标记**：inspectRoot 先 lstat 检查 .wex-root.json，拒绝符号链接与非普通文件。此举不构成句柄级原子防护，不能夸大为抵御同用户恶意并发换链。

新增回归测试覆盖：provider关闭瞬时失败后重试、root lease释放瞬时失败后重试、模块stop失败重试、迟到实例清理重试、身份标记符号链接/目录拒绝、owner写入确认丢失后的安全回滚，以及未知owner内容保留并持续阻断。

**验证边界**：本次通过GitHub源码写入接口提交变更；当前执行环境没有仓库工作树且无法解析外部GitHub/npm网络，因此未在本轮运行Node/TypeScript测试。新增测试已写入对应测试入口，须在可用Node >=24.9.0环境执行 npm test、npm run typecheck；不以静态审查冒充运行通过。本轮不触发GitHub Actions。
