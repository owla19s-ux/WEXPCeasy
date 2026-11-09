# Space / Context｜组织、引用与配置选择

> Owner：`space/`，正式接口细则见 [CONTRACT](CONTRACT.md)，长期需求见 [A1](../docs/A1-正式产品设计/产品功能总表.md)，0.1.1 交付状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)。

## 职责与边界

Space 维护 Category、Space、Group、Context 的组织关系、稳定 ID、地址（本地/资料/产出等）、工具或配置的引用/选择以及可见投影。**Context ID 已有正式实现。不得恢复历史 Placement 实体。** 一个 Context 的引用/选择不代表资源所属权迁移，也不等于执行绑定已经授权。API/AI、Connections、Permissions、Local/Environments 分别拥有自己的配置、操作、权限、资源和环境事实；Space 不复制第二份权威。

## 源码与状态（2026-11-08）

`space/src/index.ts` 导出 `openSpaceService`、SpaceService，以及 Category、Space、Group、Context、Address、Association、Tool、ContextView、投影等类型。具体业务校验、修订、持久化和恢复在 `src/service.ts`、`src/model.ts` 等已有文件中，测试在 `tests/`；不按名字预建额外状态中心。

| 能力 | 当前实现 | 待验证/补齐 |
|---|---|---|
| 组织结构和 Context ID | 已有实体、稳定身份、查询/修改端口 | 全部 UI 操作、损坏/并发/重启恢复 |
| 地址及引用 | 已有地址、Association、Tool 等模型 | 引用目标失联、选择/绑定/使用边界及真实连接器组合 |
| Category 可见性 | 已有准备/提交和恢复边界的撤权相关修复/测试提交（`3693a8ec`、`beea0ce2`、`c2e68469`） | 当前 SHA 同步回归、原回执/未授权落库防护 |
| Space 桌面展示 | 现有 Space 页面和资源预览/编辑入口 | 快速切换、迟到响应、权限变化与 Windows 验收 |

## 2026-11-09 桌面工具引用进展

[`5a77d192`](https://github.com/owla19s-ux/WEXPCeasy/commit/5a77d192bf8d0154ca5975c42ec7e8f42181090c) 已提交经授权发现工具并管理 Context 工具引用的桌面交互，相关差异涉及 `UI/src/context-tools.tsx`、`app/src/desktop-space.ts`、Connections 能力及测试。该证据仅说明代码/测试已提交，不等于 Space 所有引用关系或真实工具执行已通过；最新 main `a91aacf3` 的同 SHA CI、撤权/重启/失联验收仍待核。Space 仍只持引用，工具发现不授予执行权。

## 调整与验收

1. 先确认本域已有公开端口和模块测试，区分“引用”“配置选择”“执行绑定”，不因引用存在自动赋权。
2. 复验类别撤权、准备/提交/回执、跨 Context 可见性、失联目标、重启/冲突和旧结果隔离；必要修复限于负责 owner。
3. 与 AI、API、Conversations、Connections、Local、UI 组合时只通过公开端口。用户添加本地工具地址或参考目录不代表 Space 拥有 OS 执行或安装权。
4. 先查 [Actions 总运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 及被测 SHA，再记录验证结果。当前仅静态源码/提交证据，未独立签收。

施工路径：根 README → 本 README/CONTRACT → 本模块源码与测试；有明确争议时再查 A1/A2，不建立跨 A0/A1/A2 的额外索引。

## 模板在 Context 内的归属（2026-11-09 用户确认）

**模板属于 Context 体系内的配置与组合能力，不规划为仓库顶层独立 Templates 业务模块。** Context 可通过模板组织和复用资源引用、工具/能力选择、视图配置及可选工作流关联；模板不是 Context 本体，也不拥有被引用目标的权威内容或执行状态。需要具体区分 Context 本体字段、模板配置和外部引用；模板实体/操作的完整接口、持久化字段和版本范围仍需依 A1 产品规格细化，不从本条自动推导新 API 或源码结构。历史 `templates/README.md` 不存在无需补建。

## 97 项对账｜Space/Context 操作与 UI 入口（2026-11-09）

- 对应第二批 F01 操作级检查点与 UIX-01/04：Category、Space、Group、Context 的创建/编辑、可选组织、地址 add/edit/remove/primary、Association add/replace/remove、Tool add/set/remove 由 `space/src/service.ts` 负责。工作目录登记不移动实体数据，Context ID 不随重命名改变。
- Context 的 config 字段不等于完整可编辑配置：当前 `context.edit` 只编辑名称/说明；目标 Association 目前仅支持部分 AI/API 类型和 Connections tool。Context 对 Agent/Role/Model 等是**引用/选择**，执行仍须独立授权。
- `UI/src/space.tsx` 的类别导航目前从 `data.categories` 逐项生成一般按钮，并非 A1 规定的三枚横排窄高分类按钮；这是 UI 容器设计缺口，Space 不应为了布局伪造新的业务 Category 实体。
- 对应 A1 UIX-13～17 的多视图/多层自由格子及 Context 内模板组合为长期方向；本 owner 负责 Context 内组合/引用事实及稳定身份，模板具体操作待细化，并不拥有外域资源本体，不占有视图坐标、画布关系、工作流依赖或另一份资源本体。
- 待核：Context.config 明确批准的字段与修改入口、引用失联与撤权投影、Group 跨 Space/删除/排序和完整 UI 生命周期；原历史 Placement 冻结，不能恢复。具体 F 编号/状态见 A2 四批清单及 UIX 对账。
