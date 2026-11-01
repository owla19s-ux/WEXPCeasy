# GitHub 连接器｜旧成熟能力复用与独立验收（2026-11-01）

状态：**复用评审与移植规格；WEXPCeasy 目前无 GitHub 产品连接器实现**。上位 owner 为 connections；这份文件只细化 GitHub 适配器，不建立另一套 Operation 或授权系统。

## 一、已检查来源与复用结论

- WEXPC Rust 实现：[github_dispatch.rs](https://github.com/owla19s-ux/wexpc/blob/main/crates/wex-desktop-service/src/connectors/github_dispatch.rs)。可见的 read_approved_github_file 已有可信 Dispatch 匹配、资源/路径校验、意图参数绑定、凭证不可用诊断、HTTP 超时与响应大小限制。此为旧实现源码存在的证据，不是 WEXPCeasy 测试通过的证据。
- WEX 旧 Flutter/Dart 连接：[github_extension.dart](https://github.com/owla19s-ux/WEX/blob/main/apps/wex/lib/extensions/android_connectors/github_extension.dart)、[github_tool_session.dart](https://github.com/owla19s-ux/WEX/blob/main/apps/wex/lib/extensions/android_connectors/github_tool_session.dart)；可作为功能与交互行为参考，**不按原语言直接纳入 TypeScript/Electron 主线**。
- 复用路线：复用经实测证实的**业务规则、请求参数校验、GitHub API 行为、错误分类、测试样本和边界条件**。直接复用 Rust 二进制或移植实现必须比较 FFI/子进程/Node 实现成本、宿主集成、平台打包、取消与权限风险；未选定之前不重写，也不宣布可即插即用。
- GitHub Connector 与 Local Git 分开：前者为远端 GitHub API 仓库/PR/Actions/Commit/分支/内容；后者处理本地工作树、index、HEAD、git commit；git push 属于明确远端副作用，不能靠本地 Git 授权放行。

## 二、功能和验收映射

| 编号 | 候选能力 | 输入与授权边界 | 必须验证 |
|---|---|---|---|
| GH-01 | 连接与仓库定位 | 凭证引用、owner/repo、权限范围、当前仓库身份 | 授权仓库与请求目标不匹配拒绝，Token 不进入回执 |
| GH-02 | 只读元数据与文件 | 仓库、ref/commit SHA、路径、内容大小限制 | 路径/编码/大小限制、404/403、重定向及 HEAD 漂移 |
| GH-03 | 分支与 HEAD 读取 | 目标分支、当前 ref、预期 SHA | 默认分支可能变化，不依赖旧名称缓存 |
| GH-04 | Commit/文件写入 | 用户确认目标、修改依据、expected SHA/parent、内容或 patch | stale SHA 冲突拒绝；写后断连按远端对象核对，不能盲重提交 |
| GH-05 | 分支创建/更新/删除 | 仓库、ref、预期目标与版本 | 冲突/分支保护/竞态；删除独立授权，不隐式清理 |
| GH-06 | PR 查询/创建/更新/合并 | base/head、PR 目标、批准的合并动作 | 同意图重复提交不产生多个 PR；合并前重查冲突和 CI 证据 |
| GH-07 | GitHub Actions 查询与触发 | workflow/run、分支、授权、预算/实际配置 | 先读 runs 集合；仅当明确需触发且授权时触发；不以 PR 自动断言 CI 已运行 |
| GH-08 | 运行状态与日志观察 | run/job ID 与观察时间 | pending/queued/in_progress/completed 区分；失败日志有真实来源 |
| GH-09 | 结果未知与回执恢复 | Operation ID、意图、远端 commit/PR/ref/run 定位 | timeout/断连/ACK 丢失必须回读；Not Found 单独不证明未执行 |
| GH-10 | 限流/取消/安全与能力声明 | 401/403/404/409/422/429/5xx、重试限制 | 错误分类清楚；限流不绕权限；不可取消的远端副作用不虚报取消 |
| GH-11 | 远端产物与证据引用 | commit SHA、PR、run、文件版本与目标仓库 | workflow Artifact/Verification/Acceptance 自有归属；路径/文本自报不算验证 |
| GH-12 | 适配器版本、配置与卸载 | 连接修订、GitHub API 版本、Capabilities | 更新配置不改在途 Operation；停用阻止新调用不删除历史 |

## 三、先复用，后移植

G-B1 **旧代码能力盘点**：逐项读取 WEXPC Rust dispatch 源码和测试、WEX Flutter 旧模块与对应报告，形成“可复用规则/测试、需移植代码、不可复用 UI/宿主耦合、缺失功能”矩阵。现仅确认上述 Rust 读取适配的部分安全检查；不得把写入/PR/Actions 整体称作成熟产品实现。

G-B2 **宿主适配与替身验收**：以 connections 的 Operation/permissions 接口接入能力，不直接继承旧客户端内部判权；先测 GH-01～03/09/10 的失败、版本、速率限制、伪造参数和未知结果。

G-B3 **写入能力与真实远端验收**：按 GH-04～08 分功能在用户明确许可的测试仓库验证；旧 WEXPC 的操作成功经验不代表新的宿主已通过。不要为了验收自动触发 GitHub Actions，优先本地和伪造响应验证。

G-B4 **组合验收**：Workflow/Task → GitHub Operation → 远端 SHA/PR/CI 证据 → 独立 Verification/Acceptance；不得混淆请求返回成功和最终验收完成。

停止条件：必须先锁定旧代码对应 commit/测试证据，避免仅凭文件存在复制。架构保持单 owner、单 Operation 账本、单权限源，不额外造 GitHub 专用授权数据库。
