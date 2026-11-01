# DSH / Cordis 插件机制源码快照与 WEXPC1 适配审查
> **本地链接说明（2026-11-02 文档检查）：** 这里是按文件选择性保存的**非完整上游快照**。原始 `docs/architecture.md`、`cordis-primer.md`、`cordis-README.md`、`scope-README.md` 中大量相对链接指向未复制的 DSH/Cordis 文件，因此这些链接在本仓库内无法打开。**这是快照覆盖不完整，不是 WEX 站内索引错误。** 请从上游仓库的对应路径/固定 blob SHA 查询，勿批量创建占位文档或随意修改上游原文。


- 日期：2026-10-30
- 上游：[DeepSeek-AI/deepseek-harness](https://github.com/DeepSeek-AI/deepseek-harness)
- 状态：**源码与原始文档研究资料，不是可运行的 WEX 插件实现**；先理解源码，再设计 WEX 公共契约、协议与接口。
- 保留授权：上游 DSH 与 vendored Cordis 在此快照分别保存原 MIT License。保留原文、上游路径和文件 blob SHA；原始文件禁止误认 WEX 自研模块。
- 采集方式：GitHub 文件接口按上游默认分支读取，逐文件记录 blob SHA；**不是一个已固定的整体上游 commit**，如需一致版本，下一轮需先锁定仓库 commit 再统一复核。

## 已保存的原始文件

| 本仓文件 | 上游原路径 | 上游 blob SHA | 阅读目的 |
|---|---|---|---|
| [docs/architecture.md](docs/architecture.md) | `docs/architecture.md` | `e3f5cd24a39d1d6275a291c83f165e6839ce191b` | 全局插件图、Profile、Bundle、启动与桌面运行 |
| [docs/cordis-primer.md](docs/cordis-primer.md) | `docs/cordis-primer.md` | `2e5a48745cf96068bec9e31b0c6f1bf9d84b0e34` | Context、Service、inject、生命周期基础 |
| [docs/cordis-README.md](docs/cordis-README.md) | `vendor/cordis/README.md` | `ad3e290a540f437d7576e217b910e9714959f430` | Cordis API、官方附属包与 Loader/HMR 的区别 |
| [source/package-manifest-types.ts](source/package-manifest-types.ts) | `packages/util/package-manifest/src/types.ts` | `392b20b3ef0b80d84d9169c468d15c50b8d1f73a` | DSH 包清单类型与扩展声明（仅 TS 类型，不执行 JSON 校验） |
| [docs/scope-README.md](docs/scope-README.md) | `packages/core/scope/README.md` | `d5f88240e07cfbf113e9b554b2814ab916529795` | 分域注册、继承与清理 |
| [LICENSE-deepseek.txt](LICENSE-deepseek.txt) | `LICENSE` | `c1f7a78e89e4e4dc7b86664c3b3c76eb5eee1785` | DSH 原版权声明 |
| [LICENSE-cordis.txt](LICENSE-cordis.txt) | `vendor/cordis/LICENSE` | `9fdec8c979b135b9433ad31949828f42a8eaa8a6` | Cordis 原版权声明 |

## 第一遍源码阅读结论：必须分清的五层

1. **Cordis 基础层**：Context/Service/inject/事件/Fiber 负责可信模块的声明、挂载和卸载。WEX `plugins/` 需要研究的首先是这一层；不等于插件包安装系统或强安全隔离。
2. **DSH 业务服务层**：例如 `ctx.llm` 注册 Provider，`ctx.tools` 注册工具；外部适配器依赖服务而不是整个聊天 UI。WEX `connections/api` 等业务模块可借鉴服务提供者/消费者分离，但不直接继承 DSH Agent Loop。
3. **Profile / Bundle 层**：`dsh.profile` 和 `dsh.bundle`、按序 Patch、应用启动 Loader 决定 DSH 如何组成插件树；这是 DSH 专属分发和配置机制，不能直接视为 WEX 自身配置格式。
4. **插件管理与热加载层**：安装、启停、持久配置、实际激活、HMR 各是不同动作；WEX 首版不要求插件市场与无重启升级。注册成功、已安装、已启用和已运行必须区别。
5. **客户端 UI 插件层**：`dsh.client`、浏览器 Bundle、UI slots、模块热更新属于另一套前端运行链。即使共享 Cordis，也不能认为 WEX React UI 能直接显示任意 DSH 客户端插件。

## 在 WEXPC1 的推荐归属（尚非实现）

| 机制 | WEX 归属 | 采用范围 |
|---|---|---|
| Cordis 基础实例、服务注册、依赖和生命周期 | `plugins/runtime/`（待实现时创建） | 首版优先 |
| 可发现能力、服务元数据与加载状态 | `plugins/registry/` | 首版按需 |
| DSH Bundle / Profile / UI 扩展兼容层 | `plugins/compatibility/` | 后续实验 |
| API Provider 与模型协议解析 | `connections/api/` | 首版 |
| 搜索 / Fetch 模块 | `connections/search/` | 首版 |
| 文件与目录本地能力 | `connections/local/` | 首版 |
| 通过 SDK/协议连接外部独立 DSH | `connections/dsh/` | 首版 |
| Electron 生命周期和启动装配 | `app/` | 首版 |
| 授权策略、确认、撤权、有效权限 | `permissions/` | 独立权威域 |
| 任务卡和实际运行结果 | `workflows/` | 不属于插件宿主 |

## 进入公共契约设计前需要完成的对照

- 选定并验证 Cordis 的实际 npm 版本与 DSH vendored 包差异（DSH 源码中使用 `@deepseek-ai/cordis`，vendored README 使用 `cordis`）；不能认定包名和 API 完全互换。
- 实际阅读注册代码 `packages/llm/llm/src/index.ts`（大文件，在线链接）与 scope 管理，辨别注册句柄所有权、冲突检查、在途调用。
- 实际阅读插件管理器、app-boot 与 client-modules（大文件，在线链接），区分“安装包”“启用配置”“激活成功”“UI 加载”；这些上游文档暂未全文复制。
- 针对 WEX 只定义最小稳定的模块公开边界：提供能力、消费能力、停用、错误与回执；**暂不冻结接口签名、Manifest 格式和 HMR 协议**。
- 设计依赖方向与可机检规则；模块化不能只靠文件夹或注释。
- 在 Windows Electron 原型验证 Cordis 基础实例以及一个 API Provider、一个模拟 DSH 连接器的加载与卸载。

## 更多上游原始源码入口（未复制）

- [LLM 服务/Provider 注册](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/llm/llm/src/index.ts)
- [插件管理器](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [App Boot / Profile Loader](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/boot/app-boot/README.md)
- [浏览器端模块](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/client/modules/README.md)
- [能力接缝服务图](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/capability-seams.md)
- [DSH 包清单说明](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/util/package-manifest/README.md)

不复制整套 DSH、大量生成文档或运行平台代码到 WEX 的生产目录。原始快照全部放在 `references/`，便于审阅后决定是否引入依赖、借鉴机制或单独改造。
