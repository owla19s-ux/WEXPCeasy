# Space / Context｜组织、引用与配置选择

> Owner：`space/`，正式接口细则见 [CONTRACT](CONTRACT.md)，长期需求见 [A1](../docs/A1-正式产品设计/产品功能总表.md)，0.1.1 交付状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与边界

Space 维护 Category、Space、Group、Context 的组织关系、稳定 ID、地址（本地/资料/产出等）、工具或配置的引用/选择以及可见投影。**Context ID 已有正式实现。不得恢复历史 Placement 实体。** 模板归属 Context 内的可复用配置与组合能力（资源、能力、视图及可选工作流引用），不另设顶层 Templates 模块；模板不等于 Context 本体，具体模板操作/字段仍待细化。 一个 Context 的引用/选择不代表资源所属权迁移，也不等于执行绑定已经授权。API/AI、Connections、Permissions、Local/Environments 分别拥有自己的配置、操作、权限、资源和环境事实；Space 不复制第二份权威。

## 源码与状态（2026-11-08）

`space/src/index.ts` 导出 `openSpaceService`、SpaceService，以及 Category、Space、Group、Context、Address、Association、Tool、ContextView、投影等类型。具体业务校验、修订、持久化和恢复在 `src/service.ts`、`src/model.ts` 等已有文件中，测试在 `tests/`；不按名字预建额外状态中心。

| 能力 | 当前实现 | 待验证/补齐 |
|---|---|---|
| 组织结构和 Context ID | 已有实体、稳定身份、查询/修改端口 | 全部 UI 操作、损坏/并发/重启恢复 |
| 地址及引用 | 地址、Association、Tool 的部分服务已存在；普通 Association 支持 AI role/position/旧 agent、API/model 和 conversation 目标，工具引用与启用状态独立 | 桌面发现/添加/替换/解除及关联会话入口已接；默认/有效配置解析、真实 Provider 与 Windows 待验 |
| Category 可见性 | 已有准备/提交和恢复边界的撤权相关修复/测试提交（`3693a8ec`、`beea0ce2`、`c2e68469`） | 当前 SHA 同步回归、原回执/未授权落库防护 |
| Space 桌面展示 | 现有 Space 页面和资源预览/编辑入口 | 快速切换、迟到响应、权限变化与 Windows 验收 |

**Issue #11 接线（2026-11-09）**：Context 通过既有 Association 引用多个 Role、Position 或现有 Conversation；不设唯一主 AI/唯一会话。桌面复用 AI/Conversations 原有 snapshot 发现对象，OwnerPort 每次以真实 owner 读取验证。引用操作不授权执行；Tool.enabled 仍只适用于工具选择，不复制给普通 Association。Context 打开返回 associations 与 associationsComplete；投影不完整时明确提示，失效/无权引用仍保留在原 Store，不自动清理或创建替代目标。

## 2026-11-09 桌面工具引用进展

[`5a77d192`](https://github.com/owla19s-ux/WEXPCeasy/commit/5a77d192bf8d0154ca5975c42ec7e8f42181090c) 已提交经授权发现工具并管理 Context 工具引用的桌面交互，相关差异涉及 `UI/src/context-tools.tsx`、`app/src/desktop-space.ts`、Connections 能力及测试。该证据仅说明代码/测试已提交，不等于 Space 所有引用关系或真实工具执行已通过；最新 main `a91aacf3` 的同 SHA CI、撤权/重启/失联验收仍待核。Space 仍只持引用，工具发现不授予执行权。

本轮复用 Association 关联会话，消息和生成仍归 Conversations。`Context.config` 继续只允许空对象，旧 Body/Registry 格式无需迁移；选择设定是对话本轮显式选择，不写默认或启用状态。删除/停用目标清理、跨 Context 会话移动/共享、默认模型优先级和高级配置覆盖仍待决。

## 调整与验收

当前 `context.edit` 主要修改名称与说明，`Context.config` 尚无完整公开编辑操作；Association/Tool 有既定目标类型限制，不得按“引用系统已实现”推断任意资源类型或配置已可用。类别按钮的排列属于 UI 责任，Space 不为该布局新建业务类别。


1. 先确认本域已有公开端口和模块测试，区分“引用”“配置选择”“执行绑定”，不因引用存在自动赋权。
2. 复验类别撤权、准备/提交/回执、跨 Context 可见性、失联目标、重启/冲突和旧结果隔离；必要修复限于负责 owner。
3. 与 AI、API、Conversations、Connections、Local、UI 组合时只通过公开端口。用户添加本地工具地址或参考目录不代表 Space 拥有 OS 执行或安装权。
4. 先查 [Actions 总运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 及被测 SHA，再记录验证结果。当前仅静态源码/提交证据，未独立签收。

施工路径：根 README → 本 README/CONTRACT → 本模块源码与测试；有明确争议时再查 A1/A2，不建立跨 A0/A1/A2 的额外索引。
