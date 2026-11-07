# API 历史复用与 Pi AI 隔离验证执行计划

目标：依用户本批任务书复核完整旧 API 规范，执行 DEC-01～16，形成可复现的 A/B/C 决策；不修改正式契约或生产实现。

基线：WEXPCeasy `609e4142b319fec8800c8aea89bc7aa4ca447d16`；工作区初始干净；Actions /actions/runs total_count=0。

- [x] 1. 历史复核：读取 WEX 完整规范与实现、WEXPC 协议/HTTP/回归测试、当前 API-01～10；分别记录设计/代码/运行证据；定位 APS 或记缺失。
- [x] 2. 官方源码和 npm 发布核对：固定版本/提交/完整性、许可证/Node/依赖/公开 API；不把源码支持当真实厂商验收。
- [x] 3. `experiments/pi-ai-compat`：沿用 Node test；先建立原生行为探针，再对失败样本添加隔离防护与断言。使用 Faux、本地 HTTP 和注入 fetch；无付费请求。
- [x] 4. DEC-01～16：每组保留输入、期望、原生观察/适配后结果、对应旧代码；对完整性/上限/续传/认证/超时无法覆盖的情况明确 FAIL/NOT_RUN。
- [x] 5. 边界替身：permissions→credential callback→connections attempt→Pi→receipt；拒绝零派发、工具意图不执行、不修改外部在途写入。只验证调用关系。
- [x] 6. 写四份报告和 README 索引，运行根测试/实验/差异检查，再次 fetch main 后集中提交。

文件：四份指定报告及本计划放本目录；依赖锁、HTTP夹具、原生探针、隔离适配器与测试放 `experiments/pi-ai-compat/`；正式 API 契约不改。

审查重点：SDK 接受但忽略图片/参数；非成功 finishReason；不完整工具 JSON；重试与凭证外发；上下文转换不是外发授权。只将验证过的协议边界列为可复用，Windows/Electron/真实厂商/真实代理保持未验证。

执行裁定：用户已明确要求默认 main 上完整执行，本计划直接实施，不额外设置等待审批。研究实验无需产品架构重设计。

## 执行回执

- 六项均已完成。正式整体替换兼容性结论为不通过，细项PARTIAL/NOT_RUN不被勾选状态掩盖。
- 执行中main前进至819bcf6，新增跨代研究索引；已读取并fast-forward融入，无覆盖。
- 实验37项断言通过、根工程50项通过；历史Rust日志读取而非本轮Rust重跑。
- 独立审查：无Critical、2项Important与3项Minor。两个Important（Header覆盖、兼容开关绕过终态）及重定级的可变快照均已RED→GREEN；文档依赖数量已更正，未使用Models.complete的证据范围已明确，无遗留Minor。
- 主线集成/发布按最终git回执；不以研究提交替代Windows或产品独立验收。
