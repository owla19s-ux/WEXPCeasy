# 第六批关键机制隔离实验

**仅实验，不是产品模块、正式调度器、权限引擎或冻结接口。** Python/SQLite用于快速验证持久化和真实多进程假设，不改变TypeScript/Electron技术路线。数据全部位于系统临时目录，不读取用户资料，不联网、不调用模型。

```bash
python3 experiments/contract-readiness-spike/test_mechanisms.py
# 单项可独立运行，例如：
python3 experiments/contract-readiness-spike/test_mechanisms.py Mechanisms.test_F05_atomic_last_unit_only_one_winner
npm run build --prefix dsh/runtime
npm test --prefix dsh/runtime
node --test connections/experiment/boundary.test.mjs connections/dsh/experiment/headless.test.mjs
```

Python使用标准库；F01/F05故障用SIGKILL，F08使用Linux advisory flock，Windows不适用。进程队列/屏障有上限，退出回收子进程。SQLite schema及Python函数全部实验私有，禁止从产品模块导入；一个实验库汇聚多个表只为夹具隔离，不决定产品共库或跨域事务。

| 验收入口/名称前缀 | 对应缺口/样本 | 证据与限制 |
|---|---|---|
| `test_F01_*` | F01/H01/H13/H22 | 真SQLite+子进程强杀；等待边/占用分表；仅已登记等待图，不证明任意回调/外部死锁消失 |
| `test_F02_*` | F02/H18/H23 | 真持久定义/实例/轮次/attempt，子进程重读；无真实工作流引擎/编辑器接线 |
| `test_F03_*` | F03/H14/H24/H26/H27 | 真文件→确定性摘要→保存/二次摘要→受控本地outbox；不是AI自动溯源或网络发送 |
| `test_F05_*` | F05/H29 | 两进程最后额度竞争、错误算法负对照、提交后强杀、差额/未知/重试；无真实计费 |
| `test_F06_*` | F06/H17/H22/H28 | 真SQLite执行代次/CAS竞争；旧结果保留；外部Agent停止仅注入事实，不证明已停止 |
| `test_F07_*` | F07/H03/H26–28 | 真文件哈希/mtime伪同/移动/删除/同名，Requirement/Verification版本适用性；不是原子文件快照或自动Acceptance |
| `test_F08_*` | F08/H05/H30 | Linux真实flock、强杀、同/异根、并发写及integrity_check；不验证NTFS/ACL/跨主机 |
| `dsh/checks/test-readiness-lifecycle.mjs` | F04/H12/H25 | 固定真实Cordis Service/Loader，双依赖、卸载、在途旧引用、新代次；不是完整DSH或WEX真实连接 |
| Windows检查表 | F09/H16/H19–21/H30 | [未执行条件](../../docs/A0-产品构想与研究/历史参考/工程研究批次/batch6/EXPERIMENTS.md)，没有Windows实机或产品EXE |

[实际结果及失败记录](../../docs/A0-产品构想与研究/历史参考/工程研究批次/batch6/EXPERIMENTS.md)。通过局部断言不等于对应完整H样本通过。来源sidecar是可信夹具，不是防篡改证明；outbox提交与远端发送之间仍需真实接线验证。锁仅约束合作写入者，不防同用户外部工具绕过。产物检查后再次变化的窗口未关闭。
