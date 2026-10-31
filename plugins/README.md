# plugins — WEX 自有插件机制（预留研究）

**状态：已建立 PLUGINS-* 候选业务契约；机制仍未研究定型，无产品级动态插件加载器。当前不作为 WEX 首期前置。** 不预设 Cordis、DSH Service 或其他框架是 WEX 自有插件的必选底层。

## 模块编号规则

- WEX 自有插件功能使用 `PLUGINS-<子域>-NNN`，详见 [CONTRACT 第 2 节](CONTRACT.md#2-模块独立功能编号与细化契约)。
- 本模块的契约是候选业务语义，不代表插件加载器、包格式、沙箱或市场已确定。
- DSH 原生插件与外部 DSH Agent 连接器继续使用独立目录和验收路线。

## 研究边界

- 未来 WEX 插件可以通过 [内部/公共连接体系](../connections/README.md) 受控提供能力、请求宿主能力，**不得直接依赖 WEX 内部具体服务文件**。
- 插件生命周期、依赖管理、安装/卸载、隔离、包格式、版本兼容和 UI 扩展机制，待基础连接器与真实 Windows 使用经验成熟后再确定。
- WEX 连接器是当前可用功能接入方式，**连接器不等于动态插件**，无需被某个插件加载器强制管理。
- [DSH 原生插件宿主](../dsh/README.md) 使用独立 Cordis Core + Loader；[DSH Agent 连接器](../connections/dsh/README.md) 对接外部客户端；二者都不是这里的 WEX 插件加载器。
- 用户数据根未来拟保留 `plugins/wex/`、`plugins/dsh/` 分离，属于**安装目录目标**，不是当前已完成安装器。

当前不新建 runtime/、registry/、market/ 等空壳目录。已有早期关于 Cordis 作为 WEX 模块基础的设想保留在 Git 历史和研究资料中，不再作为当前施工决策。

详见 [本阶段研究共识](../docs/decisions/RESEARCH-DECISIONS-2026-10-30.md) 与 [DSH 双路线架构说明](../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)。


第六批：[最新准备度/证据及限制](../docs/batch6/READINESS.md)。原生Core+Loader实验、WEX外部DSH连接和Windows实机证据分别验收；预留平台不因局部实验通过进入正式施工。


## 文档入口与证据边界

- [WEX 自有插件业务契约](CONTRACT.md)

- [文档体系总索引](../docs/README.md)
- [全局架构：双插件体系边界](../docs/architecture/DUAL-PLUGIN-SYSTEM-BOUNDARIES-2026-10-30.md)
- [运行时扩展契约研究](../docs/architecture/RUNTIME-EXTENSION-CONTRACT-V0.1.md)
- [研究决策](../docs/decisions/RESEARCH-DECISIONS-2026-10-30.md)
- [DSH 能力差距审计](../docs/audits/DSH-WEXPC1-GAP-MATRIX-V0.1.md)
- [第六批准备度](../docs/batch6/READINESS.md)

本目录当前为预留机制或独立实验，不等于完整产品模块已获施工准入。研究/实验结果只证明其明确记录的范围；不得外推为完整 WEX 集成、Windows 实机或生产可用性。
