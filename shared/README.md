# shared｜通用技术基础

> Owner：`shared/`；本版状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。这里只实现跨模块可复用的**技术机制**，不存第二套 Space/Conversation/Task/Permission/Operation 业务权威。

## 已有实现与边界

| 机制 | 已有源码/测试 | 当前缺口 |
|---|---|---|
| SQLite 命名空间 Store、CAS、事务恢复 | `src/index.ts`、`src/storage.ts` 与模块测试 | durable receipt、损坏/遗失回执、rollback 未知、跨 namespace 协调与恢复的同 SHA 证明 |
| 数据根、受限路径和目录锁 | 公开技术端口与测试 | Windows 路径别名、跨进程锁、ACL、失盘和重启 |
| 诊断/持久记录 | `src/diagnostics.ts`、`persisted-diagnostics.ts` 与测试 | 轮转、真实环境接线、脱敏与不同日志权威分离 |
| 凭证/Vault | `src/credentials.ts`、相关测试及 App safeStorage 适配 | Windows OS 身份、凭证失效、安装/重装、权限和秘密泄露负例 |

已有完整性专项修复的提交/测试线索，**不能等同当前 SHA 全面通过或 Windows E4 签收**。Storage 成功只说明技术持久化结果；不能由 Shared 擅自决定业务成功/授权或远端副作用回滚。

## 技术语义与验收

- Store 操作必须表达修订/冲突、已提交/确定未提交/unknown，不能遇到异常静默重试或覆盖数据。
- 路径/数据根不是安装目录；跨盘、符号链接、权限变化和目标失联需要明确拒绝或诊断。
- Lock、Vault、诊断属于技术基础；秘密不得进入普通日志/Renderer。诊断记录不代替领域正式账本。
- 以 `npm run test:shared`、build/typecheck/test/boundaries 和 Windows 专项分别验证并记录 SHA。优先复验现有损坏、回滚、恢复、ACL/safeStorage 用例，失败后再修，不能创建重复数据库或凭证服务。

施工顺序：根 README → 本 README → 公开源码与测试；版本/Windows 规则按需查阅 [正式设计](../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)。
