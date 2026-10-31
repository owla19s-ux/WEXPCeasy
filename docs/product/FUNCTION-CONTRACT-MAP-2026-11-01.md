# WEX F01–F15 功能—模块契约逐项映射（第二轮）

- 日期：2026-11-01
- 本轮复核基线：`faeefa8cb2cd56ca2e115ea1bd02844772577ff3`
- 产品底表：[PRODUCT-FUNCTION-CATALOG-2026-11-01.md](PRODUCT-FUNCTION-CATALOG-2026-11-01.md)
- 第二轮审查：[SECOND-ROUND-REQUIREMENT-REVIEW-2026-11-01.md](SECOND-ROUND-REQUIREMENT-REVIEW-2026-11-01.md)
- 性质：逐项追踪与缺口登记；不是实现状态报告、接口签名批准书或0.1.1范围表。

## 1. 映射规则

每项F功能只指定一个**主责owner**。其他模块只作为能力提供方、依赖方、平台支持方或证据来源，不因此共同拥有该项业务事实。

若F项涉及多个领域事实，仍只指定一个主责owner负责该功能的协调/技术规则/投影；领域提供方继续拥有本域事实。只有尚未定产品方向的远期候选F10-014暂留owner裁决，不将shared/app/workflows变成万能owner。

“覆盖”只表示现有CONTRACT已描述主要业务行为；“部分”表示相关行为存在，但缺少该功能所需的输入输出、生命周期、异常或稳定锚点；“缺失”表示只有README/研究或没有可追踪业务契约。覆盖不代表已实现。

### 当前契约锚点

| 模块 | 当前锚点 | 映射说明 |
|---|---|---|
| space | SPC-01–SPC-05 | 稳定能力编号 |
| AI / roles | AIC-01–AIC-08 | 已补记忆子契约；D10/D05仍未决 |
| connections | C01–C05 | 稳定编号；API/local子契约已分别补充 |
| conversations | CV-01–CV-15 | 已补稳定锚点；B/C候选语义 |
| connections/api | API-01–API-07 | 已补适配器子契约，真实Provider待验 |
| connections/local | LOCAL-01–LOCAL-10 | 已补适配器子契约，Windows实测待验 |
| workflows/runtime | W01–W07 | 稳定能力编号 |
| workflows/modes | MODE-01–MODE-06 | 已补稳定锚点，仍为B候选 |
| software-development mode | SD-01–SD-07 | 已补专业模式子契约，未实现 |
| permissions | PER-01–PER-04 | 稳定能力编号 |
| shared | SH-01–SH-06 | SH-06已作为B候选技术日志能力写入 |
| views | VIEW-01–VIEW-07 | 已补稳定能力锚点 |
| app | APP-01–APP-09 | 已补运行维护候选能力 |
| UI | UI/CONTRACT及I01–I16 | UI只拥有交互/呈现，不拥有F业务事实 |
| plugins/accounts/dsh | README与研究文档 | 预留/独立路线；不是已建立WEX业务契约 |

> CV/API/LOCAL/MODE/SD/VIEW/AIC/APP/SH能力锚点均已写入对应CONTRACT，当前仍为B/C/D候选语义；不等于接口签名冻结或产品实现完成。

## 2. 映射统计

- F功能项：**216项**，15个功能域。
- 契约覆盖：覆盖 142；部分 62；缺失 12。
- 准备度初判：候选细化评审后施工 70；可直接施工（独立验收） 61；实验前置 32；实验 + 用户裁决 2；补契约/语义评审后施工 30；用户决策前置 14；产品方向/owner裁决前不施工 1；补契约后施工 6。
- 主责复合/待拆分项目：0项；F10-014为有意保留的远期owner/范围待决项（PRD-D13），不是当前基础模块的复合owner。

## 3. 216项逐项映射

| F编号 | 基础功能 | 唯一主责owner | 现有契约锚点 | 契约覆盖 | 初步准备度 | 缺口/说明 |
|---|---|---|---|---|---|---|
| F01-001 | Space 类别管理 | space | space/CONTRACT · SPC-01 | 覆盖 | 候选细化评审后施工 | — |
| F01-002 | Space 生命周期 | space | space/CONTRACT · SPC-01 | 覆盖 | 候选细化评审后施工 | — |
| F01-003 | 工作区与目录登记 | space | space/CONTRACT · SPC-01 | 覆盖 | 可直接施工（独立验收） | — |
| F01-004 | Group 组织 | space | space/CONTRACT · SPC-01 | 覆盖 | 候选细化评审后施工 | — |
| F01-005 | Context 独立创建 | space | space/CONTRACT · SPC-01 | 覆盖 | 可直接施工（独立验收） | — |
| F01-006 | Context 本体与配置 | space | space/CONTRACT · SPC-01 | 覆盖 | 候选细化评审后施工 | — |
| F01-007 | Context 多处放置 | space | space/CONTRACT · SPC-02 | 覆盖 | 可直接施工（独立验收） | — |
| F01-008 | Context 组合引用 | space | space/CONTRACT · SPC-03 | 覆盖 | 可直接施工（独立验收） | — |
| F01-009 | Context 有效配置解析 | space | space/CONTRACT · SPC-03；AI AIC-03/04；connections C01；permissions PER-01 | 部分 | 实验前置 | 缺默认/覆盖优先级、冲突决议和失效重算契约。 |
| F01-010 | 引用解除与本体删除分离 | space | space SPC-05；permissions PER-03；workflows W05 | 部分 | 实验 + 用户裁决 | 删除竞争屏障为C/D，实际删除延期。 |
| F01-011 | Context 查询与可见性 | space | space SPC-04；permissions PER-01/04 | 覆盖 | 候选细化评审后施工 | — |
| F01-012 | Context 接回与重定位 | space | space SPC-01；app APP-01；shared SH-01；connections/local README | 部分 | 实验前置 | 目录接回、身份冲突、重定位需子契约和Windows实验。 |
| F02-001 | Agent 定义 | AI | AI AIC-01 | 覆盖 | 候选细化评审后施工 | — |
| F02-002 | 角色定义 | AI | AI AIC-02 | 覆盖 | 可直接施工（独立验收） | — |
| F02-003 | 职责配置 | AI | AI AIC-02 | 覆盖 | 可直接施工（独立验收） | — |
| F02-004 | 职责范围绑定 | AI | AI AIC-02 | 覆盖 | 可直接施工（独立验收） | — |
| F02-005 | 模型与连接引用 | AI | AI AIC-01；connections C01；shared SH-04 | 覆盖 | 候选细化评审后施工 | — |
| F02-006 | Agent 配置修订 | AI | AI AIC-01 | 覆盖 | 候选细化评审后施工 | — |
| F02-007 | Agent 运行实例绑定与观察 | AI | AI AIC-01/04；connections C01/03/04；app APP-02 | 部分 | 实验前置 | 缺Agent实例启动/暂停/释放/重连的完整生命周期契约。 |
| F02-008 | Agent Session 映射 | AI | AI AIC-04；connections C01/03/04 | 部分 | 补契约/语义评审后施工 | 需外部实例代次、Session定位和可查询性子契约。 |
| F02-009 | 外部 Agent 接入 | AI | AI AIC-04；connections C01/03/04 | 部分 | 补契约/语义评审后施工 | 需外部实例代次、Session定位和可查询性子契约。 |
| F02-010 | 执行者替换与交接 | AI | AI AIC-04；workflows W02/W06；connections C04 | 覆盖 | 候选细化评审后施工 | — |
| F02-011 | Agent 记忆策略配置 | AI | AI AIC-01/04；F10记忆契约缺口；permissions PER-01 | 缺失 | 用户决策前置 | AI契约没有记忆对象、来源、共享、撤回、纠错和过期能力。 |
| F02-012 | Agent 状态与工作状态分离 | AI | AI AIC-03/04；connections C03/04；workflows W07 | 部分 | 补契约/语义评审后施工 | 需区分Agent配置、Runtime在线、Session可查询和Task状态的观察来源。 |
| F03-001 | 独立会话生命周期 | conversations | conversations/CONTRACT.md · CV-01 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-002 | 消息与轮次持久化 | conversations | conversations/CONTRACT.md · CV-02 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-003 | 消息序列项 | conversations | conversations/CONTRACT.md · CV-03 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-004 | 局部选择与引用 | conversations | conversations/CONTRACT.md · CV-04 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-005 | 分支讨论 | conversations | conversations/CONTRACT.md · CV-05 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-006 | 已发送消息修改与重发 | conversations | conversations/CONTRACT.md · CV-06 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-007 | 生成期间追加与排队 | conversations | conversations/CONTRACT.md · CV-07 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-008 | 流式输出与定稿 | conversations | conversations/CONTRACT.md · CV-08 | 覆盖 | 实验前置 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-009 | 停止生成 | conversations | conversations/CONTRACT.md · CV-09 | 覆盖 | 实验前置 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-010 | 对话背景与模型选择 | conversations | conversations/CONTRACT.md · CV-10 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-011 | 输入附件与来源 | conversations | conversations/CONTRACT.md · CV-11 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-012 | 工具意图往返 | conversations | conversations/CONTRACT.md · CV-12 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-013 | 显式转为 Task | conversations | conversations/CONTRACT.md · CV-13 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-014 | 会话检索与历史读取 | conversations | conversations/CONTRACT.md · CV-14 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-015 | 序列项采纳/拒绝状态 | conversations | conversations/CONTRACT.md · CV-15 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-016 | 序列项局部补充与修订 | conversations | conversations/CONTRACT.md · CV-16 | 覆盖 | 候选细化评审后施工 | 序列项局部修订与历史消息重发分开；CV-16只修改单项版本。 |
| F04-001 | Provider 配置 | connections/api | connections/api/CONTRACT.md · API-01 | 覆盖 | 可直接施工（独立验收） | API子契约已补，真实Provider仍需独立验收。 |
| F04-002 | 账号与凭证引用 | connections/api | connections/api/CONTRACT.md · API-03 | 覆盖 | 可直接施工（独立验收） | API子契约已补，真实Provider仍需独立验收。 |
| F04-003 | 模型目录 | connections/api | connections/api/CONTRACT.md · API-02 | 覆盖 | 候选细化评审后施工 | API子契约已补，真实Provider仍需独立验收。 |
| F04-004 | 模型能力描述 | connections/api | connections/api/CONTRACT.md · API-02 | 覆盖 | 候选细化评审后施工 | API子契约已补，真实Provider仍需独立验收。 |
| F04-005 | 调用参数配置 | connections/api | connections/api/CONTRACT.md · API-01/API-04；AI AIC-01/04 | 覆盖 | 候选细化评审后施工 | API子契约已补，真实Provider仍需独立验收。 |
| F04-006 | 连接测试与诊断 | connections/api | connections/api/CONTRACT.md · API-03 | 覆盖 | 候选细化评审后施工 | API子契约已补，真实Provider仍需独立验收。 |
| F04-007 | 模型调用与流式适配 | connections/api | connections/api/CONTRACT.md · API-04 | 覆盖 | 可直接施工（独立验收） | API子契约已补，真实Provider仍需独立验收。 |
| F04-008 | 工具调用格式适配 | connections/api | connections/api/CONTRACT.md · API-05 | 覆盖 | 候选细化评审后施工 | API子契约已补，真实Provider仍需独立验收。 |
| F04-009 | 模型路由与选择 | connections/api | connections/api/CONTRACT.md · API-08 | 部分 | 补契约/语义评审后施工 | 路由独立于Provider目录；不能绕过能力、来源、授权和费用策略。 |
| F04-010 | 限额与用量记录 | connections/api | connections/api/CONTRACT.md · API-06 | 部分 | 补契约/语义评审后施工 | 记录供应方usage与估算来源；未知费用保持未知，预算政策受PRD-D11。 |
| F04-011 | 超时、重试与降级 | connections/api | connections/api/CONTRACT.md · API-09 | 部分 | 实验前置 | 仅模型请求有限重试；工具副作用不由API适配器重发。 |
| F04-012 | 模型故障切换 | connections/api | connections/api/CONTRACT.md · API-10 | 部分 | 用户决策前置 | 故障切换是新请求/新快照；自动切换受PRD-D11及来源/权限政策。 |
| F04-013 | 本地模型 Provider | connections/api | connections/api/CONTRACT.md · API-07 | 部分 | 补契约/语义评审后施工 | 本地模型服务和GPU进程资源需单独实验，不默认由WEX管理运行时。 |
| F05-001 | Connection 生命周期 | connections | connections C01 | 覆盖 | 可直接施工（独立验收） | — |
| F05-002 | 能力描述 | connections | connections C01/C02 | 覆盖 | 可直接施工（独立验收） | — |
| F05-003 | 能力注册与发现 | connections | connections C01；app APP-02 | 覆盖 | 候选细化评审后施工 | — |
| F05-004 | 能力就绪检查 | connections | connections C01/C03；app APP-02 | 覆盖 | 候选细化评审后施工 | — |
| F05-005 | 连接配置与能力版本 | connections | connections C01/C02 | 覆盖 | 候选细化评审后施工 | — |
| F05-006 | 受控调用入口 | connections | connections C02；permissions PER-01/03 | 覆盖 | 可直接施工（独立验收） | — |
| F05-007 | Operation 尝试与回执 | connections | connections C02；shared SH-02 | 覆盖 | 可直接施工（独立验收） | — |
| F05-008 | 结果查询与进度观察 | connections | connections C03 | 覆盖 | 可直接施工（独立验收） | — |
| F05-009 | 取消与接续能力声明 | connections | connections C04 | 覆盖 | 实验前置 | — |
| F05-010 | 外部事件与回调接入 | connections | connections C05；app APP-02；permissions PER-01 | 部分 | 实验前置 | 回调认证、重放、代次、顺序和撤权竞态仍需实验。 |
| F05-011 | 外部 Agent 连接器 | connections | connections C01–04；connections/dsh README | 覆盖 | 可直接施工（独立验收） | — |
| F05-012 | GitHub / Local 等系统适配 | connections | connections §3 api/github/local | 部分 | 补契约/语义评审后施工 | GitHub仅职责说明；Local缺子契约，不能将适配器等同。 |
| F05-013 | 网络代理与连接策略 | connections | connections C01/C03；app APP-02 | 部分 | 实验前置 | 通用代理偏好与Provider专属代理/证书分层，离线重连按适配器验收。 |
| F05-014 | 连接器错误规范化 | connections | connections C02/C03/C04 | 覆盖 | 可直接施工（独立验收） | — |
| F05-015 | Service 生命周期与连接绑定 | connections | connections C01；app APP-02 | 部分 | 补契约/语义评审后施工 | Service定义/实例/代次、Connection绑定、Capability状态与卸载需独立样例。 |
| F05-016 | 外部 Search / Fetch / Browser 适配 | connections | connections C01–03；permissions PER-01；F10-009 | 部分 | 补契约/语义评审后施工 | Search/Fetch/Browser不同于内部检索，当前为后续扩展。 |
| F06-001 | 本地目录与资源选择 | connections/local | connections/local/CONTRACT.md · LOCAL-01 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-002 | 文件与目录查询 | connections/local | connections/local/CONTRACT.md · LOCAL-02 | 覆盖 | 可直接施工（独立验收） | Local子契约已覆盖主要业务输入输出。 |
| F06-003 | 文件创建与修改 | connections/local | connections/local/CONTRACT.md · LOCAL-03 | 覆盖 | 可直接施工（独立验收） | Local子契约已覆盖主要业务输入输出。 |
| F06-004 | 文件删除 | connections/local | connections/local/CONTRACT.md · LOCAL-03 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-005 | 文件版本与变化检测 | connections/local | connections/local/CONTRACT.md · LOCAL-04 | 部分 | 实验前置 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-006 | 文件内容解析 | connections/local | connections/local/CONTRACT.md · LOCAL-02 | 覆盖 | 候选细化评审后施工 | Local子契约已覆盖主要业务输入输出。 |
| F06-007 | 终端命令执行 | connections/local | connections/local/CONTRACT.md · LOCAL-05 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-008 | 进程生命周期管理 | connections/local | connections/local/CONTRACT.md · LOCAL-06 | 部分 | 实验前置 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-009 | 开发环境发现 | connections/local | connections/local/CONTRACT.md · LOCAL-07 | 覆盖 | 可直接施工（独立验收） | Local子契约已覆盖主要业务输入输出。 |
| F06-010 | 开发环境配置与选择 | connections/local | connections/local/CONTRACT.md · LOCAL-07 | 覆盖 | 候选细化评审后施工 | Local子契约已覆盖主要业务输入输出。 |
| F06-011 | 项目运行、构建和测试 | connections/local | connections/local/CONTRACT.md · LOCAL-05/07 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-012 | 本地 Git 操作 | connections/local | connections/local/CONTRACT.md · LOCAL-08 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-013 | Android 工具链与模拟器 | connections/local | connections/local/CONTRACT.md · LOCAL-09 | 部分 | 补契约/语义评审后施工 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F06-014 | 本地运行产物定位 | connections/local | connections/local/CONTRACT.md · LOCAL-10 | 覆盖 | 候选细化评审后施工 | Local子契约已覆盖主要业务输入输出。 |
| F06-015 | 文件监控与外部修改检测 | connections/local | connections/local/CONTRACT.md · LOCAL-04 | 部分 | 实验前置 | Windows/进程树/删除或真实工具链仍需C/D验证。 |
| F07-001 | 工作流定义 | workflows/runtime | workflows W01/W03 | 覆盖 | 可直接施工（独立验收） | — |
| F07-002 | 节点能力描述 | workflows/runtime | workflows W01/W03 | 覆盖 | 候选细化评审后施工 | — |
| F07-003 | 流程依赖关系 | workflows/runtime | workflows W01/W03 | 覆盖 | 候选细化评审后施工 | — |
| F07-004 | 工作流校验 | workflows/runtime | workflows W01/W03 | 覆盖 | 候选细化评审后施工 | — |
| F07-005 | 模板与预设 | workflows/runtime | workflows/modes/CONTRACT.md · MODE-01 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-006 | 模板实例化 | workflows/runtime | workflows/modes/CONTRACT.md · MODE-02 | 覆盖 | 候选细化评审后施工 | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-007 | 模板组合 | workflows/runtime | workflows/modes/CONTRACT.md · MODE-02 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-008 | 模板保存与复用 | workflows/runtime | workflows/modes/CONTRACT.md · MODE-06 | 覆盖 | 候选细化评审后施工 | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-009 | 工作流触发条件 | workflows/runtime | workflows W03/W06；app APP-03；PRD-D04 | 部分 | 用户决策前置 | 触发来源、授权时点、重复触发和退出后运行策略需定义。 |
| F07-010 | 定义修订与草稿 | workflows/runtime | workflows/modes/CONTRACT.md · MODE-06 | 覆盖 | 候选细化评审后施工 | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-011 | 工作流导入导出 | workflows/runtime | workflows W01；shared SH-02/03；permissions PER-01 | 部分 | 补契约/语义评审后施工 | 定义修订与布局分离；导入导出需身份冲突/外部引用/部分成功语义。 |
| F07-012 | 专业模式 | workflows/modes | workflows/modes/CONTRACT.md · MODE-01/MODE-04 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-013 | 软件开发项目对象 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-01 | 覆盖 | 可直接施工（独立验收） | 软件开发专业对象子契约已补，尚未实现。 |
| F07-014 | 需求与功能对象 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-02 | 覆盖 | 候选细化评审后施工 | 需求/功能对象身份和修订已定义。 |
| F07-015 | 架构与组件关系 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-03 | 覆盖 | 候选细化评审后施工 | 专业关系不得自动变成执行依赖。 |
| F07-016 | 项目资源映射 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-04 | 覆盖 | 候选细化评审后施工 | 资源内容/版本仍归真实资源owner。 |
| F07-017 | 工作项追溯关系 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-05 | 覆盖 | 可直接施工（独立验收） | Task/Artifact事实仍归workflows。 |
| F07-018 | AI 结构建议草案 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-06 | 覆盖 | 候选细化评审后施工 | AI建议保持草案，显式采纳后才调用owner。 |
| F07-019 | 从模板创建或关联既有项目 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-01/SD-04 | 覆盖 | 可直接施工（独立验收） | 专业Project与Context/物理目录分离。 |
| F07-020 | 项目基准与决策记录 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-07 | 覆盖 | 候选细化评审后施工 | Baseline/Decision不覆盖Git/文件当前事实。 |
| F08-001 | Task 创建与读取 | workflows/runtime | workflows W02/W03/W04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-002 | Task 修订 | workflows/runtime | workflows W02/W03/W04 | 覆盖 | 候选细化评审后施工 | — |
| F08-003 | 责任分配 | workflows/runtime | workflows W02/W03/W04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-004 | 工作轮次 | workflows/runtime | workflows W02/W03/W04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-005 | 任务队列与优先级 | workflows/runtime | workflows W03；connections C02；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F08-006 | 依赖与条件推进 | workflows/runtime | workflows W03；connections C02；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F08-007 | 执行者选择与路由 | workflows/runtime | workflows W03；connections C02；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F08-008 | 调度与派发 | workflows/runtime | workflows W03；connections C02；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F08-009 | 资源冲突协调 | workflows/runtime | workflows W05/W03；connections C02；app APP-02 | 部分 | 实验前置 | 资源身份/别名、租约/fencing、跨Context冲突和容量策略待实验。 |
| F08-010 | 并发与容量调度 | workflows/runtime | workflows W05/W03；connections C02；app APP-02 | 部分 | 实验前置 | 资源身份/别名、租约/fencing、跨Context冲突和容量策略待实验。 |
| F08-011 | Task 状态与推进 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-012 | 暂停、继续和停止 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-013 | 失败、重试与升级 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-014 | 检查点与跨会话接续 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04 | 覆盖 | 可直接施工（独立验收） | — |
| F08-015 | 人工接管与交接 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04 | 覆盖 | 候选细化评审后施工 | — |
| F08-016 | 持续推进策略 | workflows/runtime | workflows W06；app APP-03；PRD-D04 | 部分 | 用户决策前置 | 持续推进能力与关窗/退出/休眠/后台政策分离；D04待决。 |
| F08-017 | 项目状态快照 | workflows/runtime | workflows W02/W04/W07；shared SH-02 | 部分 | 补契约/语义评审后施工 | 快照来源版本、失效、外部资源差异与恢复时效需定义。 |
| F09-001 | 可信主体识别 | permissions | permissions PER-01/04；app APP-02 | 覆盖 | 可直接施工（独立验收） | — |
| F09-002 | 可信入口识别 | permissions | permissions PER-01/04；app APP-02 | 覆盖 | 可直接施工（独立验收） | — |
| F09-003 | 模块启用约束 | permissions | permissions PER-01/04；app APP-02 | 覆盖 | 可直接施工（独立验收） | — |
| F09-004 | 全局访问约束 | permissions | permissions PER-01/04；app APP-02 | 覆盖 | 可直接施工（独立验收） | — |
| F09-005 | 对话启用约束 | permissions | permissions PER-01；conversations CONTRACT；PRD-D01 | 部分 | 用户决策前置 | 非对话入口策略D01未决，不能伪造Conversation ID或默认放行。 |
| F09-006 | 资源与动作判定 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-007 | 授权策略模式 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-008 | 授予与审批 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 候选细化评审后施工 | — |
| F09-009 | 授权撤销与收窄 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-010 | 执行前复核 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-011 | 权限审计 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-012 | 数据读取与外发权限 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 候选细化评审后施工 | — |
| F09-013 | 重装后的权限失效 | permissions | permissions PER-01–04；shared SH-04/05 | 覆盖 | 可直接施工（独立验收） | — |
| F09-014 | 撤权竞态与有限授权 | permissions | permissions PER-02/03；shared SH-02；connections C02 | 部分 | 实验 + 用户裁决 | 有限次数并发消费和撤权/派发竞态为C/D，未证原子消费前不启用。 |
| F10-001 | 业务数据持久化 | shared（持久化技术契约） | shared/CONTRACT.md · SH-02 | 覆盖 | 补契约/语义评审后施工 | shared只拥有技术持久化；各领域仍独立保存本域对象/状态/修订。 |
| F10-002 | 数据与程序分离 | app | app APP-01/04；shared SH-01/03 | 覆盖 | 可直接施工（独立验收） | — |
| F10-003 | 数据类别与存储形式 | shared（技术存储分类规则） | shared/CONTRACT.md · SH-02（存储类别） | 覆盖 | 补契约/语义评审后施工 | shared定义技术存储类别；各领域声明本域对象类别，不建立万能数据分类业务中心。 |
| F10-004 | 稳定身份与引用 | shared（稳定引用/定位技术规则） | shared/CONTRACT.md · SH-01（稳定引用/路径定位） | 覆盖 | 补契约/语义评审后施工 | shared定义稳定引用表示/定位规则；对象ID归源owner，文件身份归connections/local。 |
| F10-005 | 版本与并发修改 | shared（CAS/修订技术原语） | shared/CONTRACT.md · SH-02（CAS/意图） | 覆盖 | 补契约/语义评审后施工 | shared提供CAS/意图原语；业务冲突/合并语义归各领域。 |
| F10-006 | 数据导入导出 | app（导入/导出作业协调） | app/CONTRACT.md · APP-11；各领域导入/导出出口 | 部分 | 领域I/O细化后施工 | app协调作业；格式、对象冲突和本域导入校验由各领域提供，部分成功逐项报告。 |
| F10-007 | 备份与恢复 | app（备份/恢复流程协调） | app/CONTRACT.md · APP-12；shared SH-03 | 部分 | 实验前置 | app协调全局备份恢复；shared提供技术原语，各域提供一致性范围/钩子；PRD-C07未关闭。 |
| F10-008 | 数据迁移 | app（数据迁移协调） | app/CONTRACT.md · APP-04；shared SH-03 | 部分 | 实验前置 | app协调迁移；各域拥有schema迁移；跨域回滚不假定原子，PRD-C07未关闭。 |
| F10-009 | 内部检索 | views（获准检索聚合/投影） | views/CONTRACT.md · VIEW-01/03；各领域查询出口 | 部分 | 领域查询出口细化后施工 | views只聚合获准查询；各域提供权威查询出口，打开结果重判权限。 |
| F10-010 | 知识资料管理 | space（知识资料记录/关联） | space/CONTRACT.md · SPC-03/04；connections/local LOCAL-01/02 | 部分 | 领域资源引用细化后施工 | space拥有知识资料记录/引用；原文件字节和内容版本归connections/local。 |
| F10-011 | Agent 记忆 | AI | AI/CONTRACT.md · AIC-05 | 部分 | 补契约/语义评审后施工 | Agent派生记忆归AI；原始消息/项目资料不复制为第二事实源。 |
| F10-012 | 记忆来源与可信度 | AI | AI/CONTRACT.md · AIC-06 | 部分 | 补契约/语义评审后施工 | 可信来源由source owner提供；模型推断不能伪装用户确认。 |
| F10-013 | 记忆共享与隔离 | AI | AI/CONTRACT.md · AIC-07；permissions PER-01 | 部分 | 用户决策前置 | 共享范围由AI记录，实际读取许可由permissions决定；PRD-D10未决。 |
| F10-014 | 公共策略与经验库 | 待用户裁决：space公共知识集合或未来Knowledge owner | 无已批准契约；PRD-D13 | 缺失 | 产品方向/owner裁决前不施工 | 远期候选；PRD-D13确认是否纳入及owner方向前不施工。 |
| F10-015 | 记忆纠错、过期和删除 | AI | AI/CONTRACT.md · AIC-08；PRD-D05/D10 | 部分 | 用户决策前置 | 只删除AI派生记忆；来源原件和审计保留政策独立。 |
| F10-016 | 用户级偏好与跨项目记忆 | AI | AI/CONTRACT.md · AIC-09；PRD-D10 | 部分 | 用户决策前置 | 用户偏好记忆与Agent私有记忆分开；不自动复制到全部Context。 |
| F11-001 | 视图定义 | views | views/CONTRACT.md · VIEW-01 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-002 | 多种视图投影 | views | views/CONTRACT.md · VIEW-01 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-003 | 对象映射 | views | views/CONTRACT.md · VIEW-02 | 覆盖 | 可直接施工（独立验收） | 视图能力锚点已补，源对象owner保持不变。 |
| F11-004 | 关系映射 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 可直接施工（独立验收） | 视图能力锚点已补，源对象owner保持不变。 |
| F11-005 | 布局与筛选配置 | views | views/CONTRACT.md · VIEW-04 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-006 | 多视图关联 | views | views/CONTRACT.md · VIEW-05 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-007 | 视图投影刷新 | views | views/CONTRACT.md · VIEW-05 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-008 | 草稿与提交映射 | views | views/CONTRACT.md · VIEW-05 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-009 | 专业视图规则 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-010 | 视图性能与大规模数据 | views | views/CONTRACT.md · VIEW-06 | 部分 | 实验前置 | 性能阈值与大规模降级仍需实测。 |
| F11-011 | 需求/功能树投影 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-012 | 架构关系视图 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-013 | 功能与资源映射视图 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-014 | 任务与进度投影 | views | views/CONTRACT.md · VIEW-03 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-015 | 稳定对象定位与对话锚点 | views | views/CONTRACT.md · VIEW-07 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F12-001 | 插件描述清单 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-002 | 插件发现与登记 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-003 | 安装、启用与停用 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-004 | 插件能力提供 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-005 | 插件依赖与版本兼容 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 实验前置 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-006 | 插件信任与完整性 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 实验前置 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-007 | 插件隔离 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 实验前置 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-008 | 插件配置与数据 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-009 | 插件 UI 扩展 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 补契约后施工 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-010 | 插件更新、卸载与回滚 | plugins（预留） | plugins README（无CONTRACT）；app APP-02；connections C01/C02；permissions PER-01 | 缺失 | 实验前置 | WEX插件平台预留；D09信任政策和C06 Windows隔离未完成，不得以DSH实验代替。 |
| F12-011 | DSH 双路线边界 | plugins（预留） | plugins README；双插件边界设计；connections §3外部Agent | 覆盖 | 可直接施工（独立验收） | 仅覆盖双路线边界，不代表WEX插件或DSH连接器已完成。 |
| F12-012 | 插件目录与重装重识别 | plugins（预留） | plugins README；app/CONTRACT.md · APP-04；shared/CONTRACT.md · SH-01 | 部分 | 实验前置 | 插件目录重识别依赖根身份/应用更新协调；SH-05凭证能力不再错误映射到插件目录。 |
| F13-001 | 产物登记 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F13-002 | 产物来源追踪 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F13-003 | Receipt 关联 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F13-004 | Evidence 收集 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F13-005 | Review 记录 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F13-006 | Verification 规则 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 候选细化评审后施工 | — |
| F13-007 | Verification 执行 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F13-008 | Acceptance 决策 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 用户决策前置 | — |
| F13-009 | 版本漂移失效 | workflows | workflows W04；connections C02/C03；permissions PER-01 | 覆盖 | 可直接施工（独立验收） | — |
| F13-010 | 证据包与导出 | workflows | workflows W04；shared SH-03；permissions PER-01 | 部分 | 补契约/语义评审后施工 | 证据包导出需定义范围、脱敏、缺失附件、引用快照和部分失败。 |
| F13-011 | 证据冲突处理 | workflows | workflows W04；connections C03 | 覆盖 | 候选细化评审后施工 | — |
| F14-001 | Windows 安装交付 | app | app APP-01/04；shared SH-01/03/05 | 部分 | 实验前置 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-002 | 安装位置选择 | app | app APP-01/04；shared SH-01/03/05 | 部分 | 补契约/语义评审后施工 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-003 | 首次启动初始化 | app | app APP-01/04；shared SH-01/03/05 | 部分 | 补契约/语义评审后施工 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-004 | 单实例与重复启动 | app | app APP-01/04；shared SH-01/03/05 | 部分 | 实验前置 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-005 | 模块发现与装配 | app | app APP-02/03 | 覆盖 | 可直接施工（独立验收） | — |
| F14-006 | 模块生命周期 | app | app APP-02/03 | 覆盖 | 可直接施工（独立验收） | — |
| F14-007 | 可信宿主通信 | app | app APP-02；UI CONTRACT；permissions PER-01 | 部分 | 实验前置 | IPC sender身份、参数schema、超时/取消/重放/撤权缓存需实验。 |
| F14-008 | 窗口与应用生命周期 | app | app APP-03；PRD-D04 | 部分 | 用户决策前置 | 关窗/退出/托盘/后台策略D04未决；技术行为可独立测试。 |
| F14-009 | Windows 系统集成 | app | app APP-03；UI CONTRACT；PRD-D04 | 部分 | 用户决策前置 | 菜单/通知/文件关联/托盘/快捷键等平台能力与政策需细化。 |
| F14-010 | 凭证平台接线 | app | app/CONTRACT.md · APP-02；shared/CONTRACT.md · SH-04/05 | 部分 | 实验前置 | app负责可信平台接线；shared负责凭证引用/平台后端；permissions决定本次使用许可。 |
| F14-011 | 应用升级与卸载 | app | app APP-04；shared SH-03；PRD-D07 | 部分 | 用户决策前置 | 程序回滚、数据迁移、插件兼容/卸载分离；自动更新D07待决。 |
| F14-012 | 安全模式与启动降级 | app | app APP-02/03；plugins README；F15-006 | 部分 | 实验前置 | 安全模式需验证Renderer/主进程/插件宿主故障边界。 |
| F15-001 | 结构化运行日志 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-002 | 跨模块调用追踪 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-003 | 运行指标 | app（宿主运行保障） | app/CONTRACT.md · APP-05 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-004 | 健康检查 | app（宿主运行保障） | app/CONTRACT.md · APP-05 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-005 | 故障诊断 | app（宿主运行保障） | app/CONTRACT.md · APP-06 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-006 | 崩溃与安全恢复 | app（宿主运行保障） | app/CONTRACT.md · APP-07 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-007 | 数据容量与维护 | app（宿主运行保障） | app/CONTRACT.md · APP-05/APP-10；shared容量技术观察 | 部分 | 候选细化评审后施工 | app拥有容量维护入口；各owner决定本域可清理对象，不由app直接删除。 |
| F15-008 | 备份与恢复运行保障 | app（宿主运行保障） | app/CONTRACT.md · APP-12；shared SH-03 | 部分 | 实验前置 | app协调备份任务和完整性检查；备份范围与数据语义由F10-007/各owner提供。 |
| F15-009 | 网络与离线诊断 | app（宿主运行保障） | app/CONTRACT.md · APP-05 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-010 | 进程与资源维护 | app（宿主进程协调） | app/CONTRACT.md · APP-05/APP-07；connections/local LOCAL-06 | 部分 | 实验前置 | app拥有宿主协调；local提供进程树事实；Windows残留进程和退出确认需实验。 |
| F15-011 | 维护与清理策略 | app（维护/清理流程协调） | app/CONTRACT.md · APP-10；各数据owner清理出口；PRD-D05/D12 | 部分 | 用户决策前置 | app拥有清理流程编排；实际保留/删除由数据owner执行，PRD-D05/D12待决。 |
| F15-012 | 通知事件来源保障 | app（宿主运行保障） | app/CONTRACT.md · APP-08 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-013 | 用户帮助与问题报告 | app（宿主运行保障） | app/CONTRACT.md · APP-06 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-014 | 配置完整性与恢复协调 | app（宿主运行保障） | app/CONTRACT.md · APP-09 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-015 | 日志配置与保留策略 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06；正式账本owner；PRD-D05 | 部分 | 用户决策前置 | shared只管理普通技术日志；权限审计/Operation/Task证据保留不归shared。 |

## 4. 必须优先补齐的模块契约

1. **conversations**：已补CV-01～CV-15；下一步按稳定输入输出和失败样例实现并测试。
2. **connections/api**：已补API-01～API-07；下一步用真实Provider验证流式、usage、限流和错误映射，不另建Operation账本。
3. **connections/local**：已补LOCAL-01～LOCAL-10；下一步做Windows路径/ACL/进程树实验，终端/Git/Android能力按证据分阶段开放。
4. **workflows/modes/software-development**：已补SD-01～SD-07；继续验证专业关系、资源映射与执行依赖严格分离。
5. **views**：已补VIEW-01～VIEW-07；多图传播、撤权缓存和规模性能仍需实验。
6. **AI记忆**：已补AIC-05～AIC-08；共享默认值与删除/保留政策仍受D10/D05约束。
7. **shared日志技术能力**：已补SH-06候选契约；不接管权限审计、Operation或Task/Evidence。
8. **app运行维护**：将健康、诊断、崩溃恢复、通知投递、配置恢复协调补入APP契约；各模块仍拥有自身配置语义。
9. **connections Service生命周期**：定义Service实例/代次、Connection绑定、Capability状态、停用/卸载和迟到回调。
10. **F10/F15复合项**：分离横向技术标准与领域业务事实，必要时拆分功能项，确保唯一主责。

## 5. 维护规则

- F编号稳定；本映射只增加可追踪关系，不重编号。
- 模块CONTRACT变更时同步修改映射行和覆盖状态。
- owner变更必须检查H01–H30及所有依赖消费者。
- 候选锚点正式落入模块CONTRACT前，不得当作已经存在的API。
- UI/CONTRACT和I编号只映射交互入口，不替代F owner。
