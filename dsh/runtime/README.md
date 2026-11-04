# 独立 Core + Loader 验证工具

此处仅维护 WEX 自有构建装配，不修改 `../upstream/`。完整命令见 [工程入口](../README.md)，真实结果见 [验收报告](../BUILD-VERIFICATION-2026-10-30.md)。

`build.mjs` 先验证上游 blob，随后清空 `.build/`，从四个原始 package tsconfig 派生独立项目：只重定向输出、项目引用、四包 source aliases、Node/Standard Schema 类型解析。继承上游编译规则，TypeScript 真正编译全部源文件；不关闭类型检查或吞掉错误。生成 JS 再经 esbuild 打包到原清单的公开入口，复制原 package.json 和 LICENSE，并建立本地包解析链接。

固定依赖：TypeScript 5.9.3、@types/node 24.10.0、esbuild 0.25.12、@standard-schema/spec 1.1.0。前三者为验证工具选择，不冒称上游 monorepo 的原工具锁；Standard Schema 版本满足上游声明的 `^1.1.0`。npm 锁文件记录具体 tarball 与 integrity。实际运行时包闭包只有四个 vendored 包，Standard Schema 只用于类型，未引入 Agent/Boot/Client。

安装使用 `--ignore-scripts`，本轮 Linux 的 esbuild 平台二进制由锁定可选包提供，已实测可运行；其他 OS/架构需另验。生成 manifest 保留 `workspace:` 字段，只作本地解析，不将 `.build/` 当成可发布 npm 包。Core CLI 原样保留用于完整性，但依赖可选 include，不在本轮运行入口内。原 tsdown 配置作为上游资料保留，独立构建不安装 tsdown 或其 monorepo 构建链。

`verify.mjs` 为每个检查创建独立 Node 进程并设 30 秒上限，失败立即退出。`smoke-runtime` 保留原基本检查；`test-loader-runtime` 覆盖真实文件导入与依赖/生命周期变化，无 mock。配置重载和相同模块重新挂载已经测试，编辑源码后清除 ESM cache 的 HMR 尚未测试。

生成目录及链接均被 git 忽略。删除 `dsh/runtime/.build/` 与 `dsh/node_modules/` 后可从锁文件重建；测试不启动 GitHub Actions，也不接触 WEX 业务数据。

## 独立进程生命周期入口（2026-10-30）

构建后执行 `node dsh/runtime/host-process.mjs hello`：打印 started/loaded/unloaded/stopped，并确认根 Loader 已释放。`throw`、`missing` 两个模式分别真实导入启动抛错插件、缺失模块，打印 failed、disposed=true，退出 1。仅允许这三个受控模式，不接任意第三方插件路径。

`node --test dsh/checks/test-host-process.mjs` 的三项真实子进程测试已通过并纳入 `npm test --prefix dsh/runtime`。本批重跑锁文件安装、四包 TypeScript/打包、原有全部检查及 `node --expose-internals dsh/checks/test-loader-runtime.mjs` 均通过。上游 51 文件 blob 完整性仍匹配 f3803c9；未修改上游源码。

这是独立短周期启动/停止验证入口，不是持续后台插件服务器；测试插件真实导入、真实执行和释放，hello 是仓库已有样本而非市场兼容性证明。Windows 待验：包解析与路径/链接、平台构建二进制、启动抛错后的退出/资源释放、Electron 通过独立 worker/子进程托管。未把任何第三方插件装入 Electron 主进程。


第六批：[最新准备度/证据及限制](../../docs/batch6/EXPERIMENTS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 上级契约与文档入口

- **上级业务/职责研究（历史）：** [dsh/README.md](../../dsh/README.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [双插件体系边界](../../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)
- [第六批实验与证据](../../docs/batch6/EXPERIMENTS.md)
- [DSH 能力差距审计](../../docs/audits/DSH-WEXPC1-GAP-MATRIX-V0.1.md)

本子目录不另建第二份业务权威。当前稳定职责与施工范围以对应 owner README 和根 README 为入口；历史契约只按需追溯，实验结论仅按原环境和范围解释。
