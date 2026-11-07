> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 第六批交付验证记录

起始main `aeca0ec7b8e574732d74b03e828e603584f2fdad`；实验提交 `a0cc7ac43d846ddd2dec6a0d854ad4897ee63811` 已用expected SHA保护更新main并fetch回读。文档后续提交同样在核对最新HEAD后进行；最终SHA见Git历史/交付回执，不自引用。

| 实际命令/检查 | 结果/证据 | 限制 |
|---|---|---|
| `python3 experiments/contract-readiness-spike/test_mechanisms.py` | 18/18，[原输出](../../../../batch6/evidence/mechanisms.txt) | E1模型+局部E2技术；非产品集成 |
| `npm run build --prefix dsh/runtime` | 固定51上游文件/四包TS编译打包通过，[原输出](../../../../batch6/evidence/dsh-build.txt) | 复用现有开发依赖；未新做registry干净安装 |
| `npm test --prefix dsh/runtime` | 原9个检查与新增真实生命周期检查通过，[原输出](../../../../batch6/evidence/dsh.txt) | 固定Core+Loader/fixture，非完整DSH/WEX集成 |
| `node --test connections/experiment/boundary.test.mjs connections/dsh/experiment/headless.test.mjs` | 18/18，[原输出](../../../../batch6/evidence/connections.txt) | 协议/边界夹具，非真实Agent成功 |
| `npm test --prefix workflows/editor/prototype` | 5模型+6DOM，[原输出](../../../../batch6/evidence/editor.txt) | 未测本轮实鼠标/Windows |
| `npm run build --prefix workflows/editor/prototype` | TS/Vite通过，[原输出](../../../../batch6/evidence/editor-build.txt) | 依赖use client忽略警告；非Electron打包 |
| `python3 experiments/contract-readiness-spike/check_docs.py` | 11域/33+9样本/九类缺口与实验/Markdown文件目标检查，[原输出](../../../../batch6/evidence/docs.txt) | 非锚点渲染或语义机器证明 |
| `git diff --check` | 退出0 | 文档+隔离实验，无无关产品修改 |
| 新上下文只读终审 | 无Critical/Important；进度勾选Minor已按实际补记 | 非CodeRabbit云审；终审后补的真实副作用恢复断言另跑全套18项 |

文件范围：新增`docs/batch6/`及`experiments/contract-readiness-spike/`，新增DSH隔离检查并接入既有verify；11域CONTRACT/README及相关索引/子入口更新；未大改目录、未改上游源码/依赖锁/产品功能。

约束：未调用付费API/服务、未调用Actions、未建分支/PR/Release、未操作用户真实资料。当前检出无`.github`工作流；提交带`[skip ci]`。不把该事实扩大为对任意外部GitHub App行为的保证。

未执行：真实WEX提供/消费者集成、真实DSH成功任务/指定目录产物/控制/恢复、任意第三方插件、Windows安装/多用户ACL/DPAPI/休眠/通知/更新/卸载。X09与剩余C/D有步骤及解除条件，不以模拟替代。

验收结论：本批收敛与准备度交付可完成；WEXPC1仅**分范围具备模块独立施工条件**。产品运行/安全并发/完整组合未验收，用户待决项没有代选。
