# shared/permissions — 历史入口（不承接实现）

原“统一授权检查”的职责已归独立 [permissions/](../../permissions/README.md)。此目录仅保留重定向说明，不新增策略、授权状态、判定实现或第二套审计账本。

连接边界调用权限域；`shared` 只提供通用存储/凭证等技术机制。调用方应查阅现行权限 README，不沿旧目录另起实现。目录保留不代表已存在运行服务。


## 正式 owner

- [Permissions 模块](../../permissions/README.md)：权限判定与审计的唯一维护入口。

本目录仅保留历史路径说明，不承担现行权限实现或全局文档导航。
