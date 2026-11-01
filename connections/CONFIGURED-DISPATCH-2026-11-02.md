# Connections 配置绑定派发施工回执

日期：2026-11-02（北京时间）；基线 `1ad0613263cc7237c87e3e26c7cdb6eec39c72b1`。接续用户明确授权的模块施工与 main 发布；范围：本域 C01/C02 和 CONNECTIONS-CONNECTION/VERSION/ADMISSION/OPERATION 的稳定最小能力。不扩大权限政策、任务账本或 0.1.1 范围。

## 本批产物

- 新增 `src/configured-dispatch.ts`，就近拥有配置查询、启用/修订/适配器检查和原配置捕获；公开出口在 `src/index.ts`。不把配置行为塞进 shared 或 app。
- `src/operations.ts` 增加可选 `OperationConnection`，保存连接 ID、命名空间修订、适配器 ID/版本和端点；校验持久历史、拒绝重绑，兼容旧无 binding 记录。
- `src/dispatch.ts` 将绑定纳入指纹，预留后复核权限/配置，保存被拦操作的“未外发”观察；持久化未知不伪报回执已保存。输入在依赖调用前捕获，拒绝稀疏数组、undefined、循环引用等非法 JSON，防止原对象修改造成指纹与实际派发不同。
- 配置移除/停用/版本变化只阻止后续动作；已开始调用继续使用原配置副本，历史不被后来修改覆盖。

## 验证证据

Linux，Node v24.22.1，npm 11.9.0，TypeScript 5.9.3。继续复用已安装依赖，没有升级包或改工作流。

| 实际命令 | 结果 |
|---|---|
| `npm run build && node --test connections/tests/configured-dispatch.test.mjs` | 最终 15/15；初次 12 项缺少入口失败，后续输入快照/未外发回执/错误分类用例均先失败后修复 |
| `node --test connections/tests/persistence.test.mjs` | 8/8；新增绑定回读、拒绝重绑、旧记录兼容和非法绑定拒绝 |
| `node --test connections/tests/configured-dispatch.test.mjs connections/tests/durable-dispatch.test.mjs` | 18/18；见 [组合输出](evidence/configured-dispatch-2026-11-02/combination.txt) |
| `npm run typecheck` | 退出 0；[输出](evidence/configured-dispatch-2026-11-02/typecheck.txt) |
| `npm test` | 121/121；含 build、全仓回归与依赖边界；[输出](evidence/configured-dispatch-2026-11-02/test.txt) |
| `git diff --check` | 退出 0 |

相对基线 98 项新增 23 项。[失败摘要](evidence/configured-dispatch-2026-11-02/red-summary.txt)保留测试名称/计数。npm 的 http-proxy 弃用提示来自既有运行环境，不是测试失败。

真实 SQLite + permissions + ledger 的消费者测试验证：拒绝时不读取配置、disabled/missing/stale/mismatch 零调用；在持久预留内注入停用/删除/版本变化/撤权后仍零调用，并有未外发观察；回执写入未知保持 unknown。跨独立 Node 进程验证配置绑定持久恢复、旧操作不重发、新端点不能重绑同一意图，实际文件只追加一次。

## 未完成与装配要求

- 只有配置绑定的 headless 写边界，不是完整连接系统。app/UI 尚未接入；旧显式无配置入口仍保留。
- target 的真实 backend/对象身份由可信宿主与具体适配器核验；本域检查当前 permissions 的 resource/target/write 范围，未新增 endpoint 专属授权政策或资源解析器。
- 整个配置命名空间采用 CAS 修订，修改其他连接也可能使本次预期修订失效；当前保守拒绝，不建立第二套单连接修订。
- 适配器版本非空和当前值一致不等于语义兼容性验收；动态加载/兼容范围尚未实现。
- 资源协调、凭证后端、主动远端恢复、取消、真实 Provider/GitHub/DSH 与 Windows E4 未执行；本地文件夹具不代替正式 Local 适配器。
- 预留后崩溃仍须按原操作核对；没有跨模块或跨进程的权限/外发原子事务保证，不承诺恰好一次。
- 完成作者自审；独立验收待不同执行者依据源码与证据完成。

后续施工重点是实际适配器的资源身份与 capability 准入接线，以及 app 对新边界的真实消费；不得把本回执当成上述能力均已实现。
