> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 07 — 护栏：CI、工具、脚手架与 AI 施工

> 规范靠自觉会失效。本文把“边界”变成可执行的检查，把“AI 施工”变成可重复的流程。

## 1. 护栏总览

```text
写代码前：脚手架 + 任务包 + 检查清单
写代码时：依赖注入 + 公开面最小 + 就近测试
提交时：arch-check + contract test + lint + 单测
合并后：依赖图快照 + 模块索引 + 指标统计
```

护栏的目标不是“卡人”，是**让违规在 30 秒内暴露**，而不是半年后才发现。

## 2. CI 流水线

### 2.1 阶段顺序

```text
1. format / lint
2. arch-check          ← 依赖方向、循环、业务词泄漏、module.toml 一致性
3. unit tests          ← 按模块并行
4. contract tests      ← 所有能力模块对同一契约
5. integration tests    ← 用 fake 组装，不依赖真实网络
6. build               ← Windows 目标；Tauri 打包可后置
7. docs check          ← 模块索引是否过期、MODULE.md 是否存在
```

### 2.2 快速失败原则

arch-check 必须在前：依赖错了，后面测试再绿也没有意义。

### 2.3 分模块并行

每个模块的测试独立跑，互不依赖；CI 按模块分 job，避免一个模块失败阻塞全部反馈。

## 3. 工具设计

### 3.1 `arch-check`

输入：

- `cargo metadata`
- `docs/architecture/dependency-allowlist.toml`
- 源码（扫描 `use` / `import`）
- 各模块 `module.toml`

输出：

- 违规列表（from → to、规则、位置、修复建议）
- 非零退出码

检查项：

| 检查 | 说明 |
|---|---|
| crate 依赖边 | 是否符合矩阵 |
| 循环依赖 | crate 图无环 |
| 跨模块内部 import | 禁止 `use <module>::` 内部路径 |
| 平台业务词 | `platform/` 不含模块业务词 |
| module.toml 一致性 | capabilities/dependencies 与代码一致 |
| 公开面 | `lib.rs` 未导出禁止项 |

### 3.2 `testkit`

给所有能力模块复用的契约测试库：

- 参数 schema 校验（必填、类型、边界）；
- 能力 ID 命名规范；
- 副作用/审批/幂等声明是否与执行行为一致；
- 回执形态是否符合 `EvidenceSpec`；
- 错误是否映射到统一分类；
- 结果未知是否进入 `OutcomeUnknown`；
- 不依赖真实网络/凭证。

模块只需要：

```rust
#[test]
fn contract() {
    testkit::assert_module(&GithubModule::descriptors());
}
```

### 3.3 `module-new`

脚手架命令，生成：

```text
modules/<name>/
├── MODULE.md
├── module.toml
├── src/lib.rs
├── src/capabilities.rs
├── src/config.rs
├── src/errors.rs
├── tests/contract.rs
└── docs/notes.md
```

同时：

- 在 workspace 中加入 crate（或自动 glob）；
- 在模块索引中登记（自动生成）；
- 生成一条空的 ADR 草稿（如果模块引入新依赖）。

目的：让“新增模块”是 1 条命令 + 填内容，而不是“复制一个模块再改”。

### 3.4 模块索引生成

`docs/modules/INDEX.md` 由 `module.toml` 自动生成：

| 模块 | 能力数 | 依赖 | owner | 成熟度 |
|---|---|---|---|---|

不手写，避免过期。

### 3.5 依赖图快照

每次合并生成 mermaid/文本依赖图，提交到 `docs/architecture/`。评审时看新增/删除的边。

## 4. AI 施工任务包

给一个 AI 分配模块任务时，任务包必须包含：

```markdown
## 任务
在 modules/github 中新增 github.issue.create 能力。

## 允许修改
- modules/github/**（你的模块）
- 如契约不足，先提 ADR，不要直接改 platform/contract

## 禁止修改
- platform/**、apps/**、其他 modules/**
- 不要改公共错误分类/账本/权限语义

## 契约版本
contract v0.1（见 platform/contract/src/lib.rs）

## 验证
- cargo test -p github
- cargo run -p xtask -- arch-check
- 契约测试必须通过

## 交付
- 改动文件列表
- 新增能力声明
- 测试证据（命令 + 结果）
- 未完成项
```

### 4.1 任务颗粒度

- 一个任务 = 一个模块内的一组相关能力；
- 不要给“把架构改成 X”这种跨模块大任务，除非同时给 ADR 和分步计划；
- 跨模块契约变更单独成任务，由 integrator/人负责。

### 4.2 AI 的“四问”

AI 在提交前必须回答：

1. 属于哪个模块？
2. 公开接口变没变？
3. 影响哪些模块/UI/数据？
4. 怎么验证？

答不出来，不提交。

## 5. 代码评审清单

### 5.1 边界

- [ ] 新代码是否在正确的模块？
- [ ] 是否新增了跨模块 import？
- [ ] 是否修改了 `platform/`？为什么？
- [ ] 是否修改了中央注册/组合根？是否必要？

### 5.2 契约

- [ ] 能力声明是否完整（参数/副作用/审批/幂等/证据）？
- [ ] 是否修改了契约？是否版本化？是否 ADR？
- [ ] 错误是否映射到统一分类？
- [ ] 结果未知是否处理？

### 5.3 安全

- [ ] 凭证是否只走 secrets/引用？
- [ ] 日志/事件/错误是否脱敏？
- [ ] 权限是否在执行点检查？
- [ ] 撤销后是否失效？

### 5.4 状态

- [ ] 是否有唯一写入口？
- [ ] 是否先记账再发请求？
- [ ] UI 是否只持展示/草稿？

### 5.5 测试

- [ ] 是否有契约测试？
- [ ] 是否可离线跑？
- [ ] 是否覆盖失败/未知/边界？
- [ ] `MODULE.md` 是否同步？

## 6. 指标

每月统计，趋势比单点重要：

| 指标 | 目标 |
|---|---|
| 新功能模块外改动文件数 | 中位数 ≤2 |
| 契约变更次数 | 稳定后 ≤1 次/月 |
| 跨模块内部 import 数 | 0（allowlist 除外） |
| 循环依赖数 | 0 |
| 模块删除后可编译 | 是 |
| 模块测试离线通过率 | 100% |
| 双写字段数 | 0 |

指标恶化时，先修边界，不要继续加功能。

## 7. 分支与合并

- 模块级任务在独立分支；
- 不同模块可并行；
- 契约变更分支优先合并，其他模块 rebase；
- 大范围重构必须 ADR + 分阶段；
- 合并前 arch-check 必须通过。

## 8. 文档同步检查

CI 检查：

- 每个 `modules/*` 是否有 `MODULE.md`；
- `module.toml` 的 capabilities 是否与代码声明一致；
- `docs/modules/INDEX.md` 是否过期；
- 契约版本变更是否带 changelog/ADR。

## 9. 安全护栏

- 密钥扫描（禁止提交 token/密钥）；
- 依赖许可证检查；
- 危险能力（进程/文件写/网络）默认审批；
- 平台权限与业务权限分开测试；
- 外部写入默认不自动重试。

## 10. AI 施工的长期维护

- 每个模块的 `MODULE.md` 是 AI 的第一入口；
- 模块内的 `docs/notes.md` 记录已知坑；
- ADR 记录跨模块决策；
- 指标看板展示边界健康度；
- 每季度做一次“删除实验”和“局部性实验”，防止架构腐化。
