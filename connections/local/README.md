# connections/local

> **当前代码事实（2026-11-07，`main bd72dfea`）**：`connections/local/src/index.ts`、`file-capability.ts`、`directories.ts`、`bindings.ts` 等已存在；`tests/` 包含文件、目录与绑定测试。现有范围主要是受控文件/目录能力，不能推定 Shell、编译器、本地 Git 或 Windows 实机均已交付。

> **当前模块施工状态（文档整理，2026-11-03）**：候选契约与 Windows 风险已记录，产品实现待核查。此状态是文档审查结论，开工时必须以最新源码及测试核实；**不等于本轮已验收**。
>
> **模块职责**：本地文件、进程、Git 与开发环境适配。
>
> **下一施工范围**：先查代码；实现须通过 connections 受控边界，不绕过权限和 Operation 记录。
>
> **职责分离**：工作模式只改产品代码和测试，提交 SHA/测试/缺口回执，**不得修改 README、CONTRACT 或其他施工文档**；普通对话模式检查、验收并更新施工状态。已实现部分禁止无证据重写。
>
> **研究迁移**：历史深度契约归档于 [docs/research/contracts/connections/local/CONTRACT-archive.md](../../docs/research/contracts/connections/local/CONTRACT-archive.md)，其中候选与待实验内容不是直接施工命令。旧 `CONTRACT.md` 暂保留兼容入口。


本地文件、终端、Git 等能力，按实际复杂度拆分。外部文件保持原位置，按授权访问。

状态：受控 Local 文件/目录能力已有正式源码及测试；Windows 原生选择/路径/权限的端到端验收和高风险本地工具能力应按 0.1.1 已确认范围另行判断。

[源码目录与 Windows 数据要求](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 2026-10-30 目录职责补充

首版基础范围为授权文件和目录访问。终端、Git、编译工具链仍为研究与后续 Windows 实测决定的范围，不因目录已经存在就要求首版完整交付。由可信宿主装配并接入 connections 受控边界；权限判断不由工具自己绕过统一边界。

## 冲突与执行证据

对真实路径、文件/Git 版本、进程和退出结果提供可核验观察；WEX 管理的排队与资源占用由 `workflows/runtime` 协调，连接器在实际动作前复核适用条件。不同 Context/路径别名可能指向同一资源，不能靠 Context ID 判定无冲突。WEX 的占用记录约束不了未纳管的外部进程，仍需隔离工作区或重新核对并报告冲突；不承诺全局文件锁。终端/Git 的 Windows 能力范围仍待实测，本批不扩大首期范围。


## 上级契约与文档入口

- **上级业务/职责研究（历史）：** [connections/CONTRACT.md](../../docs/research/contracts/connections/CONTRACT-archive.md)
- **适配器子契约：** [本地资源适配器子契约](../../docs/research/contracts/connections/local/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [源码目录与 Windows 数据布局](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)
- [安全与数据持续性](../../docs/research/SECURITY-AND-PERSISTENCE-2026-10-31.md)

本子目录不另建第二份业务权威。当前稳定职责与施工范围以对应 owner README 和根 README 为入口；历史契约只按需追溯，实验结论仅按原环境和范围解释。

## G1/G4/G7：本地资源与附件访问

本地连接器负责真实文件/目录的定位、获准读取、元数据/版本观察及明确写入副作用；路径不是永久身份，访问时必须重新核对真实目标。用户选择文件/拖入/粘贴由 UI/App 收集意图，实际文件读取经本目录受控能力；Renderer 不直接读任意路径。外部关联、导入持久副本、会话临时附件和 Task 产物必须区分；本地连接器不自行决定把文件加入 Context。

每次真实副作用通过 Connections 宿主边界形成 Operation；文件写入结果 unknown 时先核对实际版本，不盲重写。见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
