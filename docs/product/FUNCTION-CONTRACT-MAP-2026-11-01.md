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
| space | SPC-01–SPC-07 | 稳定能力编号；SPC-06/07承接Context资源引用与工具组合细分 |
| AI / roles | AIC-01–AIC-08 | 已补记忆子契约；D10/D05仍未决 |
| connections | C01–C05 + CONNECTIONS-* | 核心宿主细分编号；API/LOCAL 子模块独立维护 |
| conversations | CV-01–CV-16 + CONVERSATIONS-* | 既有业务锚点保留；新增细粒度对话业务编号 |
| connections/api | API-01–API-07 | 已补适配器子契约，真实Provider待验 |
| connections/local | LOCAL-01–LOCAL-10 | 已补适配器子契约，Windows实测待验 |
| workflows | W01–W07 + WORKFLOWS-* | 核心业务细分编号；W01–W07 保留为契约章节锚点 |
| workflows/modes | MODE-01–MODE-06 | 已补稳定锚点，仍为B候选 |
| workflows/editor | WORKFLOWS-EDITOR-001～011 | 自由格子交互子域编号；布局数据归 views |
| software-development mode | SD-01–SD-07 | 已补专业模式子契约，未实现 |
| permissions | PER-01–PER-04 + PERMISSIONS-* | 既有能力锚点保留；新增细粒度判权/策略/审计编号 |
| shared | SH-01–SH-06 + SHARED-* | 既有技术能力锚点保留；新增存储/路径/凭证/日志细分编号 |
| views | VIEW-01–VIEW-07 + VIEWS-* | 既有能力锚点保留；新增细粒度视图/布局编号 |
| app | APP-01–APP-12 + APP-* | 既有宿主能力锚点保留；新增安装/数据根/装配/平台/维护细分编号 |
| UI | UI/CONTRACT及I01–I16 | UI只拥有交互/呈现，不拥有F业务事实 |
| plugins/accounts/dsh | README与研究文档 | 预留/独立路线；不是已建立WEX业务契约 |

> CV/API/LOCAL/MODE/SD/VIEW/AIC/APP/SH能力锚点均已写入对应CONTRACT，当前仍为B/C/D候选语义；不等于接口签名冻结或产品实现完成。

## 2. 映射统计

- F功能项：**216项**，15个功能域。
- 契约覆盖：覆盖 142；部分 62；缺失 12。
- 准备度初判：候选细化评审后施工 70；可直接施工（独立验收） 61；实验前置 32；实验 + 用户裁决 2；补契约/语义评审后施工 30；用户决策前置 14；产品方向/owner裁决前不施工 1；补契约后施工 6。
- 主责复合/待拆分项目：0项；F10-014为有意保留的远期候选，Space是未来owner候选但最终契约未定，不是当前基础模块的复合owner。

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
| F01-008 | Context 组合引用 | space | space/CONTRACT · SPC-03、SPC-06 | 覆盖 | 可直接施工（独立验收） | 资源引用条目细分见 SPACE-RESOURCE-001～007。 |
| F01-009 | Context 有效配置解析 | space | space/CONTRACT · SPC-03、SPC-07；AI AIC-03/04；connections C01；permissions PER-01 | 部分 | 实验前置 | Context 工具组合细分见 SPACE-TOOL-001～003；跨域默认/覆盖优先级、冲突决议和失效重算仍需补齐。 |
| F01-010 | 引用解除与本体删除分离 | space | space SPC-05；permissions PER-03；workflows W05 | 部分 | 实验 + 用户裁决 | 删除竞争屏障为C/D，实际删除延期。 |
| F01-011 | Context 查询与可见性 | space | space SPC-04；permissions PER-01/04 | 覆盖 | 候选细化评审后施工 | — |
| F01-012 | Context 接回与重定位 | space | space SPC-01；app APP-01；shared SH-01；connections/local README | 部分 | 实验前置 | 目录接回、身份冲突、重定位需子契约和Windows实验。 |
| F02-001 | Agent 定义 | AI | AI AIC-01；模块编号：AI-AGENT-001 | 覆盖 | 候选细化评审后施工 | — |
| F02-002 | 角色定义 | AI | AI AIC-02；模块编号：AI-ROLE-001、AI-TOOL-ELIGIBILITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F02-003 | 职责配置 | AI | AI AIC-02；模块编号：AI-RESPONSIBILITY-001、AI-TOOL-ELIGIBILITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F02-004 | 职责范围绑定 | AI | AI AIC-02；模块编号：AI-SCOPE-001 | 覆盖 | 可直接施工（独立验收） | — |
| F02-005 | 模型与连接引用 | AI | AI AIC-01；connections C01；shared SH-04；模块编号：AI-MODEL-001 | 覆盖 | 候选细化评审后施工 | — |
| F02-006 | Agent 配置修订 | AI | AI AIC-01；模块编号：AI-AGENT-002、AI-PROMPT-001、AI-WORK-SNAPSHOT-001 | 覆盖 | 候选细化评审后施工 | — |
| F02-007 | Agent 运行实例绑定与观察 | AI | AI AIC-01/04；connections C01/03/04；app APP-02；模块编号：AI-RUNTIME-001 | 部分 | 实验前置 | 缺Agent实例启动/暂停/释放/重连的完整生命周期契约。 |
| F02-008 | Agent Session 映射 | AI | AI AIC-04；connections C01/03/04；模块编号：AI-SESSION-001 | 部分 | 补契约/语义评审后施工 | 需外部实例代次、Session定位和可查询性子契约。 |
| F02-009 | 外部 Agent 接入 | AI | AI AIC-04；connections C01/03/04；模块编号：AI-EXTERNAL-001 | 部分 | 补契约/语义评审后施工 | 需外部实例代次、Session定位和可查询性子契约。 |
| F02-010 | 执行者替换与交接 | AI | AI AIC-04；workflows W02/W06；connections C04；模块编号：AI-HANDOVER-001 | 覆盖 | 候选细化评审后施工 | — |
| F02-011 | Agent 记忆策略配置 | AI | AI AIC-01/04；F10记忆契约缺口；permissions PER-01；模块编号：AI-MEMORY-SHARING-001 | 缺失 | 用户决策前置 | AI契约没有记忆对象、来源、共享、撤回、纠错和过期能力。 |
| F02-012 | Agent 状态与工作状态分离 | AI | AI AIC-03/04；connections C03/04；workflows W07；模块编号：AI-STATUS-001 | 部分 | 补契约/语义评审后施工 | 需区分Agent配置、Runtime在线、Session可查询和Task状态的观察来源。 |
| F03-001 | 独立会话生命周期 | conversations | conversations/CONTRACT.md · CV-01；模块编号：CONVERSATIONS-THREAD-001 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-002 | 消息与轮次持久化 | conversations | conversations/CONTRACT.md · CV-02；模块编号：CONVERSATIONS-MESSAGE-001、CONVERSATIONS-GENERATION-001、CONVERSATIONS-STATE-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-003 | 消息序列项 | conversations | conversations/CONTRACT.md · CV-03；模块编号：CONVERSATIONS-SEQUENCE-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-004 | 局部选择与引用 | conversations | conversations/CONTRACT.md · CV-04；模块编号：CONVERSATIONS-REFERENCE-001 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-005 | 分支讨论 | conversations | conversations/CONTRACT.md · CV-05；模块编号：CONVERSATIONS-BRANCH-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-006 | 已发送消息修改与重发 | conversations | conversations/CONTRACT.md · CV-06；模块编号：CONVERSATIONS-RESUBMIT-001 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-007 | 生成期间追加与排队 | conversations | conversations/CONTRACT.md · CV-07；模块编号：CONVERSATIONS-QUEUE-001 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-008 | 流式输出与定稿 | conversations | conversations/CONTRACT.md · CV-08；模块编号：CONVERSATIONS-GENERATION-001、CONVERSATIONS-STREAM-001、CONVERSATIONS-STATE-001 | 覆盖 | 实验前置 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-009 | 停止生成 | conversations | conversations/CONTRACT.md · CV-09；模块编号：CONVERSATIONS-STOP-001、CONVERSATIONS-STATE-001 | 覆盖 | 实验前置 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-010 | 对话背景与模型选择 | conversations | conversations/CONTRACT.md · CV-10；模块编号：CONVERSATIONS-CONTEXT-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-011 | 输入附件与来源 | conversations | conversations/CONTRACT.md · CV-11；模块编号：CONVERSATIONS-ATTACHMENT-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-012 | 工具意图往返 | conversations | conversations/CONTRACT.md · CV-12；模块编号：CONVERSATIONS-TOOL-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-013 | 显式转为 Task | conversations | conversations/CONTRACT.md · CV-13；模块编号：CONVERSATIONS-TASK-001 | 覆盖 | 可直接施工（独立验收） | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-014 | 会话检索与历史读取 | conversations | conversations/CONTRACT.md · CV-14；模块编号：CONVERSATIONS-SEARCH-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-015 | 序列项采纳/拒绝状态 | conversations | conversations/CONTRACT.md · CV-15；模块编号：CONVERSATIONS-DECISION-001 | 覆盖 | 候选细化评审后施工 | 已补逐项锚点；流式/取消/提交未知仍按原C样例验收。 |
| F03-016 | 序列项局部补充与修订 | conversations | conversations/CONTRACT.md · CV-16；模块编号：CONVERSATIONS-ITEM-REVISION-001 | 覆盖 | 候选细化评审后施工 | 序列项局部修订与历史消息重发分开；CV-16只修改单项版本。 |
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
| F05-001 | Connection 生命周期 | connections | connections C01；模块编号：CONNECTIONS-CONNECTION-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-002 | 能力描述 | connections | connections C01/C02；模块编号：CONNECTIONS-CAPABILITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-003 | 能力注册与发现 | connections | connections C01；app APP-02；模块编号：CONNECTIONS-DISCOVERY-001 | 覆盖 | 候选细化评审后施工 | — |
| F05-004 | 能力就绪检查 | connections | connections C01/C03；app APP-02；模块编号：CONNECTIONS-HEALTH-001 | 覆盖 | 候选细化评审后施工 | — |
| F05-005 | 连接配置与能力版本 | connections | connections C01/C02；模块编号：CONNECTIONS-VERSION-001 | 覆盖 | 候选细化评审后施工 | — |
| F05-006 | 受控调用入口 | connections | connections C02；permissions PER-01/03；模块编号：CONNECTIONS-ADMISSION-001、CONNECTIONS-RESOURCE-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-007 | Operation 尝试与回执 | connections | connections C02；shared SH-02；模块编号：CONNECTIONS-OPERATION-001、CONNECTIONS-IDEMPOTENCY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-008 | 结果查询与进度观察 | connections | connections C03；模块编号：CONNECTIONS-OBSERVATION-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-009 | 取消与接续能力声明 | connections | connections C04；模块编号：CONNECTIONS-CONTROL-001、CONNECTIONS-RECOVERY-001 | 覆盖 | 实验前置 | — |
| F05-010 | 外部事件与回调接入 | connections | connections C05；app APP-02；permissions PER-01；模块编号：CONNECTIONS-CALLBACK-001、CONNECTIONS-NOTIFICATION-001 | 部分 | 实验前置 | 回调认证、重放、代次、顺序和撤权竞态仍需实验。 |
| F05-011 | 外部 Agent 连接器 | connections | connections C01–04；connections/dsh README；模块编号：CONNECTIONS-AGENT-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-012 | GitHub / Local 等系统适配 | connections | connections §3；connections/local/CONTRACT.md · LOCAL-01～10；connections/github README；模块编号：CONNECTIONS-ADAPTER-001 | 部分 | 补契约/语义评审后施工 | Local子契约已补，Windows实测仍待验；GitHub仍需独立远端操作/冲突/回执契约与验收。 |
| F05-013 | 网络代理与连接策略 | connections | connections C01/C03；app APP-02；模块编号：CONNECTIONS-NETWORK-001 | 部分 | 实验前置 | 通用代理偏好与Provider专属代理/证书分层，离线重连按适配器验收。 |
| F05-014 | 连接器错误规范化 | connections | connections C02/C03/C04；模块编号：CONNECTIONS-ERROR-001 | 覆盖 | 可直接施工（独立验收） | — |
| F05-015 | Service 生命周期与连接绑定 | connections | connections C01；app APP-02；模块编号：CONNECTIONS-SERVICE-001 | 部分 | 补契约/语义评审后施工 | 契约已补；真实实例代次、停用/卸载、释放与迟到回调仍需独立实验。 |
| F05-016 | 外部 Search / Fetch / Browser 适配 | connections | connections C01–03；permissions PER-01；F10-009；模块编号：CONNECTIONS-SEARCH-001 | 部分 | 补契约/语义评审后施工 | Search/Fetch/Browser不同于内部检索，当前为后续扩展。 |
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
| F07-001 | 工作流定义 | workflows/runtime | workflows W01/W03；模块编号：WORKFLOWS-DEFINITION-001、WORKFLOWS-REVISION-001/002 | 覆盖 | 可直接施工（独立验收） | — |
| F07-002 | 节点能力描述 | workflows/runtime | workflows W01/W03；模块编号：WORKFLOWS-NODE-001～003 | 覆盖 | 候选细化评审后施工 | — |
| F07-003 | 流程依赖关系 | workflows/runtime | workflows W01/W03；模块编号：WORKFLOWS-EDGE-001/002 | 覆盖 | 候选细化评审后施工 | — |
| F07-004 | 工作流校验 | workflows/runtime | workflows W01/W03；模块编号：WORKFLOWS-VALIDATION-001/002 | 覆盖 | 候选细化评审后施工 | — |
| F07-005 | 模板与预设 | workflows/modes | workflows/modes/CONTRACT.md · MODE-01 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-006 | 模板实例化 | workflows/modes | workflows/modes/CONTRACT.md · MODE-02 | 覆盖 | 候选细化评审后施工 | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-007 | 模板组合 | workflows/modes | workflows/modes/CONTRACT.md · MODE-02 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-008 | 模板保存与复用 | workflows/modes | workflows/modes/CONTRACT.md · MODE-06 | 覆盖 | 候选细化评审后施工 | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-009 | 工作流触发条件 | workflows/runtime | workflows W03/W06；app APP-03；PRD-D04；模块编号：WORKFLOWS-TRIGGER-001～003 | 部分 | 用户决策前置 | 触发来源、授权时点、重复触发和退出后运行策略需定义。 |
| F07-010 | 定义修订与草稿 | workflows/runtime | workflows W01；WORKFLOWS-REVISION-001/002 | 覆盖 | 候选细化评审后施工 | 定义修订、草稿和冲突处理由 workflows W01 承接；模式模板修订仍归 MODE。 |
| F07-011 | 工作流导入导出 | workflows/runtime | workflows W01；shared SH-02/03；permissions PER-01；模块编号：WORKFLOWS-TRANSFER-001/002 | 部分 | 补契约/语义评审后施工 | 定义修订与布局分离；导入导出需身份冲突/外部引用/部分成功语义。 |
| F07-012 | 专业模式 | workflows/modes | workflows/modes/CONTRACT.md · MODE-01/MODE-04 | 覆盖 | 可直接施工（独立验收） | 已补稳定模式能力锚点；专业模式仍为可选组合。 |
| F07-013 | 软件开发项目对象 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-01 | 覆盖 | 可直接施工（独立验收） | 软件开发专业对象子契约已补，尚未实现。 |
| F07-014 | 需求与功能对象 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-02 | 覆盖 | 候选细化评审后施工 | 需求/功能对象身份和修订已定义。 |
| F07-015 | 架构与组件关系 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-03 | 覆盖 | 候选细化评审后施工 | 专业关系不得自动变成执行依赖。 |
| F07-016 | 项目资源映射 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-04 | 覆盖 | 候选细化评审后施工 | 资源内容/版本仍归真实资源owner。 |
| F07-017 | 工作项追溯关系 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-05 | 覆盖 | 可直接施工（独立验收） | Task/Artifact事实仍归workflows。 |
| F07-018 | AI 结构建议草案 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-06 | 覆盖 | 候选细化评审后施工 | AI建议保持草案，显式采纳后才调用owner。 |
| F07-019 | 从模板创建或关联既有项目 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-01/SD-04 | 覆盖 | 可直接施工（独立验收） | 专业Project与Context/物理目录分离。 |
| F07-020 | 项目基准与决策记录 | workflows/modes | workflows/modes/software-development/CONTRACT.md · SD-07 | 覆盖 | 候选细化评审后施工 | Baseline/Decision不覆盖Git/文件当前事实。 |
| F08-001 | Task 创建与读取 | workflows/runtime | workflows W02/W03/W04；模块编号：WORKFLOWS-TASK-001 | 覆盖 | 可直接施工（独立验收） | — |
| F08-002 | Task 修订 | workflows/runtime | workflows W02/W03/W04；模块编号：WORKFLOWS-TASK-001 | 覆盖 | 候选细化评审后施工 | — |
| F08-003 | 责任分配 | workflows/runtime | workflows W02/W03/W04；模块编号：WORKFLOWS-TASK-002 | 覆盖 | 可直接施工（独立验收） | — |
| F08-004 | 工作轮次 | workflows/runtime | workflows W02/W03/W04；模块编号：WORKFLOWS-TASK-002、WORKFLOWS-RUN-002 | 覆盖 | 可直接施工（独立验收） | — |
| F08-005 | 任务队列与优先级 | workflows/runtime | workflows W03；connections C02；permissions PER-01；模块编号：WORKFLOWS-QUEUE-001 | 覆盖 | 候选细化评审后施工 | — |
| F08-006 | 依赖与条件推进 | workflows/runtime | workflows W03；connections C02；permissions PER-01；模块编号：WORKFLOWS-EDGE-001/002、WORKFLOWS-VALIDATION-002 | 覆盖 | 候选细化评审后施工 | — |
| F08-007 | 执行者选择与路由 | workflows/runtime | workflows W03；connections C02；permissions PER-01；模块编号：WORKFLOWS-DISPATCH-001 | 覆盖 | 候选细化评审后施工 | — |
| F08-008 | 调度与派发 | workflows/runtime | workflows W03；connections C02；permissions PER-01；模块编号：WORKFLOWS-DISPATCH-002 | 覆盖 | 可直接施工（独立验收） | — |
| F08-009 | 资源冲突协调 | workflows/runtime | workflows W05/W03；connections C02；app APP-02；模块编号：WORKFLOWS-RESOURCE-001 | 部分 | 实验前置 | 资源身份/别名、租约/fencing、跨Context冲突和容量策略待实验。 |
| F08-010 | 并发与容量调度 | workflows/runtime | workflows W05/W03；connections C02；app APP-02；模块编号：WORKFLOWS-CAPACITY-001 | 部分 | 实验前置 | 资源身份/别名、租约/fencing、跨Context冲突和容量策略待实验。 |
| F08-011 | Task 状态与推进 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04；模块编号：WORKFLOWS-RUN-001/002、WORKFLOWS-PROJECTION-001 | 覆盖 | 可直接施工（独立验收） | — |
| F08-012 | 暂停、继续和停止 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04；模块编号：WORKFLOWS-CONTROL-001 | 覆盖 | 可直接施工（独立验收） | — |
| F08-013 | 失败、重试与升级 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04；模块编号：WORKFLOWS-FAILURE-001、WORKFLOWS-RECOVERY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F08-014 | 检查点与跨会话接续 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04；模块编号：WORKFLOWS-CHECKPOINT-001 | 覆盖 | 可直接施工（独立验收） | — |
| F08-015 | 人工接管与交接 | workflows/runtime | workflows W02/W03/W04/W06；connections C02–04；模块编号：WORKFLOWS-HANDOVER-001 | 覆盖 | 候选细化评审后施工 | — |
| F08-016 | 持续推进策略 | workflows/runtime | workflows W06；app APP-03；PRD-D04；模块编号：WORKFLOWS-CONTINUITY-001 | 部分 | 用户决策前置 | 持续推进能力与关窗/退出/休眠/后台政策分离；D04待决。 |
| F08-017 | 项目状态快照 | workflows/runtime | workflows W02/W04/W07；shared SH-02；模块编号：WORKFLOWS-SNAPSHOT-001 | 部分 | 补契约/语义评审后施工 | 快照来源版本、失效、外部资源差异与恢复时效需定义。 |
| F09-001 | 可信主体识别 | permissions | permissions PER-01/04；app APP-02；模块编号：PERMISSIONS-SUBJECT-001；app模块编号：APP-TRUSTED-IDENTITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-002 | 可信入口识别 | permissions | permissions PER-01/04；app APP-02；模块编号：PERMISSIONS-ENTRY-001；app模块编号：APP-TRUSTED-IDENTITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-003 | 模块启用约束 | permissions | permissions PER-01/04；app APP-02；模块编号：PERMISSIONS-MODULE-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-004 | 全局访问约束 | permissions | permissions PER-01/04；app APP-02；模块编号：PERMISSIONS-GLOBAL-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-005 | 对话启用约束 | permissions | permissions PER-01；PRD-D01/D02 权限判定矩阵；conversations CONTRACT；模块编号：PERMISSIONS-CONVERSATION-001 | 部分 | 可信事实/入口映射/四级策略实现前置 | 工具→AI→Context→执行位置逐层收敛；非对话入口仍拒绝，直至可信主体/入口事实及策略映射完成实现与验收。 |
| F09-006 | 资源与动作判定 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-RESOURCE-001、PERMISSIONS-EVALUATION-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-007 | 授权策略模式 | permissions | permissions PER-01–04；PRD-D01/D02 权限判定矩阵；shared SH-04/05；模块编号：PERMISSIONS-POLICY-001、PERMISSIONS-DIALOGUE-LEVEL-001、PERMISSIONS-WORKFLOW-START-001 | 部分 | 四级与工作流启动授权语义已确认，待实现 | IV级在授权范围内全风险自主；工作流节点可手动/AI配置，启动时用户确认本次运行一次；主AI与秘书AI共享对话等级且须用户主动设置。 |
| F09-008 | 授予与审批 | permissions | permissions PER-01–04；PRD-D01/D02 权限判定矩阵；shared SH-04/05；模块编号：PERMISSIONS-GRANT-001、PERMISSIONS-SPECIAL-BOUNDARY-001 | 部分 | 特殊信任边界及needs-approval业务流待收敛 | 风险标签本身不阻止IV级范围内执行；Shell、插件来源信任、WEX自身权限策略和凭证边界仍待用户确认。 |
| F09-009 | 授权撤销与收窄 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-REVOCATION-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-010 | 执行前复核 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-RECHECK-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-011 | 权限审计 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-AUDIT-001、PERMISSIONS-HISTORY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-012 | 数据读取与外发权限 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-DISCLOSURE-001、PERMISSIONS-SPECIAL-BOUNDARY-001 | 覆盖 | 候选细化评审后施工 | — |
| F09-013 | 重装后的权限失效 | permissions | permissions PER-01–04；shared SH-04/05；模块编号：PERMISSIONS-REINSTALL-001 | 覆盖 | 可直接施工（独立验收） | — |
| F09-014 | 撤权竞态与有限授权 | permissions | permissions PER-02/03；shared SH-02；connections C02；模块编号：PERMISSIONS-RACE-001 | 部分 | 实验 + 用户裁决 | 有限次数并发消费和撤权/派发竞态为C/D，未证原子消费前不启用。 |
| F10-001 | 业务数据持久化 | shared（持久化技术契约） | shared/CONTRACT.md · SH-02；shared模块编号：SHARED-STORE-001、SHARED-TRANSACTION-001 | 覆盖 | 补契约/语义评审后施工 | shared只拥有技术持久化；各领域仍独立保存本域对象/状态/修订。 |
| F10-002 | 数据与程序分离 | app | app APP-01/04；shared SH-01/03；app模块编号：APP-INSTALL-002、APP-DATA-ROOT-001 | 覆盖 | 可直接施工（独立验收） | — |
| F10-003 | 数据类别与存储形式 | shared（技术存储分类规则） | shared/CONTRACT.md · SH-02（存储类别）；shared模块编号：SHARED-CATEGORY-001 | 覆盖 | 补契约/语义评审后施工 | shared定义技术存储类别；各领域声明本域对象类别，不建立万能数据分类业务中心。 |
| F10-004 | 稳定身份与引用 | shared（稳定引用/定位技术规则） | shared/CONTRACT.md · SH-01（稳定引用/路径定位）；shared模块编号：SHARED-PATH-001 | 覆盖 | 补契约/语义评审后施工 | shared定义稳定引用表示/定位规则；对象ID归源owner，文件身份归connections/local。 |
| F10-005 | 版本与并发修改 | shared（CAS/修订技术原语） | shared/CONTRACT.md · SH-02（CAS/意图）；shared模块编号：SHARED-CAS-001、SHARED-INTENT-001 | 覆盖 | 补契约/语义评审后施工 | shared提供CAS/意图原语；业务冲突/合并语义归各领域。 |
| F10-006 | 数据导入导出 | app（导入/导出作业协调） | app/CONTRACT.md · APP-11；各领域导入/导出出口；app模块编号：APP-IMPORT-EXPORT-001 | 部分 | 领域I/O细化后施工 | app协调作业；格式、对象冲突和本域导入校验由各领域提供，部分成功逐项报告。 |
| F10-007 | 备份与恢复 | app（备份/恢复流程协调） | app/CONTRACT.md · APP-12；shared SH-03；app模块编号：APP-BACKUP-001；shared模块编号：SHARED-BACKUP-001、SHARED-RESTORE-001 | 部分 | 实验前置 | app协调全局备份恢复；shared提供技术原语，各域提供一致性范围/钩子；PRD-C07未关闭。 |
| F10-008 | 数据迁移 | app（数据迁移协调） | app/CONTRACT.md · APP-04；shared SH-03；app模块编号：APP-MIGRATION-001；shared模块编号：SHARED-MIGRATION-001 | 部分 | 实验前置 | app协调迁移；各域拥有schema迁移；跨域回滚不假定原子，PRD-C07未关闭。 |
| F10-009 | 内部检索 | views（获准检索聚合/投影） | views/CONTRACT.md · VIEW-01/03；各领域查询出口；模块编号：VIEWS-QUERY-001 | 部分 | 领域查询出口细化后施工 | views只聚合获准查询；各域提供权威查询出口，打开结果重判权限。 |
| F10-010 | 知识资料管理 | space（知识资料记录/关联） | space/CONTRACT.md · SPC-03/04；connections/local LOCAL-01/02 | 部分 | 领域资源引用细化后施工 | space拥有知识资料记录/引用；原文件字节和内容版本归connections/local。 |
| F10-011 | Agent 记忆 | AI | AI/CONTRACT.md · AIC-05；conversations/CONTRACT.md；connections Operation；模块编号：AI-MEMORY-001 | 部分 | 远期研究/源记录先行 | 前期保存Agent关联的原始对话/操作记录，由源owner持有；AI派生长期记忆另行研究，不复制第二事实源。 |
| F10-012 | 记忆来源与可信度 | AI | AI/CONTRACT.md · AIC-06；模块编号：AI-MEMORY-SOURCE-001 | 部分 | 补契约/语义评审后施工 | 可信来源由source owner提供；模型推断不能伪装用户确认。 |
| F10-013 | 记忆共享与隔离 | AI | AI/CONTRACT.md · AIC-07；permissions PER-01；模块编号：AI-MEMORY-SHARING-001 | 部分 | 远期研究 | 记忆共享政策暂缓；实际读取许可始终由permissions决定；PRD-D10前期不启用派生记忆共享。 |
| F10-014 | 公共策略与经验库 | 暂不分配（远期候选；Space为未来owner候选） | 无已批准契约；PRD-D13 | 缺失 | 远期候选/当前不施工 | 保留远期候选，优先评估Space公共知识集合；不先建独立Knowledge模块，最终owner契约留待后续研究。 |
| F10-015 | 记忆纠错、过期和删除 | AI | AI/CONTRACT.md · AIC-08；PRD-D05/D10；模块编号：AI-MEMORY-CORRECTION-001 | 部分 | 用户决策前置 | 只删除AI派生记忆；来源原件和审计保留政策独立。 |
| F10-016 | 用户级偏好与跨项目记忆 | AI | AI/CONTRACT.md · AIC-09；PRD-D10；模块编号：AI-PREFERENCE-001 | 部分 | 远期研究 | 用户级偏好/跨项目记忆不属于前期原始记录存储承诺，需与Agent派生记忆及权限共享机制分开研究。 |
| F11-001 | 视图定义 | views | views/CONTRACT.md · VIEW-01；模块编号：VIEWS-DEFINITION-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-002 | 多种视图投影 | views | views/CONTRACT.md · VIEW-01；模块编号：VIEWS-PROJECTION-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-003 | 对象映射 | views | views/CONTRACT.md · VIEW-02；模块编号：VIEWS-MAPPING-001 | 覆盖 | 可直接施工（独立验收） | 视图能力锚点已补，源对象owner保持不变。 |
| F11-004 | 关系映射 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-RELATION-001 | 覆盖 | 可直接施工（独立验收） | 视图能力锚点已补，源对象owner保持不变。 |
| F11-005 | 布局与筛选配置 | views | views/CONTRACT.md · VIEW-04；模块编号：VIEWS-LAYOUT-001～004 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-006 | 多视图关联 | views | views/CONTRACT.md · VIEW-05；模块编号：VIEWS-ASSOCIATION-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-007 | 视图投影刷新 | views | views/CONTRACT.md · VIEW-05；模块编号：VIEWS-REFRESH-001、VIEWS-SECURITY-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-008 | 草稿与提交映射 | views | views/CONTRACT.md · VIEW-05；模块编号：VIEWS-EDIT-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-009 | 专业视图规则 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-SEMANTIC-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-010 | 视图性能与大规模数据 | views | views/CONTRACT.md · VIEW-06；模块编号：VIEWS-PERFORMANCE-001 | 部分 | 实验前置 | 性能阈值与大规模降级仍需实测。 |
| F11-011 | 需求/功能树投影 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-PROJECTION-002 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-012 | 架构关系视图 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-PROJECTION-003 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-013 | 功能与资源映射视图 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-PROJECTION-004 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-014 | 任务与进度投影 | views | views/CONTRACT.md · VIEW-03；模块编号：VIEWS-PROJECTION-005 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F11-015 | 稳定对象定位与对话锚点 | views | views/CONTRACT.md · VIEW-07；模块编号：VIEWS-ANCHOR-001 | 覆盖 | 候选细化评审后施工 | 视图能力锚点已补，源对象owner保持不变。 |
| F12-001 | 插件描述清单 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-MANIFEST-001 | 部分 | 候选细化评审后施工 | 契约已补；Manifest字段、签名/权限声明格式未冻结。 |
| F12-002 | 插件发现与登记 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-DISCOVERY-001 | 部分 | 候选细化评审后施工 | 发现不等于信任、安装、启用或授权。 |
| F12-003 | 安装、启用与停用 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-INSTALL-001、PLUGINS-LIFECYCLE-001 | 部分 | 候选细化评审后施工 | 安装/启用/加载分离；停用不代表在途操作已停止。 |
| F12-004 | 插件能力提供 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-CAPABILITY-001 | 部分 | 候选细化评审后施工 | 必须经connections与permissions受控边界，不得直连模块私有实现。 |
| F12-005 | 插件依赖与版本兼容 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-DEPENDENCY-001 | 部分 | 候选细化评审后施工 | 依赖解析和升级兼容需真实插件样本与Windows证据。 |
| F12-006 | 插件信任与完整性 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-TRUST-001 | 部分 | D09/C06政策与Windows隔离实验前置 | D09信任来源/签名/审批政策待确认。 |
| F12-007 | 插件隔离 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-ISOLATION-001 | 部分 | D09/C06政策与Windows隔离实验前置 | C06 Windows OS隔离实验未完成；进程/IPC不等于沙箱。 |
| F12-008 | 插件配置与数据 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-CONFIG-001、PLUGINS-DATA-001 | 部分 | 候选细化评审后施工 | 插件数据/配置归属已界定；具体格式和迁移尚未定。 |
| F12-009 | 插件 UI 扩展 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-UI-001 | 部分 | 候选细化评审后施工 | UI扩展点与受限Renderer边界待UI/宿主设计。 |
| F12-010 | 插件更新、卸载与回滚 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-UPDATE-001、PLUGINS-UNINSTALL-001、PLUGINS-RECOVERY-001 | 部分 | D09/C06政策与Windows隔离实验前置 | 更新/卸载/回滚与共享依赖/在途Operation需实验。 |
| F12-011 | DSH 双路线边界 | plugins（双路线边界owner） | plugins/CONTRACT.md §2；模块编号：PLUGINS-BOUNDARY-001 | 覆盖 | 独立路线验收（不代表实现） | 只覆盖三条路线的责任边界；WEX插件平台、DSH宿主和外部Agent连接器仍分别验收。 |
| F12-012 | 插件目录与重装重识别 | plugins | plugins/CONTRACT.md §2；模块编号：PLUGINS-DATA-ROOT-001 | 部分 | 候选细化评审后施工 | 插件目录规划与app/shared根身份接线已界定；重装重识别需E4验证. |
| F13-001 | 产物登记 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-ARTIFACT-001 | 覆盖 | 可直接施工（独立验收） | — |
| F13-002 | 产物来源追踪 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-ARTIFACT-002 | 覆盖 | 候选细化评审后施工 | — |
| F13-003 | Receipt 关联 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-RECEIPT-001 | 覆盖 | 可直接施工（独立验收） | — |
| F13-004 | Evidence 收集 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-EVIDENCE-001 | 覆盖 | 候选细化评审后施工 | — |
| F13-005 | Review 记录 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-REVIEW-001 | 覆盖 | 可直接施工（独立验收） | — |
| F13-006 | Verification 规则 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-VERIFY-001 | 覆盖 | 候选细化评审后施工 | — |
| F13-007 | Verification 执行 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-VERIFY-002 | 覆盖 | 可直接施工（独立验收） | — |
| F13-008 | Acceptance 决策 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-ACCEPT-001 | 覆盖 | 用户决策前置 | — |
| F13-009 | 版本漂移失效 | workflows | workflows W04；connections C02/C03；permissions PER-01；模块编号：WORKFLOWS-VALIDITY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F13-010 | 证据包与导出 | workflows | workflows W04；shared SH-03；permissions PER-01；模块编号：WORKFLOWS-EVIDENCE-PACK-001 | 部分 | 补契约/语义评审后施工 | 证据包导出需定义范围、脱敏、缺失附件、引用快照和部分失败。 |
| F13-011 | 证据冲突处理 | workflows | workflows W04；connections C03；模块编号：WORKFLOWS-EVIDENCE-CONFLICT-001 | 覆盖 | 候选细化评审后施工 | — |
| F14-001 | Windows 安装交付 | app | app APP-01/04；shared SH-01/03/05；app模块编号：APP-INSTALL-001 | 部分 | 实验前置 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-002 | 安装位置选择 | app | app APP-01/04；shared SH-01/03/05；app模块编号：APP-INSTALL-002 | 部分 | 补契约/语义评审后施工 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-003 | 首次启动初始化 | app | app APP-01/04；shared SH-01/03/05；app模块编号：APP-DATA-ROOT-001、APP-ROOT-LOCK-001 | 部分 | 补契约/语义评审后施工 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-004 | 单实例与重复启动 | app | app APP-01/04；shared SH-01/03/05；app模块编号：APP-SINGLE-INSTANCE-001、APP-ROOT-LOCK-001 | 部分 | 实验前置 | APP有安装/根接入边界，但Windows安装器、双用户/单实例、升级和凭证仍未E4验证。 |
| F14-005 | 模块发现与装配 | app | app APP-02/03；app模块编号：APP-ASSEMBLY-001 | 覆盖 | 可直接施工（独立验收） | — |
| F14-006 | 模块生命周期 | app | app APP-02/03；app模块编号：APP-MODULE-LIFECYCLE-001 | 覆盖 | 可直接施工（独立验收） | — |
| F14-007 | 可信宿主通信 | app | app APP-02；UI CONTRACT；permissions PER-01；app模块编号：APP-IPC-001、APP-TRUSTED-IDENTITY-001 | 部分 | 实验前置 | IPC sender身份、参数schema、超时/取消/重放/撤权缓存需实验。 |
| F14-008 | 窗口与应用生命周期 | app | app APP-03；PRD-D04；app模块编号：APP-WINDOW-001 | 部分 | 用户决策前置 | 关窗/退出/托盘/后台策略D04未决；技术行为可独立测试。 |
| F14-009 | Windows 系统集成 | app | app APP-03；UI CONTRACT；PRD-D04；app模块编号：APP-PLATFORM-001 | 部分 | 用户决策前置 | 菜单/通知/文件关联/托盘/快捷键等平台能力与政策需细化。 |
| F14-010 | 凭证平台接线 | app | app/CONTRACT.md · APP-02；shared/CONTRACT.md · SH-04/05；app模块编号：APP-CREDENTIAL-BRIDGE-001；shared模块编号：SHARED-CREDENTIAL-001、SHARED-SECRET-001、SHARED-PLATFORM-CREDENTIAL-001 | 部分 | 实验前置 | app负责可信平台接线；shared负责凭证引用/平台后端；permissions决定本次使用许可。 |
| F14-011 | 应用升级与卸载 | app | app APP-04；shared SH-03；PRD-D07；app模块编号：APP-UPDATE-001、APP-MIGRATION-001 | 部分 | 用户决策前置 | 程序回滚、数据迁移、插件兼容/卸载分离；自动更新D07待决。 |
| F14-012 | 安全模式与启动降级 | app | app APP-02/03；plugins README；F15-006；app模块编号：APP-SAFE-MODE-001 | 部分 | 实验前置 | 安全模式需验证Renderer/主进程/插件宿主故障边界。 |
| F15-001 | 结构化运行日志 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06；shared模块编号：SHARED-LOG-001、SHARED-REDACTION-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-002 | 跨模块调用追踪 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06；shared模块编号：SHARED-TRACE-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-003 | 运行指标 | app（宿主运行保障） | app/CONTRACT.md · APP-05；app模块编号：APP-HEALTH-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-004 | 健康检查 | app（宿主运行保障） | app/CONTRACT.md · APP-05；app模块编号：APP-HEALTH-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-005 | 故障诊断 | app（宿主运行保障） | app/CONTRACT.md · APP-06；app模块编号：APP-DIAGNOSTIC-001；shared模块编号：SHARED-DIAGNOSTIC-001、SHARED-REDACTION-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-006 | 崩溃与安全恢复 | app（宿主运行保障） | app/CONTRACT.md · APP-07；app模块编号：APP-RECOVERY-001 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-007 | 数据容量与维护 | app（宿主运行保障） | app/CONTRACT.md · APP-05/APP-10；shared容量技术观察；app模块编号：APP-CAPACITY-001；shared模块编号：SHARED-CAPACITY-001 | 部分 | 候选细化评审后施工 | app拥有容量维护入口；各owner决定本域可清理对象，不由app直接删除。 |
| F15-008 | 备份与恢复运行保障 | app（宿主运行保障） | app/CONTRACT.md · APP-12；shared SH-03；app模块编号：APP-BACKUP-001 | 部分 | 实验前置 | app协调备份任务和完整性检查；备份范围与数据语义由F10-007/各owner提供。 |
| F15-009 | 网络与离线诊断 | app（宿主运行保障） | app/CONTRACT.md · APP-05；app模块编号：APP-HEALTH-001 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-010 | 进程与资源维护 | app（宿主进程协调） | app/CONTRACT.md · APP-05/APP-07；connections/local LOCAL-06；app模块编号：APP-PROCESS-001 | 部分 | 实验前置 | app拥有宿主协调；local提供进程树事实；Windows残留进程和退出确认需实验。 |
| F15-011 | 维护与清理策略 | app（维护/清理流程协调） | app/CONTRACT.md · APP-10；各数据owner清理出口；PRD-D05/D12；app模块编号：APP-CAPACITY-001 | 部分 | 用户决策前置 | app拥有清理流程编排；实际保留/删除由数据owner执行，PRD-D05/D12待决。 |
| F15-012 | 通知事件来源保障 | app（宿主运行保障） | app/CONTRACT.md · APP-08；app模块编号：APP-NOTIFICATION-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-013 | 用户帮助与问题报告 | app（宿主运行保障） | app/CONTRACT.md · APP-06；app模块编号：APP-DIAGNOSTIC-001 | 覆盖 | 候选细化评审后施工 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-014 | 配置完整性与恢复协调 | app（宿主运行保障） | app/CONTRACT.md · APP-09；app模块编号：APP-CONFIG-001 | 覆盖 | 实验前置 | 运行保障候选契约已补，正式账本仍归各领域owner。 |
| F15-015 | 日志配置与保留策略 | shared（技术日志/追踪） | shared/CONTRACT.md · SH-06；正式账本owner；PRD-D05；shared模块编号：SHARED-LOG-001、SHARED-REDACTION-001 | 部分 | 用户决策前置 | shared只管理普通技术日志；权限审计/Operation/Task证据保留不归shared。 |

## 3.1 SPACE 模块细分编号映射

模块独立编号由 `space` owner 维护，不计入 F01–F15 的 216 项全局统计。下表把模块细分能力映射回产品总表与当前公开契约；“契约已补”不代表产品代码已实现。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 模块契约锚点 | 其他关键 owner/依赖 | 契约状态与说明 |
|---|---|---|---|---|---|
| SPACE-RESOURCE-001 | 多条资源引用集合 | F01-008 | space SPC-06 | 各资源 owner | 契约已补；支持一个 Context 多条独立引用 |
| SPACE-RESOURCE-002 | 引用描述信息（名称/地址/备注等） | F01-008 | space SPC-06 | 各资源 owner | 契约已补；地址/显示名不等于永久身份 |
| SPACE-RESOURCE-003 | 引用新增与编辑 | F01-008 | space SPC-06 | permissions、各资源 owner | 契约已补；修订冲突和目标身份变化需显式处理 |
| SPACE-RESOURCE-004 | 单条引用解除 | F01-008、F01-010 | space SPC-06 | permissions、各资源 owner | 契约已补；解除关系不删除目标 |
| SPACE-RESOURCE-005 | 引用状态与定位验证 | F01-008、F01-011 | space SPC-06 | permissions、各资源 owner | 契约已补；观察状态须区分失联、无权和来源变化 |
| SPACE-RESOURCE-006 | 重复引用与别名识别 | F01-008 | space SPC-06 | connections/local、各资源 owner | 契约已补；不能仅凭路径/URL 字符串认定同一资源 |
| SPACE-RESOURCE-007 | 来源版本与变化观察 | F01-008、F01-009 | space SPC-06 | 各资源 owner、workflows | 契约已补；版本事实由来源 owner 提供 |
| SPACE-TOOL-001 | Context 工具选择与启停 | F01-009；关联 F05/F09 | space SPC-07 | connections、permissions | 契约已补；Context 关系不替代全局启停或最终判权 |
| SPACE-TOOL-002 | Context 级工具配置 | F01-009；关联 F05 | space SPC-07 | connections、shared/credentials、permissions | 契约已补；不复制凭证，不改写全局 Connection |
| SPACE-TOOL-003 | Context 工具集解析 | F01-009；关联 F02/F05/F07/F09 | space SPC-07 | AI、connections、workflows、permissions | 契约已补；仅输出 Context 侧选择事实，不代替 AI 资格/节点许可/操作授权 |

模块编号的变更先在对应模块 CONTRACT 中维护，再同步本表；不得为了模块内部细化而重排 F01–F15。全局 F 项仍负责产品范围索引，模块编号负责局部施工与验收定位。

## 3.2 WORKFLOWS 模块细分编号映射

核心业务细分编号归 `workflows` owner 维护，不计入 F01–F15 的 216 项全局统计；`WORKFLOWS-EDITOR-*` 只标识自由格子交互，不是业务数据 owner。以下映射与上方 F07/F08/F13 逐项映射相互补充。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| WORKFLOWS-DEFINITION-001 | 工作流定义生命周期 | F07-001 | workflows/CONTRACT §6 | shared、permissions |
| WORKFLOWS-REVISION-001 | 定义草稿与修订提交 | F07-010 | workflows/CONTRACT §6 | shared/storage、permissions |
| WORKFLOWS-REVISION-002 | 修订冲突与提交未知恢复 | F07-001、F07-010 | workflows/CONTRACT §6 | shared/storage |
| WORKFLOWS-NODE-001 | 节点身份与生命周期 | F07-002 | workflows/CONTRACT §6 | shared、permissions |
| WORKFLOWS-NODE-002 | 节点能力、输入输出与配置 | F07-002 | workflows/CONTRACT §6 | connections、AI、modes |
| WORKFLOWS-NODE-003 | 节点位置权限策略 | F07-002、F09-007 | workflows/CONTRACT §6 | permissions、space、connections |
| WORKFLOWS-EDGE-001 | 执行依赖关系 | F07-003 | workflows/CONTRACT §6 | permissions |
| WORKFLOWS-EDGE-002 | 端口、数据流与控制流语义 | F07-002、F07-003 | workflows/CONTRACT §6 | modes、connections |
| WORKFLOWS-VALIDATION-001 | 定义结构校验 | F07-004 | workflows/CONTRACT §6 | shared、modes |
| WORKFLOWS-VALIDATION-002 | 启动前执行就绪检查 | F07-004、F08-008 | workflows/CONTRACT §6 | AI、space、connections、permissions |
| WORKFLOWS-TRIGGER-001 | 人工触发 | F07-009 | workflows/CONTRACT §6 | app、permissions |
| WORKFLOWS-TRIGGER-002 | 对话与 Task 触发 | F07-009、F08-001 | workflows/CONTRACT §6 | conversations、permissions |
| WORKFLOWS-TRIGGER-003 | 外部事件与定时触发 | F07-009、F08-016 | workflows/CONTRACT §6 | connections、app、permissions |
| WORKFLOWS-TRANSFER-001 | 工作流定义导出 | F07-011 | workflows/CONTRACT §6 | shared、permissions |
| WORKFLOWS-TRANSFER-002 | 工作流定义导入 | F07-011 | workflows/CONTRACT §6 | shared、connections、permissions |
| WORKFLOWS-RUN-001 | 运行实例创建与定义绑定 | F08-011 | workflows/CONTRACT §6 | shared、permissions |
| WORKFLOWS-RUN-002 | 节点运行与迭代/尝试身份 | F08-011、F08-013 | workflows/CONTRACT §6 | connections、shared |
| WORKFLOWS-TASK-001 | Task 创建、读取与修订 | F08-001、F08-002 | workflows/CONTRACT §6 | conversations、space、shared、permissions |
| WORKFLOWS-TASK-002 | 责任分配与工作轮次 | F08-003、F08-004 | workflows/CONTRACT §6 | AI、connections、permissions |
| WORKFLOWS-QUEUE-001 | 就绪队列与优先级 | F08-005、F08-006 | workflows/CONTRACT §6 | permissions、connections |
| WORKFLOWS-DISPATCH-001 | 执行者选择与能力路由 | F08-007 | workflows/CONTRACT §6 | AI、connections、permissions |
| WORKFLOWS-DISPATCH-002 | 受控派发与 Operation 关联 | F08-008 | workflows/CONTRACT §6 | connections、permissions、shared |
| WORKFLOWS-RESOURCE-001 | 真实资源冲突协调 | F08-009 | workflows/CONTRACT §6 | connections/local、app、shared、permissions |
| WORKFLOWS-CAPACITY-001 | 并发与容量准入 | F08-010 | workflows/CONTRACT §6 | app、connections、shared |
| WORKFLOWS-CONTROL-001 | 暂停、继续与停止请求 | F08-012 | workflows/CONTRACT §6 | connections、permissions、app |
| WORKFLOWS-FAILURE-001 | 失败分类、重试与升级 | F08-013 | workflows/CONTRACT §6 | connections、permissions |
| WORKFLOWS-RECOVERY-001 | 崩溃与重启恢复 | F08-013、F08-014 | workflows/CONTRACT §6 | app、shared、connections、permissions |
| WORKFLOWS-CHECKPOINT-001 | 跨对话检查点与接续 | F08-014 | workflows/CONTRACT §6 | shared、conversations、AI、connections |
| WORKFLOWS-HANDOVER-001 | 人工接管与责任交接 | F08-015 | workflows/CONTRACT §6 | AI、connections、permissions |
| WORKFLOWS-CONTINUITY-001 | 持续推进与后台策略适配 | F08-016、F07-009 | workflows/CONTRACT §6 | app、permissions |
| WORKFLOWS-SNAPSHOT-001 | 项目/工作状态快照 | F08-017 | workflows/CONTRACT §6 | shared、space、connections、views |
| WORKFLOWS-PROJECTION-001 | 状态投影、诊断与通知 | F08-011、F13 | workflows/CONTRACT §6 | views、UI、permissions、connections |
| WORKFLOWS-ARTIFACT-001 | 产物登记与引用 | F13-001 | workflows/CONTRACT §6 | connections/local、permissions |
| WORKFLOWS-ARTIFACT-002 | 产物来源与版本追踪 | F13-002 | workflows/CONTRACT §6 | connections、shared、permissions |
| WORKFLOWS-RECEIPT-001 | Operation Receipt 关联 | F13-003 | workflows/CONTRACT §6 | connections、shared |
| WORKFLOWS-EVIDENCE-001 | 证据收集与引用 | F13-004 | workflows/CONTRACT §6 | connections/local、connections/GitHub、permissions |
| WORKFLOWS-REVIEW-001 | Review 记录 | F13-005 | workflows/CONTRACT §6 | AI、permissions |
| WORKFLOWS-VERIFY-001 | Verification 规则定义 | F13-006 | workflows/CONTRACT §6 | connections/local、permissions |
| WORKFLOWS-VERIFY-002 | Verification 执行与结果 | F13-007 | workflows/CONTRACT §6 | connections、permissions |
| WORKFLOWS-ACCEPT-001 | 最终 Acceptance 决策 | F13-008 | workflows/CONTRACT §6 | permissions、connections |
| WORKFLOWS-VALIDITY-001 | 版本漂移与结论失效 | F13-009 | workflows/CONTRACT §6 | connections/local、connections/GitHub |
| WORKFLOWS-EVIDENCE-PACK-001 | 证据包汇总与导出 | F13-010 | workflows/CONTRACT §6 | shared、permissions、connections |
| WORKFLOWS-EVIDENCE-CONFLICT-001 | 证据冲突、重复与迟到处理 | F13-011 | workflows/CONTRACT §6 | connections、shared、permissions |

### 自由格子交互编号（不计入 F 功能统计）

| 模块独立编号 | 交互能力 | 对应 F 映射 | owner 边界 |
|---|---|---|---|
| WORKFLOWS-EDITOR-001 | 自由画布投影与渲染 | F07-001～004、F11-002/004 | workflows 提供业务投影；editor 不拥有状态 |
| WORKFLOWS-EDITOR-002 | 节点选择、拖动与尺寸调整 | F11-005 | 坐标和尺寸由 views 保存 |
| WORKFLOWS-EDITOR-003 | 连接端口与建边手势 | F07-002/003、F11-004 | 正式业务关系由 workflows 校验和提交 |
| WORKFLOWS-EDITOR-004 | 正交连线与方向箭头 | F11-002/004/005 | 视觉路径归 views，业务边归 workflows |
| WORKFLOWS-EDITOR-005 | 节点/关系新增、编辑与删除入口 | F07-001～004 | 通过 workflows 受控写入口 |
| WORKFLOWS-EDITOR-006 | 画布平移与缩放 | F11-005 | viewport 归 views |
| WORKFLOWS-EDITOR-007 | 手动布局管理 | F11-005 | 布局修订归 views |
| WORKFLOWS-EDITOR-008 | 自动布局预览、应用与撤销 | F11-005 | 布局算法/结果归 views；不改变执行依赖 |
| WORKFLOWS-EDITOR-009 | 节点卡片状态与任务摘要 | F08-011、F13 | 只读 workflows 权威投影 |
| WORKFLOWS-EDITOR-010 | 打开节点工作界面 | F03、F06、F07 | 对话/代码/文件界面由相应 owner 提供 |
| WORKFLOWS-EDITOR-011 | 撤销/重做与历史隔离 | F07-010、F11-008 | 定义历史与布局历史分离 |

`WORKFLOWS-EDITOR-001～011` 是交互规格编号，不增加 216 项统计。坐标、尺寸、viewport、视觉路径和布局方案仍由 views 拥有；节点业务身份/依赖由 workflows 拥有。

## 3.3 VIEWS 模块细分编号映射

视图模块独立编号由 `views` owner 维护，不计入 F01–F15 的 216 项全局统计。VIEW-01～VIEW-07 是既有稳定能力锚点；VIEWS-* 用于细粒度施工和验收。自由格子交互编号 WORKFLOWS-EDITOR-* 不属于本模块。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| VIEWS-DEFINITION-001 | 视图定义生命周期 | F11-001 | views/CONTRACT §5 | 各领域查询出口、shared、permissions |
| VIEWS-PROJECTION-001 | 通用多形态投影 | F11-002 | views/CONTRACT §5 | 各领域 owner、UI |
| VIEWS-MAPPING-001 | 对象出现与稳定映射 | F11-003 | views/CONTRACT §5 | 各领域 owner、shared |
| VIEWS-RELATION-001 | 关系类型与关系投影 | F11-004 | views/CONTRACT §5 | space、workflows、modes、permissions |
| VIEWS-LAYOUT-001 | 视图布局配置 | F11-005 | views/CONTRACT §5 | shared/storage、UI、workflows/editor |
| VIEWS-LAYOUT-002 | 手动布局与并发修订 | F11-005 | views/CONTRACT §5 | shared/storage |
| VIEWS-LAYOUT-003 | 自动布局预览、应用与撤销 | F11-005 | views/CONTRACT §5 | workflows 查询投影、shared/storage |
| VIEWS-LAYOUT-004 | 视觉连线路径与端口几何 | F11-005、F11-004 | views/CONTRACT §5 | workflows/editor、workflows |
| VIEWS-ASSOCIATION-001 | 多视图关联 | F11-006 | views/CONTRACT §5 | 各领域 owner、shared |
| VIEWS-REFRESH-001 | 来源修订刷新与新鲜度 | F11-007 | views/CONTRACT §5 | 各领域 owner、shared |
| VIEWS-EDIT-001 | 草稿与领域写入转交 | F11-008 | views/CONTRACT §5 | permissions、各领域 owner |
| VIEWS-SEMANTIC-001 | 专业语境与投影规则 | F11-009 | views/CONTRACT §5 | workflows/modes、领域 owner |
| VIEWS-PERFORMANCE-001 | 大规模视图加载与降级 | F11-010 | views/CONTRACT §5 | 各领域查询出口、UI、shared |
| VIEWS-ANCHOR-001 | 稳定对象定位与对话锚点 | F11-015 | views/CONTRACT §5 | shared、conversations、各领域 owner |
| VIEWS-QUERY-001 | 获准内部检索聚合 | F10-009 | views/CONTRACT §5 | 各领域查询出口、permissions、UI |
| VIEWS-SECURITY-001 | 投影可见性与撤权缓存失效 | F11-007、F10-009 | views/CONTRACT §5 | permissions、各领域 owner、shared |
| VIEWS-PROJECTION-002 | 需求与功能树投影 | F11-011 | views/CONTRACT §5 | workflows/modes/software-development |
| VIEWS-PROJECTION-003 | 架构关系视图 | F11-012 | views/CONTRACT §5 | workflows/modes/software-development、领域 owner |
| VIEWS-PROJECTION-004 | 功能与资源映射视图 | F11-013 | views/CONTRACT §5 | workflows/modes、connections/local、connections/GitHub、workflows |
| VIEWS-PROJECTION-005 | 任务、进度与验收投影 | F11-014 | views/CONTRACT §5 | workflows、connections、permissions |

布局归属提醒：节点位置/尺寸/viewport/视觉路径/自动布局结果归 views；节点业务身份/执行依赖归 workflows；交互手势归 workflows/editor；领域对象与专业关系归各自源 owner。

## 3.4 CONNECTIONS 模块细分编号映射

核心连接宿主独立编号由 `connections` owner 维护，不计入 F01–F15 的 216 项全局统计。C01–C05 保留为既有契约锚点；API/LOCAL 子模块编号不在本表重复。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| CONNECTIONS-CONNECTION-001 | Connection 生命周期 | F05-001 | connections/CONTRACT §7 | shared、permissions、app |
| CONNECTIONS-CAPABILITY-001 | Capability 描述 | F05-002 | connections/CONTRACT §7 | 具体 connector、shared |
| CONNECTIONS-DISCOVERY-001 | 能力注册与发现 | F05-003 | connections/CONTRACT §7 | app、具体 connector |
| CONNECTIONS-HEALTH-001 | 连接与能力就绪检查 | F05-004 | connections/CONTRACT §7 | app、shared、具体 connector |
| CONNECTIONS-VERSION-001 | 配置与适配器版本绑定 | F05-005 | connections/CONTRACT §7 | shared、app、具体 connector |
| CONNECTIONS-CREDENTIAL-001 | 凭证引用与受控使用 | F05-001、F05-004 | connections/CONTRACT §7 | shared/credentials、permissions |
| CONNECTIONS-ADMISSION-001 | 受控调用准入 | F05-006 | connections/CONTRACT §7 | permissions、app、workflows |
| CONNECTIONS-RESOURCE-001 | 真实资源解析与定位 | F05-006、F05-012 | connections/CONTRACT §7 | 具体 connector、workflows/runtime、permissions |
| CONNECTIONS-OPERATION-001 | Operation 意图、尝试与回执账本 | F05-007 | connections/CONTRACT §7 | shared/storage、permissions |
| CONNECTIONS-OBSERVATION-001 | 结果查询与进度观察 | F05-008 | connections/CONTRACT §7 | 具体 connector、workflows |
| CONNECTIONS-CONTROL-001 | 取消、分离与接续能力 | F05-009 | connections/CONTRACT §7 | 具体 connector、permissions、workflows |
| CONNECTIONS-RECOVERY-001 | 未知结果恢复与外部核对 | F05-007～009 | connections/CONTRACT §7 | shared、app、workflows、具体 connector |
| CONNECTIONS-IDEMPOTENCY-001 | 有限作用域去重与重试声明 | F05-007、F05-009 | connections/CONTRACT §7 | shared/storage、具体 connector |
| CONNECTIONS-CALLBACK-001 | 外部回调与事件接入 | F05-010 | connections/CONTRACT §7 | app、permissions、shared |
| CONNECTIONS-AGENT-001 | 外部 Agent 客户端连接 | F05-011 | connections/CONTRACT §7 | connections/dsh、workflows、permissions |
| CONNECTIONS-ADAPTER-001 | 具体适配器装配与协议边界 | F05-012 | connections/CONTRACT §7 | connections/api、connections/local、connections/dsh、app |
| CONNECTIONS-NETWORK-001 | 网络、代理与离线诊断 | F05-013 | connections/CONTRACT §7 | app、具体 connector |
| CONNECTIONS-ERROR-001 | 连接器错误规范化 | F05-014 | connections/CONTRACT §7 | shared、workflows |
| CONNECTIONS-SERVICE-001 | Service 实例生命周期与 Connection 绑定 | F05-015 | connections/CONTRACT §7 | app、具体 connector |
| CONNECTIONS-SEARCH-001 | 外部 Search / Fetch / Browser 能力 | F05-016 | connections/CONTRACT §7 | permissions、app、具体 connector、views |
| CONNECTIONS-EXCHANGE-001 | 双向最小能力交换 | F05-006、F05-010 | connections/CONTRACT §7 | app、permissions、各领域 owner |
| CONNECTIONS-NOTIFICATION-001 | 状态变化通知与补读 | F05-008、F05-010 | connections/CONTRACT §7 | app、workflows、conversations、permissions |

编号边界提醒：Operation/外部观察归 connections；Task、资源冲突协调和最终验收归 workflows；授权决定归 permissions；秘密归 shared/credentials；真实外部 Session/资源仍由外部系统拥有。

## 3.5 AI 模块细分编号映射

AI 模块独立编号由 `AI` owner 维护，不计入 F01–F15 的 216 项全局统计。AIC-01～09 是既有能力锚点；AI-* 用于细粒度施工和验收。F10-014 仍为无 owner 远期候选，不进入本表。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| AI-AGENT-001 | Agent 定义与生命周期 | F02-001 | AI/CONTRACT §8 | shared/storage、space |
| AI-AGENT-002 | Agent 配置修订 | F02-006 | AI/CONTRACT §8 | shared/storage、permissions |
| AI-ROLE-001 | 角色定义与生命周期 | F02-002 | AI/CONTRACT §8 | permissions |
| AI-RESPONSIBILITY-001 | Agent 与角色职责关联 | F02-003 | AI/CONTRACT §8 | space、permissions |
| AI-SCOPE-001 | 职责范围绑定 | F02-004 | AI/CONTRACT §8 | space、workflows、permissions |
| AI-MODEL-001 | 模型与连接引用 | F02-005 | AI/CONTRACT §8 | connections/api、shared/credentials |
| AI-PROMPT-001 | 提示与行为配置 | F02-006 | AI/CONTRACT §8 | shared/storage、permissions |
| AI-WORK-SNAPSHOT-001 | 本次工作配置快照 | F02-006、F02-012 | AI/CONTRACT §8 | shared、workflows、connections |
| AI-TOOL-ELIGIBILITY-001 | Agent/角色工具资格配置 | F02-002、F02-003；D01 | AI/CONTRACT §8 | connections、permissions、space |
| AI-RUNTIME-001 | 运行实例绑定与观察引用 | F02-007 | AI/CONTRACT §8 | connections、app |
| AI-SESSION-001 | 外部 Session 映射 | F02-008 | AI/CONTRACT §8 | connections、workflows |
| AI-EXTERNAL-001 | 外部 Agent 类型与接入配置 | F02-009 | AI/CONTRACT §8 | connections、workflows |
| AI-HANDOVER-001 | 执行者替换与交接引用 | F02-010 | AI/CONTRACT §8 | workflows、connections、permissions |
| AI-STATUS-001 | Agent 配置与运行状态投影 | F02-012 | AI/CONTRACT §8 | connections、workflows、permissions |
| AI-MEMORY-001 | Agent 派生记忆对象 | F10-011 | AI/CONTRACT §8 | conversations、connections、shared、permissions |
| AI-MEMORY-SOURCE-001 | 记忆来源与可信度依据 | F10-012 | AI/CONTRACT §8 | conversations、connections、space、permissions |
| AI-MEMORY-SHARING-001 | Agent 记忆共享范围 | F02-011、F10-013 | AI/CONTRACT §8 | permissions、space |
| AI-MEMORY-CORRECTION-001 | 记忆纠错、过期与删除 | F10-015 | AI/CONTRACT §8 | permissions、shared |
| AI-PREFERENCE-001 | 用户级偏好与跨项目记忆 | F10-016 | AI/CONTRACT §8 | permissions、shared、conversations |

边界提醒：AI 保存职责与工具资格，不授予权限；Space 选择 Context，workflows 分配 Task/轮次，connections 管理真实 Runtime/Session/Operation，conversations 持有消息原文，permissions 独占授权决定。

## 3.7 CONVERSATIONS 模块细分编号映射

对话模块独立编号由 `conversations` owner 维护，不计入 F01–F15 的 216 项全局统计。CV-01～CV-16 是既有稳定能力锚点；CONVERSATIONS-* 用于细粒度施工和验收；I01–I16 仍为全局交互语义目录。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| CONVERSATIONS-THREAD-001 | Conversation 生命周期 | F03-001 | conversations/CONTRACT §5 | shared、permissions |
| CONVERSATIONS-MESSAGE-001 | 消息与轮次持久化 | F03-002 | conversations/CONTRACT §5 | shared/storage、connections/api |
| CONVERSATIONS-GENERATION-001 | 逻辑生成身份与请求关联 | F03-002、F03-008、F03-012 | conversations/CONTRACT §5 | connections/api、connections、shared |
| CONVERSATIONS-SEQUENCE-001 | 稳定序列项 | F03-003 | conversations/CONTRACT §5 | shared、views/UI |
| CONVERSATIONS-REFERENCE-001 | 局部选择与版本引用 | F03-004 | conversations/CONTRACT §5 | permissions、source owner |
| CONVERSATIONS-BRANCH-001 | 分支讨论与回链 | F03-005 | conversations/CONTRACT §5 | shared、permissions |
| CONVERSATIONS-RESUBMIT-001 | 历史消息修改与重发 | F03-006 | conversations/CONTRACT §5 | connections、permissions、shared |
| CONVERSATIONS-QUEUE-001 | 生成期间追加与排队 | F03-007 | conversations/CONTRACT §5 | connections/api、shared |
| CONVERSATIONS-STREAM-001 | 流式片段接收与定稿 | F03-008 | conversations/CONTRACT §5 | connections/api、shared |
| CONVERSATIONS-STOP-001 | 停止等待、停止显示与远端取消 | F03-009 | conversations/CONTRACT §5 | connections、permissions |
| CONVERSATIONS-CONTEXT-001 | 对话背景与模型输入快照 | F03-010 | conversations/CONTRACT §5 | space、AI、connections/api、permissions |
| CONVERSATIONS-ATTACHMENT-001 | 输入附件与来源 | F03-011 | conversations/CONTRACT §5 | connections/local、space、permissions |
| CONVERSATIONS-TOOL-001 | 工具意图往返 | F03-012 | conversations/CONTRACT §5 | connections/api、connections、permissions |
| CONVERSATIONS-TASK-001 | 显式转为 Task | F03-013 | conversations/CONTRACT §5 | workflows、permissions |
| CONVERSATIONS-SEARCH-001 | 会话检索与历史读取 | F03-014 | conversations/CONTRACT §5 | permissions、views |
| CONVERSATIONS-DECISION-001 | 序列项采纳、拒绝与待讨论 | F03-015 | conversations/CONTRACT §5 | permissions、workflows |
| CONVERSATIONS-ITEM-REVISION-001 | 序列项局部补充与修订 | F03-016 | conversations/CONTRACT §5 | shared、permissions |
| CONVERSATIONS-STATE-001 | 消息、生成、工具与定稿状态分离 | F03-002、F03-008、F03-009、F03-012 | conversations/CONTRACT §5 | connections、shared、permissions |

边界提醒：消息/序列项/逻辑生成归 conversations；Provider 请求/Operation 归 connections；Agent/角色配置归 AI；Task 归 workflows；授权归 permissions；全局 I01–I16 不因本模块细化而重排。

## 3.8 PERMISSIONS 模块细分编号映射

权限模块独立编号由 `permissions` owner 维护，不计入 F01–F15 的 216 项全局统计。PER-01～PER-04 是既有稳定能力锚点；PERMISSIONS-* 用于细粒度施工和验收。授权账本只允许 permissions 维护。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| PERMISSIONS-SUBJECT-001 | 可信主体与安装关系识别 | F09-001 | permissions/CONTRACT §11 | app、shared、connections |
| PERMISSIONS-ENTRY-001 | 可信入口与实例代次 | F09-002 | permissions/CONTRACT §11 | app、conversations、workflows、connections |
| PERMISSIONS-MODULE-001 | 模块启用约束 | F09-003 | permissions/CONTRACT §11 | app |
| PERMISSIONS-GLOBAL-001 | 全局访问约束 | F09-004 | permissions/CONTRACT §11 | app、space、AI |
| PERMISSIONS-CONVERSATION-001 | 对话启用约束 | F09-005 | permissions/CONTRACT §11 | conversations、app |
| PERMISSIONS-RESOURCE-001 | 真实资源身份与范围核对 | F09-006 | permissions/CONTRACT §11 | space、connections、各领域 owner |
| PERMISSIONS-EVALUATION-001 | 主体/入口/资源/动作判定 | F09-006 | permissions/CONTRACT §11 | 各领域可信事实源 |
| PERMISSIONS-POLICY-001 | 授权策略与结果优先级 | F09-007 | permissions/CONTRACT §11 | shared、app |
| PERMISSIONS-DIALOGUE-LEVEL-001 | 对话四级执行模式 | F09-007 | permissions/CONTRACT §11 | conversations、AI、app |
| PERMISSIONS-WORKFLOW-START-001 | 工作流节点方案一次性启动确认 | F09-007 | permissions/CONTRACT §11 | workflows、app、connections |
| PERMISSIONS-GRANT-001 | 精确授权与审批 | F09-008 | permissions/CONTRACT §11 | app、shared |
| PERMISSIONS-REVOCATION-001 | 授权撤销与收窄 | F09-009 | permissions/CONTRACT §11 | shared、connections、各领域 owner |
| PERMISSIONS-RECHECK-001 | 副作用前复核 | F09-010 | permissions/CONTRACT §11 | connections、workflows、app |
| PERMISSIONS-AUDIT-001 | 判定、审批与撤权审计 | F09-011 | permissions/CONTRACT §11 | shared、app |
| PERMISSIONS-DISCLOSURE-001 | 读取、模型发送与外部披露分离 | F09-012 | permissions/CONTRACT §11 | conversations、AI、connections、space、views |
| PERMISSIONS-REINSTALL-001 | 重装与安装代次失效 | F09-013 | permissions/CONTRACT §11 | app、shared、connections |
| PERMISSIONS-RACE-001 | 撤权竞态、并发审批与有限许可 | F09-014 | permissions/CONTRACT §11 | connections、shared、app |
| PERMISSIONS-SPECIAL-BOUNDARY-001 | 特殊信任根边界 | F09-008、F09-012 | permissions/CONTRACT §11 | app、connections、shared/credentials |
| PERMISSIONS-HISTORY-001 | 许可历史与可见性查询 | F09-011 | permissions/CONTRACT §11 | shared、app |

边界提醒：app 提供可信主体/入口事实；AI 提供职责/资格；Space 提供 Context 选择；workflows 提供节点与运行方案；permissions 独占授权/撤销/审计；connections 只执行受控调用并复核。

## 3.9 APP 模块细分编号映射

app 模块独立编号由 `app` owner 维护，不计入 F01–F15 的 216 项全局统计。APP-01～APP-12 是既有能力锚点；APP-* 用于宿主、安装、平台、恢复和跨域维护细分。F15-001/002/015 仍归 shared/各账本 owner。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| APP-INSTALL-001 | Windows 安装交付 | F14-001 | app/CONTRACT §7 | shared、打包工具、Windows |
| APP-INSTALL-002 | 程序安装位置选择 | F14-002 | app/CONTRACT §7 | shared、Windows |
| APP-DATA-ROOT-001 | 首次启动与数据根选择 | F14-003、F10-002 | app/CONTRACT §7 | shared、各领域 owner、permissions |
| APP-ROOT-LOCK-001 | 数据根身份与运行锁 | F14-003、F14-004 | app/CONTRACT §7 | shared、Windows |
| APP-SINGLE-INSTANCE-001 | 单实例与重复启动协调 | F14-004 | app/CONTRACT §7 | Windows、shared、UI |
| APP-ASSEMBLY-001 | 可信模块发现与依赖装配 | F14-005 | app/CONTRACT §7 | 各模块公开入口、shared |
| APP-MODULE-LIFECYCLE-001 | 模块生命周期与释放 | F14-006 | app/CONTRACT §7 | 各模块、shared |
| APP-IPC-001 | 可信宿主通信与窄桥 | F14-007 | app/CONTRACT §7 | UI、permissions、connections |
| APP-TRUSTED-IDENTITY-001 | 可信主体与入口事实绑定 | F09-001、F09-002、F14-007 | app/CONTRACT §7 | permissions、connections、Windows |
| APP-WINDOW-001 | 窗口与应用生命周期 | F14-008 | app/CONTRACT §7 | UI、workflows、connections、permissions |
| APP-PLATFORM-001 | Windows 系统集成 | F14-009 | app/CONTRACT §7 | UI、permissions、workflows |
| APP-CREDENTIAL-BRIDGE-001 | 系统凭证平台接线 | F14-010 | app/CONTRACT §7 | shared/credentials、permissions |
| APP-UPDATE-001 | 程序升级、回滚与卸载 | F14-011 | app/CONTRACT §7 | shared、各模块、plugins |
| APP-MIGRATION-001 | 跨模块数据迁移协调 | F10-008、F14-011 | app/CONTRACT §7 | shared、各领域 owner |
| APP-SAFE-MODE-001 | 安全模式与启动降级 | F14-012 | app/CONTRACT §7 | plugins、connections、permissions、shared |
| APP-HEALTH-001 | 宿主健康与就绪聚合 | F15-003、F15-004、F15-009 | app/CONTRACT §7 | 各模块、connections、shared |
| APP-DIAGNOSTIC-001 | 故障诊断与问题报告 | F15-005、F15-013 | app/CONTRACT §7 | shared、permissions、各领域 owner |
| APP-RECOVERY-001 | 崩溃与安全恢复协调 | F15-006 | app/CONTRACT §7 | shared、connections、workflows、permissions |
| APP-CAPACITY-001 | 容量维护与清理协调 | F15-007、F15-011 | app/CONTRACT §7 | shared、各数据 owner、permissions |
| APP-BACKUP-001 | 备份与恢复协调 | F10-007、F15-008 | app/CONTRACT §7 | shared、各领域 owner、permissions |
| APP-IMPORT-EXPORT-001 | 数据导入与导出作业 | F10-006 | app/CONTRACT §7 | 各领域 owner、permissions、shared |
| APP-PROCESS-001 | 宿主进程与资源维护 | F15-010 | app/CONTRACT §7 | connections/local、plugins、dsh、shared |
| APP-NOTIFICATION-001 | 通知投递与导航 | F15-012 | app/CONTRACT §7 | workflows、connections、views、permissions |
| APP-CONFIG-001 | 配置完整性与恢复协调 | F15-014 | app/CONTRACT §7 | 各模块、shared |

边界提醒：app 提供可信宿主和跨域作业协调；shared 提供技术存储/路径/凭证；permissions 决定许可；各领域 owner 维护数据格式与业务事实；app 不接管 Task/Operation/授权账本。

## 3.10 SHARED 模块细分编号映射

shared 模块独立编号由 `shared` owner 维护，不计入 F01–F15 的 216 项全局统计。SH-01～SH-06 是既有技术能力锚点；SHARED-* 用于细粒度施工和验收。shared 不拥有领域业务对象或授权账本。

| 模块独立编号 | 技术细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| SHARED-ROOT-001 | 数据根身份与格式观察 | F10-002、F14-003 | shared/CONTRACT §7 | app、Windows |
| SHARED-PATH-001 | 路径规范化与受限定位 | F10-004 | shared/CONTRACT §7 | app、connections/local、各资源 owner |
| SHARED-LOCK-001 | 跨进程合作锁 | F14-003、F14-004 | shared/CONTRACT §7 | app、Windows |
| SHARED-STORE-001 | 命名空间持久化 | F10-001、F10-003 | shared/CONTRACT §7 | 各领域 owner |
| SHARED-TRANSACTION-001 | 单命名空间事务 | F10-001、F10-005 | shared/CONTRACT §7 | 各领域 owner |
| SHARED-CAS-001 | 修订与比较交换 | F10-005 | shared/CONTRACT §7 | 各领域 owner |
| SHARED-INTENT-001 | 持久意图与提交三态 | F10-005、F15-002 | shared/CONTRACT §7 | connections、workflows、permissions |
| SHARED-CATEGORY-001 | 技术存储类别 | F10-003 | shared/CONTRACT §7 | 各领域 owner |
| SHARED-BACKUP-001 | 备份快照技术原语 | F10-007、F15-008 | shared/CONTRACT §7 | app、各领域 owner |
| SHARED-RESTORE-001 | 恢复校验技术原语 | F10-007、F15-008 | shared/CONTRACT §7 | app、各领域 owner、connections |
| SHARED-MIGRATION-001 | 存储格式迁移支撑 | F10-008 | shared/CONTRACT §7 | app、各领域 owner |
| SHARED-CREDENTIAL-001 | 凭证引用与元数据 | F14-010、F02-005 | shared/CONTRACT §7 | app、connections、permissions |
| SHARED-SECRET-001 | 受控秘密读取与交付 | F14-010 | shared/CONTRACT §7 | permissions、connections、app |
| SHARED-PLATFORM-CREDENTIAL-001 | 平台凭证后端与生命周期 | F14-010 | shared/CONTRACT §7 | app、Windows、permissions |
| SHARED-LOG-001 | 普通技术日志管道 | F15-001、F15-015 | shared/CONTRACT §7 | app、各模块 |
| SHARED-TRACE-001 | 跨模块关联追踪 | F15-002 | shared/CONTRACT §7 | app、workflows、connections、permissions |
| SHARED-DIAGNOSTIC-001 | 受限诊断事件接收 | F15-005、F15-013 | shared/CONTRACT §7 | app、permissions、各模块 |
| SHARED-REDACTION-001 | 秘密与敏感内容脱敏 | F15-001、F15-005、F15-015 | shared/CONTRACT §7 | app、permissions、各领域 owner |
| SHARED-CAPACITY-001 | 存储容量与占用观察 | F15-007、F15-011 | shared/CONTRACT §7 | app、各数据 owner |
| SHARED-ERROR-001 | 技术错误与提交结果规范 | F10-001、F10-005、F10-007、F14-010 | shared/CONTRACT §7 | 各模块 |

边界提醒：shared 提供存储/路径/凭证/日志技术原语；app 负责跨域作业协调；permissions 独占授权；各领域 owner 保存业务事实和保留策略。

## 3.11 PLUGINS 模块细分编号映射

WEX 自有插件模块独立编号由 `plugins` owner 维护，不计入 F01–F15 的 216 项全局统计。PLUGINS-* 描述候选业务语义，不代表动态插件加载器已实现或已获准进入首期。DSH 原生插件与外部 DSH Agent 连接器分别由 dsh/ 与 connections/dsh/ 管理。

| 模块独立编号 | 模块细分能力 | 对应全局 F 索引 | 契约锚点 | 关键依赖/边界 |
|---|---|---|---|---|
| PLUGINS-MANIFEST-001 | 插件描述清单 | F12-001 | plugins/CONTRACT §2 | app、connections、permissions |
| PLUGINS-DISCOVERY-001 | 插件发现与登记 | F12-002 | plugins/CONTRACT §2 | app、shared |
| PLUGINS-INSTALL-001 | 插件安装与来源接入 | F12-003 | plugins/CONTRACT §2 | app、shared、permissions |
| PLUGINS-LIFECYCLE-001 | 插件启用、加载、停用与释放 | F12-003 | plugins/CONTRACT §2 | app、connections、permissions |
| PLUGINS-CAPABILITY-001 | 插件能力发布与受控消费 | F12-004 | plugins/CONTRACT §2 | connections、permissions、各领域 owner |
| PLUGINS-DEPENDENCY-001 | 依赖解析与版本兼容 | F12-005 | plugins/CONTRACT §2 | app、connections、shared |
| PLUGINS-TRUST-001 | 来源信任与完整性校验 | F12-006 | plugins/CONTRACT §2 | app、permissions、shared |
| PLUGINS-ISOLATION-001 | 插件权限与运行隔离 | F12-007 | plugins/CONTRACT §2 | app、permissions、Windows |
| PLUGINS-CONFIG-001 | 插件专属配置 | F12-008 | plugins/CONTRACT §2 | shared、app |
| PLUGINS-DATA-001 | 插件专属数据与保留 | F12-008、F12-010 | plugins/CONTRACT §2 | shared、permissions、app |
| PLUGINS-UI-001 | 受控 UI 扩展 | F12-009 | plugins/CONTRACT §2 | app、views、UI、permissions |
| PLUGINS-UPDATE-001 | 插件更新与兼容升级 | F12-010 | plugins/CONTRACT §2 | app、shared、connections、workflows |
| PLUGINS-UNINSTALL-001 | 插件卸载与依赖释放 | F12-010 | plugins/CONTRACT §2 | app、shared、connections、permissions |
| PLUGINS-RECOVERY-001 | 崩溃隔离与安全恢复 | F12-003、F12-010 | plugins/CONTRACT §2 | app、shared、permissions |
| PLUGINS-DATA-ROOT-001 | 插件目录与安装位置 | F12-012 | plugins/CONTRACT §2 | app、shared |
| PLUGINS-BOUNDARY-001 | WEX/DSH 双插件路线边界 | F12-011 | plugins/CONTRACT §2 | dsh、connections/dsh、app、permissions |

边界提醒：plugins 只拥有 WEX 自有插件机制；app 提供宿主，connections 提供受控能力出口，permissions 独占授权，shared 提供技术原语；dsh/ 与 connections/dsh/ 不并入本模块。

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
