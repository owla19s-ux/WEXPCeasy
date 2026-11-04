> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 01 — 仓库目录结构与调整方案

> 目录是架构推导的结果，不是研究的起点。本文给出候选结构、每一层的存在理由、单模块内部模板、何时增删目录，以及首版最小形态。
>
> **V0.2 定位修订**：本文目录是**目标参考形态**，不是施工顺序。WEXPC 主仓已采用“职责模块是逻辑边界，不要求一模块一 crate、进程、数据库或网络服务”的轻量路线。差异审计完成前，不得按本文搬迁主仓目录；先做映射与适配，目录最后动。
>
> **逻辑边界 ≠ 物理 crate**：一个模块可以先存在于现有 crate 的子模块中，等拆分收益被验证后再物理独立。目录是结果，不是施工起点。

## 1. 调整原则

### 1.1 一级目录按“职责性质”分，不按技术名词分

技术名词（网络、认证、存储、执行、日志、权限）不能成为一级目录。原因很简单：GitHub 同时需要网络、认证、存储、执行、日志、权限，一旦按技术分，GitHub 就被拆散了。

一级目录只允许出现**依赖方向不同**或**维护责任人不同**的类别。

### 1.2 每个目录必须有存在理由

新增一级目录前，必须回答：

- 它的依赖方向是否与其他目录不同？
- 它的维护责任人/AI 是否与其他目录不同？
- 它是否包含一组会一起演化的东西？
- 删掉它，其他目录会不会变得混乱？

答不出来，就不要建。**不建空壳目录来证明架构存在。**

### 1.3 目录深度跟随复杂度

不是每个模块都要有“公共层/内部层/子模块”。GitHub 复杂，可以内部再分 `api/`、`actions/`、`auth/`；本地文件模块可能只有 `src/fs.rs`。**模块内部组织由它自己的复杂度决定，不搞机械递归。**

### 1.4 目录名用职责名，不用框架名/产品名

- 可以：`modules/github`、`platform/ledger`、`apps/desktop`
- 不可以：`modules/software-dev`（这是工作流/UI 分类）、`platform/core`（“core”没有说明职责）、`modules/connectors`（分类不是维护单元）

### 1.5 测试、文档、迁移跟着模块走

模块的测试、说明、数据迁移、fixture 放在模块目录内或紧邻位置，不集中到远处的 `tests/`、`docs/`、`migrations/` 大目录。**这是 AI 能独立维护模块的前提。**

## 2. 顶层骨架（候选）

```text
repo/
├── apps/                     # 可交付程序：只做装配、IPC、生命周期
│   ├── desktop/              # Tauri 宿主 = 组合根
│   └── ui/                   # React 前端 = 交互集合
│
├── modules/                  # 第一方完整功能模块：一个目录 = 一个维护单元
│   ├── github/               # 连接器：认证适配/API/操作/转换/错误/测试/说明
│   ├── ai-api/               # 模型服务商连接
│   ├── local-files/          # 本地文件能力
│   ├── terminal/             # 本地进程/终端能力
│   ├── git/                  # 本地 Git 能力
│   ├── workspace/            # Space/Context/对象/关系/布局
│   ├── agents/               # 角色/Agent/会话/职责分配
│   ├── workflows/            # 工作流模板定义/校验/运行
│   ├── tasks/                # 项目/任务/状态
│   └── records/              # 记录/决策/证据引用
│
├── platform/                 # 公共机制：多模块共享且必须语义一致
│   ├── contract/             # 稳定契约：ID/能力描述/调用/回执/事件/错误
│   ├── registry/             # 能力注册与发现
│   ├── invoke/               # 单次调用管线
│   ├── policy/               # 权限判定组合
│   ├── ledger/               # 操作/回执/证据追加记录
│   ├── store/                # 持久化/事务/迁移框架
│   ├── secrets/              # 凭证存取
│   ├── events/               # 事件总线
│   └── host/                 # 平台适配（Windows 文件/进程/凭证/通知）
│
├── tools/                    # 架构护栏：检查/脚手架/契约测试
│   ├── arch-check/           # 依赖方向检查
│   ├── module-new/           # 新模块脚手架
│   └── testkit/              # 模块一致性测试套件
│
└── docs/                     # 架构说明/ADR/自动生成的模块索引
    ├── architecture/
    ├── adr/
    └── modules/INDEX.md      # 自动生成，不手写
```

## 3. 每一层为什么存在

### 3.1 `apps/` —— 可交付程序

**职责**：把模块装配起来，暴露 IPC，管理窗口/生命周期/启动顺序。

**为什么单独**：它依赖所有模块，但不被任何模块依赖，是依赖图的叶子。它是唯一允许知道“全部模块有哪些”的地方。

**禁止**：在 apps 里写业务规则、在 Tauri command 里写 if/else 业务、在 React 页面里直接调模块内部 API。

### 3.2 `modules/` —— 完整功能模块

**职责**：一个模块拥有一个完整功能的全部实现：配置、认证适配、协议调用、参数转换、错误映射、状态、测试、说明。

**为什么平铺**：模块之间是并列维护单元，不需要再套 `connectors/`、`domains/` 之类的分类。分类是 UI 和文档的事。**多一层分类，就多一次“这个模块算哪类”的争论。**

**禁止**：模块直接 import 另一个模块的内部实现；模块自己发明权限；模块自己实现公共安全语义。

### 3.3 `platform/` —— 公共机制

**职责**：只做“多个模块共享、且必须语义一致”的东西。

**为什么单独**：这些机制的依赖方向特殊——它们不能依赖任何业务模块，否则就会知道业务；而业务模块只依赖它们的接口，不依赖具体实现。

**禁止**：平台机制里出现具体模块的业务词；平台机制替业务做决定。

### 3.4 `tools/` —— 架构护栏

**职责**：把规范变成可执行检查：依赖图、契约测试、脚手架、模块索引。

**为什么需要**：文档拦不住长期施工，工具可以。没有 arch-check，半年后一定有人为了方便直接跨模块 import。

### 3.5 `docs/` —— 架构说明与决策

**职责**：总览、ADR、术语、自动生成的模块索引。

**规则**：模块自己的 `MODULE.md` 放在模块目录内，不集中在 docs；docs 只放跨模块的内容。

## 4. 单模块内部模板

所有模块共享同一套“入口”，内部自由。

```text
modules/github/
├── MODULE.md              # 人/AI 的唯一入口（必填）
├── module.toml            # 机器可读元数据（必填）
├── src/
│   ├── lib.rs             # 唯一公开面：构造模块、注册能力
│   ├── capabilities.rs    # 能力声明：动作/参数/副作用/审批/超时/证据
│   ├── config.rs          # 本模块配置与校验
│   ├── auth.rs            # 本模块认证适配（如需要）
│   ├── api/               # 私有：协议客户端/分页/限流（如需要）
│   ├── actions/           # 私有：具体操作，一操作一文件（如需要）
│   └── errors.rs          # 外部错误 → 统一错误分类
├── tests/
│   ├── contract.rs        # 用 testkit 跑能力契约
│   ├── actions_*.rs
│   └── fixtures/          # 录制回放
└── docs/
    └── notes.md           # 已知限制、变更注意事项
```

### 4.1 文件职责

| 路径 | 职责 | 是否公开 |
|---|---|---|
| `MODULE.md` | 职责/非职责/公开能力/依赖/数据/测试/修改规则 | 是 |
| `module.toml` | id、版本、依赖、能力清单、owner | 是 |
| `lib.rs` | 构造 + 注册；只导出公开面 | 是 |
| `capabilities.rs` | 能力描述（数据） | 是（经注册） |
| `config.rs` | 配置 schema 与校验 | 是（经公开面） |
| `auth.rs` | 认证适配 | 否 |
| `api/` | 协议细节 | 否 |
| `actions/` | 具体操作 | 否 |
| `errors.rs` | 错误映射 | 否（输出统一错误类型） |
| `tests/` | 契约/单元/回放 | 否 |

### 4.2 公开面规则

`lib.rs` 只允许导出：

- `pub struct XxxModule`（或等价构造入口）
- `pub fn register(registry: &mut Registry)`
- `pub fn descriptor() -> ...`（如果模块只需要声明）
- 该模块的配置类型（谨慎，尽量用通用配置 + 模块私有解析）

其他一律 `pub(crate)` 或私有。**公开面不是“我觉得可能会用”，是“组合根/平台契约确实需要”。**

## 5. `platform/` 内部结构

```text
platform/
├── contract/
│   └── src/
│       ├── ids.rs             # 稳定 ID 类型
│       ├── capability.rs      # 能力描述
│       ├── invocation.rs      # 调用信封
│       ├── decision.rs        # 权限判定
│       ├── receipt.rs         # 回执/证据
│       ├── event.rs           # 事件
│       └── error.rs           # 统一错误分类
├── registry/                  # 能力注册/查询
├── invoke/                    # 调用管线
├── policy/                    # 判定组合 + 规则接口
├── ledger/                    # 账本
├── store/                     # 持久化/迁移
├── secrets/                   # 凭证
├── events/                    # 事件总线
└── host/                      # 平台 trait + Windows 实现
```

每个机制目录内部同样遵守“公开面最小、内部私有、测试就近”。

## 6. `apps/` 内部结构

### 6.1 `apps/desktop/`（Tauri 宿主）

```text
apps/desktop/
├── src/
│   ├── main.rs            # 启动
│   ├── composition.rs     # 组合根：装配服务、注册模块
│   ├── ipc/               # 按领域分组的薄 command/event
│   ├── lifecycle.rs       # 启动/退出/恢复
│   └── state.rs           # 应用级依赖容器（不是业务状态）
├── capabilities/          # Tauri OS 权限配置
└── tauri.conf.json
```

规则：

- `composition.rs` 是唯一知道全部模块的地方；新增模块最多改这里一行（或用分布式注册后零改动）。
- `ipc/` 每个 command 只做：校验输入 → 调用服务 → 转换 DTO。不写业务分支。
- 大对象不要整图 IPC；传 ID + 查询参数，或分批/分页。

### 6.2 `apps/ui/`（React）

```text
apps/ui/
├── src/
│   ├── app/               # shell/路由/providers/错误边界
│   ├── features/          # 交互集合
│   │   ├── workspace/
│   │   ├── conversation/
│   │   ├── workflow/
│   │   ├── canvas/
│   │   ├── agents/
│   │   ├── tasks/
│   │   ├── connectors/
│   │   ├── activity/
│   │   └── settings/
│   └── shared/            # ui-kit、生成的 IPC client、i18n、hooks
└── tests/e2e/
```

规则：

- `features/` 是 UI 分类，不是底层分类；一个 feature 可以消费多个模块的能力。
- UI 不直接 import Rust 类型，只使用从契约生成的 TS 类型/client。
- UI 只持展示状态、选择状态、未提交草稿；持久业务状态由后端写。
- 工具列表、能力可用性、配置表单尽量由能力声明驱动，减少手写第二份清单。

## 7. 依赖方向（目录级）

```text
platform/contract   ←   platform/*   ←   apps/*
        ↑                    ↑
     modules/* ──────────────┘
        │
        └── 只依赖 contract 与 platform/host 的 trait
```

规则详见 `04-dependency-rules.md`，这里只给目录级结论：

- `modules` 不能 import 另一个 `modules` 的内部实现。
- `platform` 不能 import 任何 `modules`。
- `apps` 可以依赖全部，但不能被依赖。
- `tools` 可以读所有代码做检查，但不进入产品依赖图。

## 8. 何时新增/合并/删除目录

### 8.1 新增一级目录的条件

同时满足两条以上：

1. 依赖方向与其他目录不同；
2. 有独立的长期维护责任人/AI；
3. 内部会一起演化，对外边界稳定；
4. 不单独放会导致其他目录职责混乱。

### 8.2 合并目录的条件

- 两个目录的依赖方向相同；
- 没有独立负责人；
- 分离后每次改动都要跨两个目录；
- 其中一个目录长期没有内容。

### 8.3 删除目录的条件

- 目录内只剩空壳或转发；
- 职责已被其他目录吸收；
- 没有测试、没有文档、没有消费者。

**不要为了让目录“整齐”而保留空目录。**

## 9. 首版最小形态

目标形态不是第一天就要全部建出来。首版可以合并为：

```text
apps/desktop
apps/ui
platform/contract
platform/{host, store, secrets, invoke, policy, ledger}
modules/{workspace, ai-api, github, local-files, terminal, git}
modules/agent-runtime        # 可先并入 apps/desktop 的服务层
tools/{arch-check, testkit}
docs/
```

暂时不建：`registry`（先作为 invoke 内部静态表）、`events`（先用回调）、`workflows`（先做模板读取 + 手动执行）、`records`（先只记 operation/receipt）、`tasks`（先并入 workspace）。

**每一条“暂不建”都要写恢复触发条件**，例如“当出现第二个工作流模式时，把 workflows 独立成模块”。否则会永久欠账。

## 10. 与“技术分层目录”的对照

| 技术分层目录 | 本方案 | 原因 |
|---|---|---|
| `core/` | 拆到 `modules/*` + `platform/*` | “core”会吸业务，且职责不清 |
| `services/` | `apps/desktop` 的编排 + `modules/*` 内部 | 服务层容易变成第二套业务 |
| `adapters/` | 各模块内部 + `platform/host` | 适配是模块的一部分，不是独立层 |
| `network/` | 各连接器内部 | 网络不是业务共性，是模块实现细节 |
| `auth/` | `platform/secrets` + 各模块 `auth.rs` | 凭证存取是共性；认证协议是模块专属 |
| `storage/` | `platform/store` + 模块数据 | 事务/迁移是共性；表结构是模块专属 |
| `ui/` | `apps/ui/features` | UI 按交互集合，不按后端模块 |

## 11. 常见误用

- 把 `modules/connectors/` 再套一层：分类不是维护单元，平铺即可。
- 把 `platform` 做成“什么都往里放”的新 core：平台只放多模块共享且语义一致的机制。
- 给每个模块再建 `common/`、`internal/`、`submodules/`：机械递归。
- 按 UI 页面建模块：`modules/software-dev/` 是典型错误。
- 建空目录占位：架构不是靠目录存在证明的。
