# WEXPCeasy｜2026-11-07 文档状态治理回执

> 范围：仅当前施工导航、模块 README、0.1.1 计划中的过期事实与状态口径；不改源码、API、权限政策或产品架构。
>
> 核对基线：`main bd72dfea801395e2f5dce94f2ccddc7a5ba20919`；写入从该基线连续提交，最终 SHA 以 GitHub main 为准。

## 已处理

1. 根 `README.md`：从旧 B1 独占施工入口更新为 B3 桌面交付入口，B1 保留为残余验收导航；同时纠正 AI/Conversations/GitHub/Local 无产品源码的历史快照。
2. `UI/README.md`、`app/README.md`：确认正式 Electron/React、Space UI、桌面主进程与受限 IPC 已有代码；明确仍缺完整对话/设置 UI、Windows 安装与实机证据。
3. `AI/README.md`、`conversations/README.md`：改为已有产品 `src/`、`tests/`，不把基础领域代码误报为自主 Agent 或正式对话 UI。
4. `connections/github/README.md`、`connections/local/README.md`：确认已有适配器及测试；区分 GitHub 官方 SDK 读取工作流成功与真实写入、完整 MCP 能力；区分 Local 文件/目录能力与 Shell/本地 Git/Windows 实机。
5. `space/README.md`：明确正式源码和 `test:space` 已存在，保留过时快照的历史性质，不直接改动 Placement 相关机制与数据表。
6. `docs/versions/0.1.1/PLAN.md`：更新入口事实和 B1-04/05/06/08 状态，保留 B1/B2/B3 任务编号和正式退出条件。

## 证据等级

- 基线 `bd72dfea` 对应 B1 public contract acceptance、B2 cross-module acceptance、B3 desktop host acceptance、Foundation verification、GitHub official SDK read acceptance、Documentation audit 有成功记录。
- **有源码**、**相应 CI 成功**、**完整功能验收**、**Windows 实机交付**必须分开；CI 成功不表示全部 B3 页面完成。
- 施工状态以开工时最新 `main` 与实际测试为准，不以本文快照取代复核。

## 仍待独立核对，不作已完成声明

- 0.1.1 B1 各条款完整独立验收矩阵与 B2 真实外部服务证据；
- 正式 API/Agent/Conversations、设置/权限 UI 与多视图；
- Windows 安装包、首次选择数据根、工具环境路径、升级与重装恢复；
- GitHub GH-01～GH-12 各项官方 MCP/Octokit 能力与受控真实写入；
- Space README 现存 Placement 历史关系叙述与用户已确认产品语义之间的冲突：**本次仅保留明确的非授权提醒，不擅自修改业务模型或将其列为产品层级**；
- 未对全仓每一个相对链接、所有 216 项功能进行逐项语义审计；此前治理审计仍可按需参照。

## 后续施工入口（供 Codex 使用，不新增授权）

[根 README](../../../README.md) → 对应 owner README → 源码与测试；跨模块范围参照 [B3 桌面交付任务](../../versions/0.1.1/B3-DESKTOP-DELIVERY-TASK-2026-11-07.md)。每次先查最新 `main` 和 [Actions 总列表](https://github.com/owla19s-ux/WEXPCeasy/actions/runs)，不得重建已有模块。代码施工不得自行改写施工文档，实际证据交给验收/文档模式更新。
