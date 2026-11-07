# DSH 研究：公开的插件 HMR / 热插拔实现

状态：源码参考，不代表 WEXPC1 已选用 Node/Cordis 或已实现热插拔。

## 来源
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/boot/hmr/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/boot/plugin-manager/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/boot/app-boot/README.md

## 已核实的机制

1. `dsh-hmr` 将插件源码替换、Include 更新、Profile 配置重组放入同一串行队列；包安装本身在队列外。
2. `root: []` 保留配置监听而不监听任意源码目录；设置 watch roots 才启用相应源码监听。未启用 HMR 的部署在重启后应用变更。
3. Profile 重组预检后通过 Loader 更新运行时；文件变更检测记录 inode、size、mtime，沿 ESM 与 CommonJS 模块依赖关系寻找受影响插件。
4. 受影响插件先停用，再由 Loader 重新导入当前文件；插件的注册与资源释放由其生命周期管理。
5. 重组失败有不同语义：预检失败可保留运行态；模块替换后导入或激活失败可能使旧插件不再运行，不能笼统承诺无损回滚。
6. Plugin Manager 管理 bundle 安装、启停、升级与恢复；manifest 和 lockfile 可在安装失败时恢复，但这不等于任意运行态回滚。
7. HMR 对宿主依赖、部分模块缓存、worker 环境和特定包路径变化有明确限制；可能返回 restart-required。
8. 文档注明替换实现源于 `@cordisjs/plugin-hmr` 1.0.15，保留 MIT 许可证；借鉴源码时仍需逐文件核对许可证与第三方依赖。

## WEX 的可迁移设计

建议将用户动作“把模块放入目录，刷新 UI 就能用”拆为：发现 → 读取清单 → 兼容性/依赖预检 → 注册能力 → 激活 → UI 能力目录更新 → 回执。停用则先阻止新调用，再处理在途任务、撤销注册和资源清理。

关键是 **Module Manifest / Loader / Lifecycle / Capability Registry / UI Contribution** 分离。即使 WEXPC 仍采用 Rust + Flutter，也可以复用此契约，而非必须迁移 Node/Cordis。

当前 0.1.1 可先做轻量插件清单、加载状态、注册与撤销接口；真正动态库加载、跨进程插件、热替换事务属于待评估实现选型。

## 需求对冲

- 新插件目录出现但依赖缺失：不得污染已运行能力目录。
- 插件升级中有执行中的 Git 写入：不得将已发生副作用伪装成取消成功。
- 新版本加载失败：保留明确状态与修复/恢复路径，不虚报回滚成功。
- UI 插件停用：相关视图和命令撤销，不影响无关页面。
- 不可信插件：HMR 不提供沙箱；安装授权与运行权限仍需分开。
