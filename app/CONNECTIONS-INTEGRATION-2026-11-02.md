# 可信宿主与连接模块组合施工回执

日期：2026-11-02（北京时间）；施工基线 `98883eaabe56b97aa604c8e8bbdb44507d8a96dc`。按用户持续施工与 main 发布授权推进。依据 app 的 APP-ASSEMBLY-001 / APP-MODULE-LIFECYCLE-001 / APP-ROOT-LOCK-001 和 connections 的配置、Operation、受控派发边界，不修改 Task、权限政策、产品版本或 UI 方案。

## 实际交付

- `connections/src/service.ts`：装配可信内置适配器，以既有配置/账本构造配置绑定派发。拒绝重复/无效适配器；启动验证本域配置和账本；仅向可信宿主提供配置管理、操作读取和派发，不公开数据库或 ledger mutation。
- 服务在进入任何依赖/适配器回调前登记在途令牌；`stop()` 开始即拒绝新派发与配置访问。等待已开始操作完成回执写入，超时返回 incomplete；后续可重试 stop，不发送取消、kill 或自动重派。
- `app/src/foundations.ts` 新增可选 `connections:{adapters,shutdownTimeoutMs?}`。仅消费连接模块公开出口；未配置时保持原 shared/permissions 装配路径，不打开连接数据库。
- 配置时在用户选定根内打开 `connections-configs.sqlite` / `connection-configs` 与 `connections-operations.sqlite` / `connection-operations`，分别归 connections 解释。复用既有根身份与锁，检查 SQLite 文件及 journal/wal/shm 既存路径，不跟随符号链接或接受目录。
- 连接初始化失败只降级可选连接服务；permissions 仍可用。初始化部分成功后逐个清理，未确认关闭的句柄保留到退出重试。服务未排空或关库不确定时返回 incomplete 并保留根锁，不制造已停止或外部未执行的结论。

## 验证

Linux，Node v24.22.1，npm 11.9.0，TypeScript 5.9.3；未新增/升级依赖，未改工作流。

| 实际命令 | 结果 |
|---|---|
| `npm run build && node --test connections/tests/service.test.mjs` | 初次 4 项缺少服务失败；实现后通过，最终含异常退出补测 5/5 |
| `npm run build && node --test app/tests/connections.test.mjs` | 初次 6 项缺少连接装配失败；实现后通过，最终含跨进程补测 7/7 |
| `node --test app/tests/connections.test.mjs connections/tests/service.test.mjs` | 12/12；[组合输出](evidence/connections-2026-11-02/combination.txt) |
| `npm run typecheck` | 退出 0；[输出](evidence/connections-2026-11-02/typecheck.txt) |
| `npm test` | 133/133，全仓 build、回归和依赖边界通过；[输出](evidence/connections-2026-11-02/test.txt) |
| `git diff --check` | 退出 0 |

相对基线 121 项新增 12 项；[失败摘要](evidence/connections-2026-11-02/red-summary.txt)保留初始红灯名称/计数。npm http-proxy 弃用提示为既有环境提示。

组合测试使用真实数据根、锁、SQLite、permissions、connections 配置和账本，外部动作由测试内文件适配器执行。不同 Node 进程启动同一根，旧授权/配置/回执能恢复、同一 Operation 不重发、文件只写一次。故障覆盖非法存储路径、坏配置保持原数据、在途未决保留实际根锁、普通/部分初始化关库失败重试、未知外部结果后排空，以及适配器回入 stop 的在途登记时序。

## 交付边界

- 这是可信主进程的可选 headless 装配；没有 Renderer/IPC/React/Electron 正式 UI 接线。CLI 未默认注册任何适配器，未新增网络调用或自动授权。
- 宿主返回的 connections client 只能由可信代码持有；不是已授权的普通用户接口。UI/外部入口仍须逐项绑定真实来源并判权，不可直接把配置/操作历史转给 Renderer 或模型。
- app 只负责技术存储打开、关闭和装配，不解释/写入 Connection/Operation 数据格式；无第二套业务账本或全局业务容器。
- stop 超时只表示未排空，不保证外部停止；在途可能永不返回，根锁保持占用并报告 incomplete，不自动删锁。关闭过程中服务不可重新启用；需完成退出后重新装配。
- 技术路径检查不承诺对抗同用户恶意并发换链。Windows ACL/句柄、E4、真实 Provider/GitHub/DSH/Local 适配器、资源协调、凭证后端与配置绑定读取边界未完成。
- 完成作者自审，未把施工回执当作不同执行者独立验收。

后续重点：具体适配器的资源解析与能力准入；正式宿主通信/用户交互在基础能力具备后另行接线。历史上批见 [配置派发回执](../connections/CONFIGURED-DISPATCH-2026-11-02.md)。
