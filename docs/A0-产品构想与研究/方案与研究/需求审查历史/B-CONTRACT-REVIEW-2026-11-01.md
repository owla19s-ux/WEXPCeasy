# B级候选需求与模块契约评审（2026-11-01）

- 基线：216项F功能总表；本次逐项映射版本以本轮Owner收敛提交为准。
- 评审对象：产品目录中状态含B的全部功能项（含A/B、B/C、B/D等组合状态）。
- 评审方式：核对功能定义、唯一owner、模块CONTRACT锚点、输入输出/生命周期边界、C/D阻塞关系；不把B自动升级为A。
- 结论：B项技术审查按契约覆盖情况分为通过、条件通过和未通过；用户批准仍单独进行。

## 1. 总体统计

- B相关功能项：122项。
- 契约覆盖：75项；部分覆盖：38项；缺失：9项。
- “覆盖”仅表示已有可追踪业务契约，不代表实现完成；“技术评审通过”不代表用户批准。
- B/C、B/D、A/B/D等组合项仍同时受C实验或D政策阻塞。

## 2. 按功能域统计

| 功能域 | B相关项 | 覆盖 | 部分 | 缺失 |
|---|---:|---:|---:|---:|
| F01 Space | 6 | 5 | 1 | 0 |
| F02 Agent | 7 | 4 | 2 | 1 |
| F03 Conversations | 10 | 10 | 0 | 0 |
| F04 Model/API | 10 | 5 | 5 | 0 |
| F05 Connections | 7 | 3 | 4 | 0 |
| F06 Local tools | 5 | 3 | 2 | 0 |
| F07 Workflow/modes | 13 | 11 | 2 | 0 |
| F08 Scheduling | 6 | 5 | 1 | 0 |
| F09 Permissions | 2 | 2 | 0 | 0 |
| F10 Data/memory | 11 | 1 | 9 | 1 |
| F11 Views | 12 | 12 | 0 | 0 |
| F12 Plugins | 8 | 0 | 1 | 7 |
| F13 Evidence | 5 | 4 | 1 | 0 |
| F14 Host | 5 | 0 | 5 | 0 |
| F15 Operations | 15 | 10 | 5 | 0 |

## 3. 逐项评审清单

| F编号 | 功能 | 原状态 | 唯一owner | 契约覆盖 | 准备度 | 技术评审结论 | 契约锚点/缺口 |
|---|---|---|---|---|---|---|---|
| F01-001 | Space 类别管理 | B | space | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | space/CONTRACT · SPC-01；— |
| F01-002 | Space 生命周期 | A/B | space | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | space/CONTRACT · SPC-01；— |
| F01-004 | Group 组织 | A/B | space | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | space/CONTRACT · SPC-01；— |
| F01-006 | Context 本体与配置 | A/B | space | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | space/CONTRACT · SPC-01；— |
| F01-009 | Context 有效配置解析 | B/C | space | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | space/CONTRACT · SPC-03；AI AIC-03/04；connections C01；permissions PER-01；缺默认/覆盖优先级、冲突决议和失效重算契约。 |
| F01-011 | Context 查询与可见性 | A/B | space | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | space SPC-04；permissions PER-01/04；— |
| F02-001 | Agent 定义 | A/B | AI | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | AI AIC-01；— |
| F02-005 | 模型与连接引用 | A/B | AI | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | AI AIC-01；connections C01；shared SH-04；— |
| F02-006 | Agent 配置修订 | B | AI | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | AI AIC-01；— |
| F02-007 | Agent 运行实例绑定与观察 | B/C | AI | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | AI AIC-01/04；connections C01/03/04；app APP-02；缺Agent实例启动/暂停/释放/重连的完整生命周期契约。 |
| F02-008 | Agent Session 映射 | A/B | AI | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | AI AIC-04；connections C01/03/04；需外部实例代次、Session定位和可查询性子契约。 |
| F02-010 | 执行者替换与交接 | A/B | AI | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | AI AIC-04；workflows W02/W06；connections C04；— |
| F02-011 | Agent 记忆策略配置 | B/D | AI | 缺失 | 用户决策前置 | 未通过：必须补模块契约 | AI AIC-01/04；F10记忆契约缺口；permissions PER-01；AI契约没有记忆对象、来源、共享、撤回、纠错和过期能力。 |
| F03-002 | 消息与轮次持久化 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-02；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-003 | 消息序列项 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-03；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-005 | 分支讨论 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-05；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-008 | 流式输出与定稿 | B/C | conversations | 覆盖 | 实验前置 | 契约通过；真实实验前置 | conversations/CONTRACT.md · CV-08；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-010 | 对话背景与模型选择 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-10；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-011 | 输入附件与来源 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-11；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-012 | 工具意图往返 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-12；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-014 | 会话检索与历史读取 | B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-14；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-015 | 序列项采纳/拒绝状态 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-15；已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-016 | 序列项局部补充与修订 | A/B | conversations | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | conversations/CONTRACT.md · CV-16；序列项局部修订与历史消息重发分开；CV-16只修改单项版本。 |
| F04-003 | 模型目录 | B | connections/api | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/api/CONTRACT.md · API-02；API子契约已补，真实Provider仍需独立验收。 |
| F04-004 | 模型能力描述 | B | connections/api | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/api/CONTRACT.md · API-02；API子契约已补，真实Provider仍需独立验收。 |
| F04-005 | 调用参数配置 | B | connections/api | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/api/CONTRACT.md · API-01/API-04；AI AIC-01/04；API子契约已补，真实Provider仍需独立验收。 |
| F04-006 | 连接测试与诊断 | A/B | connections/api | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/api/CONTRACT.md · API-03；API子契约已补，真实Provider仍需独立验收。 |
| F04-008 | 工具调用格式适配 | A/B | connections/api | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/api/CONTRACT.md · API-05；API子契约已补，真实Provider仍需独立验收。 |
| F04-009 | 模型路由与选择 | B | connections/api | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | connections/api/CONTRACT.md · API-08；路由独立于Provider目录；不能绕过能力、来源、授权和费用策略。 |
| F04-010 | 限额与用量记录 | B | connections/api | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | connections/api/CONTRACT.md · API-06；记录供应方usage与估算来源；未知费用保持未知，预算政策受PRD-D11。 |
| F04-011 | 超时、重试与降级 | B/C | connections/api | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | connections/api/CONTRACT.md · API-09；仅模型请求有限重试；工具副作用不由API适配器重发。 |
| F04-012 | 模型故障切换 | B/D | connections/api | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | connections/api/CONTRACT.md · API-10；故障切换是新请求/新快照；自动切换受PRD-D11及来源/权限政策。 |
| F04-013 | 本地模型 Provider | B（远期） | connections/api | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | connections/api/CONTRACT.md · API-07；本地模型服务和GPU进程资源需单独实验，不默认由WEX管理运行时。 |
| F05-003 | 能力注册与发现 | B | connections | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections C01；app APP-02；— |
| F05-004 | 能力就绪检查 | A/B | connections | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections C01/C03；app APP-02；— |
| F05-005 | 连接配置与能力版本 | B | connections | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections C01/C02；— |
| F05-010 | 外部事件与回调接入 | B/C | connections | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | connections C05；app APP-02；permissions PER-01；回调认证、重放、代次、顺序和撤权竞态仍需实验。 |
| F05-013 | 网络代理与连接策略 | B/C | connections | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | connections C01/C03；app APP-02；通用代理偏好与Provider专属代理/证书分层，离线重连按适配器验收。 |
| F05-015 | Service 生命周期与连接绑定 | B | connections | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | connections C01；app APP-02；Service定义/实例/代次、Connection绑定、Capability状态与卸载需独立样例。 |
| F05-016 | 外部 Search / Fetch / Browser 适配 | B（后续扩展） | connections | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | connections C01–03；permissions PER-01；F10-009；Search/Fetch/Browser不同于内部检索，当前为后续扩展。 |
| F06-005 | 文件版本与变化检测 | B/C | connections/local | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | connections/local/CONTRACT.md · LOCAL-04；Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-006 | 文件内容解析 | B | connections/local | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/local/CONTRACT.md · LOCAL-02；Local子契约已覆盖主要业务输入输出。 |
| F06-010 | 开发环境配置与选择 | A/B | connections/local | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/local/CONTRACT.md · LOCAL-07；Local子契约已覆盖主要业务输入输出。 |
| F06-014 | 本地运行产物定位 | A/B | connections/local | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | connections/local/CONTRACT.md · LOCAL-10；Local子契约已覆盖主要业务输入输出。 |
| F06-015 | 文件监控与外部修改检测 | B/C | connections/local | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | connections/local/CONTRACT.md · LOCAL-04；Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F07-002 | 节点能力描述 | B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W01/W03；— |
| F07-003 | 流程依赖关系 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W01/W03；— |
| F07-004 | 工作流校验 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W01/W03；— |
| F07-006 | 模板实例化 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/CONTRACT.md · MODE-02；已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-008 | 模板保存与复用 | B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/CONTRACT.md · MODE-06；已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-009 | 工作流触发条件 | B/D | workflows/runtime | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | workflows W03/W06；app APP-03；PRD-D04；触发来源、授权时点、重复触发和退出后运行策略需定义。 |
| F07-010 | 定义修订与草稿 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/CONTRACT.md · MODE-06；已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-011 | 工作流导入导出 | B | workflows/runtime | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | workflows W01；shared SH-02/03；permissions PER-01；定义修订与布局分离；导入导出需身份冲突/外部引用/部分成功语义。 |
| F07-014 | 需求与功能对象 | A/B | workflows/modes | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/software-development/CONTRACT.md · SD-02；需求/功能对象身份和修订已定义。 |
| F07-015 | 架构与组件关系 | B | workflows/modes | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/software-development/CONTRACT.md · SD-03；专业关系不得自动变成执行依赖。 |
| F07-016 | 项目资源映射 | A/B | workflows/modes | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/software-development/CONTRACT.md · SD-04；资源内容/版本仍归真实资源owner。 |
| F07-018 | AI 结构建议草案 | A/B | workflows/modes | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/software-development/CONTRACT.md · SD-06；AI建议保持草案，显式采纳后才调用owner。 |
| F07-020 | 项目基准与决策记录 | A/B | workflows/modes | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows/modes/software-development/CONTRACT.md · SD-07；Baseline/Decision不覆盖Git/文件当前事实。 |
| F08-002 | Task 修订 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W02/W03/W04；— |
| F08-005 | 任务队列与优先级 | B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W03；connections C02；permissions PER-01；— |
| F08-006 | 依赖与条件推进 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W03；connections C02；permissions PER-01；— |
| F08-007 | 执行者选择与路由 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W03；connections C02；permissions PER-01；— |
| F08-010 | 并发与容量调度 | B/C | workflows/runtime | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | workflows W05/W03；connections C02；app APP-02；资源身份/别名、租约/fencing、跨Context冲突和容量策略待实验。 |
| F08-015 | 人工接管与交接 | A/B | workflows/runtime | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W02/W03/W04/W06；connections C02–04；— |
| F09-008 | 授予与审批 | A/B | permissions | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | permissions PER-01–04；shared SH-04/05；— |
| F09-012 | 数据读取与外发权限 | A/B | permissions | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | permissions PER-01–04；shared SH-04/05；— |
| F10-004 | 稳定身份与引用 | A/B | shared（稳定引用/定位技术规则） | 覆盖 | 补契约/语义评审后施工 | 保留候选；按备注限制范围 | shared/CONTRACT.md · SH-01（稳定引用/路径定位）；shared定义稳定引用表示/定位规则；对象ID归源owner，文件身份归connections/local。 |
| F10-006 | 数据导入导出 | B | app（导入/导出作业协调） | 部分 | 领域I/O细化后施工 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-11；各领域导入/导出出口；app协调作业；格式、对象冲突和本域导入校验由各领域提供，部分成功逐项报告。 |
| F10-007 | 备份与恢复 | A/B/C | app（备份/恢复流程协调） | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-12；shared SH-03；app协调全局备份恢复；shared提供技术原语，各域提供一致性范围/钩子；PRD-C07未关闭。 |
| F10-009 | 内部检索 | B | views（获准检索聚合/投影） | 部分 | 领域查询出口细化后施工 | 条件通过：补足域输入输出/生命周期后施工 | views/CONTRACT.md · VIEW-01/03；各领域查询出口；views只聚合获准查询；各域提供权威查询出口，打开结果重判权限。 |
| F10-010 | 知识资料管理 | B | space（知识资料记录/关联） | 部分 | 领域资源引用细化后施工 | 条件通过：补足域输入输出/生命周期后施工 | space/CONTRACT.md · SPC-03/04；connections/local LOCAL-01/02；space拥有知识资料记录/引用；原文件字节和内容版本归connections/local。 |
| F10-011 | Agent 记忆 | A/B | AI | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | AI/CONTRACT.md · AIC-05；Agent派生记忆归AI；原始消息/项目资料不复制为第二事实源。 |
| F10-012 | 记忆来源与可信度 | A/B | AI | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | AI/CONTRACT.md · AIC-06；可信来源由source owner提供；模型推断不能伪装用户确认。 |
| F10-013 | 记忆共享与隔离 | B/D | AI | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | AI/CONTRACT.md · AIC-07；permissions PER-01；共享范围由AI记录，实际读取许可由permissions决定；PRD-D10未决。 |
| F10-014 | 公共策略与经验库 | B（远期候选） | 待用户裁决：space公共知识集合或未来Knowledge owner | 缺失 | 产品方向/owner裁决前不施工 | 未通过：必须补模块契约 | 无已批准契约；PRD-D13；远期候选；PRD-D13确认是否纳入及owner方向前不施工。 |
| F10-015 | 记忆纠错、过期和删除 | B/D | AI | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | AI/CONTRACT.md · AIC-08；PRD-D05/D10；只删除AI派生记忆；来源原件和审计保留政策独立。 |
| F10-016 | 用户级偏好与跨项目记忆 | B/D（远期） | AI | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | AI/CONTRACT.md · AIC-09；PRD-D10；用户偏好记忆与Agent私有记忆分开；不自动复制到全部Context。 |
| F11-001 | 视图定义 | B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-01；视图能力锚点已补，源对象owner保持不变。 |
| F11-002 | 多种视图投影 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-01；视图能力锚点已补，源对象owner保持不变。 |
| F11-005 | 布局与筛选配置 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-04；视图能力锚点已补，源对象owner保持不变。 |
| F11-006 | 多视图关联 | B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-05；视图能力锚点已补，源对象owner保持不变。 |
| F11-007 | 视图投影刷新 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-05；视图能力锚点已补，源对象owner保持不变。 |
| F11-008 | 草稿与提交映射 | B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-05；视图能力锚点已补，源对象owner保持不变。 |
| F11-009 | 专业视图规则 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-03；视图能力锚点已补，源对象owner保持不变。 |
| F11-011 | 需求/功能树投影 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-03；视图能力锚点已补，源对象owner保持不变。 |
| F11-012 | 架构关系视图 | B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-03；视图能力锚点已补，源对象owner保持不变。 |
| F11-013 | 功能与资源映射视图 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-03；视图能力锚点已补，源对象owner保持不变。 |
| F11-014 | 任务与进度投影 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-03；视图能力锚点已补，源对象owner保持不变。 |
| F11-015 | 稳定对象定位与对话锚点 | A/B | views | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | views/CONTRACT.md · VIEW-07；视图能力锚点已补，源对象owner保持不变。 |
| F12-001 | 插件描述清单 | B | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-002 | 插件发现与登记 | B（远期候选） | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-003 | 安装、启用与停用 | B（远期候选） | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-004 | 插件能力提供 | B（远期候选） | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-005 | 插件依赖与版本兼容 | B/C | plugins（预留） | 缺失 | 实验前置 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-008 | 插件配置与数据 | B | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-009 | 插件 UI 扩展 | B（远期候选） | plugins（预留） | 缺失 | 补契约后施工 | 未通过：必须补模块契约 | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01；WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-012 | 插件目录与重装重识别 | B/C | plugins（预留） | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | plugins README；app/CONTRACT.md · APP-04；shared/CONTRACT.md · SH-01；插件目录重识别依赖根身份/应用更新协调；SH-05凭证能力不再错误映射到插件目录。 |
| F13-002 | 产物来源追踪 | A/B | workflows | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W04；connections C02/C03；permissions PER-01；— |
| F13-004 | Evidence 收集 | A/B | workflows | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W04；connections C02/C03；permissions PER-01；— |
| F13-006 | Verification 规则 | A/B | workflows | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W04；connections C02/C03；permissions PER-01；— |
| F13-010 | 证据包与导出 | B | workflows | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | workflows W04；shared SH-03；permissions PER-01；证据包导出需定义范围、脱敏、缺失附件、引用快照和部分失败。 |
| F13-011 | 证据冲突处理 | A/B | workflows | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | workflows W04；connections C03；— |
| F14-003 | 首次启动初始化 | A/B | app | 部分 | 补契约/语义评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | app APP-01/04；shared SH-01/03/05；APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-004 | 单实例与重复启动 | B/C | app | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | app APP-01/04；shared SH-01/03/05；APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-009 | Windows 系统集成 | B/D | app | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | app APP-03；UI CONTRACT；PRD-D04；菜单/通知/文件关联/托盘/快捷键等平台能力与政策需细化。 |
| F14-011 | 应用升级与卸载 | A/B/D | app | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | app APP-04；shared SH-03；PRD-D07；程序回滚、数据迁移、插件兼容/卸载分离；自动更新D07待决。 |
| F14-012 | 安全模式与启动降级 | B/C | app | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | app APP-02/03；plugins README；F15-006；安全模式需验证Renderer/主进程/插件宿主故障边界。 |
| F15-001 | 结构化运行日志 | B | shared（技术日志/追踪） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | shared/CONTRACT.md · SH-06；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-002 | 跨模块调用追踪 | B | shared（技术日志/追踪） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | shared/CONTRACT.md · SH-06；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-003 | 运行指标 | B | app（宿主运行保障） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | app/CONTRACT.md · APP-05；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-004 | 健康检查 | A/B | app（宿主运行保障） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | app/CONTRACT.md · APP-05；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-005 | 故障诊断 | A/B | app（宿主运行保障） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | app/CONTRACT.md · APP-06；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-006 | 崩溃与安全恢复 | B/C | app（宿主运行保障） | 覆盖 | 实验前置 | 契约通过；真实实验前置 | app/CONTRACT.md · APP-07；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-007 | 数据容量与维护 | B | app（宿主运行保障） | 部分 | 候选细化评审后施工 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-05/APP-10；shared容量技术观察；app拥有容量维护入口；各owner决定本域可清理对象，不由app直接删除。 |
| F15-008 | 备份与恢复运行保障 | B/C | app（宿主运行保障） | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-12；shared SH-03；app协调备份任务和完整性检查；备份范围与数据语义由F10-007/各owner提供。 |
| F15-009 | 网络与离线诊断 | B/C | app（宿主运行保障） | 覆盖 | 实验前置 | 契约通过；真实实验前置 | app/CONTRACT.md · APP-05；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-010 | 进程与资源维护 | B/C | app（宿主进程协调） | 部分 | 实验前置 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-05/APP-07；connections/local LOCAL-06；app拥有宿主协调；local提供进程树事实；Windows残留进程和退出确认需实验。 |
| F15-011 | 维护与清理策略 | B/D | app（维护/清理流程协调） | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | app/CONTRACT.md · APP-10；各数据owner清理出口；PRD-D05/D12；app拥有清理流程编排；实际保留/删除由数据owner执行，PRD-D05/D12待决。 |
| F15-012 | 通知事件来源保障 | B | app（宿主运行保障） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | app/CONTRACT.md · APP-08；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-013 | 用户帮助与问题报告 | B | app（宿主运行保障） | 覆盖 | 候选细化评审后施工 | 技术评审通过；B仍待用户批准，不升A | app/CONTRACT.md · APP-06；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-014 | 配置完整性与恢复协调 | B/C | app（宿主运行保障） | 覆盖 | 实验前置 | 契约通过；真实实验前置 | app/CONTRACT.md · APP-09；运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-015 | 日志配置与保留策略 | B/D | shared（技术日志/追踪） | 部分 | 用户决策前置 | 条件通过：补足域输入输出/生命周期后施工 | shared/CONTRACT.md · SH-06；正式账本owner；PRD-D05；shared只管理普通技术日志；权限审计/Operation/Task证据保留不归shared。 |

## 4. 人工复核的关键语义修订

1. **F03-006与F03-016分开。** 历史消息编辑/重发会创建新逻辑生成；单个序列项局部修订只创建该项新版本，不应复用同一契约锚点。
2. **F04-009～012分开。** 模型路由、usage观察、超时/重试、故障切换分别定义；模型请求重试不能重放工具Operation，故障切换是新请求和新快照。
3. **F10-001/003/004/005分配shared技术owner。** 只拥有持久化、存储类别、稳定引用技术规则和CAS；领域数据/对象身份/业务冲突仍归源owner。
4. **F10-006～008分配app作业协调owner。** 各领域保留格式/迁移schema/数据校验；shared只提供底层技术原语。
5. **F10-013与F10-016分开。** Agent记忆共享范围与用户级偏好记忆不是同一个对象；两者默认可见范围受PRD-D10。
6. **F10-014不并入AI或shared。** 公共策略/经验库范围与owner保留PRD-D13用户裁决。
7. **F15-011唯一owner为app。** app只编排清理预览/流程；实际保留和删除由数据owner执行，PRD-D05/D12未决时不自动清理。
8. **F15-015只由shared管理普通技术日志。** 权限审计、Operation回执和Task/Evidence保留仍归各自owner。
9. **视图、专业关系和执行关系分离。** VIEW映射不写入业务关系；SD/MODE专业关系不自动变成workflow执行依赖。
10. **跨域部分成功不假装原子。** 模板实例化、导入导出、备份和迁移逐owner回执；无共同事务证据就逐项报告。

## 5. B的处理规则

- 评审通过的B：可作为用户确认的候选基线，用户确认前仍标B。
- 条件通过的B：先补足对应域契约/输入输出/失败样例，不因映射表存在就施工。
- 未通过的B：缺少正式模块契约，不进入实现。
- 带C的B：契约语义可评审，但对应实现必须等待实验。
- 带D的B：只能保留候选方案和安全默认建议，必须由用户裁决。
- 远期B：可保留在完整需求底表，不自动进入0.1.1。

**本评审不批准任何0.1.1范围，也不把所有B升级为A。**
