# DSH 研究：插件管理、热更新与运行时边界

- 状态：研究记录 / 非 WEXPC1 已采纳方案
- 来源：[Plugin Manager README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)、[App Boot README](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/app-boot/README.md)、[架构文档](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)。

## 1. DSH 实际支持的动态管理能力

Plugin Manager 可以启用或禁用 profile 中的插件条目、选择已安装 bundle、安装或移除外部 bundle，并持久化 profile 配置。配置启用了 HMR 时，配置变更可以立即应用；未启用时，运行中的组合保持不变，直到重启。

安装 bundle 与激活代码不是同一动作：安装会更新 profile 依赖与组合配置，Loader/HMR 再负责将新组合应用到运行时。应用层还区分已保存的启用状态与实际加载成功状态；加载失败的 bundle 仍会显示错误，而不是把“已选中”误报成“已成功运行”。

## 2. 这并不等于任意源码直接热加载

从当前文档可确认的是：DSH 管理的是安装包、profile 配置和 Loader 插件组合；HMR 负责协调配置变更与重新加载。它不是“把任意源文件扔进目录，宿主自动执行”的普遍承诺。

尤其需要注意：
- 新包通常仍需满足包格式、依赖、导出与入口约定。
- Host 插件代码在进程内运行，不能仅凭 Plugin Manager 的权限审批就推断其受到完整 OS 级沙箱隔离。
- 配置热更新、模块重新挂载、任意后端二进制热替换是不同级别的能力。
- 有些 profile 默认禁用 HMR，因此同一套插件管理操作在不同运行形态下可能需要重启才能生效。

## 3. 对 WEX 的直接启发

WEX 需要把扩展链路拆成可观察的阶段，而不是只保留一个 `enabled` 布尔值：

1. `discovered`：发现扩展目录或安装记录。
2. `validated`：清单、完整性、兼容性和依赖检查通过。
3. `installed`：扩展文件已安装到受控位置。
4. `prepared`：运行时入口已准备，注册尚未对消费者公开。
5. `active`：能力注册和 UI 贡献已发布。
6. `deactivating`：停止接收新请求，处理在途操作。
7. `inactive` / `failed`：停用完成或失败，带有可诊断原因。

这些名称只是状态建模候选，不是最终状态机。WEX 还需要定义升级时旧版本如何继续服务、失败如何回滚，以及文件系统与运行时状态不一致时如何恢复。

## 4. 对施工卡和回执的启发

施工卡与扩展状态可以共享同一原则：声明状态与真实结果分离。

- 任务卡被标记为 `ready`，不代表前置任务已经实际完成；需要验证其证据。
- 扩展被声明为 `enabled`，不代表运行时激活成功；需要真实加载结果。
- 安装命令返回成功，不代表扩展能力可用；需要宿主确认注册并通过健康检查。
- 停用请求已发出，不代表所有在途调用已经退出；需要明确 quiescence / drain 的完成条件。

这能避免 WEX 的调度器、插件宿主和 UI 各自维护互相矛盾的状态。

## 5. 需要在 WEX 方案比较中验证的内容

- 文件监听是否只是触发检查，还是直接触发加载；
- 安装和激活是否有独立事务与回滚边界；
- 新旧版本并存期间，调用如何绑定到具体激活代次；
- 旧版本退出前，是否排空在途请求并释放资源；
- 插件异常时，宿主是否保留其他已激活模块；
- profile / bundle 配置变化是否能在不重启主进程时重新组合；
- 哪些模块属于必须重启的宿主基础设施。

## 6. 参考源码

- [插件安装、启停和失败状态](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [profile 组合、Loader 启动与 HMR 配置](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/app-boot/README.md)
- [应用架构、profile 与 bundle](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)