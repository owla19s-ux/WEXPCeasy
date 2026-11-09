# connections/local｜本机文件、目录与受控 OS 适配

> Owner：`connections/local/`；公共 Operation 归 [Connections](../README.md)，环境业务生命周期归独立 [environments](../../environments/README.md)。本版范围见 [A2](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 当前实现

`src/index.ts`、`file-capability.ts`、`directories.ts`、`bindings.ts` 等已提供受控文件/目录读取、版本观察、目录绑定和有限文件写入。App 有协调写入/Operation 回执，`UI/src/local-file-editor.tsx` 已具备草稿保留、版本绑定保存、冲突重读、取消/unknown 不重试。**本机文件编辑已存在，不再按“只有只读预览”重做。**

## 职责边界

- Local 只处理用户获准的真实路径、文件/目录、版本观察和实际 OS 副作用；不同 Context 或路径别名可能指同一资源，不能以 Context ID 代替文件版本检查。
- 工具/环境登记、安装计划、升级/卸载/恢复策略属于 Environments；Local 未来只提供经批准的本机执行适配。当前**没有完整 Shell、任意进程、正式安装器或本地 Git**，不因本目录名称默认纳入 0.1.1。
- 用户选择/拖入文件由可信 App/UI 收集意图，实际访问仍经 Local + Permissions/Connections；Renderer 不直接调用 Node 文件系统或读取任意路径。
- 文件写入 unknown 必须核查原 Operation/磁盘版本，不能盲重写。窗口内存草稿不等于持久化编辑会话。

## 测试与下一步

优先验证 Windows 路径/ACL/别名、外部并发修改、editToken 与观察版本、撤权、取消、重启恢复、权限拒绝及真实文件保存。执行模块测试与全仓可用 build/typecheck/test/boundaries，并明确同 SHA、模拟/真实环境及未验证项。需要新增本机执行能力时先取得具体版本与权限范围，不另建账本。

## 97 项对账｜Local 操作与 UIX-05/06（2026-11-09）

第四批 F06 明确区分可信路径选择、文件/目录读取、绑定版本保存、冲突重读、草稿与 unknown 原 Operation 回查。`app/src/desktop-space.ts` 有 resource.read/save，`UI/src/local-file-editor.tsx` 有窗口内草稿、editToken、保存和冲突比较；这不是持久草稿或完整多文件编辑器。Context 地址属于 Space 的引用，Local 保有真实 OS 路径/版本事实；跨进程/别名/ACL 和 Windows 实机仍待核。F06-009/010 环境管理归 environments，Shell/安装器不自动进入本版。
