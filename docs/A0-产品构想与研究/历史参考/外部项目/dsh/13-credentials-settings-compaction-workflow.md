# DSH 补充研究：凭证、自动配置、上下文压缩与 Workflow

状态：参考研究，不等于 WEXPC1 架构已批准。

## 核查来源
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/credentials.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/settings.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/compaction.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/workflow.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session.md

## 新增参考点

1. **凭证引用与值分离**：DSH 配置存 CredentialRef，不直接存密钥；消费者每次操作解析一次，模型每次请求读取当前凭证，密钥轮换无需重启。WEX 应区分凭证 ID、连接实例、Provider 和实际秘密值。
2. **插件配置驱动 UI**：Settings 服务从活动插件配置生成表单描述；支持继承值、用户覆盖值和版本号。更新使用完整 schema 校验、乐观修订检查；路径级修改避免因客户端看不到 secret 而误清空密钥。WEX 的 Flutter 设置页可采用 schema-driven 扩展点。
3. **上下文压缩独立能力**：Compaction 是可替换的可选能力，不塞入 Agent loop；压缩摘要、原始记录的覆盖关系、token 用量和操作记录保留在持久事件中。WEX Space/Context 可借鉴“原始事实不等于模型当前可见视图”，但不照搬 DSH 的具体消息投影。
4. **Workflow 独立于 Agent loop**：Workflow Engine 是可替换服务；脚本编排子 Agent，元数据、运行句柄、结果与事件分离。WEX 的调度器不应将某种脚本引擎写死。
5. **错误严重性**：DSH Workflow 将非法参数、超限、取消等 fatal 错误重新抛出，普通子任务失败可由编排逻辑处理，避免误判整体成功。
6. **只读事件观察**：workflow 事件向监听者提供克隆的数据快照而不是可取消的 live handle，异常监听者不能阻断其他监听者。WEX 可将 UI 观察权限和执行控制权限分离。

## 对 WEX 的优先级

- 高：凭证引用与每次操作解析；插件配置 schema / 修订冲突；工作流结果与状态边界。
- 中：上下文压缩的事件化可追溯；工作流引擎可替换；只读事件快照。
- 后续：复杂上下文压缩策略、完整脚本工作流 VM、跨设备同步。

## 验收案例候选

- 运行中更换 API Key，下一次模型调用使用新凭证，不影响已启动请求。
- 新增插件声明配置字段，宿主无需硬编码该插件专用设置表单。
- 两个窗口同时编辑同一插件配置，旧修订号提交被拒绝。
- Context 压缩后仍可检索原始历史与压缩来源。
- 子 Agent 普通失败与工作流结构性错误呈现不同状态。
- UI 监听者崩溃不影响调度器运行或其他订阅者。
