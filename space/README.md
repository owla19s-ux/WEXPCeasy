# Space / Context｜组织、引用与配置选择

> Owner：`space/`，正式接口细则见 [CONTRACT](CONTRACT.md)，长期需求见 [A1](../docs/A1-正式产品设计/产品功能总表.md)，0.1.1 交付状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与边界

Space 维护 Category、Space、Group、Context 的组织关系、稳定 ID、地址（本地/资料/产出等）、工具或配置的引用/选择以及可见投影。**Context ID 已有正式实现。不得恢复历史 Placement 实体。** 模板归属 Context 内的可复用配置与组合能力（资源、能力、视图及可选工作流引用），不另设顶层 Templates 模块；模板不等于 Context 本体，具体模板操作/字段仍待细化。 一个 Context 的引用/选择不代表资源所属权迁移，也不等于执行绑定已经授权。API/AI、Connections、Permissions、Local/Environments 分别拥有自己的配置、操作、权限、资源和环境事实；Space 不复制第二份权威。

## 源码与状态（2026-11-08）

`space/src/index.ts` 导出 `openSpaceService`、SpaceService，以及 Category、Space、Group、Context、Address、Association、Tool、ContextView、投影等类型。具体业务校验、修订、持久化和恢复在 `src/service.ts`、`src/model.ts` 等已有文件中，测试在 `tests/`；不按名字预建额外状态中心。

| 能力 | 当前实现 | 待验证/补齐 |
|---|---|---|
| 组织结构和 Context ID | 已有实体、稳定身份、查询/修改端口 | 全部 UI 操作、损坏/并发/重启恢复 |
| 地址及引用 | 地址、Association、Tool 的部分服务已存在；普通 Association 只支持有限 AI/API 目标类型，工具引用与启用状态独立 | Context 内会话关联、有效配置解析、引用来源/可用/执行资格及完整桌面入口未贯通 |
| Category 可见性 | 已有准备/提交和恢复边界的撤权相关修复/测试提交（`3693a8ec`、`beea0ce2`、`c2e68469`） | 当前 SHA 同步回归、原回执/未授权落库防护 |
| Space 桌面展示 | 现有 Space 页面和资源预览/编辑入口 | 快速切换、迟到响应、权限变化与 Windows 验收 |

**版本修订（2026-11-09）**：0.1.1 已批准每个 Context 可选择一个主 AI 并进入一个可恢复的基础关联对话，用于 B2 基础链路验收；不依赖工作流。完整 Context 多会话组织、任意会话关联/解除、自动配置继承与多 AI 仍不在该最小闭环内。现有 Context 只存组织、地址、关联及 Tool 选择；桌面 Context 打开投影没有正式会话列表/关联操作。Context 需要能够组织和引用关联 Conversation，但会话本体、消息与生成仍归 Conversations。资源引用、配置选择、局部启用、目标实际可用、权限允许与实际执行是不同层次；Tool.enabled 不授予执行许可。原 0.1.1 的 B2-02/B2-04 只要求 Context 与 Agent/模型、资源/Connections 的基础关联及能力调用；完整 Context 内会话组织、列表/绑定/解除等操作在原计划中未明确规定版本。具体关联生命周期、默认与覆盖优先级仍需依据版本设计细化，不能擅自新增数据结构。

## 2026-11-09 桌面工具引用进展

[`5a77d192`](https://github.com/owla19s-ux/WEXPCeasy/commit/5a77d192bf8d0154ca5975c42ec7e8f42181090c) 已提交经授权发现工具并管理 Context 工具引用的桌面交互，相关差异涉及 `UI/src/context-tools.tsx`、`app/src/desktop-space.ts`、Connections 能力及测试。该证据仅说明代码/测试已提交，不等于 Space 所有引用关系或真实工具执行已通过；最新 main `a91aacf3` 的同 SHA CI、撤权/重启/失联验收仍待核。Space 仍只持引用，工具发现不授予执行权。

本版重点：复用现有 `AI:agent` Association 和 Context 稳定 ID，明确主 AI 的唯一有效选择与读取结果，并以受控、可持久关系关联基本 Conversation；不得复制消息、配置或权限数据。`Context.config` 当前要求空对象，**不得直接写入任意新键**；关联方式/持久边界须由本模块和 Conversations 的现有 Store 与公开接口共同确定，防止破坏旧数据。异常时保留旧关联并报告冲突/失权，避免自动转用其他 Agent。

## 调整与验收

当前 `context.edit` 主要修改名称与说明，`Context.config` 尚无完整公开编辑操作；Association/Tool 有既定目标类型限制，不得按“引用系统已实现”推断任意资源类型或配置已可用。类别按钮的排列属于 UI 责任，Space 不为该布局新建业务类别。


1. 先确认本域已有公开端口和模块测试，区分“引用”“配置选择”“执行绑定”，不因引用存在自动赋权。
2. 复验类别撤权、准备/提交/回执、跨 Context 可见性、失联目标、重启/冲突和旧结果隔离；必要修复限于负责 owner。
3. 与 AI、API、Conversations、Connections、Local、UI 组合时只通过公开端口。用户添加本地工具地址或参考目录不代表 Space 拥有 OS 执行或安装权。
4. 先查 [Actions 总运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 及被测 SHA，再记录验证结果。当前仅静态源码/提交证据，未独立签收。

施工路径：根 README → 本 README/CONTRACT → 本模块源码与测试；有明确争议时再查 A1/A2，不建立跨 A0/A1/A2 的额外索引。
