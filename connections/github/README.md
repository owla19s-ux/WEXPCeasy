# connections/github

GitHub 操作与连接配置。权限使用共用机制；专属面板留在本模块。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 官方 GitHub 能力连接与验收

- [GitHub 官方 MCP + Octokit 完整能力接入契约](CONTRACT.md)（GH-01～GH-12）。官方 GitHub MCP Server 为首选，Octokit REST/GraphQL 补充能力缺口；WEX 只做受控连接器，不重写 GitHub API。旧 WEX/WEXPC 源码仅作测试与安全参考。

## 上级契约与文档入口

- **上级业务/职责契约：** [connections/CONTRACT.md](../../connections/CONTRACT.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [提供方边界 Walkthrough](../../docs/architecture/PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)
- [复杂业务契约压力审查](../../docs/audits/COMPLEX-CONTRACT-STRESS-REVIEW-2026-10-31.md)

本子目录只细化上级模块内部的职责或实现入口，不另建第二份业务权威。若本页与上级契约冲突，以对应 owner 契约为准；实验结论只按原记录的环境和范围解释。

## G1/G4：远端资源引用与操作回执

GitHub 仓库、分支、提交、PR 和文件均按远端对象身份/版本观察引用；名称、URL 或默认分支不能替代当前修订核对。每次写操作由 Connections 宿主记录 Operation/attempt，回读远端结果后再报告；提交请求超时或回执缺失时先查询原 Operation/远端事实，不盲目创建第二次提交、PR 或分支。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
