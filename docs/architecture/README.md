# 全局架构文档

本目录保存跨模块的整体架构、模块边界、运行方式和宿主设计。模块自己的业务职责与契约仍以各模块目录中的 README、CONTRACT 为准。

## 架构依据

- [全局契约地图与模块化施工方法](GLOBAL-CONTRACT-MAP-V0.1.md)
- [模块局部性设计](MODULE-LOCALITY-DESIGN-V0.1.md)
- [提供方边界 walkthrough](PROVIDER-BOUNDARY-WALKTHROUGH-V0.1.md)
- [运行时扩展契约研究](RUNTIME-EXTENSION-CONTRACT-V0.1.md)
- [运行时方案比较](RUNTIME-OPTIONS-V0.1.md)
- [源码目录与 Windows 数据布局](SOURCE-LAYOUT-AND-WINDOWS-DATA-2026-10-30.md)
- [工作流自由画布与节点工作界面设计（当前）](WORKFLOW-CANVAS-AND-NODE-WORKSPACE-DESIGN-2026-11-01.md)
- [Space 与工作流编辑器设计（历史共识；画布技术选型已修订）](SPACE-AND-WORKFLOW-EDITOR-DESIGN-2026-10-30.md)
- [DSH 与 WEX 双插件体系边界](DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)

## 使用规则

1. 本目录说明全局结构，不替代模块契约。
2. 业务语义以模块 CONTRACT 为准；跨模块索引见 [模块契约总索引](../MODULE-CONTRACTS.md)。
3. 研究候选、实验结果与正式决策必须分开；不得把文档中的候选接口视为已实现 API。
4. 若全局设计与较新的正式决策冲突，以 [决策目录](../decisions/README.md) 中明确标记的当前决策为准，并保留冲突记录。
