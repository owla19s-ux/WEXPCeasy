# Pi AI 测试与证据报告

日期：2026-11-01。实验成功运行，**整体替换兼容性验收不通过**。所有结果仅适用于锁定发布包、Linux和所列模拟输入。

## 环境、版本与基线

| 项 | 实际值 |
|---|---|
| WEXPCeasy 初始HEAD | 609e4142b319fec8800c8aea89bc7aa4ca447d16，工作区干净 |
| 执行中远端变化 | main前进至819bcf6f3916e203850946a5ec91246c3da8f127，新增711304d/819bcf6历史索引；已读并fast-forward，保留原文并关联本实验，无覆盖 |
| WEX | c7dcf0a9833f66d8c93b5356c2dbfe1bfd882c19；GitHub连接器读取完整API规范、Android实现/测试 |
| WEXPC | faf11f31d44e4fc4788e766074b8db6b83ab4a1b；实际克隆，未修改 |
| APS | 024ca95d542ed7e74e1d7bf726376f36e1d7613d；实际找到原始Kotlin实现与测试，未运行Android测试 |
| Pi官方main取样 | c09c98d7d2caf659b4bbe1e2427adb1bdac4b114；与npm同版本内容不同，详见兼容矩阵 |
| 实装发布版 | @earendil-works/pi-ai 1.4.0；typebox 1.3.27；有独立package-lock |
| 执行环境 | Linux x64，Node v24.22.1，npm 11.9.0；无rustc/cargo |
| 费用 | 无真实Provider请求，无真实API Key、外部账号或付费模型；所有Key均fake-local-only测试值 |
| CI | 起始读取WEXPCeasy /actions/runs：total_count=0；旧wexpc仅查询既有运行与原日志；未触发新Actions |

完整发布包指纹见[manifest](../../../experiments/pi-ai-compat/evidence/package-manifest.json)。实验默认frame 64KiB、response 1MiB、local event 4096；与旧Rust默认1MiB/16MiB/每push1024事件/continuation256KiB不同，**实验值不构成产品配置变更**。

## 可复现命令及真实结果

```bash
cd experiments/pi-ai-compat
npm ci --ignore-scripts
npm test
# 分别复现
node --test native.test.mjs
node --test adapter.test.mjs
node --test protocols.test.mjs
```

- 本轮最终实验：**37 tests / 37 pass / 0 fail / 0 cancelled / 0 skipped / 0 todo**，exit 0；[原始输出](../../../experiments/pi-ai-compat/evidence/tests.txt)。这里的pass包含“确认已知不兼容行为仍存在”的观察断言，不等于34项产品能力验收通过。
- 原生行为10项、隔离适配与缺口回归22项、其他协议5项。没有使用第二套测试框架。
- 仓库根：`npm ci --ignore-scripts`、`npm test`，**50/50通过**，boundary errors=[]；根源码/依赖未改。[根验证摘要](../../../experiments/pi-ai-compat/evidence/root-validation.txt)。
- 旧Rust本轮：`rustc -V` / `cargo -V` exit127，**未运行**。未尝试以Actions收费运行代替本地。
- 历史Rust证据：本轮读取既有run40527701505/job122271653337完整日志，SHA c1ff8d9e83c920fb3a531926e5dc6aa47039f805，Ubuntu24.04.5；其中 **decoder30/30、encode17/17、desktop api21/21**。可追溯[日志节选](../../../experiments/pi-ai-compat/evidence/historical-rust.txt)。当前文件数量与历史这三组相同不证明字节相同或当前HEAD已重跑。

## 测试中实际遇到的失败与处理

1. 首次原生测试用官方main新导出createFauxProvider，发布包不导出，启动失败；实装包使用fauxProvider，修正测试到真正发布API。没有改SDK或把接口猜测当证据。
2. 适配器先用无守卫占位实现运行16组：**0通过/16失败**，断言确认缺少防护；随后实现。记录见[RED摘要](../../../experiments/pi-ai-compat/evidence/red-green.txt)。
3. 第一轮适配后15/16通过；DEC-09实际是OpenAI SDK在Pi observer之前拦截SSE error，导致外层Protocol而非Provider。源码追溯node_modules/openai/core/streaming.mjs，改为有限字节/帧层先识别内嵌error并固定分类，16/16通过。不是删断言。
4. 额外两个负向回归先失败：transport抛错会泄露原错误字符串；model.samplingParams可以绕请求参数白名单。分别加静态错误白名单和模型默认参数入口检查后通过。未知错误统一NetworkUnknown，不输出厂商原文。
5. 独立审查复现两处Important：model.headers可以覆盖受控Key、compat.supportsFinishReason=false可以把缺终态变成功。均先加失败测试，再前置拒绝危险模型配置，并独立检查raw终态。审查还发现回调可修改克隆快照：按外发目标风险提升为必须修复，深冻结后由三个REVIEW回归验证。3项均RED→GREEN；依赖数量更正为10，移除未实际注册Models的无效构造断言，明确普通生成证据是stream.result()，不是调用Models.complete。
6. 未修复为通过的兼容问题：DONE后帧、原生图片降级、原生多choice/重复终态、原生参数忽略等，均保留可执行样本。部分由适配器阻断，DONE后帧仍保留KNOWN GAP。

## DEC-01～16 迁移与执行记录

所有ID都有实际构造输入和断言；PASS表示所列范围，不表示整组所有真实环境前提已满足。PARTIAL逐项写明未执行部分，不能升级为全组通过。

| ID | 旧测试/语义对应 | 实际输入、断言与执行结果 | 结论/未覆盖原因 |
|---|---|---|---|
| DEC-01 | decoder utf8_split/crlf_and_multiline/comments | 中文🌟逐字节、CRLF、多行data与注释；最终字串完全相同且stop | PASS，Chat模拟解析；非其他Provider全覆盖 |
| DEC-02 | eof_without_terminal、missing terminal api | 空EOF、仅DONE、部分文本后EOF；原生error，不能成功 | PASS；compat.supportsFinishReason=false不允许用来绕过WEX要求 |
| DEC-03 | truncated_finish_reason/duplicate_terminal/conflicting_terminal | length原生done(length)、filter error；重复stop/冲突length适配拒绝 | PARTIAL：DONE后帧SDK忽略，candidate仍completed，严格旧语义GAP |
| DEC-04 | tool_fragments/incomplete/duplicate IDs | 跨块{"p":+"x"}成功；不完整/[]/null/空函数名/重复ID/跳号分别失败；Schema错误不进入工具入口 | PASS，模拟已列样本；完整参数验证不等于执行授权 |
| DEC-05 | duplicate_primary_choice/unexpected_role/content_after_terminal | 一帧两个index0、user角色、finish后content；原生部分接受，adapter拒绝 | PARTIAL：无原生事件序号时无法证明所有重放/乱序检测；DONE后同DEC03缺口 |
| DEC-06 | response/frame/events limits | frame100字节、response100字节、local event1逐项越界；分别FrameLimit/ResponseLimit/EventLimit | PARTIAL：只证明自身有界缓冲与中止；SDK FIFO无容量参数，生产者满队列背压/join未验 |
| DEC-07 | continuation_exactly_at_limit/size_bounded | JSON含中文🌟，按UTF8字节恰好上限允许、少1拒绝；payload不截断 | PASS，隔离受信内部封装；未接持久化或秘密后端 |
| DEC-08 | continuation_scope_mismatch/tool_ids_mismatch | 换connection/revision/keyRef/endpoint/conversation/generation/request/model/tool集合逐一拒绝；same-model换endpoint原生保留thinking样本 | PARTIAL：封装比较已测，未接真实conversations恢复/撤权；不是抗篡改签名或正式续传安全存储 |
| DEC-09 | error_for_status/provider body；api redaction | 200 SSE error、401/403/429/500含fake敏感文；稳定分类，不回显Key/body，每次请求计数=1 | PASS，注入HTTP模拟；TLS/真实厂商错误未验 |
| DEC-10 | channel full cancel / cancel while no block | 本机HTTP发partial后永不发块；Abort30ms，<1秒返回Cancelled；已取消前置拒绝；local event限额会abort | PARTIAL：未构造有界SDK生产者channel满时join（SDK无此抽象）；不是远端停计费证明 |
| DEC-11 | connect/idle/total | fetch永不返回→ConnectTimeout；headers已到但body停顿→IdleTimeout；总deadline→TotalTimeout | PARTIAL：所谓connect为注入HTTP头等待，非真实TCP/DNS连接测量；OS connect/代理网络未执行 |
| DEC-12 | proxy userinfo/redirect | credential URL前置拒绝；307实际指向第二本机server，第二server请求=0；显式proxy返回UnsupportedProxy而非直连 | PARTIAL：代理功能本批拒绝，未执行代理认证/不可用真实代理/跨主机TLS；不伪称已实现代理 |
| DEC-13 | progress_is_provisional/missing terminal | partial正文后EOF；completed=false/Protocol，保留text_delta | PASS；无持久Conversation写入，不伪称已接恢复 |
| DEC-14 | Core cancellation/inflight writes | 替身Operation state=unknown；生成取消返回Cancelled且不改该事实 | PARTIAL：API无Core写接口，仅验证不混同边界；真实在途写、回执并发、回滚未运行 |
| DEC-15 | overlap tool intents/application admission | 两请求对同path发write意图；均返回toolCall，executeTool次数=0 | PARTIAL：只验API不执行；真实permissions/runtime资源占用与竞争写入未运行，不能由此宣布Dispatcher通过 |
| DEC-16 | request reserved/unknown field validation | 未知option、samplingParams.model、字符串top_p、未知工具顶层字段、工具path类型错误拒绝；model默认覆盖负例亦拒绝 | PARTIAL：有限白名单与Schema路径；全Provider参数类型范围/嵌套映射/声明文件验证未执行 |

## 特别回归与模块边界

- 图片：原生text-only把图片换成文本；适配器对user和toolResult图片拒绝，permissions/credential/attempt调用数均为0；vision模型data URL编码通过。没有测试真实图像理解。
- 非工具模型：无tools模型在自定义endpoint实际生成成功，不按tools能力筛除。
- 参数：未知选项、保留字段覆盖、错误类型必须失败；已测temperature=0/top_p/Anthropic预算/DeepSeek启用。未支持参数不能呈现“已生效”；全模型能力表尚缺。
- 续传：DeepSeek模拟工具回合后的reasoning_content保留；跨model去除thinking，同model跨endpoint不自动去除，故WEX请求绑定不可省。
- 定稿：EOF和length不当正常成功；DONE后恶意帧严格拒绝仍未满足。
- 工具：没有任何真正工具执行、AI Loop或权限引擎；结构化意图返回给调用者，实际执行必须另走WEX。
- Provider切换：替身permissions收到实际model/endpoint/content；新目标拒绝后不取Key、不建attempt、不外发。
- 调用顺序替身：permission→credential→attempt→Pi→receipt；attempt保存失败零发送；receipt失败返回Observed结果，不自动重试。Operation/Attempt/Receipt仍由宿主回调维护，不在adapter建立第二账本。
- 真实shared/credentials尚无平台实现，本批没有偷偷提供“能用”的明文产品凭证库。AI角色/Conversation/Task均不被SDK对象接管。

## 明确未执行与失败样本处理建议

真实DeepSeek/OpenAI/Anthropic/Gemini、付费模型、Provider实际目录、真实图片/音视频输出、Windows/Electron包、OS凭证/代理/TLS、真实调度资源冲突、SQLite账本、断电恢复与SDK满队列join均NOT_RUN。原因分别为需凭证/费用或真实平台、本批边界限制、尚无正式实现；不是跳过测试就当支持。

停止本批“整体替换”方向并非停止SDK复用：按[决策](API-IMPLEMENTATION-DECISION.md)保留旧严格Chat路径与向量，只有准备进入对应Provider施工时才关闭其必需门槛，避免无限研究所有厂商。
