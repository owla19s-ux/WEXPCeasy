> **2026-11-04 文档治理标识｜历史研究/证据**：保留原始结论、编号及当时状态；当前施工从[根 README](../../../../../../README.md)进入，本文不自动派工。研究中的候选、准备度及接口草案不等于已批准或已实现。

# 新增模块 / 新增能力检查清单

## A. 新增模块前

- [ ] 能回答“模块五问”：数据归属、公开能力、依赖边界、失败/证据、独立验证
- [ ] 满足能力模块判据（≥2 个使用场景、独立协议/认证/错误/证据、可独立测试）
- [ ] 不是 UI 页面、不是工作流模式、不是技术分层
- [ ] 名称是职责名，不是 `core`/`common`/`utils`
- [ ] 明确非职责

## B. 建模块

- [ ] `modules/<id>/MODULE.md` 按模板填写
- [ ] `modules/<id>/module.toml` 填写
- [ ] `src/lib.rs` 只导出构造/注册/配置
- [ ] `src/capabilities.rs` 能力声明完整
- [ ] `src/config.rs` 配置 schema 与校验
- [ ] `src/errors.rs` 错误映射
- [ ] `tests/contract.rs` 契约测试
- [ ] `tests/fixtures/` 回放数据
- [ ] `docs/notes.md` 已知限制

## C. 新增能力

- [ ] 能力 ID 符合 `<module>.<resource>.<action>`
- [ ] 参数 schema 完整（类型、必填、边界）
- [ ] 副作用分类正确
- [ ] 审批类别正确
- [ ] 幂等策略明确
- [ ] 证据规格明确
- [ ] 错误映射完整（尤其 OutcomeUnknown）
- [ ] 契约测试 + 单元测试 + fixture
- [ ] `MODULE.md` 能力表同步
- [ ] `module.toml` capabilities 同步

## D. 边界检查

- [ ] 没有 import 其他模块内部
- [ ] 没有修改 `platform/`（如修改，是否有 ADR？）
- [ ] 没有修改 `apps/` 业务代码（组合根注册除外）
- [ ] 没有新增中央 enum/match
- [ ] 配置/迁移在本模块内
- [ ] 凭证只走 secrets/引用
- [ ] 权限只在执行点检查

## E. 验证

- [ ] `cargo test -p <module>` 通过
- [ ] `cargo test -p <module> --test contract` 通过
- [ ] `xtask arch-check` 通过
- [ ] 模块外改动文件数 ≤2
- [ ] `MODULE.md` 与代码一致

## F. 交付说明

- [ ] 改动文件列表
- [ ] 新增/修改能力
- [ ] 契约是否变化（版本/ADR）
- [ ] 测试命令与结果
- [ ] 未完成项与风险
