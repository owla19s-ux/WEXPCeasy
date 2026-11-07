# 第六批：契约收敛与模块施工准备度

2026-10-31；起始main：`aeca0ec7b8e574732d74b03e828e603584f2fdad`。包含第五批`6d0fa1c`后的四个F01/F03/F05文档补丁，没有以历史HEAD代替最新main。根目录没有AGENTS.md，遵从用户本批任务、README与现有协作规范。

**结论：部分具备模块独立施工条件。** 可以开始组织引用、AI配置、布局配置等明确范围；其余按黄色稳定子能力推进。真实DSH成功派发、跨域安全并发、Windows安装/恢复与权限政策仍是门槛，不能宣布完整产品闭环可用。本批没有正式产品施工。

| 交付 | 入口 |
|---|---|
| A F01–F09逐项收敛 | [CONVERGENCE.md](CONVERGENCE.md) |
| B 九类机制、实际环境/失败/未验证 | [EXPERIMENTS.md](EXPERIMENTS.md) |
| C 全11域绿黄红及逐项门槛 | [READINESS.md](READINESS.md) |
| D 依赖、契约、测试、多AI边界 | [DEPENDENCIES.md](DEPENDENCIES.md) |
| E 原样本组合验收 | [COMPOSITION.md](COMPOSITION.md) |
| F A/B/C/D及用户待决项 | [DECISIONS.md](DECISIONS.md) |
| G 后续施工顺序 | [NEXT.md](NEXT.md) |
| 执行计划/实际证据 | [PLAN.md](PLAN.md)、[环境](../../../../batch6/evidence/environment.json)、[实验入口](../../../../../experiments/contract-readiness-spike/README.md) |

E0=静态组合核查；E1=实验模型/替身；E2=真实本地文件/进程/数据库技术机制；E3=真实外部DSH/第三方插件/适配；E4=Windows实机。**一个实验可同时含E1业务模型和E2技术证据，不能整项外推为E2产品集成。** 没有完整H样本被本批提升为运行通过。

本批收敛条款可作为下一阶段稳定范围的实现验收输入；历史B选型/机制/推荐不因入仓或实验通过升级为A。D未代用户决定，C按子断言保留。第三层实现签名、IPC编码、SQLite驱动、根锁平台实现、插件协议未冻结。
