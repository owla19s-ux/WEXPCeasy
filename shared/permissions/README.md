# shared/permissions — 历史入口（不承接实现）

原“统一授权检查”的职责已归独立 [permissions/](../../permissions/README.md)。此目录仅保留重定向说明，不新增策略、授权状态、判定实现或第二套审计账本。

连接边界调用权限域；`shared` 只提供通用存储/凭证等技术机制。调用方应查阅现行权限 README，不沿旧目录另起实现。目录保留不代表已存在运行服务。


## 现行契约与文档入口

- [permissions 业务契约](../../docs/A0-产品构想与研究/方案与研究/既有研究/contracts/permissions/CONTRACT-archive.md)
- [全局文档总索引](../../docs/README.md)
- [权限边界决策记录](../../docs/decisions/BOUNDARY-DECISION-NOTES-V0.1.md)

本目录仅为兼容旧路径的说明页；任何权限语义、实现和测试均只在 `permissions/` owner 域维护。
