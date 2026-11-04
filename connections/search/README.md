# connections/search

首版基础搜索与网页 Fetch 能力，按服务商差异维护适配器；公开能力由可信宿主装配并接入 `connections` 受控边界，可被对话或工作流调用。需要权限、超时、大小限制与返回内容安全边界。

状态：目录说明，尚无实现；具体搜索服务尚未确定。


## 上级契约与文档入口

- **上级业务/职责研究（历史）：** [connections/CONTRACT.md](../../docs/research/contracts/connections/CONTRACT-archive.md)
- **全局文档总索引：** [docs/README.md](../../docs/README.md)
- [全局契约地图](../../docs/architecture/GLOBAL-CONTRACT-MAP-V0.1.md)
- [复杂业务契约压力审查](../../docs/audits/COMPLEX-CONTRACT-STRESS-REVIEW-2026-10-31.md)

本子目录不另建第二份业务权威。当前稳定职责与施工范围以对应 owner README 和根 README 为入口；历史契约只按需追溯，实验结论仅按原环境和范围解释。

## G5：外部搜索与内部检索分离

本目录只提供互联网 Search/Fetch 适配器、外部来源和抓取限制，不负责搜索 WEX 自身的 Space、Context、Conversation、Task、Artifact 或 Operation。内部检索由各业务 owner 提供获准查询，UI 聚合。外部命中不等于可信事实或授权；打开、读取、摘要和外发仍按当前来源及权限规则处理。

见[基础能力落地映射](../../docs/planning/FOUNDATION-CAPABILITY-IMPLEMENTATION-MAP-2026-10-31.md)。
