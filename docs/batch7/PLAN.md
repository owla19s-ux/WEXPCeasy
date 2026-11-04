> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 第七批基础模块实施计划

基线：7b88e16655a970b9f610c0cf462290c150884f64。直接 main；不触发 Actions，不使用付费 API。
按用户完整任务授权直接实施，不再次请求计划批准。三个模块各自持有源码、数据与测试。

1. shared：根身份/受限解析/合作根锁；命名空间 CAS 存储及原意图查询；结构化白名单脱敏诊断。公开面 shared/src/index.ts；测试 shared/tests；依赖 Node 技术端口。
2. permissions：消费 shared 的 Store 窄端口；可信事实由宿主输入，精确对话授权/撤销/CAS/历史与出口前复核。公开面 permissions/src/index.ts；测试 permissions/tests。
3. app：消费两个公开面；生命周期协调、依赖诊断/降级和最小真实装配。公开面 app/src/index.ts；测试 app/tests。
4. tools：TypeScript AST 依赖图，私有深导入/反依赖/循环/Renderer 越权/解析失败与空图拒绝；正反例。
每项：先写测试观察失败→实现→本域与消费方共同语义验收→全套验证。最后契约回写、报告、核远端 main CAS 更新。

风险关注：ACK 丢失、跨重启重复意图、旧撤权迟到、目标或入口漂移、初始化迟到资源释放、符号链接越界、解析失败假绿。
存储选择为本批可替换 Node SQLite 适配器，不批准全产品驱动；根锁为合作式保守锁端口，不冒充 Windows OS 活性证据。Electron/Windows E4 未验；不施工 UI 或绿色业务包。

## 执行记录

全部四项完成；44项基础测试通过。独立代码审查3项Important均有RED→GREEN回归；数据库链接逃逸单独修复。真实驱动/替身/平台局限见REPORT。工程裁定：复用锁定依赖（联网干净安装仍未验证）；Node SQLite可替换、目录锁保守fail-closed；D01–D07无代裁。旧DSH测试只调整fixture包锚点以兼容新增根工程。
