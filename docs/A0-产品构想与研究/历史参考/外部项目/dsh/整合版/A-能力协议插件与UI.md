# A｜能力、协议、插件及 UI 扩展

状态：研究参考；非 WEX 已批准接口。

## 1. 能力接缝与组合（原 01、05、11）
DSH 的 Service Definition、Provider、Consumer 区分“能力语义、实现和使用者”；注册表按服务接口解析提供者，生命周期负责注册释放。Profile/Bundle/Package 分别承担运行组合、配置集合和发布单元职责，不等于一目录一插件。WEX 可把 Connection ID、Capability ID、实例、包版本与激活代次分开，避免连接更换后历史回执失联。**注册可见、运行健康、授权可执行、实际完成是不同事实。**

## 2. 协议与连接身份（原 02、11）
LLM 公共输入/流式输出/终态/错误契约与具体 Provider 适配器分离。工具意图不能由协议解析器直接执行；半截流式工具参数不得提交。错误映射需与重试策略分开，EOF/断线不等于成功。MCP 工具身份宜由本地配置的服务器身份与远端原始工具名组合，不能直接信任远端自报名称；重连同步要区分 generation、冲突、旧注册和可用状态。WEX 的协议适配与连接实例应独立演化。

## 3. Manifest、安装、Loader 与 HMR（原 03、07、12）
Manifest 是声明，不自动成为兼容、安全和权限保证。Plugin Manager 负责安装、版本、启停与恢复；App Boot/Profile 负责组合与预检；Loader 负责激活；HMR 协调源码/配置变更与生命周期。DSH HMR 串行处理模块、Include 和 Profile 更新，可能要求重启；导入或启动失败并不保证无缝回滚。WEX 候选链路：发现→清单校验→依赖/兼容检查→准备→暂存注册→发布代次→UI 更新。停用先拒绝新调用，再排空/取消在途、保留回执并释放注册。**源码热替换、用户安装扩展、配置热更新是三种不同能力**。

## 4. 配置、凭证和 UI 扩展（原 13、14）
凭证引用与秘密值分离；使用时解析当前凭证，不在普通配置或 UI 事件中传播。插件可以声明配置 Schema，由宿主生成表单；并发修改需要配置修订号，局部更新不得误清空不可见的 secret。UI Slots 让插件贡献设置页、详情和操作区块，宿主拥有插槽排序、权限和撤销。Plugin Inventory 应从 Loader 当前状态产生只读快照，UI 不维护第二套生命周期真相。

## 5. 对 WEX 的边界
WEX 已在候选设计中提出运行时扩展和 connection.settings 插槽，但不代表已实现。Rust/React 或其他运行时是否支持完整热插拔，必须做“未知协议 + 设置面板 + 真正调用 + 停用恢复”的试点。不要让插件越过统一执行/授权边界，也不要把 UI 错误边界误认为代码沙箱。

## 主要来源
原文：[01](../01-capability-seams-and-registration.md)、[02](../02-protocols-and-adapters.md)、[03](../03-manifest-loading-lifecycle.md)、[05](../05-composition-and-package-boundaries.md)、[07](../07-plugin-management-and-runtime-boundaries.md)、[11](../11-cross-domain-reference-value.md)、[12](../12-hmr-hot-plug-runtime.md)、[13](../13-credentials-settings-compaction-workflow.md)、[14](../14-session-projection-ui-extension.md)。

上游：DSH `docs/architecture.md`、`packages/boot/{plugin-manager,app-boot,hmr}/README.md`、`packages/client/ui-plugin-manager/README.md`、`packages/llm/llm`、MCP client 与 `docs/subsystems/{credentials,settings}.md`。精确引用见原文。
