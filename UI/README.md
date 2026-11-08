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
| `src/interaction-dock.tsx` | 形象/交互栏基础显示及位置管理；真实角色素材/完整交互未交付 |
| `src/index.ts`、`tests/` | UI/桌面桥类型、状态回归和测试；权限与 OS 事实仍在可信宿主 |

早期“只有 Space 页面”“全部对话为占位”“只有只读预览”“无文件编辑器”均不是当前状态，不得继续按这些旧结论重造组件。GitHub main 目前确认文件级交互；通用官方 MCP UI 的独立 [PR #3](https://github.com/owla19s-ux/WEXPCeasy/pull/3) 证据不能直接冒充主分支已交付。

## 产品约束

- PC 优先；单 Context 可开多个视图、布局保存恢复。窗口与 Context 组织方式尚未最终冻结，不据此提前建设独立多窗口调度系统。
- 视图容器只承载操作，不保存额外业务数据库、权限事实、密钥或外部 Operation。通过受控 DesktopBridge 调用正式 owner。
- 窗口尺寸、拖动分栏、Snap、DPI/文本放大与窄窗布局必须可用；旧布局安全迁移，不为了测试方便删除有效断言。
- 文件草稿的内存保留不等于持久化工作区；流式文本显示不等于生成已定稿；工具可见不等于授权使用。

## 剩余施工与验收

优先验证真实 Provider → 对话 → 流式/取消/编辑重发、Space/Local 文件编辑的撤权/冲突、连接设置与 Operation 反馈、跨 Context 视图恢复、Windows 布局和安装 E4。只有可复现失败或批准的缺口才拆分 `workbench`、CSS 和状态逻辑；不预建空目录。

阅读顺序：根 README → 本 README → 目标源码/测试；必要时查上述 A1 交互文档。记录同 SHA build/typecheck/test/boundaries、UI 绘制证据、真实与模拟结果。当前 B3 未独立签收。
