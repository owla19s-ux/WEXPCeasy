# Product baseline C probes

日期：2026-11-01
性质：隔离SQLite机制实验（E2），不是WEX产品代码、不是正式模块集成，也不关闭对应PRD-C。

## 环境

- Linux x86_64，Python 3.13.5
- SQLite 3.46.1（Python sqlite3内置）
- 标准库：sqlite3、multiprocessing、tempfile
- 全部数据库均为临时文件；无用户资料、外部服务、付费API或GitHub Actions。

## 运行

```bash
python3 experiments/product-baseline-c-probes/run.py
```

## 结果

1. **PRD-C12 正向机制**：对象和引用在同一SQLite事务权威内，删除与新增引用并发时只有一个成功；不会出现目标已删但引用新建的状态。
2. **PRD-C12 负向对照**：对象与引用分库，先检查引用再删除的check-then-act流程可复现竞态，最终留下dangling reference。
3. **PRD-C11 正向机制**：剩余次数为1，8个不同意图并发消费，恰好一个成功；对已提交意图模拟ACK丢失后重试，读回原结果且不重复扣次。
4. **PRD-C07 负向对照**：两个独立数据源顺序备份，中间发生写入，备份修订为[1,2]，证明逐库顺序复制不能宣称跨域一致快照。

## 严格结论

- C11：只证明单SQLite事务模型可实现原子扣次/同意图去重；没有接入permissions真实授权服务、撤权代次、审计或重启产品流程，仍为**部分实验**。
- C12：证明同一事务权威可挡住竞态，也复现分库check-then-act失败；WEX Space与目标owner尚无真实引用屏障/跨域提交接口，仍为**部分实验**。不能据此宣称全产品删除安全。
- C07：只得到负向对照；没有证明冻结协调、各owner快照钩子、附件和外部资源核对，仍为**未关闭**。

本实验不改变模块owner、不引入全局数据库、不冻结SQLite作为全产品方案。实际WEX实现必须在对应owner和正式持久化机制上复验。
