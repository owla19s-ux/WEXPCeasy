# DSH → WEXPC1 架构差异与验证矩阵 V0.1

日期：2026-10-28。状态：研究审计／候选改进，非冻结施工令。

## 审计基线
- 当前设计：docs/WEXPC-MODULE-LOCALITY-DESIGN-V0.1.md
- 当前扩展契约：docs/WEXPC-RUNTIME-EXTENSION-CONTRACT-V0.1.md
- DSH 研究：references/dsh/01—15
- 旧资料仅作历史参考；不能以旧依赖矩阵覆盖当前功能聚合设计。
- 这是文档对照；没有运行 WEXPC 构建、端到端热加载或真实连接测试。不能把“设计已有”写成“实现通过”。

## 逐项矩阵

| 参考机制 | WEXPC1 现状（文档） | 差异 / 风险 | 建议动作 |
|---|---|---|---|
| 按功能聚合、模块局部维护 | 已有候选目录与 MODULE.md 要求 | 缺真实 crate/前端映射与变更局部性验证 | 先做真实调用链归位表 |
| Manifest / 依赖预检 | 扩展契约已有字段与检查流程 | 字段格式、注册一致性、机器检查未定 | 最小试点确定 manifest + checker |
| 动态 Loader / HMR | 已确认运行时扩展目标、生命周期候选 | 未选运行机制，未验证不退出宿主可加载后端代码 | 做未知协议+面板最小端到端原型 |
| UI 插槽 / 配置表单 | 已有 connection.settings 等候选 | 配置 schema、修订冲突、表单回退和草稿保护待定 | 先验证设置插槽和修订冲突 |
| 稳定身份 | package/instance/connection/capability/activation 已区分 | 缺跨升级/卸载/重新激活的引用规则 | 用旧回执与配置迁移用例校验 |
| 能力解析 / 执行边界 | 注册与 execution owner 已描述 | 具体接口、撤权与在途重载组合尚未验证 | 契约测试：拒绝新调用、旧请求结算 |
| Task / Dispatcher / Operation | work/dispatcher/execution owner 已提出 | 三类 attempt 的 ID、状态转移、失败责任需细化 | 写单条链路状态表而非再建总状态机 |
| Agent / Conversation | 独立身份与普通对话已明确 | Loop 的唯一 owner、外部 Agent continuation 差异未定 | 明确 native loop 和外部 provider 边界 |
| 持久化 / flush | 设计要求回执与历史保留 | 缺确认落盘、重启恢复、部分副作用未知的试点证据 | 设计最小 crash matrix，验证再声称可靠 |
| Host/Client API | UI 走受控客户端的目标明确 | 类型生成、事件可靠性、断线重连与版本兼容未定 | 先规定查询/命令/通知不同语义 |
| 配置 / 凭证 | 明确秘密值与普通配置分离 | 热轮换、来源、凭证重配和并发编辑待验证 | 最小 CredentialRef + revision 语义 |
| Session / Context | 反对所有状态塞入 Session；分 owner | Context 长期摘要、原始记录追溯仍是研究方向 | 暂不冻结统一事件库 |
| 依赖机器门禁 | MODULE.md、检查目标已列出 | 未建立新规则的机器执行证据 | 按实际目录做依赖图检查原型 |
| 插件信任/隔离 | 不把 UI/插件当安全边界 | 高级隔离与复杂主体不在当前必做范围 | 保留可扩展接口，暂不造重型权限系统 |

## 三项最紧迫的结构性问题

1. **接口与目录映射未验证**：目录聚合不等于调用依赖解耦。需基于 WEXPC 当前真实源码检查 App.tsx、application/mod.rs、tool_round、tool_catalog、tool_approvals 等中央汇聚点。
2. **动态扩展只是目标**：未知后端协议+UI 同包运行时装载、在途操作排空、失败回滚都还没有端到端证据。必须明确设计状态和实现状态。
3. **状态所有权与恢复交叉点**：Task 正式状态、Dispatcher 投递状态、Execution 操作回执、Session 生成历史之间要有明确引用和 durable checkpoint，不可让 UI 或模板维护副本。

## 建议施工验证顺序（不改变产品版本范围）

A. 当前仓真实源码调用链/依赖扫描 → 标注模块边界与允许依赖。
B. 最小运行时扩展试点：未知协议+connection.settings 面板；不重建宿主；完整激活/停用。
C. 单条“任务→派发→执行→回执→恢复”链路契约与故障注入。
D. 将 A—C 的稳定约束转为自动化 arch-check、manifest-check、contract tests。
E. 逐项决定哪些纳入 0.1.1，哪些仅保留扩展接口；未经用户确认不调整版本范围。

## 防止照搬

- DSH 是参考实现，不是 WEX 目录与技术栈的权威。
- 功能模块内部可以依赖合法实现库；不能机械禁止一切跨模块公开接口。
- 模块声明、能力可用、权限已批准、操作成功是不同事实。
- UI 的刷新不能替代后端动态加载；HMR 不能保证副作用回滚。
- 当前安全以必要边界和扩展接口为主，不启动复杂组织多租户体系。
