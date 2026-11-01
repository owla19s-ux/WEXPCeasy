# Connections 最小持久链路施工回执

日期：2026-11-02（北京时间）。施工基线：`42b52d0adc12431bb71a7efe0050f83a53b7481b`；目标：main。用户授权按模块施工；范围来自本域 CONTRACT 的 C01、C02、CONNECTIONS-CONNECTION-001、CONNECTIONS-OPERATION-001。不是完整连接系统交付或独立验收。

## 实际修改

1. `src/config.ts`：新增公开 `remove(id, expectedRevision, intent)`，移除本地配置并保留所有 Operation 历史。检查合法输入、CAS、目标存在性；未知提交不报成功，提交 ACK 后回读检查配置确实移除。`src/index.ts` 导出 `ConfigRemovalResult`。不触发网络断开/进程停止，不删除凭证，不把配置删除当成权限撤销。
2. `src/operations.ts`：验证持久账本的唯一身份、非空指纹、观察字段/JSON 和阶段/预留次数一致性；坏账本拒绝读写与派发，不创建替代空状态。写入观察前拒绝非法 phase、非有限数、undefined、循环引用和非 JSON 对象。unknown 保留原规则，迟到成功不清除未知。
3. 修复观察提交 intent 的分隔符碰撞：原 `a:b + c` 与 `a + b:c` 会形成相同存储 intent，第二条观察不能保存；改为独立 v2 前缀加 JSON 元组编码。已有快照和 Observation ID 不变，原有观察仍按账本查重；无需删除或重写旧 intent。Store 的 256 字符 intent 限制仍适用，过长输入不承诺可持久化。
4. 新增真实 SQLite 配置/账本测试、18 项非法账本/观察输入测试、跨独立 Node 进程的 permissions + connections + 文件副作用组合测试；同步 README/CONTRACT 当前实现状态。

## 验证

环境：Linux，Node v24.22.1，npm 11.9.0，TypeScript 5.9.3；依赖由 `npm ci --ignore-scripts` 安装。

| 实际命令 | 结果 |
|---|---|
| 基线 `npm test` | 71/71 通过 |
| `npm run build && node --test connections/tests/persistence.test.mjs` | 初次缺少 remove 的 3 个用例失败；实现后通过；后续 intent 碰撞用例先失败再通过，最终 5/5 |
| `node --test connections/tests/ledger-validation.test.mjs` | 原实现 18 项失败；修复后 18/18 通过 |
| `node --test connections/tests/durable-dispatch.test.mjs` | 2/2 通过，运行独立子进程，而非只重建 JS 对象 |
| `npm run typecheck` | 退出 0；见 [原始输出](evidence/2026-11-02/typecheck.txt) |
| `npm test` | 98/98 通过，含 build、全仓测试与边界检查；见 [原始输出](evidence/2026-11-02/test.txt) |
| `git diff --check` | 退出 0 |

相对基线新增 27 项测试。跨进程测试证明：已保存的成功回执、授权和 attempt 可在进程退出后恢复；同一操作不会重复写文件；撤权后新操作零副作用；写入后模拟远端 ACK 丢失时，重启保持 unknown 且不重做。文件适配器为本地夹具，不是正式 Local 连接器或真实远端服务。

npm 输出存在运行环境注入的 http-proxy 配置弃用提示，不影响安装和测试结果；未修改用户网络设置。红灯证据见 [账本校验](evidence/2026-11-02/ledger-red.txt) 和 [观察意图碰撞](evidence/2026-11-02/intent-red.txt)。

## 复核与边界

- 完成本次 diff 自审；未宣称不同执行者独立验收。
- 当前账本最多预留一次派发；预留成功不证明外部已执行，进程在预留后退出仍须按原 Operation 核对，不自动重试。
- 配置存储 API 由可信调用方先授权。生产连接配置/版本与派发边界接线、资源协调、凭证后端、取消/主动查询、真实 Provider/GitHub/DSH、Windows E4 均未完成。
- 未改动权限政策、Task/Acceptance owner、0.1.1 范围或未决 B/C/D。
- 修改前读取 Actions `/actions/runs` 集合：基线运行 `41341158201` 成功；当前 push main 工作流会自动触发。优先本地完成验证，本批只集中提交一次，不手动重跑 CI。
- 后续由其他执行者依据本域契约、源码和原始证据独立验收，再进入配置/能力准入与生产派发接线；不能由本回执代替最终产品验收。
