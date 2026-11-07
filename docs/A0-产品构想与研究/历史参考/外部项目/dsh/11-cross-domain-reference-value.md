# DSH 跨领域可借鉴机制：面向 WEX 扩展能力

状态：研究参考，不是已批准架构。范围：DSH architecture、MCP client、LLM、Plugin Manager、adding-a-package 文档。

## 值得优先借鉴

1. **能力定义／实现／消费者分离**：DSH cookbook 建议对可替换能力采用 Service Definition / Provider / Consumer 分层；单一职责插件无需强行拆分。WEX 可用于文件、终端、GitHub、API 和未来外部客户端的可替换实现。
2. **稳定的外部工具身份**：MCP client 使用本地配置的 (serverName, rawName) 作为稳定身份，而不信任远端 serverInfo.name。名称冲突拒绝整代更新；同步失败保留旧代。WEX 应考虑 Connection ID、Capability ID、外部标识映射分离，避免重连后权限和回执失联。
3. **连接故障状态显式化**：MCP 支持断线重连、工具同步串行、失败预算与停止重连；故障时工具可能仍被列出但调用失败。WEX 应区分发现、可用、健康、已授权、已加载。
4. **模型适配器中立**：DSH LLM 通过 provider adapter 处理供应商翻译，调用请求不可随意被扩展改写，单次 stream 对应一次 provider attempt；重试作为可选能力。WEX 的 Provider/Model/Credential/Agent/Task 不应耦合。
5. **可恢复事实与瞬态事件分离**：DSH architecture 区分持久 Session 事件与 live extension events。WEX 的任务、操作、回执、授权变更应辨明哪些是 durable facts，哪些只是 UI 通知。
6. **组合与部署分离**：Profile 是运行配置，Bundle 是可叠加的插件配置分发；patch 可覆盖组件。WEX 可借鉴模块实现、组合清单、用户配置分离，但不能把配置 HMR 等同于任意二进制热加载。
7. **插件更新事务意识**：Plugin Manager 区分安装、选择、激活、更新、恢复、需重启等状态，更新失败有恢复路径；WEX 要避免单个 enabled 布尔值承担全部生命周期。
8. **AI 施工规则机器校验**：adding-a-package 有明确文件清单、依赖和打包约束，由 constraints 脚本验证；WEXPC1 可将模块接口、依赖边界、清单完整性、任务卡验收转为可执行门禁。

## 不能直接照搬

- DSH 同进程 Cordis 插件作用域不是安全边界，也不是多主体／多组织授权图。
- MCP 名称稳定不等于服务器真实身份可信；还需要本地连接实例与授权绑定。
- DSH HMR 的即时配置应用不保证未知原生代码可无重启加载。
- DSH 事件模型不必原样移植；先明确 WEX 的状态所有权。
- 不应为了“万物皆插件”将稳定的安全边界、操作账本、基础协议全部做成可被普通插件覆盖的实现。

## 用 WEX 需求反向检验

- 运行中加入插件并刷新 UI：是否可完成发现、依赖检查、激活、撤销与错误恢复？
- 同一秘书使用不同模型：是否保持主体、任务、授权和凭证的独立性？
- 一个 Context 引用两个外部服务：工具 ID、连接 ID 和资源 ID 是否稳定？
- 公司／个人／设备等未来身份：当前对象标识和关联契约是否允许扩展，而不强行加入全套账号系统？
- 并发施工与回执：持久事实、实时事件、操作副作用和 UI 状态是否分开？

## 参考源

- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/architecture.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/mcp/mcp-client/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/llm/llm/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/boot/plugin-manager/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/adding-a-package.md
