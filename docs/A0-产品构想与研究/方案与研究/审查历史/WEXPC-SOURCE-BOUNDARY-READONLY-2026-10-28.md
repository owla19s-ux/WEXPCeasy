# WEXPC 实际源码边界审计（只读）— 2026-10-28

状态：静态源码定位；不覆盖或修改任何既有设计文档；不宣称编译、运行或 Windows 验证。

## 基线与证据
读取 owla19s-ux/wexpc 默认分支的以下真实文件：
- apps/desktop/src/App.tsx（172 行）
- apps/desktop/src-tauri/src/main.rs（637 行）
- apps/desktop/src-tauri/src/tool_catalog.rs（335 行）
- apps/desktop/src-tauri/src/tool_approvals.rs（1723 行）
- crates/wex-desktop-service/src/connectors/tool_round.rs（527 行）
- crates/wex-desktop-service/src/lib.rs（78 行）

设计依据：docs/WEXPC-MODULE-LOCALITY-DESIGN-V0.1.md 与 docs/WEXPC-RUNTIME-EXTENSION-CONTRACT-V0.1.md（WEXPC1）；仅对照，不修改。

## 发现

### 1. 前端 App.tsx 已是共享协调入口，不应整文件机械拆散
- 目前集中维护 Snapshot 新鲜度/refresh generation、页面路由、项目/会话选择、草稿、预览、恢复状态。
- 具体页面已经在 Connections、Projects、Chat、Organization、Settings 等文件。
- 迁移时应保留唯一共享快照一致性 owner；逐页抽离局部状态和命令，不复制 refresh 逻辑。

### 2. Tauri main.rs 仍有大量显式 command 接线
- 包含空间、上下文、项目、会话等 Tauri command；属于宿主入口的候选归位点。
- 不能因“中央文件大”就断言全部是错误业务逻辑；需要将命令薄桥接与业务判断分别标注。
- 动态扩展不能依赖每新增协议都在 main.rs 添加手写分支。

### 3. tool_catalog.rs 有明确的静态内置能力表
- 发现 BUILTIN_COMMANDS、GITHUB_CAPABILITIES、append_local_capabilities、append_host_commands、append_github_capabilities 等。
- 现有声明能区分“发现”与“授权”；包含重复名/schema 测试、GitHub policy 状态测试。
- 与动态扩展目标的差距是注册来源仍偏静态：需验证按 provider 提供声明、统一目录汇总与生命周期撤销，而不是删除已通过的权限测试。

### 4. tool_approvals.rs 是最明显的职责汇聚点
- 1723 行，包含模型工具回合接线、预检、原生批准、本地文件、终端/进程、Git/GitHub 调用、回执结算等。
- 这是后续按功能归位的重点；先画清 Host approval、execution operation、connector dispatch 三层，不直接拆代码。
- 目前已有 begin_approved_dispatch、策略接口和结果处理，不能假设安全机制缺失；拆分需保留原有边界与测试。

### 5. tool_round.rs 已经有独立的工具回合与 checkpoint
- 模型结果在 Host 批准前不执行；存在 pending checkpoint、工具回合上限、恢复历史不重派发、网络无关测试。
- 这部分值得保留并封装，不应因为参考 DSH 再重造一个工具流水线。
- 重点核验持久化失败、外部副作用未知、回执恢复和跨模块 API 的实际行为。

### 6. wex-desktop-service/lib.rs 有较宽的公开导出面
- 当前导出 Git、GitHub、本地、进程、终端、工具回合、日志/检查点等众多函数。
- 风险不是“导出多就错误”，而是 Host 可能直接依赖连接器内部函数，未来拆分功能时影响面扩大。
- 候选：稳定公开 Facade/trait/command 接口与内部实现分离；先列消费者，再收窄导出，避免破坏既有测试。

## 初步对照 DSH

| DSH 机制 | WEX 已存在 | 尚未验证的差距 |
|---|---|---|
| 能力目录 | 静态目录与 schema/policy 测试 | 动态注册、代次、撤销 |
| 工具流水线 | 工具回合、预检、批准、checkpoint | 统一扩展调用边界、跨模块解耦 |
| Session 恢复 | pending checkpoint 与恢复历史 | durable flush/崩溃矩阵 |
| 插件 HMR | 当前设计文档有目标 | 源码无已验证的未知扩展加载闭环 |
| UI 插槽 | 独立页面组件 | 插件贡献设置面板的运行时注册 |
| Host/Client | Tauri commands | 可扩展类型化接口、版本兼容与通知可靠性 |

## 施工顺序建议（需单独执行，不是本次修改）
1. 为 tool_approvals.rs 画函数→职责→调用关系，标出能直接保留的可信边界。
2. 以 tool_catalog.rs 做可插拔 Provider 注册最小试验，保留原静态提供者为兼容适配。
3. App.tsx 只抽离真正局部状态，保留 Snapshot owner；先验证行为不变。
4. 将新增扩展的模型协议 + 设置面板作为首个真正运行时试点。
5. 对 checkpoint、撤权、在途停止和旧回执做失败注入测试。

注意：当前仅静态阅读，未执行任何测试、构建或 Actions。旧文档与现有设计均保持原样。
