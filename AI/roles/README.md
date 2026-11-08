# AI/roles｜角色、岗位与职责子域

> 2026-11-08 源码核对：`main@4ec86a84f83aad2e6b6ef46a1fc0db103fc015a1`。此目录目前只有本 README，**角色功能并非零实现**：基础 Role/Position/Agent 代码集中在 `../src/index.ts`，测试位于 `../tests/`，桌面入口在 `UI/src/ai-settings.tsx` 和 `app/src/desktop-ai.ts`。本页不代表最新 CI/Windows 验收通过。

## 职责和目标

该子域承接 AI 模块的 Role、Position、Responsibility、Scope 及工具资格配置目标；现阶段仅维护子域说明，不默认建立独立源码或第二套角色数据表。正式功能与接口以 [AI/CONTRACT.md](../CONTRACT.md) 为准。

- **Role**：角色行为、提示与表达配置；当前有 `{name,prompt}` 的可保存对象。
- **Position**：岗位及职责描述；当前有 `{name,responsibility}` 的可保存对象。
- **Agent**：独立执行主体配置，可引用角色/岗位及模型。当前源码仅支持一个 Role 与一个 Position，这是实现限制，不是长期产品原则。
- **Responsibility / Scope**：同一 Agent 在不同工作范围承担的职责；目标支持兼任和多个 Agent 复用同一角色，但尚无正式关系接口。
- **工具资格**：决定 Agent/Role 可看到或提出的能力集合，不是实际权限；本子域未实现资格配置。

主 AI、秘书/管家、研究、执行、审查与验证都是可组合的职责定位，不得固化为不可兼任的身份等级。同一模型被多主体共用，不得混合身份、上下文或授权。

## 当前缺口与接线

| 功能编号 | 状态（源码核对） | 下一处理 |
| --- | --- | --- |
| AI-ROLE-001 | 部分实现 | 生命周期、停用/归档和引用影响需明确 |
| AI-RESPONSIBILITY-001 | 部分实现 | 解除 Agent→固定单 Role/Position 的长期上限；先核对迁移和边界 |
| AI-SCOPE-001 | 未实现 | 职责范围由 AI 描述，Context 选择归 Space，Task 分配归 workflows |
| AI-PROMPT-001 | 部分实现 | 提示已有，但来源与工作修订引用需补充 |
| AI-TOOL-ELIGIBILITY-001 | 未实现 | 按已确认资格/授权分离原则补充能力；不建立第二套权限 |
| AI-WORK-SNAPSHOT-001 | 未实现 | 在途工作绑定来源修订，不静默采用最新角色编辑 |

- `space` 保存 Context 对角色/Agent 的**选择**；AI 负责配置及职责关系；不复制 Context 成员表。
- `workflows` 保存 Task 分配/轮次；`permissions` 决定当前许可；`connections/api` 提供模型/连接引用，不在本域保存 Key 或调用 Provider。
- 角色变更不覆盖在途工作依据，角色名称/Prompt 不得绕过权限。角色长期记忆、共享、外部 Agent 运行实例暂不在此目录预建空模块。

## 实施和验收

先核查 `../src/index.ts` 的配置读写和引用测试，明确 Role/Position 变更、重启恢复及关联删除行为；再判断是否确需独立拆出本子域实现。不能因 `roles/src` 不存在就重复建设已有功能。

验收重点：角色/岗位定义与独立复用、多个职责的受控配置、关联与撤权互不替代、重启后修订稳定、旧工作不受新配置静默影响、真实 UI 消费。当前这些长期行为尚未全部实现或验证；不得以基础配置测试代替。

工作模式遵守根 README 的文档/施工分工。完整功能编号及当前实施说明均在 [AI 模块 README](../README.md) 与 [CONTRACT](../CONTRACT.md)，A0 历史研究仅按争议定向追溯。
