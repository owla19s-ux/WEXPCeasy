# app｜可信桌面宿主与生命周期

> Owner：`app/`，版本状态见 [A2](../docs/A2-版本与工程状态/0.1.1/功能与工程状态总表.md)，产品目录与 Windows 数据规则见 [正式设计](../docs/A1-正式产品设计/架构与决策/源码目录与Windows数据规则-2026-10-30.md)。

## 当前实现与源码入口

`src/index.ts` 与 `foundations.ts` 负责可信模块装配与启动/停止；`src/desktop-main.ts`、`desktop-runtime.ts`、preload 负责 Electron/React 宿主；`desktop-space.ts`、`desktop-api.ts`、`desktop-connections.ts` 等负责各领域的窄 IPC；`desktop-authority.ts`、`desktop-credentials.ts` 处理可信确认、授权与秘密隔离。另有 Windows NSIS 安装/数据根选择与恢复相关实现、`desktop-failure.ts` 的 Renderer 失效封锁/恢复机制以及桌面测试。

**当前不是仅有 headless 宿主或仅 Space/API 占位 IPC。** `desktop-connections.ts` 当前读取到的请求白名单包含配置、凭证及 `github.read/write`，但不包含通用 `github.tools/github.invoke`；后者的双平台成果见独立 [PR #3](https://github.com/owla19s-ux/WEXPCeasy/pull/3)，不能在未确认合并时记作 main 实现。

## Owner 不变量

- App 只管理可信宿主、装配、Native/IPC、凭证入口、进程、窗口、错误恢复；不拥有 AI/Space/Conversations/权限/Operation 的业务权威。
- Renderer 不直接访问 Node、密钥、任意 OS 工具或可信判权对象；受限输入须捕获、确认并在实际动作前重检。
- abort/关闭 UI 不等于外部已停止、已回滚；资源释放不确定时保留 incomplete 和可重试清理，不自动假设安全重启。
- WEX 程序安装目录、用户公共数据根、Space 工作区、外部工具环境目录保持不同用途，不因重新安装改写已有数据。

## 当前缺口和验收

| 方向 | 已有 | 仍需验证 |
|---|---|---|
| 模块装配与受控 IPC | 真实入口、测试与多个领域接线 | 全部消费者、撤权/崩溃/旧请求、权限身份 |
| 对话与 GitHub/Local | 有正式 UI/宿主交互基础 | 真实服务、原 Operation/未知结果及跨域恢复 |
| Windows 安装和数据根 | NSIS、首次选择和恢复相关代码/测试已提交 | 当前 SHA Windows CI、真实安装/卸载/重装 E4 |
| 生命周期/Renderer 失败 | 即时封锁、资源释放与恢复逻辑已有专项代码 | 关闭失败、重复失效、停止不确定与实机 |

施工先看最新 Actions 全运行集合及 SHA，再跑可用的 `npm run test:app`、build/typecheck/test/boundaries 与 Windows 专项。根 README → 本 README → `src/` 与 `tests/` 是默认阅读路径；历史批次仅在具体证据争议时追查。
