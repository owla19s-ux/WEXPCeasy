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

## 调整与验收

1. 先确认本域已有公开端口和模块测试，区分“引用”“配置选择”“执行绑定”，不因引用存在自动赋权。
2. 复验类别撤权、准备/提交/回执、跨 Context 可见性、失联目标、重启/冲突和旧结果隔离；必要修复限于负责 owner。
3. 与 AI、API、Conversations、Connections、Local、UI 组合时只通过公开端口。用户添加本地工具地址或参考目录不代表 Space 拥有 OS 执行或安装权。
4. 先查 [Actions 总运行集合](https://github.com/owla19s-ux/WEXPCeasy/actions/runs) 及被测 SHA，再记录验证结果。当前仅静态源码/提交证据，未独立签收。

施工路径：根 README → 本 README/CONTRACT → 本模块源码与测试；有明确争议时再查 A1/A2，不建立跨 A0/A1/A2 的额外索引。
