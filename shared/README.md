# shared｜通用技术基础模块

> **代码事实核对（2026-11-04，基线 `1048b6a`）**：产品源码 4 文件、测试 5 文件，公开入口 `shared/src/index.ts`。本轮根测试覆盖 shared、permissions、app、connections 及边界工具；不代表完整本版验收。 开工须重新核对最新 main。

> **施工入口说明（2026-11-07）**：本页仅负责 shared 独立维护与验收；当前跨模块施工任务从 [根 README](../README.md) 与 [0.1.1 B3 任务](../docs/versions/0.1.1/B3-DESKTOP-DELIVERY-TASK-2026-11-07.md) 定向进入。过去“当前模块是 Space”的说法为历史状态，不是现在的统一调度。工作模式不得修改施工文档。
>
> **实现状态（文档证据，待实时核查）**：已有 `shared/src/index.ts`、`shared/tests/` 和 `npm run test:shared` 入口；此前记录 SQLite 命名空间 Store/CAS、数据根检查、受限路径定位、合作目录锁、诊断 sink 已实现。本文更新没有重新执行测试或 Windows 实机验证。

## 职责与边界

shared 只提供可复用的**技术机制**，不拥有 Space/Context、Agent、Conversation、Operation、Task、权限策略或领域审计事实。业务 owner 通过公开端口使用 shared，不能把业务规则集中到这里。

| 技术能力 | 已有证据与公开入口 | 仍需验证或补齐 |
|---|---|---|
| 命名空间 Store / CAS 与修订检查 | `shared/src/index.ts`，`npm run test:shared`；历史实现记录 | 真实代码 API、并发冲突、异常恢复、重启与隔离 |
| 数据根和受限路径定位 | 同上；历史实现记录 | Windows 路径别名、权限拒绝、跨盘与 ACL 实测 |
| 合作目录锁 | 同上；历史实现记录 | 跨进程、异常退出、残留锁及 Windows 实测 |
| 技术诊断与有限持久记录 | `shared/src/diagnostics.ts`、`persisted-diagnostics.ts` 与 `shared/tests/persisted-diagnostics.test.mjs`；App 存在装配入口 | 已有字段白名单与 SQLite 持久回读等测试；完整日志轮转、运行环境接线及 Windows 真实权限仍需验证 |
| 凭证引用与受控 Vault | `shared/src/credentials.ts`、`shared/tests/credentials.test.mjs`；App 的 `desktop-credentials.ts` 与测试提供 Windows safeStorage 适配 | 真实 Windows OS 账号/安装代次、ACL、凭证失效与重装恢复尚未完整验收；不得认为凭证可解密就已获授权 |
| 完整备份/恢复、日志轮转、配置迁移 | 目前仍属需要独立验收的较完整能力，不由基本持久诊断自动满足 | 按版本范围与 App/各业务 owner 分工确认；不得拿单库重启回读冒充全域恢复 |

## 公开契约的最低语义

- **存储**：调用者声明命名空间、对象/键、读写意图及预期修订；成功返回持久化确认与修订，旧修订必须冲突拒绝，未知提交不得假装失败。shared 只保证技术原子性，不替业务 owner 决定业务回滚。
- **路径与数据根**：验证用户选择的数据根及访问边界；失联/无权/路径冲突应返回可诊断错误，不静默创建业务对象，不把安装目录当作默认用户资料目录。
- **锁与恢复**：明确锁的作用域、持有者与释放条件；进程退出、重启和并发冲突不得把“已获得锁”当作永久权威。
- **凭证**：秘密值不得出现在业务配置、普通日志或诊断导出；领域只能保存受控凭证引用。Windows 真实保管与失效行为未验收前不承诺安全能力。
- **诊断**：运行日志可轮转，但不得删除领域正式账本、授权审计或验收证据；跨域诊断只能引用事实，不复制可修改的权威数据。

具体函数签名、存储格式和已有测试，以当前源码为准；历史研究候选不自动成为实现要求。

## 模块独立验收

| 编号 | 测试行为 | 验收断言 |
|---|---|---|
| SH-T01 | 写入、读取、重启恢复 | 数据与修订一致，不跨命名空间串读 |
| SH-T02 | CAS 并发写入 | 旧修订拒绝，不静默最后写入获胜 |
| SH-T03 | 存储失败/中断 | 确定未提交与结果未知可区分，不能假报成功 |
| SH-T04 | 路径拒绝/失盘 | 不越界读写，不生成业务替代对象 |
| SH-T05 | 锁冲突/异常退出 | 冲突可诊断，不产生永久不可恢复死锁 |
| SH-T06 | 诊断与秘密 | 无权路径、Key 和敏感内容不出现在普通诊断中 |
| SH-T07 | Windows 实机 | ACL、路径别名、凭证、跨进程行为有单独实机证据；未测标未验收 |

## 下一次施工与交接

先核查最新 `main` 的 `shared/src/`、`shared/tests/`、`package.json` 与 CI，再核对以上行为是否已有测试。**只修真实缺陷或已批准范围内的缺口**；不为满足目录规划而创建空子目录，不代替 permissions 实现授权，不代替业务模块保存状态。提交回执列 SHA、修改文件、执行命令、测试结果及 Windows 未验证项。

**当前验收状态（2026-11-07 定向源码核对）**：已确认 `shared/src/index.ts` 实际公开 Store、路径、Vault 与持久诊断，相关模块测试文件存在；本轮只读核对源码/测试，**没有复跑测试或 Windows 实机验收**。不得根据旧状态重复创建凭证库或诊断持久机制，也不能据代码存在宣布模块验收通过。

历史完整研究：[shared 契约归档](../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/shared/CONTRACT-archive.md)；旧 [CONTRACT](../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/shared/CONTRACT-archive.md) 为兼容入口。Windows 数据要求：[目录与数据设计](../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)。
