# Accounts｜仅保留的身份与账号边界（2026-11-01）

状态：预留规格，不表示已决定注册/登录产品、云服务、多租户或实施排期。

- **accounts owner：** 未来本地用户主体/账号生命周期、外部账号关联、跨设备账户与组织身份映射（均为可选未来方案）。
- **app owner：** 当前 Windows 可信入口、OS 用户/SID、安装关系和进程/IPC 代次；在没有 accounts 产品代码时也必须能够完成本地启动。
- **permissions owner：** 所有主体对模块/资源/Context/动作/入口的授权、Grant/撤销与审计；账号存在不等于被授权。
- **connections owner：** 外部 GitHub/模型/Agent 服务连接、Service 和 Operation；外部 Token 由 shared/credentials 保管，不应转存至 accounts 的通用对象。
- **space owner：** Space 类别、Context、工作区选择和组织结构；Space 类别“公司/个人”不等于账户组织或租户。
- **AI owner：** Agent/角色职责；Agent 名称、角色、模型账号、外部 Session 不能替代可信用户身份。

## 不应阻塞首版的事项

无需 WEX 云账号即可安装、选择本地数据根、打开 Context、进行获准的离线操作和使用独立 Provider Key。数据盘重装接回需重核本机可信主体/授权/凭证，不自动复活旧 Grant。

## 将来启用前需要单独决策

1. 本地身份是否需要多用户、Windows SID 映射和恢复边界。
2. 云账号、跨设备同步、组织/协作、共享资源和数据驻留是否真的成为产品目标。
3. 外部账号关联、登录、登出、会话失效、撤销、设备丢失和迁移的数据/安全政策。
4. 身份模型不能提升现有权限：所有跨 Context/组织访问仍需当前 permissions 判权。

先保留 README/BOUNDARY，不新增运行时代码、数据库表、云服务部署或版本承诺。
