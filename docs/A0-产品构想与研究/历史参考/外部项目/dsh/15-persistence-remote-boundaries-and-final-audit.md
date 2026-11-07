# DSH 研究总审：持久化、远程通信、工程约束与 WEX 取舍

状态：研究完成一轮横向扫描；不是正式架构批准，也不是对上游全部源码逐行审计。

## 最后一轮核查
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/persistence.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/api/remotes/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-package.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/core.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/subagent.md

## 发现

1. **持久化句柄和单写入所有权**：SessionPersistence 抽象 create/open/stat/list；SessionHandle 承担 read/append/flush/close，跨进程写租约保护单写者。可替换 JSONL provider。
2. **持久化检查点**：内存事件通知不是已落盘；后台写批次失败后保留队列并在显式 flush 时向调用者报错。WEX 的可信回执必须明确 durable 状态。
3. **中断恢复不丢历史**：崩溃时保留完整事件前缀；AgentLoop 补写 interrupted 结束事件，而不是删除未闭合任务。不能将“已写入文件”误认成外部副作用可回滚。
4. **格式版本和拒绝策略**：不能理解的未来格式与损坏分开报错；历史版本非破坏式迁移。
5. **远程接口聚合门面**：api-remotes 将 Host 服务的类型化 Remote 选择与 Client 消费隔离；事件显式 allowlist，传输、取消和重连由 Gateway 负责。WEX Rust/Flutter 可借鉴，不必采用相同协议。
6. **事件可靠性边界**：普通 Host 事件 best effort，不重放；需要可靠恢复时必须由拥有者提供查询、cursor 或基线快照。
7. **模块工程门禁**：adding-a-package 规定包元数据、导出、Host/Client 构建面、依赖方向、文档、校验命令；constraints/typecheck/lint 是机器检查，不只是协作文档。
8. **子 Agent 能力差异**：外部 backend 可不支持 continuation；能力标志与实际 provider 分离，避免把所有 Agent 当成同一运行模型。

## WEX 研究汇总（参考 01—15）

### 优先吸收（架构契约层）
- Module Manifest + 能力注册/解析 + Loader 生命周期 + UI 插槽/配置 schema
- 稳定的 Connection/Capability/Resource 身份，Provider 与消费者解耦
- 操作时权限检查、委托范围、可撤销调用与结构化结果
- 持久事实/实时事件/UI 投影分离，单写者与 flush 检查点
- Host/Core 与 Client/UI 的类型化远程边界
- 模块依赖与清单机器校验

### 借鉴但延后实现
- 源码级 HMR、动态代码替换事务、原生插件隔离
- 完整脚本 Workflow VM、多租户权限图、复杂组织和设备主体
- 高级 Context 压缩、跨设备数据同步、完整插件市场

### 不宜照搬
- Cordis Scope 当安全边界
- 单父 Scope 直接承载多组织/多 Space 资源关系
- 任意插件直接访问安全/账本核心内部对象
- 所有 WEX 状态挤进一个 Session 日志
- 将热配置等同任意代码热替换、将 UI 状态当生命周期真相

## 尚未核验的范围
这是一轮基于公开模块文档与部分执行源码的研究，尚非全仓源码逐文件审计；没有对 WEX 当前实现做自动化差异扫描，也没有执行 DSH 本地构建。正式纳入架构前应逐条映射 WEXPC1 模块契约和 0.1.1 范围，并进行最小原型验证。
