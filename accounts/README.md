# accounts — 账号与身份体系（预留）

状态：2026-10-30 按用户要求仅保留顶层入口，**尚未确定账号模型、注册/登录方式、云端服务或实现排期**。

未来研究范围可能包括本地用户身份、外部平台账号关联、跨设备登录/同步以及多人/组织使用；这些不是首版已经批准的功能。首先以个人本地使用为阶段目标，不让登录或远端账号服务器阻挡第一版离线启动与本地资料访问。

边界：`accounts/` 负责主体身份及账号生命周期；`permissions/` 负责主体在具体操作、Context、模块上的授权；`connections/` 负责接入第三方服务，API Key 等秘密由安全凭证机制保管。外部 DSH 或模型平台账号不能直接等同于 WEX 本地账号。


第六批：[最新准备度/证据及限制](../docs/batch6/READINESS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 身份边界预留

- [Accounts 身份与账号边界](BOUNDARY.md)：本地可离线启动、可信 OS/安装主体由 app 提供、权限归 permissions；云账号与同步不进入首期。

## 文档入口与证据边界

- [文档体系总索引](../docs/README.md)
- [全局契约地图](../docs/architecture/GLOBAL-CONTRACT-MAP-V0.1.md)
- [研究决策与当前边界](../docs/decisions/RESEARCH-DECISIONS-2026-10-30.md)
- [第六批准备度与待决边界](../docs/batch6/READINESS.md)

本目录当前为预留机制或独立实验，不等于完整产品模块已获施工准入。研究/实验结果只证明其明确记录的范围；不得外推为完整 WEX 集成、Windows 实机或生产可用性。
