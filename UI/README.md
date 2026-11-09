# UI｜Windows PC 交互与多视图宿主

> Owner：`UI/`。正式交互方向见 [PC 基础 UI 设计](../docs/A1-正式产品设计/PC基础UI布局与交互设计.md) 与 [0.1.1 UI 映射](../docs/A1-正式产品设计/0.1.1-UI功能映射.md)；版本状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与已存在源码

| 文件 | 现有职责与边界 |
|---|---|
| `src/renderer.tsx` | React 挂载和可信 DesktopBridge 消费，不存业务权威 |
| `src/workbench.tsx`、`workbench.css` | 导航、动态中间工作窗口、设置/面板装配及响应式布局 |
| `src/layout.ts` | 外层布局调节、旧布局状态迁移及恢复 |
| `src/space.tsx`、`space-addresses.tsx` | Space/Context 组织、地址与受控资源入口 |
| `src/middle-workspace.tsx`、`workspace-state.ts` | Context 多视图标签、预览、按 Context ID 隔离的布局状态 |
| `src/conversation.tsx` | **正式普通对话组件已存在**：历史、新建、Agent 选择、发送、段落引用、编辑重发、生成状态及回执查询 |
| `src/local-file-editor.tsx` | **本地编辑器已存在**：窗口内草稿、版本绑定保存、冲突重读、取消/unknown 反馈 |
| `src/context-tools.tsx`、`operation-receipt.tsx` | Context 工具发现/引用与桌面 Operation 回执展示；工具可见不等于授权，回执呈现不等于业务确认已签收 |
| `src/conversation-files.tsx` | 对话受控文件引用入口；文件选择、读取权限和真实发送仍须端到端验收 |
| `src/interaction-dock.tsx` | 形象/交互栏基础显示及位置管理；真实角色素材/完整交互未交付 |
| `src/index.ts`、`tests/` | UI/桌面桥类型、状态回归和测试；权限与 OS 事实仍在可信宿主 |

早期“只有 Space 页面”“全部对话为占位”“只有只读预览”“无文件编辑器”均不是当前状态，不得继续按这些旧结论重造组件。`github-tools.tsx` 提供官方目录、Schema、JSON 参数及 Operation 结果展示，经 DesktopBridge 手动触发；撤权、连接/配置切换清理目录与旧结果。此入口要求可信宿主装配 MCP runtime，不代表默认安装包已提供运行时或所有官方工具已验收。

## 产品约束

当前界面只有 `context` / `structure` 两类工作视图：它们是基础标签和按需预览，不是长期专业多视图引擎。`src/space.tsx` 的类别按钮目前纵列渲染，且导航只有折叠态，与 A1 三个横排窄高类别按钮及完全隐藏能力仍有差距。`src/interaction-dock.tsx` 已有栏体开合、窗口内悬浮标记与两套坐标，但 AI/秘书/Context 对象入口未接线；底部输出不是交互栏。


- PC 优先；单 Context 可开多个视图、布局保存恢复。窗口与 Context 组织方式尚未最终冻结，不据此提前建设独立多窗口调度系统。
- 视图容器只承载操作，不保存额外业务数据库、权限事实、密钥或外部 Operation。通过受控 DesktopBridge 调用正式 owner。
- 窗口尺寸、拖动分栏、Snap、DPI/文本放大与窄窗布局必须可用；旧布局安全迁移，不为了测试方便删除有效断言。
- 文件草稿的内存保留不等于持久化工作区；流式文本显示不等于生成已定稿；工具可见不等于授权使用。

## 2026-11-09 新增交互变更核对

已通过 main 提交差异核到 API/AI/Permissions/Space 设置页的撤权后迟到响应隔离、发现模型 ID 选择（不隐式注册），以及 Context 工具引用、对话文件引用、Operation 回执相关组件与桌面测试修改。对应 A2 最新记录的基线为 `a91aacf3`；当前同 SHA CI 和完整真实 UI 验收未核实。不能据代码提交推断这些交互已独立签收。

## 剩余施工与验收

先按 A1 UI 设计核对上述**已确认的布局/入口缺口**，再分别验证 Context 配置项、视图与预览状态、撤权、草稿和 Operation 回执；复杂自由格子、专业多视图与桌面级虚拟形象保留后续设计，不以现有容器冒充完成。


优先验证真实 Provider → 对话 → 流式/取消/编辑重发、Space/Local 文件编辑的撤权/冲突、连接设置与 Operation 反馈、跨 Context 视图恢复、Windows 布局和安装 E4。只有可复现失败或批准的缺口才拆分 `workbench`、CSS 和状态逻辑；不预建空目录。

阅读顺序：根 README → 本 README → 目标源码/测试；必要时查上述 A1 交互文档。记录同 SHA build/typecheck/test/boundaries、UI 绘制证据、真实与模拟结果。当前 B3 未独立签收。
