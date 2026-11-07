# DSH 补充研究：Session 重放、只读投影与 UI 插槽

状态：研究参考，不自动修改 WEX 正式架构。

## 已核查来源
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/architecture.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/host/plugin-inventory/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/ui-plugin-manager/README.md

## 新发现

1. Session 使用 append-only 类型化事件日志作为交互历史唯一事实来源；模型可见消息由日志投影得到，不独立维护第二份真相。插件可以贡献不进入模型上下文的 log-only 事件。
2. DSH 明确“模型可见即已记录”，请求头、工具声明、系统消息与尝试结果需要能从持久记录重建；失败或取消的 settled attempt 可以保留而不污染模型历史。
3. Session 历史格式迁移按相邻版本 vN→vN+1 组合；写打开时以独占方式发布新一代文件，旧代不覆盖。未来 WEX 长期项目数据迁移可借鉴非破坏式版本升级。
4. Session Projection 服务从提交事件生成增量只读视图，供 UI/外部载体获取 snapshot；业务服务保有自己的状态所有权。
5. Plugin Inventory 每次从 Loader 当前状态生成只读快照，不建立第二套插件生命周期缓存；清单显示状态不授予插件启停权限。
6. 客户端插件管理页使用 UI slots 注册插件专属配置页、详情动作、徽标和扩展区块。宿主提供稳定插槽与上下文，插件贡献 UI 内容；不是让每个插件任意重写主界面。

## WEX 适用性

- **高优先级**：任务/操作/回执与 UI 投影分离；避免多个生命周期真相；插件 UI 扩展插槽契约；项目持久数据格式版本化。
- **中优先级**：会话/任务日志可重放、失败尝试独立留痕、投影按需重建。
- **谨慎**：WEX 的 Space/Context、文件和多 Agent 操作未必都适合一个 Session 事件流；应按领域划分事实所有权，不能将 DSH 的会话日志当成万能数据库。

## 对冲案例

- 重启后 UI 从持久记录恢复任务和回执，不靠旧窗口内存。
- 插件停用后 UI 插槽自动撤销，其他页面不受影响。
- 读取插件清单不隐式激活插件。
- 历史格式升级失败时原文件仍可用且错误可诊断。
- 一次模型调用失败被记录，但不伪装成已经发送给模型的正常历史。
