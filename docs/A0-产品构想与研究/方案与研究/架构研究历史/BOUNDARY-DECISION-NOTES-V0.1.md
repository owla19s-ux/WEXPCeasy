# 三项关键边界：源码证据与收敛建议

日期：2026-10-29。状态：候选取舍，不是正式 ADR 或施工命令。
承接：[全局契约地图](GLOBAL-CONTRACT-MAP-V0.1.md)。
本次只读 WEXPC，更新 WEXPC1；没有运行测试、调用模型或修改产品代码。证据基线：faf11f31d44e4fc4788e766074b8db6b83ab4a1b。

## 1. 结论先行

建议用以下三项作为下一轮验证的基准，而非继续平行扩展所有可能方案：

1. 模型调用生命周期归 API 功能域的公共调用服务；会话负责上下文与消息，工作循环负责多回合，工具执行继续走受控执行服务。
2. 关系按业务含义确定唯一维护方，不按“所有关系都是边”集中成全知关系模块。
3. 软件开发模板的首个实例化流程以纯本地数据提交为边界；能共享一个受控事务时原子提交，外部操作后续单独授权执行。

三项均可因试点证据修正。它们没有选定插件语言、进程方案或物理目录。

## 2. 模型调用：实际链路与问题

### 源码证据

- [Tauri main.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/apps/desktop/src-tauri/src/main.rs)：send_message 先 prepare_chat，再释放锁进行网络工作；流式走 execute_chat_stream_with_progress，非流式走 tool_approvals::run_non_streaming，最后 settle_chat_result。这里含绑定检查、凭证读取、事件发送和结算编排，已经超出单纯参数转发。
- [application/mod.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/application/mod.rs)：prepare_chat 解析连接、阻止同一会话并发生成、组装 Context／成员资料和历史，并登记 Running；persist_result 保存失败时保留待保存结果，retry_chat_result 只重试落盘；settle 拒绝覆盖已结束的回合。
- [tool_round.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/connectors/tool_round.rs)：execute_model_step 直接调用 openai_compatible::protocol_request，使用 HTTP 和 choices／finish_reason 解析；同文件还含厂商无关的多回合预算、工具结果拼接、重复调用 ID 检查和检查点驱动。
- [operation.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-core/src/operation.rs)：OperationLedger 面向 Read／Write、精确意图审批、持久化前置和证据结算；cancel_unstarted 只取消未开始操作。它是纯生命周期逻辑，不是现成模型流服务。

因此：当前链路已有防重结算和恢复保护，但通用循环与具体协议耦合。现有 OperationLedger 不直接等价于生成运行时，不能仅因两者都“执行”就机械合并。

### 推荐边界

| 责任 | 候选归属 | 对外语义 |
|---|---|---|
| 选取会话历史、组织输入、保存用户及助手消息 | 会话 | 准备一个回合、接收该回合结果 |
| 固定连接／模型／配置与实现代次，管理单次生成进度、取消及结束 | API 公共调用服务 | 开始生成、观察进度、请求取消、查询结果 |
| 厂商编码、网络协议交互和解码 | 协议适配器 | 将请求转换为厂商交互，报告标准化事实 |
| 消费工具意图、限制回合、形成后续输入 | 工作循环 | 组织多个生成与工具步骤 |
| 授权与真实工具操作、证据结算 | 权限＋执行服务 | 执行经核验的操作并返回可信结果 |
| 桌面通信和平台接线 | Tauri 装配 | 调用公开服务、转发事件，不维护厂商分支 |

“API 公共调用服务”是 API 模块内部职责，不要求新增顶层平台或独立进程。凭证和受控网络方式仍随运行方案验证，表格不授予插件任意联网或读取秘密的权利。

### 不制造第二份真相

一次对话回合可能包含多次模型生成和多个工具操作。建议分别关联：
- 会话回合：用户此次交互及最终回复。
- 模型生成：一次具体模型请求及观察结果。
- 工具操作：一次真实工具执行及证据。

它们不是复制同一条 running 记录。UI 可以投影汇总，但不能任选一个状态覆盖另外两个。新调用服务上线前需要明确旧 ChatTurn.status 的迁移／派生规则，不能保留两套都能随意写的调用状态。

### 验证门槛

同一模拟适配器同时服务普通会话与工作循环；更换协议不改循环和聊天页；一回合两次生成仍只有一个回合记录；保存失败只补保存；取消与完成竞争不重复结算；旧代次事件不能污染新调用。

不能丢掉的现有保护：先持久记录再派发、恢复历史工具回执不重新执行、检查点失败停止推进、完整回复可本地恢复。以上为源码机制，非本次运行通过声明。

## 3. 跨领域引用：先按语义分配

### 源码证据

[domain/organization.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/domain/organization.rs) 已将 Context 与 ContextPlacement 分开，Context.resources 目前是字符串列表。

[application/organization.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/application/organization.rs) 中 move_context 修改位置；bind_project_context 和 bind_conversation_context 校验 Context 存在后，分别写项目和会话的 context_id。方法虽同放在 organization.rs，数据并不是统一关系表。

现有单个 context_id 只表达一种绑定；不能把它直接当成任意多对多引用的最终结构。字符串地址也不能冒充统一资源对象或有效授权。

### 推荐语义与维护方

| 关系含义 | 候选维护方 | 修改效果 |
|---|---|---|
| Context 位于哪个 Space／Group | 上下文组织 | 只改组织位置 |
| 会话当前使用哪个 Context 作为背景 | 会话 | 改后续上下文选择；在途输入不静默变化 |
| 项目主绑定哪个 Context | 工作领域 | 修改项目绑定，不自动搬文件 |
| Context 额外引用已有任务／连接／其他对象 | 上下文组织 | 保存引用关系，读取目标须走目标公开入口与权限 |
| 某角色承担项目职责 | 角色／职责管理 | 变更职责记录，授权另判 |
| 任务依赖另一个任务 | 工作领域 | 影响任务可推进条件，不等同画布连线 |

“会话背景绑定”与“Context 中显示一个会话引用”是不同关系。若产品把两者定义成同一件事，只允许一个正式写入口，另一侧由查询派生；不能两边各保存一份互相同步。

首轮建议只增加真实需要的关系类型，不先建通用图引擎。反向查询索引允许集中，但属于可重建投影，不决定业务真相。

### 删除与授权建议

- 解除关联只移除该关系，不删除被引用对象。
- 对象删除优先保留可识别的失效引用／墓碑语义，具体硬删除规则另定；UI 的“不可见”不能泄露无权对象的名称或内容。
- 关系维护方检查修改资格，目标服务检查读取与使用资格；关联不自动授权。
- 删除与新增关系竞争需要事务约束或目标修订核验；不能只做一次“存在”查询就宣称强一致。
- 具体结构和存储迁移待这些关系被产品语义确认后确定。

验收：移动 Context 不改变目标 ID／权限；解除引用不删任务；删除目标后引用可诊断；旧修订修改被拒绝；权限变化后投影不继续泄露内容。

## 4. 模板创建：利用现有本地事务边界

### 源码证据与限制

[infrastructure/sqlite.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/infrastructure/sqlite.rs) 的 DesktopStore::update 在 SQLite Immediate 事务中读取 DesktopSnapshot，执行变更、增加 revision，更新 desktop_state 后提交。一次变更可覆盖多个本地集合；错误返回不会提交这一轮写入。

[application/mod.rs](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/crates/wex-desktop-service/src/application/mod.rs) 的 create_project 只创建项目，add_agent 在一次 mutate 内同时建立会话、Agent 和职责数据。说明已有本地多对象事务模式，但不代表存在通用模板实例化接口。

[App.tsx](https://github.com/owla19s-ux/wexpc/blob/faf11f31d44e4fc4788e766074b8db6b83ab4a1b/apps/desktop/src/App.tsx) 的 createProject 调用 create_project。本次阅读的入口没有证明软件开发模板实例化已接通；不据此断言全仓不存在任何相关实现。

### 推荐首个流程

1. 模板产生可审阅的结构草案，列出要创建和引用的对象；无网络调用和真实文件修改。
2. 提交时检查草案所依据的修订、引用、权限与输入。预览时通过不等于提交时仍有效。
3. 由受信任的组合入口调用领域校验／变更逻辑，共用一次事务，写入对象、关系、实例映射与重复提交识别记录。
4. 提交成功后返回实际对象身份；响应丢失时根据提交身份查回结果，不重新建一套。
5. 用户后续启动模型、GitHub 或本地工具操作时，走独立授权与执行链。

事务入口是应用编排职责；模板不能拿可变全局快照或直接操作任意表。领域规则继续由领域维护。需要先重构出可参与同一事务的内部领域操作，不能在现有多个“各自提交”的公开方法外面包一层函数就声称原子。

重复识别应由可靠提交身份与草案内容绑定实现；同一身份不同内容应报冲突。对象映射和识别记录必须与对象同事务保存，不能提交后才补记。

### 边界与后续演进

首个模板初始化只写本地权威数据时，优先验证一次原子事务，避免先造通用补偿引擎。若未来有独立存储插件或外部写入，届时明确逐步骤状态、恢复与补偿；不能把它们纳入 SQLite 原子性承诺。

现有整体快照和全局 revision 有利于窄试点，但并非长期存储定案。大数据量与无关编辑冲突要另行评估，不借这次设计锁死全局大快照。

事务成功后的“撤销”是新的业务操作：必须检测后续修改和引用，不能直接删除整批对象。当下未定义该逆操作，不承诺一键全局撤销。

验收：第二个对象校验失败则本批零提交；提交后响应丢失能找回同一组对象；重复点击不重复创建；修订冲突明确；初始化不触发网络、授予权限或改外部文件。

## 5. 从建议到实际契约的顺序

先以这三项为候选边界，建立窄试点的行为条件，再定义接口输入输出与状态转移。不要先生成全仓接口壳。

优先验证模型协调抽取：它同时检验普通对话独立性、协议局部性和运行时扩展接缝。模板本地原子提交可作为下一条独立验证链；关系维护规则随所需对象接口逐项落实。

本次并未执行这些试点。语言仍以当前 Rust＋TypeScript 为研究基线，动态加载执行环境未定；没有因此授权改造产品仓。
