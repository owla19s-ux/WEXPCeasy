> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 第八批：基础复验与 Electron / React 宿主最小验证

2026-10-31；实际起点 `f955e058cf035a8fd38599367ad0c73926623907`，开工及提交前均重新读取远端 main，起点与用户已知基线一致；未回退到 PLAN 中的早期规划提交。新建完整本地克隆，main，无既有未提交修改，仓库无 AGENTS.md、无 .github/workflows。未发现并行主线提交。本报告所属提交 SHA 见 Git 提交记录及交付回执（避免自引用）。

**结论：基础模块和 Linux 最小宿主已具备继续桌面主体工程的条件；仅准入稳定能力及正式宿主骨架，不代表 Windows 桌面产品验收通过。E4 未通过。** 现有模块装配无需改为 Workspaces，无需推翻 TypeScript/Electron/React 路线。正式主入口仍未产品化，实验不可直接当产品启动器。

## 实际产物与边界

- 第七批最终修复重新执行完整验证，停机/provider/root lease/迟到实例重试，owner回滚及未知锁阻断、根身份链接拒绝、撤销/重授权/存储损坏与未知拒绝均由当前测试运行覆盖。
- 新增 `build:shared` / `build:permissions` / `build:app`，只以本域公开入口和必要传递依赖独立编译；不读取其他消费者入口。不是独立npm包、不同依赖版本或动态替换承诺。
- AST补缺：UI此前能经permissions公开出口导入权限引擎。新增失败反例后，禁止Renderer直连shared/permissions/connections/app；既有私有深导、反依赖、循环、动态/类型导入反例保留。
- `experiments/electron-host-spike`：精确版本/独立锁、严格TS React、本地构建、sandbox preload、sender/参数/权限gateway、启动退出协调、真实Electron验证器。保持产品app/shared/permissions源码和业务契约不变；不引入业务总管或第二权限来源。
- 主进程验证脚本与策略为ESM JavaScript测试工具，产品领域保持严格TS；React严格TS，sandbox preload为CommonJS。实验脚本不属于已交付的正式TS桌面入口。

## 环境与可复现命令

Node24.22.1、npm11.9.0、TypeScript5.9.3；Linux x64。根依赖与实验依赖均实际 `npm ci`，按各自package-lock；无既有依赖冒充干净安装。Electron45.2.1、Chromium156.0.8078.75、内嵌Node24.22.1、SQLite3.53.4；React19.2.0、esbuild0.25.12。版本来自实际进程JSON，不用系统Node推断。

复现见[实验说明](../../experiments/electron-host-spike/README.md)。核心顺序：根 `npm ci` → `npm run typecheck` → `npm test` → 三域独立测试/构建 → `npm run check:boundaries` → 实验 `npm ci/build/test` → `WEX_SPIKE_HEADLESS=1 npm run verify --prefix experiments/electron-host-spike`。Windows/有显示器环境去掉headless变量，但本批尚未执行Windows命令。

## 真实验证结果

所有原输出在[evidence](evidence/)。重复入口不累计为不同测试；旧实验不混入产品总数。

| 入口 | 实际结果 | 原始证据 |
|---|---|---|
| 根 npm ci | 成功；3包 | [npm-ci.txt](evidence/npm-ci.txt) |
| typecheck | 严格检查通过 | [typecheck.txt](evidence/typecheck.txt) |
| npm test（最终） | 50通过 / 0失败 / 0跳过 | [foundations-final.txt](evidence/foundations-final.txt) |
| test:shared | 13通过 / 0失败 | [shared.txt](evidence/shared.txt) |
| test:permissions | 5通过 / 0失败 | [permissions.txt](evidence/permissions.txt) |
| test:app | 17通过 / 0失败 | [app.txt](evidence/app.txt) |
| build:shared/permissions/app | 3入口均成功，入口闭包独立编译 | [shared](evidence/build-shared.txt)、[permissions](evidence/build-permissions.txt)、[app](evidence/build-app.txt) |
| check:boundaries | 非空AST图，0错误；15个反例/正例测试包含于总数 | [最终图](evidence/boundaries-final.txt)、[失败反例](evidence/boundary-red.txt)、[修复后](evidence/boundary-green.txt) |
| 实验 npm ci / build | 干净安装、React严格类型检查、实际打包通过 | [ci](evidence/spike-ci.txt)、[build](evidence/react-build.txt) |
| 实验单测 | 8通过 / 0失败（4策略、3生命周期、1入口烟测） | [spike-unit.txt](evidence/spike-unit.txt) |
| Electron实际运行 | 3独立进程全部exit0；write/read/startup-quit共54条命名断言（不当作54个单元测试） | [完整输出](evidence/electron-run.txt)、[写](evidence/electron-write.json)、[读](evidence/electron-read.json)、[启动退出](evidence/electron-startup-quit.json) |
| React Flow旧实验 | 模型5+DOM6通过；TS/Vite构建通过 | [测试](evidence/editor.txt)、[build](evidence/editor-build.txt) |
| DSH固定Core+Loader/原生Bundle | 10检查入口均通过；4包构建成功 | [test](evidence/dsh.txt)、[build](evidence/dsh-build.txt) |
| 连接/DSH协议夹具 | 18通过 / 0失败 | [connections.txt](evidence/connections.txt) |
| 第六批机制回归 | 18通过 / 0失败 | [mechanisms.txt](evidence/mechanisms.txt) |

npm环境http-proxy弃用提示保留；旧React Flow有上游use client打包警告；Electron容器DBus/udev/netlink诊断和主动阻止远程URL的ERR_BLOCKED_BY_CLIENT保留，不伪装成无警告。它们未导致上述运行失败；本批未验证系统通知/设备/桌面集成。

## Electron实际证据与安全边界

1. 真实Electron内使用现有shared驱动建库、BEGIN IMMEDIATE事务提交、回读、关闭；进程退出后第二进程回读同一临时根的值和原intent。SQLite目前适用；无需新增平台适配器，但版本升级仍须复跑。
2. 真实app/shared/permissions装配ready。关闭窗口触发before-quit，首次关闭SQLite故障注入返回incomplete、窗口保留/根锁仍占用；stop重试成功后另一宿主可重新接根。第三个Electron进程验证初始化pending期间quit等待所拥有实例的清理、失败保留且可重试。不是Windows系统强制关机或SIGKILL恢复证明。
3. userData/sessionData/crashDumps设置前同步准备会话目录并断言app.isReady()为false；ready后核对session路径和真实session.getStoragePath。没有首次选址UI，没有承诺系统盘零写入。
4. React真实加载并显示ready；抛错能力返回host_unavailable且UI实际显示该错误。不能据此声称主进程崩溃恢复已完成。
5. 主窗口实际nodeIntegration=false/contextIsolation=true/sandbox=true；全局enableSandbox。Renderer内require/process均undefined，wexHost只有readStatus。实际preload不暴露IPC对象、Node、FS、DB、完整host或命令。负例只用单独测试preload的两个固定拒绝探针，不是产品API。
6. gateway从Electron event取得sender/mainFrame/精确file URL，参数不提供可信主体。实际合法状态请求成功；伪造参数/未授权探针/另一真实WebContents被拒绝。纯策略单测再覆盖伪造sender、子frame、空frame、URL变化、destroyed；子frame拒绝目前是策略级证据，不宣称真实iframeIPC已实跑。权限判断消费现有permissions，默认无可信事实/无授权，外部payload不能建立事实。
7. CSP禁网络/子frame/内联脚本；Session资源白名单只含3个本地构建文件；拒绝导航/重定向、外部窗口、webview及权限请求/检查。实际window.open为空、Notification denied、主进程主动load远程页面得到ERR_BLOCKED_BY_CLIENT。实验白名单不可直接当未来多页产品协议。
8. Linux使用Ozone headless、离屏软件渲染；没有no-sandbox或disable-web-security。已核对[900×650实际窗口位图](evidence/electron-window.png)与DOM内容。无显示器环境不能证明原生Windows窗口、GPU/输入/缩放等体验。

## 失败、修复与独立审查

- ESM入口顶层等待app.whenReady造成ready阻塞，初次45秒超时；将ready等待放入异步run并完成模块求值后恢复。原始输出[electron-headless.txt](evidence/electron-headless.txt)保留。
- 沙箱preload的require是脚本作用域，不能从任意isolatedWorld注入取用；旧测试探针报错。改用独立测试preload固定负例，不放宽Node/sandbox、不把通用IPC交给Renderer。失败输出[electron-debug.txt](evidence/electron-debug.txt)保留。
- 初版headless默认屏幕1×1，截图尺寸断言实际失败；指定Ozone屏幕1280×800，取得900×650位图。不是放宽测试尺寸。[失败](evidence/electron-bitmap-red.txt)。
- 窗口关闭至stop的接线缺失：真实关闭回归失败后补close→quit→等待释放接线。[失败](evidence/electron-close-red.txt)。
- 独立只读审查发现2项Important：启动pending退出访问空host；Session设置前异步让出不能保证ready前。已增加生命周期3反例、启动退出真实进程，并改同步建目录+设置前断言。最终全套及Electron再次通过。1项Normal（超时kill后立即删除根）也调整为等待child close后再清理；未额外执行强杀超时分支，不宣称其Windows效果已验。
- AST UI→permissions缺口先失败再修复，保留旧反例，不删除/跳过失败测试。

本范围没有已知未处理Critical/Important；Windows/首次选址/未来产品IPC未实现项按下表保留门槛，不能解释成全产品无风险。

## 模块独立性与 Workspaces 判断

| 方案 | 独立施工/依赖/构建 | 版本/替换 | 当前成本与决定 |
|---|---|---|---|
| 当前单仓+公开出口+模块测试 | 已有独立入口、提供/消费契约测试、AST私有/反向/循环约束；本批增加独立编译。共用锁与TS工具链，非npm依赖隔离 | 原子提交、单仓版本；通过Store/RootLock/TrustPort/ModuleDefinition端口替换实现。现有真实/替身消费者及缺模块反例通过 | 满足当前模块施工，无多版本冲突；保留 |
| npm Workspaces | 可按包执行命令与声明依赖，但仍可能提升依赖；不能自动防止私有导入/业务耦合 | 需定义exports、包图、TS引用及发布/版本策略 | 当前收益不足以抵消改造与验证成本；不引入 |
| 真正独立发布/加载模块包 | 明确exports/版本兼容/依赖闭包，若不可信还需隔离机制 | 支持独立分发，需要兼容/迁移/生命周期及真实替换验收 | 只有真实独立发布/第三方加载需求进入批准范围时再做，不提前建设 |

AST当前产品图无环、无私有深导。shared只含存储/路径/日志等技术能力；permissions唯一拥有授权账本；app仅装配生命周期。Electron项目不侵入业务域。未来连接器/模板需按公开能力装配，目前未发现必须更换装配机制的证据；没有实际新增生产连接器，不能外推任意动态插件已兼容。

## 架构对冲与施工准入

| 事项 | 判定/影响 | 级别与准入 |
|---|---|---|
| Electron作为可信宿主 | 当前基础装配、窄桥、安全默认、真实本地SQLite可行 | 当前E2通过，允许进入正式宿主骨架施工 |
| app生命周期 | 原第七批重试有效；Electron启动/退出必须持有初始化Promise，窗口关闭必须等释放 | 本批实验修复；产品化须保留这些回归 |
| shared/SQLite | 当前Electron内建驱动可用，无需为本批增加适配 | Normal：保留驱动端口，不冻结所有产品存储 |
| Preload/IPC | 必须形成按业务能力的窄契约，Renderer保持纯展示/交互 | 后续每项业务接线前明确sender/参数/授权/结果/超时；不把实验状态DTO冻结为全局协议 |
| Renderer/模块独立性 | React只读状态，无特权/业务账本，域目录及测试未破坏 | 稳定基础模块可独立施工；正式UI仍待建设 |
| Session选址 | pre-ready设置机制可用；初始化选择UI未实现 | Deferred：正式首次启动/选根/重装产品路径需下一批施工 |
| Windows及根保护 | Linux合作目录锁/路径检查不证明NTFS/ACL/重解析点/凭证安全 | Deferred：E4未通过，相关平台能力不准宣称已验收 |
| 实验转产品 | 当前含断言、故障注入和负例桥，仅实验 | Normal／后续准入条件：不可直接复制为正式入口，先形成正式启动/关闭流程和模块归属 |

下一批建议：**正式app启动/数据根接入与最小UI壳**，依据现有施工计划核对范围。准入：本批基础完整测试与Electron回归持续绿；正式入口去除实验故障注入/负例桥；先定义窄IPC能力与错误语义、窗口/退出生命周期；继续保留默认无授权。Windows实例具备后补E4，再考虑安装/凭证等后置能力。Space、连接器、模板按本域稳定契约独立施工，不把所有业务塞入main。

未做完整对话/Space/设置/工作流/DSH连接器、第三方插件产品化、账号、安装器/更新/托盘/自启、付费API或外部Agent。未创建分支/PR/Release，未主动触发Actions；提交前复核远端与diff，集中一批提交。源码/文档diff --check通过；原始日志保留运行时产生的行尾空白，不改写原始输出。

官方依据：[Electron安全](https://www.electronjs.org/docs/latest/tutorial/security)、[沙箱preload](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload)、[离屏渲染](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)、[Chromium headless屏幕](https://chromium.googlesource.com/chromium/src/+/main/ui/ozone/platform/headless/headless_screen.cc)。文档只指导实验，不能替代运行证据。
