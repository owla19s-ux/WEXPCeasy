> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# WEXPC1｜第八批任务：基础模块最终复验与 Electron / React 宿主最小验证

仓库：`owla19s-ux/WEXPC1`

施工基线：规划提交 `4e78382670875628e2675f43c71afa78fabfbcec`。执行前必须重新读取最新 `main`；若已前进，以最新 HEAD 为实际基线并记录差异。

施工位置：默认 `main`。

本批性质：基础工程复验 + 桌面宿主兼容性验证。不是完整桌面 UI 开发，不是首版产品交付。

## 一、总体目标

第七批已建立 shared、permissions、app 的真实基础实现，但最后一轮可靠性修复尚未重新执行完整测试。本批先确认当前基础代码，再验证已确定的 TypeScript + Electron + React 路线能否与现有 app/shared/permissions 实现真实组合。

必须回答：

1. 第七批最后修复后的当前 main 是否全套通过？
2. Electron 内嵌 Node 运行时是否兼容当前 shared 的 SQLite 适配？
3. Electron 主进程、Preload、IPC 与 React Renderer 能否建立最小安全通信？
4. app 的装配/停机生命周期能否在 Electron 主进程内正确启动和释放？
5. 数据根与 Electron Session 路径是否存在需要提前处理的启动时序冲突？

## 二、前置核对

- 读取最新 main、最近提交和工作区变更；不得用规划基线覆盖更新。
- 读取根 README、package.json / lock、app/shared/permissions 当前源码及测试。
- 读取 app / UI / shared 契约、Windows 数据要求、Electron 安全研究与第七批最终报告。
- 检查是否有新的产品决策或用户修改；不把旧报告里的候选升级成已批准方案。

## 三、A：第七批最终修复复验

在 Node >=24.9.0 环境执行：

```sh
npm ci
npm run typecheck
npm test
npm run test:shared
npm run test:permissions
npm run test:app
npm run check:boundaries
```

- 若网络不可用导致 `npm ci` 失败，记录原始错误；只可在 lock 完全匹配的既有依赖环境中继续，不得声称干净安装通过。
- 运行当前仓库已有 DSH Core+Loader、原生 Bundle 和 React Flow 原型的独立回归入口；各自依赖缺失时明确记录，不将其混入基础产品测试总数。
- 测试失败先定位根因，新增回归后修复；不得跳过、删除或弱化失败用例。
- 记录每条命令、实际通过数、失败数、运行时版本和环境；不沿用修复前测试数量。

## 四、B：Electron 最小宿主实验

先在最小、可删除的实验或明确隔离的宿主骨架中验证；只有证据充分时才将可复用部分落入正式 app/UI。

1. 固定并记录 Electron 版本、对应 Node 版本、平台和构建工具版本。
2. 在 Electron 实际运行时内验证当前 SQLite 适配所需 API；执行真实建库、事务、提交、关闭和重启回读。不能以系统 Node 测试代替 Electron 内测试。
3. 启动最小 Electron 主进程与一个本地 Renderer；确认 React 资源可正常构建和加载。
4. Preload 只暴露窄化业务能力；不得向 Renderer 暴露通用 Node、文件系统、数据库连接、完整 app 容器或任意命令执行。
5. Electron BrowserWindow 必须采用安全默认值：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`；实际 IPC 必须校验发送端和允许的动作/参数。任何例外必须说明必要性与风险，不得默认放宽。
6. 验证导航、外部窗口、远程内容和权限请求限制；不允许不可信 Renderer 取得主进程特权。
7. 验证 app 基础装配可启动；窗口关闭与 app 生命周期按当前已确定语义协调，释放失败必须保留诊断并可重试。
8. 验证 Electron Session 路径设置与 app 启动时序；只形成可复现结论，不在本批擅自冻结首次启动选址交互。
9. 记录最小启动、SQLite 事务、IPC 正反例、退出释放和资源清理证据。

若 Electron 内 SQLite 不兼容，优先保持 shared 的存储端口并评估可替换驱动；不因单一驱动问题推翻 TypeScript/Electron/React 路线。若 Electron 宿主本身出现硬阻断，提供可复现实验和替代成本，交由用户决定，不擅自改技术主线。

## 五、范围限制

本批不做：

- 完整对话、Space、设置或工作流页面。
- 完整数据根选择向导和目录迁移 UI。
- Windows 安装器、自动更新、卸载器及正式发布包。
- 第三方 WEX 插件加载器、DSH 原生插件宿主产品化。
- 托盘常驻、开机自启、后台持续运行。
- 未经批准的付费 API 或外部 Agent 调用。
- GitHub Actions；不得主动触发 Actions。

## 六、验收条件

- 第七批最终修复在当前 HEAD 的完整测试重新通过，或明确列出已修复/未修复阻塞。
- Electron 内实际 Node/SQLite 兼容性有运行证据，不能只查版本表。
- 最小 BrowserWindow、Preload、IPC、React Renderer 可运行。
- Renderer 无 Node 集成，IPC sender 校验有效，越权/伪造发送端测试被拒绝。
- app/shared/permissions 在 Electron 主进程内可最小装配和释放，释放失败不被误报成功。
- 所有新增源码、测试、依赖和实验边界有说明；不把实验当产品实现。
- 文档记录实际平台与 E0–E4 证据等级；未做 Windows 实机就明确 E4 未通过。

## 七、交付

- 必要的实验代码或最小宿主实现。
- 可复现命令、版本锁和原始输出。
- Electron 与 SQLite 兼容性结论及剩余风险。
- 更新 app/UI/shared 对应 README/CONTRACT（只更新实际发生变化的 owner）。
- `docs/batch8/REPORT.md`、证据文件及文档索引。
- 提交 SHA、测试结果、未执行项目和下一批施工准入建议。

按完整批次推进，先复验再实验；不因某个小步骤通过就提前宣布完成。
