# DSH 研究：组合架构与模块边界

- 状态：研究记录 / 非 WEXPC1 已采纳设计
- 核对基线：DSH `master` 源码与文档；关键入口包括 [architecture.md](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)、[adding-a-package.md](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)、[packages/README.md](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/README.md)。

## 1. DSH 的核心架构不是“中央核心 + 插件附件”

DSH 架构文档明确描述：模型适配器、工具注册表、会话日志、Agent Loop 本身都以插件形式提供。插件向共享 Context 贡献服务、类型化事件与可逆 effects；卸载插件时，注册应随其生命周期撤销。

这带来的重点不是所有东西都必须独立部署，而是**产品能力通过组合接入，核心业务循环不应成为每个新功能的修改入口**。

## 2. Profile、Bundle、Package 是不同层次

- **Package**：承载具体能力、服务契约或实现，有自己的依赖、导出、测试和说明。
- **Bundle**：一组可组合的 Loader 配置行及其挂载代码，是分发与组合单元。
- **Profile**：一套应用运行形态的组合配置，可以叠加 bundles、用户 patch 和环境层。
- **Patch / overlay**：按条目 ID 替换配置或插入新条目，后续层可以覆盖先前层。

因此，模块实现、模块组合和最终应用形态并不要求放在同一个目录或同一个包里。应用功能可以通过配置层组合，而不是每次增加功能都新增一个可执行程序或修改主入口。

## 3. 套到 WEX 时需要保持的区分

这是研究启发，不是现成设计：

- WEX 的功能模块不必一律是运行时插件；应区分内部模块、可替换提供者、可安装扩展包和应用组合配置。
- 一个可安装扩展可以包含多个功能贡献，但每项贡献仍需声明契约、权限与生命周期。
- 应用 profile / 模板负责组合，不应复制底层服务实现。
- 能力提供者与使用者之间应存在稳定接缝；扩展接入尽量通过注册和公开契约完成，而非直接引用实现内部。
- 运行时加载、安装分发、配置组合是三种不同机制，必须分别设计。

## 4. DSH 包级施工清单的价值

`docs/cookbook/adding-a-package.md` 把新增包变成逐项检查的工程任务：目录和文件清单、package metadata、TypeScript project references、公开导出、客户端专用声明、README 内容和质量门都有明确要求。

它的可借鉴点是：新增模块不是“建个文件夹开始写”，而是遵循一套标准包模板与注册流程。更重要的是，清单会由 `constraints`、workspace 检查、配置解析检查等工具验证，避免文档仅靠自觉。

## 5. 不应机械照搬

- DSH 使用 TypeScript、pnpm workspaces 与 Cordis；WEX 不应因为它的架构组织有效就自动采用同一语言或运行时。
- DSH 的 bundle/profile 配置组合并不等于任意后端代码都能热加载。
- “一切都是插件”不代表每个小函数都必须成为独立包。过度拆包会增加版本、依赖、构建与测试成本。
- 共享 Context 是 DSH 的具体机制，不意味着 WEX 必须使用一个全局服务容器；应先定义所需的可见性、所有权和安全属性。

## 6. 对 WEXPC1 的研究问题

1. WEX 应区分哪些层：维护模块、能力提供者、扩展包、组合模板、运行时实例？
2. 哪些模块允许运行时加入，哪些只允许构建期组合，哪些必须属于可信宿主？
3. 模块注册和组合配置分别由谁拥有，如何验证引用与声明一致？
4. 一项能力如何从包清单进入注册表，再被 Agent、UI 或工作流发现？
5. 如何在不修改中央业务循环的前提下增加新的连接器、模型、执行器和 UI 贡献？

## 7. 源码入口

- [DSH 架构图与 profile 组合](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/architecture.md)
- [新增 workspace package 清单](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)
- [包组与职责地图](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/README.md)
- [配置与依赖静态校验](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/scripts/verify-cordis-config.ts)