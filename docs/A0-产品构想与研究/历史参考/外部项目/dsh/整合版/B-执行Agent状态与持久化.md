# B｜执行、Agent、状态与持久化

状态：研究参考；非 WEX 已批准接口。

## 1. 工具解析、权限和执行（原 09、10、11）
DSH 在模型步骤中解析可用工具集，工具可见性不等于已获授权；工具 pipeline 分准备、分发、完成，授权/guard 必须先于实际副作用。批量工具体可并发执行，但结果按模型调用顺序结算；**结果顺序确定不代表外部副作用顺序确定**。取消停止新分发，不会撤销已发生的外部操作。WEX 的资源写冲突需独立协调，不能仅靠有序回执保证。

## 2. Scope 与子 Agent（原 09、10）
Scope 管注册所有权、继承和清理，不是隔离不可信插件的沙箱。子 Agent 生命周期要区分创建、发布、执行、终止与回收；内部 Agent 和外部 ACP/SDK 代理对续接、取消、权限支持可能不同。启动时固定委托范围，不允许子 Agent 自我提权；外部系统的实际副作用不能随任务取消自动回滚。

## 3. Workflow 与 Dispatcher（原 13）
DSH Workflow 独立于 Agent loop；工作流实例负责步骤与编排，不应该复制工具操作状态。普通子任务失败与结构性 fatal 错误应区别处理。WEX 应坚持 Task 正式状态、Dispatcher 投递/占用、Execution 操作/回执分属不同 owner；不要另建一套重叠的任务事实库。

## 4. Session、压缩和投影（原 13、14）
DSH Session 以追加式类型化事件为事实来源；模型可见历史由记录投影，失败尝试和 UI 通知可与模型可见消息分离。Compaction 是可替换能力：摘要是模型上下文视图，不应覆盖原始记录。插件 Inventory 与 UI/客户端投影是只读视图，不是权威状态。WEX 的 Space、Context、任务和外部资源不应强塞到同一 Session 日志。

## 5. 持久化检查点与崩溃恢复（原 14、15）
DSH SessionPersistence 通过 create/open/stat/list 和单写者 SessionHandle(read/append/flush/close) 分离存储后端；后台写入和已 durable flush 是不同事实。显式 flush 才能向调用者保证相应持久化边界。崩溃后保留有效连续事件前缀，对中断回合补写 interrupted 结尾，而不是删掉已落盘历史。未知未来格式与文件损坏分别报告；旧格式迁移不破坏原文件。WEX 需把“结果未知”作为正式状态，不因超时或重启假定工具没执行。

## 6. Host/Client 通信（原 15）
DSH 的 remotes facade 选择 Host 能力和明确转发的事件；Gateway 管传输、取消和重连。普通通知 best-effort、不保证重放；需要可靠恢复的状态由 owner 提供查询、游标或基线快照。WEX UI 不能将实时事件当成持久回执，也不能绕过受控客户端直接调用连接器内部对象。

## 主要来源
原文：[09](../09-scoped-tool-resolution-and-policy.md)、[10](../10-tool-batch-and-subagent-lifecycle.md)、[11](../11-cross-domain-reference-value.md)、[13](../13-credentials-settings-compaction-workflow.md)、[14](../14-session-projection-ui-extension.md)、[15](../15-persistence-remote-boundaries-and-final-audit.md)。

上游：`packages/core/tools/src/{pipeline,batch}.ts`、`packages/subagent/subagent/README.md`、`docs/subsystems/{workflow,session,compaction,persistence}.md`、`packages/api/remotes/README.md`。精确引用见原文。
