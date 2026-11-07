> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 基础工程开发与测试

本批仅shared、permissions、app。主语言TS，Electron/React路线不变；当前验证无窗口宿主，不增加UI或打包器依赖。

```sh
npm ci
npm run typecheck
npm test
npm run test:shared
npm run test:permissions
npm run test:app
npm run check:boundaries
npm run start:headless -- /path/to/existing-root
```

Node >=24.9.0（本次24.22.1），TypeScript 5.9.3、@types/node 24.10.0及undici-types由根lock锁定，测试使用Node内建runner，不依赖Electron窗口。
数据根必须已有 `.wex-root.json`，format=1、id非空；CLI不自动选根/建根，默认不授予权。数据根、程序、源码目录各自独立。

源码公开面为各模块 `src/index.ts`；内部实现按责任拆文件，类型声明随构建产于dist。依赖：app→shared/permissions，permissions→shared类型；shared不反依赖。app对permissions只注入绑定命名空间的Store。驱动/可信事实/根锁端口都可替换；不暴露数据库连接或可变全容器。

`tools/check-boundaries.mjs` 使用TS AST扫描产品源码（含export、require、动态import及类型import），明确排除实验/上游/原型/测试/产物。输出文件与真实边；空图、解析失败、缺目标、动态不可解析、深导、反依赖、文件/模块循环、Renderer特权导入都失败。它是源码门禁，不是运行沙箱，也不证明IPC身份或Windows隔离。

当前存储是一命名空间单聚合CAS与意图记录，单SQLite事务；无自动清理意图/权限历史。未来格式迁移须先备份与兼容设计，不直接换驱动覆盖旧数据。Node内建SQLite在Electron的可用性需单独验证；这是适配实现，不把候选强制为全产品技术决策。

本次网络不允许直接GitHub/npm registry；通过GitHub连接器固定SHA读取完整源树，复用环境已有且与lock一致的依赖。构建、真实SQLite/子进程和测试均在本仓执行。未证明联网干净`npm ci`，依赖目录未提交；不能把复用依赖写成全新安装成功。

实验回归使用原有独立入口，不纳入基础产品测试数量。运行原型/DSH测试需各自依赖；不调用付费服务、外部Agent或Actions。
