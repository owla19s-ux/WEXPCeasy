> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 第八批施工记录

基线 f955e058cf035a8fd38599367ad0c73926623907；远端2026-10-31复核一致。新克隆 main 干净，无 AGENTS.md，无 workflows。Node24.22.1，npm11.9.0。

- 环境：git clone、根 npm ci 成功。
- 基础复验：完整49/49；shared13/13、permissions5/5、app17/17；typecheck及AST通过。
- 决定：保留当前单仓公开出口结构。Electron/React只放 experiments/electron-host-spike，不把试验入口放进产品 app。
- 待办：模块独立编译、AST反例、Electron/SQLite重启、真实窗口/桥/IPC正反例/生命周期、旧实验回归、报告、复验、提交。

- 独立编译：三域入口闭包均通过；保留单仓结构，无Workspace改造。
- AST：新增UI→permissions拒绝，先红后绿；最终基础50/50。
- 隔离Electron45.2.1：三进程实际运行；write24/read23/startup-quit7命名断言，SQLite3.53.4/Node24.22.1、React、IPC/安全、窗口位图、释放重试均通过。
- 独立只读审查：2 Important已修复（pending启动退出、pre-ready路径时序）；Normal超时清理改为等待child close。生命周期新增3单测，实际启动quit再验。
- 旧实验：DSH10入口及构建、ReactFlow5+6及构建、连接夹具18、机制18通过。
- 未执行：Windows E4、安装/凭证/ACL、完整业务页面/DSH任务。正式产品入口仍待施工。
- 交付：REPORT及README/CONTRACT/索引同步；不新增产品业务范围，不触发Actions。
