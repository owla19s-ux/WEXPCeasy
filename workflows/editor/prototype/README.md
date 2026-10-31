# WEX React Flow 独立编辑原型

> **历史实验说明（2026-11-01）：** 本原型不再代表当前产品画布选型。当前方向已调整为 WEX 自研轻量自由画布；本目录保留原型代码、测试和验证证据供比较与追溯，不据此继续扩展产品工作流能力。见[当前设计](../../../docs/architecture/WORKFLOW-CANVAS-AND-NODE-WORKSPACE-DESIGN-2026-11-01.md)。

这是隔离的 React/Vite 草稿编辑原型，不是 Electron 主程序或工作流调度器。

## 当前验证（2026-10-30）

已完成锁文件安装、TypeScript/Vite 生产构建、5 个模型测试、5 个 jsdom 组件集成测试，以及构建后 HTML/JS/CSS 的真实 HTTP 预览。React Flow 固定 `12.12.0`，锁文件已提交。

**真实浏览器拖拽、连线、布局与 Electron 尚未通过验收**：环境 Chromium 与浏览器控制工具均启动失败。DOM 测试使用真实 React Flow 组件，但不是浏览器测试。详细命令、故障、修复与模块边界审查见 [验证报告](VERIFICATION-2026-10-30.md)。

```sh
cd workflows/editor/prototype
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
npm run test:preview
npm run dev
```

原型需要支持 Vite 7 的 Node 运行时，本批实测 Node 24.22.1。构建/安装不使用仓库根依赖，不启动 GitHub Actions。`test:preview` 启动并结束本地 40173 端口的预览服务。

功能保持原范围：4 个初始节点、3 条连线、草稿新增/改名/移动/删除/连接、修订冲突检查、localStorage 保存与恢复；所有常规编辑通过 `applyEdit`，不执行任务。临时选中状态只存 UI；保存失败不提交隐藏修订。`App.tsx` 管理 UI 适配，`main.tsx` 仅负责挂载。

`model.mjs` 与 `model.d.mts` 不引用 React Flow；投影返回普通结构数据。未来 AI 可使用同一个模型入口，但目前没有真实模型服务调用或权限服务。重置按钮仅为原型管理操作。

原限制保留：无正式 WEX 数据 schema、磁盘存储、角色权限、运行状态、业务端口约束、撤销/重做或 Electron 集成；viewport 仍为种子字段，未接视口持久化。本原型 Draft 不是已冻结工作流契约。

## 按节点类型分文件（2026-10-30）

节点视图已经从 `App.tsx` 拆到 `src/nodes/`：`TaskPoolNode.tsx`、`AiNode.tsx`、`ReviewNode.tsx`、`ConditionNode.tsx` 各负责对应节点的呈现；`NodeShell.tsx` 只负责所有节点当前共用的标签/标题/左右 Handle；`index.tsx` 是唯一的视图分派与 React Flow nodeTypes 注册点。主画布不应写节点种类分支。现有模型继续通过 `toFlow` 输出统一的 `wex` React Flow type 和独立的业务 `kind`，因此不修改草稿、持久化格式或工作流运行协议。

以后某种节点需要新增独有的配置、标识或展示，优先修改自己的节点文件；只有确有共享需求才改 `NodeShell`，新增节点类型才改 `nodes/index.tsx`。节点可视组件不直接调用连接器、权限或任务执行；编辑仍通过 `applyEdit` 单入口。新增一项 DOM 测试覆盖四种类型及其左右 Handle。

**验证状态**：这一轮是源码重构及回归测试用例提交，尚未重新安装依赖并运行编译或测试；此前报告的 5+5 测试通过指重构之前版本，不能挪用为本轮结果。浏览器鼠标拖拽/连线真实测试仍需可用浏览器或 Windows 真机；Work 环境已证明目前不能执行该项，不作为新增节点文件拆分的阻塞。

## 本批重跑（2026-10-30）

基线 `00fa7076feb358b269a4206cb5623fd5b7b52693`，Linux / Node 24.22.1 / npm 11.9.0。实际执行 `npm ci --ignore-scripts --no-audit --no-fund`、`npm test`（5 模型 + 6 DOM，包括四种拆分节点和 Handle）、`npm run build`（TypeScript + Vite 7.3.7）、`npm run test:preview`（HTML/JS/CSS HTTP 200），全部通过。未修改业务/视图结构，未发现需修复的节点拆分回归。构建有上游 `use client` 指令忽略提示，不阻断输出。浏览器鼠标拖拽/连线及 Windows Electron 仍待真机；本批未重试受限浏览器，不启动 Actions。
