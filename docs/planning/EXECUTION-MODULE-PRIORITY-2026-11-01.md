# WEXPCeasy｜模块细化与复用优先级调整（2026-11-01）

## 用户确认的优先次序

1. **Runtime/调度**：主线。先做 workflows/runtime 独立施工与验收规格，再落地最小正确性链路。见 [Runtime 验收规格](../../workflows/runtime/ACCEPTANCE.md)。
2. **GitHub 连接器**：以 GitHub 官方 github-mcp-server 为首选，Octokit.js REST/GraphQL 补全官方 MCP 未覆盖的能力；WEX 做能力适配、授权、Operation/Receipt 和验收接线，不自行重写 GitHub API。旧 WEX/WEXPC 模块仅作参考。见 [官方 GitHub 接入契约](../../connections/github/CONTRACT.md)。
3. **API、Local、MODE、SD**：已有 CONTRACT 业务编号，下一步补独立验收表和组合验收，不重开整体架构；缺口按领域分配并保留 B/C/D。具体矩阵见本文件下文。
4. **Accounts**：仅定义未来主体身份与账号生命周期边界，不启用注册、云账号服务器、组织多租户或跨设备同步。见 [Accounts 预留边界](../../accounts/BOUNDARY.md)。
5. **DSH 原生 Core+Loader 插件宿主研究**：**暂缓**；保留已有实验与兼容性证据，不作为 Runtime、GitHub 或首版入口前置。外部 DSH Agent 连接器与此不同，不因此被要求实现原生宿主。

## API / Local / MODE / SD 验收矩阵

| 子模块 | 当前已有规格 | 下一批独立测试重点 | 组合验收 | 未闭合门槛 |
|---|---|---|---|---|
| API | connections/api/CONTRACT.md，API-01～10 | 模型/Provider配置修订；流式分块、重复、乱序、EOF缺口；401/403/429；usage未知；取消与请求未知；工具意图不得直接执行 | Conversation → API 请求 → permissions → connections Operation → 消息定稿/工具回注 | 真实 Provider/费用/取消支持，流与跨层恢复 C |
| Local | connections/local/CONTRACT.md，LOCAL-01～10 | 真实资源定位、ACL、中文路径、junction/symlink、文件版本冲突、watcher丢事件、stdout洪泛、子进程残留 | Workflow → Local 文件写入/命令 → Artifact → Verification；同一资源跨 Context 冲突 | Windows E4、句柄级路径安全和进程树 C |
| MODE | workflows/modes/CONTRACT.md，MODE-01～06 | 模式可选；草稿实例化；默认配置/用户覆盖冲突；未知提交回读；规则版本/能力不兼容 | 未使用专业模式的普通聊天仍可工作；MODE 实例化后逐 owner 创建对象/Task | 跨域部分提交、升级并发、专业语境 B/C/D |
| SD | workflows/modes/software-development/CONTRACT.md，SD-01～07 | 专业 Project、Requirement、Architecture、Resource Mapping、Work Trace、Baseline 身份和修订独立；AI 建议只为草案 | 需求 → 架构 → 代码资源引用 → Workflow Task → GitHub/Local → Verification | 真正资源版本失效、并发编辑、长期追溯 B/C |

### 共同通过条件

- 对每个编号必须有正常、明确拒绝、冲突、超时/unknown、重复/迟到、取消及恢复适用性说明；不适用者说明理由。
- 模块提供者和消费者分别有测试；组合调用只通过公开能力接口。数据 owner 和 Operation/Task/权限边界保持唯一。
- E0 静态审查、E1 替身、E2 局部真实环境、E3 真实组合、E4 Windows 分级记录；不得跨级推定。
- 优先本地/模拟测试，查询 GitHub Actions 运行集合再决定是否需要 CI；不以提交文档为测试通过。

## 状态与后续顺序

本次只形成规格与优先级记录，**没有实施 Runtime、迁移 GitHub、运行 Windows E4、完善身份系统或重新开展 DSH 原生插件实验**。下一施工批按 R-B1 → R-B2 与 G-B1/G-B2 并行（不修改同一 owner 资源）→ API/Local/MODE/SD 验收，留住未决政策/实验边界。Accounts 后置。
