# shared/credentials

系统凭证保管衔接。秘密值不进入普通配置；重装系统后凭证可能需要重新配置。

**历史（2026-10-30）**：当时本子目录只有职责说明。**当前（2026-11-07 定向核验）**：上级 `shared/src/index.ts` 已公开 `createCredentialVault` 与凭证引用/适配端口；`app/src/desktop-credentials.ts` 有 Windows safeStorage 适配源码。不能因为本子目录缺少独立 `src/` 而重复建立凭证库；也不能把代码存在当作 Windows 实机、撤权竞态或重装恢复验收。详见 [shared 主模块](../README.md)。

[源码目录与 Windows 数据要求](../../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。

## 第二批：秘密与权限的区别

本域衔接系统秘密存储，连接配置/AI 配置只保留受控引用；`permissions` 决定能否使用，实际连接边界限定向哪个适配器/进程提供。持有 Key、登录成功或共享 Provider 不授予 Context/文件权限。不能把秘密写进普通日志、任务卡、视图或模型提示。

外部 DSH 可能使用自身凭证与环境，WEX 未配置 Key 不代表 DSH 没有访问能力；启动时的环境/文件继承、独立凭证选择和撤销效果须专项验证。本批不选择具体凭证 API 或跨进程秘密传递协议。


第六批历史资料：[当时实验与限制](../../docs/A0-产品构想与研究/历史参考/工程研究批次/batch6/EXPERIMENTS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 上级契约与文档入口

- **上级业务/职责研究（历史）：** [shared/CONTRACT.md](../../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/shared/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [安全与数据持续性](../../docs/A0-产品构想与研究/方案与研究/既有研究/SECURITY-AND-PERSISTENCE-2026-10-31.md)
- [Windows 生命周期](../../docs/A0-产品构想与研究/方案与研究/既有研究/WINDOWS-LIFECYCLE-2026-10-31.md)

本子目录不另建第二份业务权威。当前稳定职责与施工范围以对应 owner README 和根 README 为入口；历史契约只按需追溯，实验结论仅按原环境和范围解释。

## G6：凭证引用的最小闭环

秘密值由平台凭证后端保管；连接配置只保存受控引用，实际使用时由可信 Connections 宿主向指定适配器/目标提供最小秘密。Permissions 决定本次主体、入口、动作和目标是否获准；凭证存在、可解密或测试连接成功都不代表资源授权。秘密不得进入日志、Task、附件、模型提示或普通备份。

当前子目录仍以职责说明为主；共享 Vault 与 App safeStorage 适配已有源码，但 Windows OS 账号/安装代次、跨进程秘密交付、替换/撤销竞态与重装重新配置尚未取得完整实机验收。见[基础能力落地映射](../../docs/A0-产品构想与研究/历史参考/旧工程规划/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
