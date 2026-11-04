> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 04 — 依赖规则与自动检查

> 目录只是边界的外形，依赖才是边界的实质。本文规定谁能依赖谁、通过什么方式通信、以及如何用工具强制执行。

## 1. 依赖分层

```text
apps/desktop ────────────────► 所有模块、平台机制
apps/ui（隔离）  ────────────► 只能通过 IPC/生成的 client

modules/* ───────────────────► platform/contract
       └─────────────────────► platform/host 的 trait（不是实现）
       └─────────────────────► platform/secrets 的 trait（不是实现）

platform/* ──────────────────► platform/contract
platform/* ──────────────────► 通用基础库（serde、thiserror、sqlite、tokio 等）

platform/contract ───────────► 最小基础库（serde、thiserror）
```

## 2. 依赖矩阵

| 从 \ 到 | contract | platform | modules | apps | tools |
|---|---|---|---|---|---|
| contract | — | 禁止 | 禁止 | 禁止 | 禁止 |
| platform | 允许 | 同级允许（谨慎） | **禁止** | 禁止 | 禁止 |
| modules | 允许 | 允许（trait） | **禁止**（除契约 DTO） | 禁止 | 禁止 |
| apps | 允许 | 允许 | 允许 | 允许（apps 内部） | 禁止 |
| tools | 允许（读） | 允许（读） | 允许（读） | 允许（读） | 允许 |

### 2.1 `platform` 同级依赖

允许，但要谨慎：

- 允许单向：`invoke → policy → contract`；
- 禁止循环：`policy → invoke → policy`；
- 依赖图必须无环。

### 2.2 `modules` 之间

**默认禁止任何直接依赖。** 例外只有一种：共享只读 DTO，且该 DTO 已上移到 `platform/contract`。

如果两个模块确实需要协作，正确做法是：

1. 通过能力 ID 调用（一个模块调用另一个模块提供的能力）；
2. 通过事件；
3. 把共性上移到公共机制。

不允许“我们关系近，直接 import 一下”。

### 2.3 `apps` 内部

- `apps/desktop` 可以依赖所有；
- `apps/ui` 不依赖 Rust crate，只依赖生成的 TS 类型/client；
- `apps/ui` 的 feature 之间不应互相 import 内部实现；共享放 `shared/`。

## 3. 模块间通信方式

### 3.1 能力调用

```text
调用方构建 Invocation
  → Invoker.invoke(invocation)
    → 解析能力 → 权限 → 记账 → 分发 → 回执
```

调用方不需要知道提供者是谁；只依赖能力 ID。这样替换实现不需要改调用方。

### 3.2 事件

```text
模块 emit(DomainEvent { topic, payload, version })
  → 事件总线
    → UI 订阅、其他服务订阅
```

事件是“已发生的事实”，不是命令。不要在事件处理器里做会反向修改模块内部状态的隐式操作。

### 3.3 共享只读 DTO

如果两个模块需要交换数据，且不是调用关系，把 DTO 上移到 `platform/contract`，双方只依赖契约。**不要直接依赖对方的类型。**

### 3.4 禁止的通信

- 直接函数调用另一个模块的 action；
- 读另一个模块的数据库/文件；
- 通过全局单例获取另一个模块的实例；
- 通过 UI 状态中转业务数据。

## 4. 组合根

组合根是**唯一**允许知道“全部模块有哪些”的地方。

### 4.1 职责

- 构造平台实现（store、secrets、host）；
- 构造模块（注入依赖）；
- 注册能力；
- 构造应用服务；
- 暴露 IPC；
- 管理启动/关闭顺序。

### 4.2 禁止

- 业务规则；
- 权限判断；
- 数据转换以外的业务处理；
- 在 command 里写 if/else 分支处理具体模块。

### 4.3 规模控制

组合根应当只有“装配代码”。如果组合根超过几百行，通常说明：

- 有业务逻辑漏进来了；
- 或者模块初始化太复杂，需要拆生命周期；
- 或者注册方式太手工，应该改为分布式注册。

## 5. 循环依赖

禁止。出现循环依赖时，按以下顺序处理：

1. 是否有一方其实只是用了一个 DTO？→ 上移契约；
2. 是否有一方在“通知”另一方？→ 改事件；
3. 是否有一方在“调用能力”？→ 改 Invoker + 能力 ID；
4. 是否职责划分错了？→ 重新切模块；
5. 以上都不行 → 写 ADR，说明为什么必须循环，以及如何隔离（例如引入第三个小模块）。

不允许用“把类型塞进 common”来掩盖循环。

## 6. 自动检查（arch-check）

### 6.1 检查什么

1. **crate 依赖边**：读 `cargo metadata`，校验矩阵。
2. **use 语句**：扫描源码，禁止 `use modules::<other>::` 内部路径。
3. **业务词泄漏**：扫描 `platform/`，禁止出现模块业务词（可配置词表）。
4. **循环依赖**：对 crate 图做环检测。
5. **module.toml 一致性**：声明的 capabilities / dependencies 与代码/依赖图一致。
6. **公开面**：检查 `lib.rs` 是否导出了禁止的模块。

### 6.2 实现建议

用 Rust 写 `tools/arch-check`：

```text
cargo metadata --format-version 1
  → 构建 crate 依赖图
  → 与 docs/architecture/dependency-allowlist.toml 比对
  → 违规输出：from → to, 规则, 修复建议
  → 非零退出码
```

allowlist 示例：

```toml
[[allow]]
from = "modules/github"
to = ["platform/contract", "platform/host", "platform/secrets"]

[[deny]]
from = "platform/*"
to = ["modules/*"]

[[deny]]
from = "modules/*"
to = ["modules/*"]   # 除 contract DTO 外
```

### 6.3 CI 位置

```text
lint → arch-check → unit tests → contract tests → integration tests → build
```

arch-check 放在最前面：依赖错了，后面的测试再绿也没有意义。

## 7. 例外流程

任何违反依赖规则的情况，必须：

1. 写 ADR：问题、为什么现有规则不适用、替代方案、影响面、退出条件；
2. 在 allowlist 中显式登记（不能隐式绕过）；
3. 设定复查时间/触发条件。

**没有 ADR 的例外 = 违规。**

## 8. 新增依赖的决策清单

引入一个新 crate/模块依赖前，回答：

- 它属于哪个模块/机制？
- 是运行时依赖还是测试依赖？
- 是否引入了新的平台绑定？
- 许可证是否可接受？
- 是否能用现有机制替代？
- 是否会影响编译时间/包体积？
- 是否需要安全审查（网络、加密、进程）？

## 9. 依赖图作为架构快照

每次合并后生成 `docs/architecture/dependency-graph.md`（或 mermaid），提交到仓库。

用途：

- 评审时看边界是否被破坏；
- AI 施工前了解影响面；
- 发现“悄悄新增的边”。

依赖图变化必须与代码变更一起评审；不允许“图过期”。

## 10. 常见违规与修复

| 违规 | 症状 | 修复 |
|---|---|---|
| module → module | `use github::...` 出现在 ai-api | 改为能力调用或上移 DTO |
| platform → module | policy 里 `match ConnectorKind::Github` | 改为规则注册，模块提供规则 |
| UI → module 内部 | React 直接 import 生成的 Rust 类型（非契约） | 只用生成的 IPC 类型 |
| 循环依赖 | A 调 B，B 调 A | 事件/契约/重新切分 |
| 中央注册表 | 新增模块要改 `registry.rs` 的 match | 分布式注册 + 启动校验 |
