# DSH 研究：清单、加载与生命周期

- 状态：研究记录；不是 WEXPC1 已采纳加载方案
- 来源：[包清单说明](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/util/package-manifest/README.md)、[客户端模块系统](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/client/modules/README.md)、[扩展开发指南](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)

## 1. 清单与执行是两件事

DSH 的包清单描述包身份、版本和扩展声明。清单类型本身只提供静态类型；其文档明确提醒，消费者需要自行解析、验证和处理默认值，声明兼容范围也不代表运行时一定强制执行。

对 WEX 的直接提醒：**清单是输入，不是安全结论。** 宿主必须自己完成解析、规范化、兼容性检查、依赖解析和加载前校验。

## 2. 客户端模块系统实际展示了什么

客户端系统会根据启用的 Loader 条目读取扩展声明，构建加载图，提供构建后的浏览器模块，并按需加载。其实现还处理入口同步、版本代次、失效和清理。

但它也明确列出限制：部分启动模块不能被普通热替换；替换模块代码及所有现有消费者不属于一般启停同步；清单编辑可能要等模块重启或宿主重启才生效。

因此不能把“支持插件”简化成“所有代码都可热替换”。

## 3. 后端与前端必须分别研究

客户端代码运行在浏览器模块系统中；后端插件运行在宿主执行环境。前端按需加载的事实，不能证明后端可以安全动态装载任意原生二进制。

WEX 要求扩展包可能同时贡献后端能力和 UI，但应当区分：
- 同一发布包中的不同入口；
- 不同执行环境和权限；
- 两侧契约版本；
- 共同的激活代次与失败处理。

## 4. WEX 候选加载流程

以下是供比较的候选流程，不是最终方案：

1. 发现扩展目录变化。
2. 对完整发布包进行暂存与完整性检查。
3. 读取并校验清单、宿主兼容范围、依赖和公开能力 ID。
4. 根据运行时方案装载后端入口，并准备 UI 贡献。
5. 暂存注册，不向业务消费者公开半成品。
6. 原子发布新激活代次并通知 UI。
7. 失败时撤销暂存注册、清理资源；若是升级则保留旧版可用状态。
8. 停用时先关闭新调用准入，再处理在途调用、清理订阅与注册。
9. 历史消息、操作回执和连接身份不随扩展代码卸载而删除。

这里的“原子发布”只要求注册表对消费者呈现一致版本，不意味着跨进程操作、文件系统、网络与数据库天然原子。

## 5. 运行时方案对比必须覆盖的维度

- 是否允许构建时未知的后端实现接入；
- 是否需要重启主程序；
- UI 是否能贡献页面、面板和资源；
- 代码隔离和文件／网络／凭证访问控制；
- 跨语言调用与协议版本管理；
- 取消、超时、崩溃检测和资源回收；
- 在途请求与旧版本排空；
- 安装、升级、回滚与数据迁移；
- 调试、打包、签名和 Windows 分发成本。

## 6. 参考源码

- [包清单](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/util/package-manifest/README.md)
- [客户端模块系统与已知限制](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/packages/client/modules/README.md)
- [扩展开发模式](https://github.com/DeepSeek-AI/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)