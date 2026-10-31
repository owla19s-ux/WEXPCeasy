# connections/local

本地文件、终端、Git 等能力，按实际复杂度拆分。外部文件保持原位置，按授权访问。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 2026-10-30 目录职责补充

首版基础范围为授权文件和目录访问。终端、Git、编译工具链仍为研究与后续 Windows 实测决定的范围，不因目录已经存在就要求首版完整交付。由可信宿主装配并接入 connections 受控边界；权限判断不由工具自己绕过统一边界。

## 冲突与执行证据

对真实路径、文件/Git 版本、进程和退出结果提供可核验观察；WEX 管理的排队与资源占用由 `workflows/runtime` 协调，连接器在实际动作前复核适用条件。不同 Context/路径别名可能指向同一资源，不能靠 Context ID 判定无冲突。WEX 的占用记录约束不了未纳管的外部进程，仍需隔离工作区或重新核对并报告冲突；不承诺全局文件锁。终端/Git 的 Windows 能力范围仍待实测，本批不扩大首期范围。


## 上级契约与文档入口

- **上级业务/职责契约：** [connections/CONTRACT.md](../../connections/CONTRACT.md)
- **适配器子契约：** [本地资源适配器子契约](CONTRACT.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [源码目录与 Windows 数据布局](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)
- [安全与数据持续性](../../docs/research/SECURITY-AND-PERSISTENCE-2026-10-31.md)

本子目录只细化上级模块内部的职责或实现入口，不另建第二份业务权威。若本页与上级契约冲突，以对应 owner 契约为准；实验结论只按原记录的环境和范围解释。

## G1/G4/G7：本地资源与附件访问

本地连接器负责真实文件/目录的定位、获准读取、元数据/版本观察及明确写入副作用；路径不是永久身份，访问时必须重新核对真实目标。用户选择文件/拖入/粘贴由 UI/App 收集意图，实际文件读取经本目录受控能力；Renderer 不直接读任意路径。外部关联、导入持久副本、会话临时附件和 Task 产物必须区分；本地连接器不自行决定把文件加入 Context。

每次真实副作用通过 Connections 宿主边界形成 Operation；文件写入结果 unknown 时先核对实际版本，不盲重写。见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
