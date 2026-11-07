# DSH 研究：批量工具调度与子 Agent 生命周期

- 状态：研究参考，不代表 WEXPC1 正式采用。
- 核查源码：[`packages/core/tools/src/pipeline.ts`](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/tools/src/pipeline.ts)、[`batch.ts`](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/core/tools/src/batch.ts)、[Subagent README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/subagent/subagent/README.md)。

## 1. 工具执行批次

- pipeline 将 prepare、dispatch、complete 分开；调用策略和 guard 在实际 dispatch 前完成。
- batch 调度允许工具 body 并行，但策略和最终结果按模型调用顺序处理与提交。
- 调用取消后停止补充新工作，等待已开始的工作排空，对跳过的调用合成明确的中止结果。
- 内部调度错误会先排空已启动调用，并将已提交结果留给上层恢复处理。
- 批次结果顺序确定不等于外部副作用顺序确定；并发写入冲突需要额外的资源约束。

## 2. 子 Agent 生命周期

- 子任务通过 startActivation 创建，返回 childId、result、dispose 等；本地子 Agent 可持续会话并冷恢复，外部 ACP/SDK/Codex/Claude Code 执行可能仅支持单次运行。
- 管理器在启动前捕获父 Agent 的模型设置、委托权限与组合配置；外部 Provider 保有自己的权限系统。
- 管理器区分发布前与发布后：发布前失败回滚，发布后 handle 对具体 activation 负责取消与资源清理。
- 子 Agent 的 Session 目录记录成员关系，完成结果另由调用者或父 Agent 接收；目录记录不等于运行状态。
- 移除 Provider 注册会阻止新启动，但不会自动撤销已接受的运行。
- 子 Agent 的委托权限在启动时固定，不允许子任务自行扩大；需要审批的操作自动拒绝并交回父级处理。

## 3. 对 WEX 的压力测试

1. 主 AI 派生施工 AI 时，委托范围与任务卡、资源授权和角色策略如何组合？
2. 子任务执行期间撤销授权，是否需要立即取消在途操作？这不能只靠启动时权限快照解决。
3. 同一仓库两个并发施工任务的写入冲突，如何锁定资源或采用修订冲突检测？
4. 任务取消时，已执行的 Git commit / 文件写入如何形成真实回执而非伪装为未发生？
5. 外部 Agent 不支持冷恢复时，调度器如何降级为一次性执行与人工接管？
6. Provider 被卸载后，已接受任务与新任务应有不同的生命周期处理。

## 4. 当前技术判断

可借鉴 DSH 的步骤级工具解析、prepare/dispatch/complete、批次顺序提交、发布前后生命周期区分与子 Agent 固定委托范围。WEX 当前不需要完整多租户安全体系，但需要在接口层保留可撤销授权、异步取消、结果未知、资源冲突和外部执行能力差异的表达空间。
