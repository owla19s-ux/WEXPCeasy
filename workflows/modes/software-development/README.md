# workflows/modes/software-development

软件开发工作流模式：流程预设、默认配置、需求／架构／代码关联和专属视图。未来按需要增加 preset、structure 实现，不冻结文件格式。

状态：2026-10-30 按用户确认建立的源码维护目录，当前只有职责说明，尚无产品实现。目录不是运行时数据路径，也不代表独立插件、进程或编译包。

[源码目录与 Windows 数据要求](../../../docs/architecture/SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)

修改原则：实现与必要测试按实际需要就近添加；不预建技术分层。模块专属 UI 随模块，内置页面集中在顶层 UI。实现后补充具体入口和验证方式。


## 上级契约与文档入口

- **上级业务/职责契约：** [workflows/modes/CONTRACT.md](../../../workflows/modes/CONTRACT.md)
- **专业模式子契约：** [software-development CONTRACT](CONTRACT.md)
- **全局文档总索引：** [docs/README.md](../../../docs/README.md)
- [产品功能全景](../../../docs/research/PRODUCT-FUNCTION-LANDSCAPE-2026-10-31.md)
- [研究决策](../../../docs/decisions/RESEARCH-DECISIONS-2026-10-30.md)

本子目录只细化上级模块内部的职责或实现入口，不另建第二份业务权威。若本页与上级契约冲突，以对应 owner 契约为准；实验结论只按原记录的环境和范围解释。
