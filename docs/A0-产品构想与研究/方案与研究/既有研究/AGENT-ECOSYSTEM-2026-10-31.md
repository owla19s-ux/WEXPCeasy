# 外部 Agent 连接生态取证（2026-10-31，上海时间）

## 结论与边界

保持已定路线：**DSH 是首期施工入口**，WEX 是 TypeScript/Electron/React 独立客户端；外部 Agent 不搬入 WEX。`connections/dsh` 与 `dsh/` Core+Loader 原生插件实验各自验收。Agent 自报完成不是产物验收；恢复历史、附着活跃会话、取消正在执行的工具、撤销文件副作用必须分别记录。

WEXPC1基线为 `70406cf`；依据只读该main `README.md`（blob `8527d7cf260408a207daacbc28ce9efd68b48cdb`）与 `connections/dsh/README.md`（blob `66a34b1e80ebea7a21c3c4407f0fb59f6ce00f89`）。另读取 `dsh/UPSTREAM-LOCK.md`、`connections/dsh/experiment/source-evidence.json`；未读取其他产品规划，不改远端。

证据等级：**A**=本次实际读取固定提交源码；**B**=同提交官方文档/许可证；**C**=WEX 已有实验记录（本次未重跑）；**U**=未核实。A/B 不等于实机通过。本次仅 Git/文件读取，不装依赖、不启动 Agent、不调用模型、不触发付费服务。所有 Windows 结论都是文档支持范围，**本次 Windows 实测均 U**。官方 Web 搜索工具返回空错误；替代为直接 Git 克隆官方仓并读随源码文档，网络可用，未据此将缺少运行验证写成产品能力缺失。

## 版本锁

| 简称 | 官方仓与固定 commit | 说明 |
|---|---|---|
| D | [DeepSeek-AI/deepseek-harness](https://github.com/DeepSeek-AI/deepseek-harness/tree/f3803c96974ad4a94195fb97e5c637e9c2a3afe3) `f3803c96974ad4a94195fb97e5c637e9c2a3afe3` | 与 WEX 原生机制锁一致；headless 实验另锁 `ce7073d51254c26cd63b22a60835b8f948deb447`，发布包 `0.2.1-rc.5`，不可混称同版本 |
| H | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/tree/5057eaa3a4d0cbef0e30078418a5115faa62889e) `5057eaa3a4d0cbef0e30078418a5115faa62889e` | 当前 gateway authority 已改变经典 CLI 的进程生命周期语义 |
| O | [OpenHands/software-agent-sdk](https://github.com/OpenHands/software-agent-sdk/tree/c048a1eb82353b0586f3ce600708394a68ebb246) `c048a1eb82353b0586f3ce600708394a68ebb246` | Canonical SDK、Agent Server、TS client |
| OC | [OpenHands/OpenHands-CLI](https://github.com/OpenHands/OpenHands-CLI/tree/283c6ac3610f4299f405f7389f65766dcb83e12a) `283c6ac3610f4299f405f7389f65766dcb83e12a` | headless/ACP CLI |
| OV | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands/tree/355ea62197722f6ffb11a55d661686b9c8b822da) `355ea62197722f6ffb11a55d661686b9c8b822da` | 当前已为 Agent Canvas 前端/控制中心；不能套用旧 monolith Python 路径 |
| C | [openai/codex](https://github.com/openai/codex/tree/b0f977c3a9c2e68e46e58e589e98f5297d2c8c10) `b0f977c3a9c2e68e46e58e589e98f5297d2c8c10` | Rust CLI、exec、app-server |
| A | [Aider-AI/aider](https://github.com/Aider-AI/aider/tree/5dc9490bb35f9729ef2c95d00a19ccd30c26339c) `5dc9490bb35f9729ef2c95d00a19ccd30c26339c` | Python 脚本入口与 CLI |

## 能力矩阵

| 项目 | CLI/headless 与机器协议 | 会话恢复/查询 | 流式、取消/中断 | cwd 与产物 | 插件/服务、Windows、许可证 |
|---|---|---|---|---|---|
| DSH | `dsh --profile headless --json -`：stdin 任务、stdout NDJSON、stderr 诊断；一次一任务。SDK profile JSON-RPC stdio；ACP profile stdio（A/B） | headless `--session-id` 恢复持久会话，校验 cwd/preset，拒绝未知、目录不匹配或本进程已占用等条件；SDK `session/resume`、`session/query`、`session/wait`、working-directory get/set；ACP `session/list`、`session/resume`，**不是 `session/load`**（A/B） | headless 语义事件中 text/thinking 来自已提交 step，不能称逐 token；SDK 事件与 status；**SDK 无 per-session close / prompt-cancel**；ACP `session/cancel`、`$/cancel_request`、`session/close` 有受控排空语义。杀 headless 进程不等于撤销全部后代副作用（A/B/C） | headless 解析 fs provider cwd；恢复需匹配记录目录。由工具实际写项目目录，事件非统一可信产物清单；需 WEX diff/文件核验（A/B；完整产物契约 U） | Cordis Service/Loader/Bundle、MCP；DSH 插件兼容与连接器无强制依赖。MIT。Windows headless/进程树/中文路径仍 U |
| Hermes | `hermes chat -q ... -Q` / `-z` 有限运行；`--format stream-json`；当前 CLI 通过 gateway authority。`hermes acp` stdio；HTTP API server（A/B） | `--resume ID/title/latest`；ACP `load_session`；HTTP runs GET、session identity/response chain。经典客户端退出/EOF **detach only**，不可按一次子进程即一次独立执行推断（A/B） | API runs SSE + GET 状态 + POST `/stop`；ACP cancel；CLI `/stop` 带 execution-generation fencing。completed/failed/cancelled/incomplete 分开；CLI exit 3 可表示 pending control/owner crash unknown（A/B） | `--in dir`，gateway 冻结 session cwd；旧 gateway 不支持 cwd 时会警告/显式拒绝。文件工具/terminal 后端位置取决于本地、Docker、SSH等配置；需保存 backend+cwd，非仅 WEX 本机路径（A/B） | Python tools/hooks/commands/skills/plugin.yaml，MCP；README 声称原生 Windows 支持且有 PowerShell installer，但 gateway-classic-cli 文档仍列 native Windows/macOS QA 未完成；MIT（B，本次实测 U） |
| OpenHands | OC `--headless --json -t task` / `-f file` JSONL；OC ACP stdio；O Python SDK、REST/WS、browser-compatible TS client，非仅网页自动化（A/B） | OC `--resume ID/--last`；O conversation GET/search、event 查询、持久 conversation/run；ACP `load_session`（A/B） | O REST pause 等当前 LLM 完成，interrupt 取消 in-flight request 并转 paused；`run` 可恢复；WS `/session/{conversation_id}` 推事件，GET 可补证；OC headless parser 明示自动批准动作（A/B） | SDK `Conversation(...workspace=cwd)`；remote workspace、Docker挂载与本机不同；file/git API 可辅助核验。不能把容器路径当 Windows 本机产物（A/B） | O 自定义工具/MCP/plugins；OV 是多Agent控制中心不应整体嵌入。三仓根 LICENSE 均 MIT（B）。OV 官方 Windows Docker quickstart；多 sandbox runtime 原生 Windows 不支持，需 WSL；CLI/SDK完整原生验收 U |
| Codex CLI | `codex exec --json`、stdin prompt、output-schema；`codex app-server` stdio JSON-RPC，源码同时支持 WebSocket；TS SDK 是可选入口（A/B） | exec resume ID/`--last`；app-server `thread/resume`、`thread/list`、`thread/read`（A） | app-server `turn/start`/`turn/interrupt` 与 notifications；exec JSON 事件可观测，CLI终止不作全副作用撤销证明。独立线程历史与当前 turn 分开（A） | CLI cwd/working directory配置，文件修改落本地workspace；app-server thread/turn事件及diff仅证据，仍核验文件与版本（A；统一产物清单 U） | skills/MCP以及插件机制见源码；不能把 MCP tool server 和完整 Agent app-server 混用。README 提供 Windows安装，源码含Windows sandbox；Apache-2.0（B，实测 U） |
| Aider | `aider --message` / `--message-file` 一次编辑退出；Python `Coder.create` + `coder.run`、`run_stream`。官方通用 REST服务/JSON-RPC stdio未核实（U，不写成确定不存在） | `--restore-chat-history` 从聊天文件恢复；不是服务侧 opaque session ID、活跃会话附着或可查询 job。脚本可持有 Coder实例（A/B） | 默认 `--stream` 为显示流；Python generator可取流；源码 KeyboardInterrupt处理。结构化生命周期/取消回执/job查询 API 未核实（U） | filename/repo/cwd共同决定写文件；默认auto/dirty commits须显式配置以吻合WEX策略；产物用git diff/文件列表核验（A/B） | 文档以代码编辑和scripting为主；不把 Python embedding叫成熟插件服务协议。支持Windows安装文档；Apache-2.0（B，实测 U） |

## 可复查的源码和官方文档

以下路径均相对上表对应仓，在固定 SHA 的 `blob/<SHA>/<path>` 可复查。A结论来自实际读取，非仅搜索结果。

- **DSH（D）**：[SDK README](https://github.com/DeepSeek-AI/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/sdk/server/README.md) 第32行恢复、第36行cwd、第56–58行prompt/wait、第140行明确无prompt-cancel；`packages/sdk/server/src/{index,server}.ts`为实现入口。 [ACP README](https://github.com/DeepSeek-AI/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/acp/acp/README.md) 第63–82行协议表与不支持项；`packages/acp/acp/src/session.ts`为prompt/cancel/close实现。headless实验提交 [startup.ts](https://github.com/DeepSeek-AI/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/headless/src/startup.ts) 第58行JSON参数；同提交 `packages/bundle/headless/src/{index,json-stream}.ts`及README。`ce7073d`源码final含reason/sessionId与发布rc.5差异由WEX记录C级佐证，不能用源码新形态解析旧发布包。
- **Hermes（H）**：[gateway CLI 语义](https://github.com/NousResearch/hermes-agent/blob/5057eaa3a4d0cbef0e30078418a5115faa62889e/website/docs/developer-guide/gateway-classic-cli.md) 第8–43行owner/detach/退出码，第49–82行cwd及flag边界；`hermes_cli/gateway_chat.py`第169行finite、第341行stream-json。 [HTTP实现](https://github.com/NousResearch/hermes-agent/blob/5057eaa3a4d0cbef0e30078418a5115faa62889e/gateway/platforms/api_server.py) 第65–71行runs GET/events/stop路由；`website/docs/user-guide/features/api-server.md`有SSE、会话、幂等与终态解释。`acp_adapter/gateway_server.py`第411行load_session、第443行cancel、第644行prompt；`website/docs/user-guide/features/acp.md`有stdio和MCP接入。`website/docs/developer-guide/plugins/index.md`说明多类扩展界面；`README.md`Windows安装及根`LICENSE`。
- **OpenHands（O）**：[conversation_router.py](https://github.com/OpenHands/software-agent-sdk/blob/c048a1eb82353b0586f3ce600708394a68ebb246/openhands-agent-server/openhands/agent_server/conversation_router.py) 第162行search、第222行get、第315行start、第369行pause、第384行interrupt、第422行run；同目录`event_router.py`第71行事件查询、第217行send_message；`session_socket.py`第315行WS。`examples/01_standalone_sdk/01_hello_world.py`第25行workspace；`README.md`第85行仓职责。**OC** [main_parser.py](https://github.com/OpenHands/OpenHands-CLI/blob/283c6ac3610f4299f405f7389f65766dcb83e12a/openhands_cli/argparsers/main_parser.py) 第81–93行headless/JSONL/自动批准；`openhands_cli/acp_impl/agent/base_agent.py`第405行cancel、第600行load_session；`README.md`第134–151行headless/resume。**OV** [Windows说明](https://github.com/OpenHands/OpenHands/blob/355ea62197722f6ffb11a55d661686b9c8b822da/README.windows.md) 第38行多sandbox Windows限制；各仓根`LICENSE`。许可证结论仅是本次文件标识与文本核对，未作法律适用结论。
- **Codex（C）**：[common.rs](https://github.com/openai/codex/blob/b0f977c3a9c2e68e46e58e589e98f5297d2c8c10/codex-rs/app-server-protocol/src/protocol/common.rs) 第561行thread/resume、第794行list、第880行read、第1104行turn/interrupt；`codex-rs/app-server/src/lib.rs`第822行stdio、第849行WebSocket；`codex-rs/exec/src/cli.rs`第54–70行schema/json、第174行resume。`docs/exec.md`指向[官方非交互文档](https://developers.openai.com/codex/noninteractive)（该外链本次未取得内容，不能借其补证）；README Windows与根`LICENSE`已读。
- **Aider（A）**：[scripting.md](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/website/docs/scripting.md)官方CLI/Python脚本示例；`aider/args.py`第290行restore、第323行stream、第639–652行message/message-file；`aider/main.py`第988行restore、第1126–1142行单次执行；`aider/coders/base_coder.py`第859行run_stream、第876行run、第889/1572行KeyboardInterrupt。`aider/website/docs/install.md`第45行Windows；根`LICENSE.txt`。

## 适配建议（研究排序，不改既定优先级）

1. **P0 DSH headless完成既有闭环**：继续严格区分已存在的真实MISSING_CREDENTIAL失败C、13项替身协议测试C，与尚未做的成功模型任务/恢复/Windows真机。优先把session、cwd、版本、turn_end、退出码、已知文件差异纳入回执。仍缺凭证时保留阻塞，不开付费任务。
2. **P1 DSH ACP是会话控制后续候选**：固定f3803c9的list/resume/cancel/close比SDK的无prompt-cancel更符合可控制任务需求；但它是automation-only ACP，`session/load`等交互功能明确不支持，应做协议协商，不能凭“ACP”标签套标准编辑器所有能力。现有headless无需因ACP而返工。
3. **P2 Codex app-server作为第二连接器契约对照**：结构化thread/turn、read/list/interrupt与TS宿主契合；仅做最小独立spike，不迫使所有Agent实现同一能力集。exec适合更小的一次性基线。
4. **P2 Hermes值得独立能力探针**：API runs的查询/SSE/stop、ACP有源码依据；有原生Windows支持声明，但QA仍待完成；但gateway owner意味着detach与cancel必须显式分开。先做只读能力/版本查询，再验证session identity、重连、cwd与pending control，不能沿用“杀CLI即停任务”的进程假设。
5. **P3 OpenHands按Agent Server/TS client评估**：工程组件与远程workspace更重；优先复用官方服务契约，避免把Agent Canvas当WEX内部客户端。需锁SDK/CLI客户端兼容版本与Docker/WSL边界。
6. **P4 Aider作为有限代码编辑executor**：适合单次任务+diff验收；在未核实服务协议前，不承诺与其他Agent同等级会话控制。Python embedding增加运行时维护成本，CLI先行更清晰。

WEX建议只提炼能力描述：submit、observe、resume、interrupt、close、query、artifact-reference分别可选；取消请求已发送/外部已确认停止/结果未知分别存证。连接器保存尝试与回执，工作流决定重试与人工验收；不因某Agent有会话或插件系统而改变WEX身份、权限或任务权威。
