# DSH 与 Hermes 扩展生态热度调研

日期：2026-10-28。状态：公开目录研究，不代表 WEX 已批准接入或推荐安装。

## 口径说明
- GitHub Stars 衡量关注度，不等于下载、活跃用户或质量。
- skills.sh installs 是该注册目录的技能安装统计，包含跨 Agent 可用的技能，不等于 Hermes 专属运行次数。
- DSH 社区目录的“下载”数据因目录/包注册表而异；官方 bundle 的 npm 下载量与社区插件安装量不可直接横比。
- 目录页面是动态数据，以下数字为检索时可见快照，需以源站当前页面复核。
- 第三方扩展可执行代码；目录审核/安装验证不等于安全保证。

## DSH 值得优先研究的扩展
- **OpenDesign**：设计工作台，原型、网页、仪表板、幻灯片、图像/视频等产物。大项目星数极高，但其热度不能说明 DSH 插件本身的安装量。
- **Archify**：从仓库或文字生成架构、流程、时序、数据流与生命周期图；适合 WEX 的架构审计和施工文档。
- **Hindsight / OpenViking**：长期记忆、自动召回/留存、知识页、项目记忆；直接关联角色记忆与公共策略库研究。
- **WeKnora**：连接自有知识库，混合检索、文档重组与带引用的 RAG。
- **BrowserSkill**：控制可见 Chrome/Edge、无障碍树、截图与多会话浏览器；可研究外部应用操作与宿主边界。
- **DSH Web UI / better-sidebar**：多视图、任务板、Git 面板、会话隔离和 UI 扩展接口；可研究 WEXPC 秘书面板和 UI slots。
- **dsh-market**：插件搜索、安装、升级、启停和配置备份；可研究能力市场生命周期。
- **dsh-agent-teams**：多 Agent 团队、依赖任务、持久消息和实时活动面板；适合对照 WEX 调度器，但不能仅凭项目描述认定状态恢复正确。
- **Reactive Resume 集成**：通过 MCP 将外部应用接入会话，适合研究外部服务适配；需检查当前安装验证状态。
- **ModLens / DSH Vision Toolkit**：OCR、视觉证据与界面比较，属于可选能力，不是当前 WEX 底层优先项。

### 可见热度/安装信号
- DSH 社区目录 dsharness.io 检索时展示：OpenDesign 约 103.7k Stars、Archify 约 88.7k、Hindsight 约 53.4k、OpenViking 约 40.4k、WeKnora 约 34.7k；这些是 GitHub 关注数快照，不是 DSH 安装量。
- dshpluginhub.ai 的热门列表展示官方基础/运行 profile 包的高下载量，例如 dsh-web-app、dsh-base、dsh-headless、dsh-sdk-app、dsh-acp-app。这些是官方 npm bundle 下载统计，不能拿来与单个社区插件星数比较。

## Hermes：技能安装量较高的候选
skills.sh 的 nousresearch/hermes-agent 页面检索时展示 261 个技能、约 42.7K 总安装。热门项包括：
- dogfood（约 6.4K）：系统化 Web 应用探索测试，强调复现证据与缺陷报告。
- humanizer（约 1.3K）：文本自然化。
- hermes-agent（约 1.1K）：Hermes 配置、扩展和编排说明。
- popular-web-designs（约 921）：设计系统参考。
- powerpoint（约 754）：演示文稿工作流。
- arxiv（约 685）：论文搜索与元数据。
- llm-wiki（约 606）：互链 Markdown 知识库。
- google-workspace（约 581）：Gmail/日历/Drive/Docs/Sheets 集成。
- research-paper-writing（约 493）、architecture-diagram（约 492）、test-driven-development（约 479）、systematic-debugging（约 472）。
- obsidian（约 457）、github-pr-workflow（约 331）、github-code-review（约 326）、github-repo-management（约 317）。

这些安装统计是 skills.sh 的目录计数，且许多技能可跨 Agent 使用，不等于 Hermes 产品内部插件的下载量。对于 WEX，dogfood、系统化调试、TDD、架构图、研究写作、知识库与 GitHub 工作流最有方法论参考价值。

## Hermes 官方插件目录（与 Skills 分开）
Hermes 官方插件目录在 2026-10-13 的 v0.22.0 发布说明中宣布达到约 600 个经审阅条目；目录按完整 commit SHA 固定版本，条目需人工 PR 审查。官方插件仓库的示例/候选包括：
- **Advanced Delegation**：按模型路由或配置 Profile 委派子 Agent。
- **Bubblewrap**：Linux 终端执行沙箱；注意文件工具仍在宿主执行，不能误以为全工具都隔离。
- **Camofox**：自托管浏览器服务集成。
- **Home Assistant / Spotify**：外部设备与服务连接器。
- **Sprites**：云端终端后端，支持 checkpoint/restore。
- **Mes​​hy**：通过 MCP 调用 3D 生成服务，按调用提示消耗额度。

官方目录使用固定 SHA，更新需经过审核；这对 WEX 能力市场的供应链与可复现安装值得借鉴。上述目录数量不是每个插件的安装量排名。

## 对 WEX 的研究优先级
1. **架构施工与质量**：Archify、dogfood、TDD、systematic-debugging、GitHub review/workflow。
2. **记忆与策略**：Hindsight、OpenViking、WeKnora、llm-wiki；重点看来源、范围、检索、写入门槛和知识纠错。
3. **多 Agent 与长期任务**：dsh-agent-teams、Hermes Advanced Delegation、Kanban dashboard；检查任务状态 owner、持久消息、取消和恢复。
4. **动态 UI 与能力市场**：DSH Web UI、better-sidebar、dsh-market、Hermes Desktop plugins；关注插槽、版本固定、启停、回滚。
5. **外部服务与浏览器**：Google Workspace、BrowserSkill、Camofox、Home Assistant；关注凭证、权限、外部副作用和断线恢复。

## 关键结论
热门项目是需求信号和研究线索，不是直接装进 WEX 的清单。优先读源码/manifest/权限/更新机制，挑选能验证 WEX 架构的案例；不因星数高就把大型外部应用或服务整体纳入核心。
