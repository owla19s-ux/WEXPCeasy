# Pi AI 隔离兼容实验

研究入口：[四份报告与决策](../../docs/research/api/README.md)。非生产 API；不修改 connections/api 契约，不使用真实Key或付费服务。

```bash
cd experiments/pi-ai-compat
npm ci --ignore-scripts
npm test
```

Node >=24.9；发布包锁定 pi-ai 1.4.0/typebox 1.3.27。使用根工程同类 `node:test`，独立package仅隔离实验依赖。

- `harness.mjs`：可控每字节Response、本机HTTP端点、协议输入工厂。
- `native.test.mjs`：Faux/自定义Provider/本机HTTP/原生行为；部分测试断言已知缺口确实存在。
- `protocols.test.mjs`：Responses/Anthropic/DeepSeek推理往返、图片编码与Google transport限制。都是模拟服务证据。
- `adapter.mjs`：有限Chat守卫与边界替身；无凭证存储、账本、授权引擎、工具执行或调度。
- `adapter.test.mjs`：旧DEC对抗样本与回归；KNOWN GAP断言DONE后帧仍不能严格拒绝。
- `evidence/`：本轮测试输出、发布包指纹与历史Rust日志节选。

**绿色测试不等于兼容性全通过。** 查看报告中PASS/PARTIAL/GAP/NOT_RUN分类；尤其DONE后帧、SDK队列背压、真实代理、三类真实网络超时、真实工具并发、Windows/Electron均不能宣称通过。

在需Rust旧环境执行时：`cargo test -p wex-api --locked` 与 `cargo test -p wex-desktop-service --test api --test legacy_api_regressions --locked`。旧源码和锁文件在原wexpc仓库保留，本仓库不复制旧crate形成新权威。
