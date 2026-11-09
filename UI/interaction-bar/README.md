# UI/interaction-bar｜独立交互栏

> Owner：UI 内的独立对象入口/交互容器；与 [虚拟形象入口](../avatar/README.md) 平级联动。产品方向见 [A1 PC UI](../../docs/A1-正式产品设计/PC基础UI布局与交互设计.md)；本版范围及缺口见 [A2](../../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与现有实现

- `interaction-bar.tsx` 负责交互栏的**视觉结构和收起操作**，现阶段仅显示栏体与“AI / 秘书 / Context 入口待接线”提示；`../src/interaction-dock.tsx` 组合栏体、虚拟形象及共同的展开状态。
- 交互栏不是 Context 工作视图的底部浏览器标签栏，不是 Workbench 的运行输出面板，更不是默认收起的右侧辅助窗。
- 独立展开/收起、保持主工作窗口空间、与形象位置联动是本版基础。当前未有真实对象列表或操作回调，不得将占位标签当成已完成的导航/调度功能。

## 未来对象入口及真实授权

可在后续版本根据获准状态展示主 AI、秘书、Agent、Context、Conversation 或其他对象入口；选择入口只构成**打开/切换/提出操作的 UI 意图**。对象权威与权限仍分别由 AI、Space、Conversations、Permissions、Connections 及可信 App 提供；切换 Context/角色不得凭已有栏状态自动扩大资源访问。

真实对象 ID、列表来源、选中方式、快捷切换、状态提醒、权限/失联/unknown 反馈及交互布局方向，需要逐项产品细化并根据版本计划施工。不依赖独立的“交互栏后台”或新增 Session Manager，不因 UI 可见自动派发工具/任务。

## 验收边界

0.1.1 以现有开合/联动和无虚假对象操作为基础验收；AI/秘书/Context 真实入口暂未接线，必须在版本范围确认后补。检查开合、手动收起、形象随栏定位、撤权后的内容清理、布局缩放及键盘可达性；Windows E4 单独验证。

源码入口：`interaction-bar.tsx`、`../src/interaction-dock.tsx`；现有测试：`../tests/interaction-dock.test.mjs`。
