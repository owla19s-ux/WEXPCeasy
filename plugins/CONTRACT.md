# plugins 业务契约：WEX 自有插件机制

- **Owner：** plugins。只负责 WEX 自有插件的描述、发现、安装、信任、生命周期、依赖、隔离、配置/数据和扩展点。
- **阶段：** 机制预留研究，尚无产品级动态插件加载器；不作为 WEX 首期前置。
- **既有边界：** WEX 插件、DSH 原生插件、外部 DSH Agent 连接器是三条独立路线；本契约不把 Cordis/DSH Loader 选为 WEX 必选框架。
- **编号：** F12-001～012 仍是产品总表索引；PLUGINS-* 是模块细分编号；F12-011 只记录双路线边界，不代表任何插件系统已产品化。

## 1. 唯一归属与明确不拥有

1. plugins 拥有 WEX 插件描述/发现/安装/信任/生命周期/依赖/隔离/插件配置和数据/扩展点/更新卸载策略。
2. app 提供可信宿主装配、安装目录/数据根接入、进程与 IPC 生命周期；不把插件业务配置放入 app 全局中心。
3. connections 负责插件向 WEX 暴露的受控 Capability 和 Operation；插件不能直接调用其他模块私有文件、数据库或万能宿主对象。
4. permissions 独占授权、Grant、撤销与审计；插件清单声明权限需求不等于获批。
5. shared 提供路径、存储、凭证引用等技术原语；插件拥有自身配置语义和业务数据；秘密不进入普通插件数据。
6. dsh/ 专门验证 DSH 原生 Core+Loader 插件；connections/dsh/ 接入外部 DSH Agent 客户端；两者均不是 WEX 插件加载器。
7. WEX 插件市场、公开分发、远程同步和第三方生态不在当前产品范围内。

## 2. 模块独立功能编号与细化契约

新增细分使用 `PLUGINS-<子域>-NNN`。所有编号描述候选业务语义，不冻结包格式、Manifest schema、Loader API、IPC wire、沙箱方案或安装器实现。

| 模块功能编号 | 功能 | 业务行为与边界 | 对应 F | 依赖 | 最低验收条件 | 状态 |
|---|---|---|---|---|---|---|
| PLUGINS-MANIFEST-001 | 插件描述清单 | 描述插件唯一身份、版本、宿主/API兼容、能力、依赖、权限需求、数据范围和来源依据；具体包格式/字段仍待研究。 | F12-001 | app、connections、permissions | 未知字段/版本/能力声明不直接启用；描述清单不是可信证明或授权。 | B |
| PLUGINS-DISCOVERY-001 | 插件发现与登记 | 扫描用户选择的数据根中 WEX 插件目录，区分发现、识别、完整性验证、兼容、安装、启用、加载、就绪和失败状态。 | F12-002 | app、shared | 发现不等于信任/启用/授权；扫描失败和目录不可用明确报告；不自动执行代码。 | B |
| PLUGINS-INSTALL-001 | 插件安装与来源接入 | 管理用户明确选择的插件包/目录导入、暂存、校验和安装结果；安装动作与启用/加载分离。 | F12-003 | app、shared、permissions | 校验前不执行入口代码；安装中断可恢复或回滚；未授权来源保持隔离。 | B/C |
| PLUGINS-LIFECYCLE-001 | 插件启用、加载、停用与释放 | 管理插件实例生命周期和状态；停用阻止新能力发布，但不假称已停止在途 Operation 或外部副作用。 | F12-003 | app、connections、permissions | 加载失败不发布可用能力；释放失败保持 failed/incomplete；重试不创建重复实例。 | B/C |
| PLUGINS-CAPABILITY-001 | 插件能力发布与受控消费 | 插件通过 connections 公开能力契约；内部模块调用不得直接依赖其他模块私有文件/数据库/宿主对象。 | F12-004 | connections、permissions、各领域 owner | 能力发现不等于调用许可；每次操作经过 connections 与 permissions；插件不拥有领域业务状态。 | B |
| PLUGINS-DEPENDENCY-001 | 依赖解析与版本兼容 | 解析插件依赖、宿主/API版本、能力版本、冲突、循环和Service就绪；不兼容时阻止发布或进入隔离状态。 | F12-005 | app、connections、shared | 缺失/循环/不兼容依赖明确失败；不能借用 DSH Loader 规则声称 WEX 插件兼容。 | B/C |
| PLUGINS-TRUST-001 | 来源信任与完整性校验 | 记录来源、签名/散列、版本、发布者和校验结果；具体信任根、允许来源、用户确认和撤销策略由 D09 决定。 | F12-006 | app、permissions、shared | 篡改/来源未知不自动加载；签名有效不等于权限批准；D09 未确认前不默认信任第三方。 | C/D |
| PLUGINS-ISOLATION-001 | 插件权限与运行隔离 | 定义插件可访问的能力、资源、目录、网络和进程边界；区分进程分离、IPC封装和真正 OS 沙箱。 | F12-007 | app、permissions、Windows | 不把独立进程/IPC/安装目录分离当作沙箱；Windows ACL/Token/Job Object/受限令牌等方案须实测和用户决策。 | C/D |
| PLUGINS-CONFIG-001 | 插件专属配置 | 插件拥有自己的配置 schema、版本、默认值和修订；app/shared 只提供存储/迁移原语，不建立万能配置中心。 | F12-008 | shared、app | 配置隔离在插件命名空间；未知/不兼容字段不静默覆盖；升级失败可回退原配置依据。 | B |
| PLUGINS-DATA-001 | 插件专属数据与保留 | 插件数据与配置、缓存、日志、凭证引用分离；插件卸载不自动删除用户数据或其他模块资料。 | F12-008、F12-010 | shared、permissions、app | 数据 owner 和删除政策明确；无权清理不执行；秘密不进入普通插件数据包。 | B/D |
| PLUGINS-UI-001 | 受控 UI 扩展 | 允许插件在经批准的扩展点提供面板/视图/命令贡献；插件 UI 只获得窄 IPC/声明能力，不获得 Node/FS/凭证特权。 | F12-009 | app、views、UI、permissions | 未知扩展点不加载；UI崩溃不破坏主宿主；Renderer 无任意系统访问。 | B/D |
| PLUGINS-UPDATE-001 | 插件更新与兼容升级 | 管理新旧版本、签名/来源校验、依赖重算、配置迁移、在途Operation影响和失败回滚。 | F12-010 | app、shared、connections、workflows | 升级不覆盖其他插件/用户资料；旧实例迟到回调不能注册为新实例；外部副作用不因回滚撤销。 | C |
| PLUGINS-UNINSTALL-001 | 插件卸载与依赖释放 | 区分停用、卸载包、移除注册、清理缓存和删除插件数据；检查共享依赖和其他插件引用。 | F12-010 | app、shared、connections、permissions | 依赖仍被使用时不能强卸载；数据删除单独判权；残留进程/释放未知保持 incomplete。 | C |
| PLUGINS-RECOVERY-001 | 崩溃隔离与安全恢复 | 识别插件加载循环、初始化挂起、崩溃和异常输出，支持隔离/安全模式恢复；不把禁用当作删除。 | F12-003、F12-010 | app、shared、permissions | 插件故障不阻断无关普通对话；隔离保留诊断证据；恢复前重新校验来源和授权。 | B/C |
| PLUGINS-DATA-ROOT-001 | 插件目录与安装位置 | 用户选择的数据根中区分 WEX 自有插件目录与 DSH 原生插件目录；程序安装目录不作为用户插件数据唯一存放位置。 | F12-012 | app、shared | `plugins/wex/` 与 `plugins/dsh/` 的规划边界清楚；根缺失/重装后不创建空目录覆盖旧包。 | B |
| PLUGINS-BOUNDARY-001 | WEX/DSH 双插件路线边界 | 明确 WEX 自有插件、DSH 原生 Core+Loader 插件、外部 DSH Agent 连接器三者的安装、生命周期、调用与权限边界。 | F12-011 | dsh、connections/dsh、app、permissions | DSH原生插件宿主实验不等于 WEX 插件平台；外部 DSH Agent 不依赖 DSH 原生宿主；三者不互为启动前置。 | A |

## 3. 关键政策与实验门槛

- **D09 信任政策待确认：** 第三方来源、签名/散列、允许来源、用户审批、撤销与自动更新策略不得由实现自行默认。
- **C06 Windows 隔离实验待完成：** 进程分离、IPC包装和目录分离不等于沙箱；真实 OS 权限边界必须在 Windows/Electron 中验证。
- **依赖/升级/卸载：** 插件共享 Service、迟到回调、在途 Operation、配置迁移、残留进程与回滚需真实第三方样本；Linux DSH Core+Loader hello 样本不能替代 WEX 插件验收。
- **不提前定框架：** 不把 Cordis、DSH Loader 或某个插件框架设为 WEX 必选依赖；先完成宿主/连接/权限业务契约，再做隔离实验。
- **不提前建市场：** 不创建 market/registry/runtime 空壳目录；只有出现真实产品需求和已验证扩展方式后再建立实现目录。

## 4. 双插件体系验收边界

| 路线 | 唯一职责 | 不代表 |
|---|---|---|
| `plugins/` | WEX 自有插件机制 | DSH 原生插件兼容或外部 Agent 会话 |
| `dsh/` | DSH 原生 Core+Loader 兼容实验 | WEX 插件平台、WEX 权限沙箱 |
| `connections/dsh/` | 对接外部 DSH Agent 客户端 | 负责加载 DSH 原生 Bundle |

## 5. 文档关联与施工入口

- **模块导航：** [plugins README](README.md) · [全模块契约索引](../docs/MODULE-CONTRACTS.md) · [文档总索引](../docs/README.md)
- **产品需求：** [F01–F15 产品功能总表](../docs/product/PRODUCT-FUNCTION-CATALOG-2026-11-01.md) · [功能—模块契约映射](../docs/product/FUNCTION-CONTRACT-MAP-2026-11-01.md)
- **跨模块边界：** [双插件体系架构](../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md) · [app](../app/CONTRACT.md) · [connections](../connections/CONTRACT.md) · [permissions](../permissions/CONTRACT.md) · [shared](../shared/CONTRACT.md)
- **证据：** [DSH 原生插件宿主实验](../dsh/README.md) · [外部 DSH Agent 连接器](../connections/dsh/README.md)

维护规则：本契约只维护 WEX 自有插件业务语义；DSH 原生插件机制写入 dsh 专属实验资料；外部 Agent 协议写入 connections/dsh；真实授权写入 permissions。所有候选状态与 D09/C06 门槛保持显式。
