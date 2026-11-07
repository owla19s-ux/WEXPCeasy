# Windows 安装与数据生命周期研究（2026-10-31）

## 范围与证据等级

仅只读审查 WEXPC1 main 与上游官方文档/源码，没有写远端、迁移旧代码或实现产品。仓库 README（blob `8527d7c`）、Windows 数据要求（`beaae98`）、Space 设计（`ebe2ed5`）已读取。既定路线保持 TypeScript + Electron + React，SQLite 与用户目录为持久化候选，Forge 为优先打包候选；安装器尚未定型。本报告的“已核实”指文档/源码事实，不表示 Windows 安装实测通过。上游 main/master 为浮动引用，施工时应锁定版本/SHA。

## 1. 自选数据盘与 Space 目录

**已核实**：Electron 的 `userData` 默认来自当前用户 AppData 加应用名，`sessionData` 默认指向 `userData`，包含 cookie、localStorage、网络状态、磁盘缓存等。`app.setPath` 可以覆盖已列出的特殊路径，但目标目录须先存在；重设 `sessionData` 必须早于 `ready`。因此“程序装 D 盘”不会自动使数据跟到 D 盘。[E1]

**设计推断**：应由 `app/` 启动接线及 `shared/` 路径基础能力集中提供已校验路径，业务模块不得各自拼 AppData。安装目录、公共数据根、Space 工作区、独立 Context、外部引用目录必须分开。Space 分类/Group 仍为逻辑组织；添加 Context 或改变归属不移动文件。公共根只保存公共配置、登记与必要应用状态，不吸纳所有 Context 实物。[R1–R3]

首次选择目录存在启动时序问题：普通 Electron 文件选择 UI 往往需要 ready，而 Chromium sessionData 已需提前确定。候选为启动器/受控初始小型系统 profile 选择后重启，或首次以明确的 bootstrap profile 启动、选择后退出重启再使用正式 profile；不能用 ready 后 `setPath(sessionData)` 冒充已实现。小型定位信息可存系统用户位置，但丢失后必须仍能浏览并识别旧数据根。根内应含非秘密格式/版本/身份元信息，确切格式不冻结。

缓存、日志、crash dump、下载、更新 staging、插件安装缓存、Chromium 持久 session 及第三方库分别列写入清单；可控制的随用户根，系统/依赖例外记录位置与原因。不可承诺系统盘零写入。自选路径需检查不存在、只读、空间不足、中文/空格/长路径、盘符变化、可移动盘掉线及重解析点；网络盘是否支持需单列，不可等同本地 NTFS。

## 2. 凭证与 Windows 多用户

**已核实**：Electron `safeStorage` Windows 后端使用 DPAPI；保护边界是 Windows 用户，并不防同一用户空间中的其他应用。微软说明通常需相同登录凭据且同一机器解密，并存在 roaming 等例外；`CRYPTPROTECT_LOCAL_MACHINE` 允许机器上的用户解密，不应为方便恢复而当作用户隔离方案。[E2,M1]

**结论/推断**：数据盘上的加密 blob 保存完好，不等于重装 Windows、新建同名账号、换机器或丢失 DPAPI 主密钥后仍能解密。不能承诺 API Key/令牌自动恢复。且这不只是 DPAPI 能否解密的技术问题：已核对固定提交 `faf11f31d44e4fc4788e766074b8db6b83ab4a1b` 旧 WEXPC 基线 §5.6，重装 Windows 或卸载后重装必须由用户重新配置凭证、重新授予有效权限；即使 Windows 凭证库仍保留且可解密旧条目，也不得静默重绑。历史授权记录只供审计，旧全局开关、目录许可、执行策略、待审批/已批准操作不得自动复活。正常重启/常规中断不要求每次输入 Key，普通升级另做兼容保留设计，不能将升级伪装成卸载重装以绕过边界。[R4] 普通数据可恢复，不清空旧记录。现行基线不允许普通备份自动导入凭证，也未批准跨机器凭证恢复；本轮不增设密码导出功能。

**已核实**：NTFS/Windows 对象访问由 DACL 中的 ACE 判定；自选 D 盘目录并不会因为应用有账户概念而自动私有。[M2]

**设计推断**：默认一个 Windows 用户一个私有公共根与 Chromium profile；首次创建根检查实际 ACL，避免继承到 Everyone/Users 广泛可读写。共享安装程序不表示共享配置、cookie、凭证或工作数据库。`accounts/` 仍仅预留，不能拿应用账号替代操作系统隔离；Space 的“公开/公司”标签也不授予文件访问权。新系统账号 SID 改变后旧 NTFS ACL 可能需要用户/管理员重新授权，不能静默广泛放权。用户选择同一目录供不同账号/多进程写入时应阻止或明确限定支持模式；当前无需建设多用户协作平台。

## 3. SQLite、文件备份与恢复

**已核实**：SQLite Online Backup API 可在源库运行时产生一致备份；官方也列 `VACUUM INTO`。WAL 模式提交可能仍在 `-wal` 中，不能热运行时只复制主 `.db` 文件当完整备份；官方还明确 WAL 不用于跨主机网络文件系统。[S1,S2]

**设计推断**：用户备份方案至少有两条可靠路径：应用内通过驱动暴露的 SQLite backup API 生成快照，或停止全部写入并正常关闭数据库后再复制；不可用“先随手复制 db，之后补 wal”替代一致快照。驱动与 API 仍待选型。WAL 可能含已提交但尚未 checkpoint 的数据，故障恢复时不得主动删 WAL 来“修复”；SHM 是可重建的 WAL-index，不等同于必须持久保全的 WAL。

单库一致不等于整个工作环境一致：公共索引、多个 Context 库、附件、外部引用、插件配置可能分处不同盘。备份需有清单，记录包含的根/版本/快照时点和未包含外部资源；可先停写做受控备份，不提前发明分布式事务。排除可重建缓存，凭证另作恢复提示。备份写到临时目标，完成校验再发布；恢复先验证格式、版本和数据库完整性，再用副本迁移，保留迁移前备份。对恢复到较旧版本要明确拒绝写入或只读，不能静默清空。

D 盘不是备份；同一物理硬盘不同分区仍共享故障。必须以真实恢复演练验证备份，包括新系统、新账号、盘符改变、缺失 Context、缺失凭证及附件缺失。运行中任务恢复为待核对/阻塞；连接操作结果未知时不得因重开程序自动重放。

## 4. 安装、升级、卸载与打包候选

| 候选 | 已核实的机制 | 与 WEX 要求的关系及不足 |
|---|---|---|
| Forge + Squirrel.Windows | Forge maker 调用 electron-winstaller，生成 Setup.exe、RELEASES、nupkg；上游 Squirrel 文档安装根是 `%LocalAppData%\\MyApp`，按用户写入并管理版本/更新包。[F1,Q1] | 安装/更新链路成熟，但标准行为不满足“安装时自由选目录”的可见要求，且更新包会占系统用户盘；不可因为 Forge 常用默认就定型。具体自定义/替代方式需验证。 |
| Forge + WiX MSI | Forge maker 调用 electron-wix-msi 的 MSICreator；其文档 `ui.chooseDirectory=true` 可选择安装目录，默认 false，自定义 template 时该字段无效。[F2,W1] | 保留 Forge 的可行候选，需配置 UI、稳定升级身份、签名、版本规则与卸载策略。MSI 构建成功不等于 Electron 自动更新已接通；运行数据仍由应用负责。 |
| electron-builder + NSIS | 当前官方类型 `oneClick` 默认 true；`allowToChangeInstallationDirectory` 默认 false 且仅 assisted installer 生效；`perMachine` 控制安装模式；`deleteAppDataOnUninstall` 默认 false，注释限定 one-click。[B1] | 可用 `oneClick=false` 与目录选择选项验证自选安装盘；是比较对象，不因此替换已确认 Forge 候选。自选公共根、Context 恢复仍非安装器自动提供。 |

特别注意：builder 官方卸载模板的可选删数据分支针对 `$APPDATA` 下若干应用名称目录，还受 `--delete-app-data`/构建宏控制；它不会自动发现任意 D/E 盘公共根和各 Context。[B2] 因此“关掉删 AppData”不能代替完整的 WEX 卸载设计；同样不能打开开关便声称完成任意位置的数据清理。默认卸载仅移除程序与系统集成，数据保留；独立清理操作须显示确切目标，外部引用资料不得递归删除。若数据根误位于安装目录内，应阻止这种布局或具备明确保护，不能依赖安装器碰巧保留。

更新是程序更新与数据格式迁移两件事：先停相关写入、备份及检查兼容；程序目录可替换，公共数据与 Space/Context 不覆盖；插件 `plugins/wex`、`plugins/dsh` 包体与各自状态分离。更新失败、数据库迁移失败、程序回滚但数据已升级须有明确处理，不能假设降级程序总能读新库。签名/安装器标识/升级代码及渠道关系在锁定具体 maker 后研究，不提前冻结。

## 5. Windows 必须实测的验收矩阵

全部为待测，当前没有 Windows 安装与重装证据：

1. 标准用户/管理员分别安装，安装盘与公共根异盘；空目录与已有根；共享安装但两个 Windows 用户的 profile/凭证隔离。
2. 首次启动选择、退出重启、bootstrap 信息丢失，仍能接回已有根；记录全进程实际写入，尤其 Chromium、更新器及扩展。
3. 安装路径中文/空格、根迁移、拒绝权限、磁盘满/离线及目录冲突；迁移中断后旧数据可恢复，不允许两个进程同时迁移。
4. 原版本升级、程序更新失败、迁移失败和降级；公共配置、Context 数据、附件、两类插件状态不被替换。
5. 默认卸载/重装留数据；显式清理只删明确受管数据，符号链接/重解析点不能越界删外部目录。
6. 干净新 Windows 与新用户接回旧根，盘符/ACL 改变可修复；DPAPI 失败明确提示；卸载重装但旧系统凭证仍可读时也不得重绑，所有重装场景须重新配置凭证与授权，并与正常重启、普通升级分开留证。
7. WAL 活跃写入备份、断电/强杀恢复、备份恢复验证；未知外部操作不重放。备份范围跨公共根与多个 Context 时清单准确。

## 来源（均为原始仓库/官方）

R1 https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/README.md
R2 https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/docs/WEXPC-SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md
R3 https://github.com/owla19s-ux/WEXPC1/blob/70406cf3924035b1982e2f8b2a769ca51c9406b8/docs/WEXPC-SPACE-AND-WORKFLOW-EDITOR-DESIGN-2026-10-30.md
R4 https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/docs/PC-PRODUCT-AND-TECH-BASELINE.md （§5.6 已确认产品边界）
E1 https://www.electronjs.org/docs/latest/api/app （getPath/setPath、ready、退出事件；注意系统关机/登出不保证退出事件执行，备份不能仅依赖退出钩子）
E2 https://www.electronjs.org/docs/latest/api/safe-storage
M1 https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata
M2 https://learn.microsoft.com/en-us/windows/win32/secauthz/access-control-lists
S1 https://sqlite.org/backup.html
S2 https://sqlite.org/wal.html
F1 https://github.com/electron/forge/blob/main/packages/maker/squirrel/src/MakerSquirrel.ts
F2 https://github.com/electron/forge/blob/main/packages/maker/wix/src/MakerWix.ts
W1 https://github.com/electron-userland/electron-wix-msi/blob/master/README.md
Q1 https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/install-process.md
B1 https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/targets/win/nsis/nsisOptions.ts
B2 https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/templates/nsis/uninstaller.nsh

检索限制：搜索服务返回错误，Forge 网站直读返回 403，改为官方 Forge maker 源码与其直接调用的官方维护库 README 核对，没有把无法读取的页面当作证据。electron-builder 当前源目录含 `targets/win/nsis`，旧教程路径 `src/options/nsisOptions.ts` 已不可直接套用；施工仍应按锁定发行版核验，而非照搬浮动 master。
