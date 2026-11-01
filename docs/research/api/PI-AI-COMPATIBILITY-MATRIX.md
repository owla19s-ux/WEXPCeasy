# Pi AI 逐项兼容性矩阵

结论：**不通过“无行为退化的整体替换”验收。推荐 C：复用 Pi 的部分 Provider/消息编码能力，保留旧严格协议约束及测试；正式采用仍有门槛。** 本批只提供实验，不将 SDK 注册、auth 或上下文对象升级为 WEX 权威。

## 固定版本、许可证、依赖与源码依据

本轮实装 npm `@earendil-works/pi-ai@1.4.0`，MIT，Node `>=22.19.0`；当前工程要求 Node `>=24.9.0`，实验实际 Node `v24.22.1` / Linux x64。Node门槛符合，但 **Windows/Electron 打包、ESM/CJS边界、代理、证书、Windows凭证均未验收**。MIT允许复用，分发仍需带许可证及各传递依赖声明，不等于已做完整供应链安全审计。

实际包依赖固定：Anthropic SDK 0.129.0、OpenAI 7.19.0、Google genai 2.21.0、AWS Bedrock runtime 3.1127.0、smithy node-http-handler 4.12.1、http/https-proxy-agent 9.1.0、partial-json 0.1.7、typebox 1.3.27、pi-telemetry 1.4.0。实验还直接固定 typebox 1.3.27 做严格校验。依赖隔离在实验 package/lock，不进根产品依赖。

官方仓库取样：[earendil-works/pi](https://github.com/earendil-works/pi/tree/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai)，主线 SHA `c09c98d7d2caf659b4bbe1e2427adb1bdac4b114`。**仓库main与同版本npm包已经不同**：main导出 `createFauxProvider`、使用 pi-schema，而实际包导出 `fauxProvider`、依赖 typebox。第一次探针因错用main导出失败，已按实装包修正；不是SDK功能缺失。npm metadata没有提供gitHead，不虚构发布提交。以下运行结论以锁定发布包为准；官方main仅作交叉源码参考。

[发布包](https://www.npmjs.com/package/@earendil-works/pi-ai/v/1.4.0)的完整性、文件SHA256、实际依赖见 [package-manifest.json](../../../experiments/pi-ai-compat/evidence/package-manifest.json)，重现后检查 `node_modules/@earendil-works/pi-ai/dist/`。本地发布产物为本轮最精确源码定位，不能用main链接冒充逐字相同的发布源码。

| 来源码 | 实装发布包路径（dist/下） | 官方源码对应入口 |
|---|---|---|
| S01 | models.js / models.d.ts / types.d.ts / providers/faux.js | [models.ts](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/models.ts)、[faux.ts](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/providers/faux.ts) |
| S02 | api/openai-completions.js：stream/buildParams/convertMessages/mapStopReason | [Chat实现](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/api/openai-completions.ts) |
| S03 | api/openai-responses.js / openai-responses-shared.js | [Responses](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/api/openai-responses.ts) |
| S04 | api/anthropic-messages.js / google-generative-ai.js / google-shared.js | [Anthropic](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/api/anthropic-messages.ts)、[Google](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/api/google-generative-ai.ts) |
| S05 | api/transform-messages.js / utils/transcript.js | [转换](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/api/transform-messages.ts) |
| S06 | utils/event-stream.js / json-parse.js / validation.js | [事件FIFO](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/utils/event-stream.ts)、[工具校验](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/utils/validation.ts) |
| S07 | utils/provider-retry.js / node-http-proxy.js / env-api-keys.js | [重试](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/utils/provider-retry.ts)、[代理](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/utils/node-http-proxy.ts) |
| S08 | auth/context.js / auth/credential-store.js / auth/types.d.ts | [凭证接口](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/auth/types.ts) |
| S09 | providers/model-schema.js / compat-schema.js / providers/*.js | [模型Schema](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/providers/model-schema.ts)、[兼容Schema](https://github.com/earendil-works/pi/blob/c09c98d7d2caf659b4bbe1e2427adb1bdac4b114/packages/ai/src/providers/compat-schema.ts) |

## 能力、实测与复用判定

“直接复用”仅指该协议子能力；“薄适配”只指已证明的小范围守卫，不能覆盖全Provider；“存在缺口”不以绿色观察测试掩盖。

| 历史/当前要求 | Pi实际能力及依据 | 本轮实测/局限 | 判定与必要动作 |
|---|---|---|---|
| A-007～010 多Provider | S01/02/03/04/09；Chat/Responses/Anthropic/Google/Bedrock等独立实现 | Faux、Chat本地HTTP、Responses/Anthropic注入流、DeepSeek模拟；真实Provider未调用 | 部分直接复用；不是全厂商兼容证书 |
| 自定义Provider与多模型 | S01 createProvider/getModels，支持静态模型和fetchModels动态overlay | native.test多个模型注册、手动text模型可用 | 直接复用底层注册；安全Descriptor导入存在缺口 |
| 独立Connection | S08 credential store默认按Provider.id一条；S01 Provider/model对象 | 本轮深冻结独立模型快照，回调修改被拒绝；未接WEX真实凭证后端 | 薄适配：WEX按Connection创建请求配置与Key引用；不采用Pi auth store为权威 |
| A-004 在线目录与手填 | S01 fetchModels/Model结构，S09内置目录 | 手动model与多个模型可用；在线目录无账号未测 | 手动直接复用；动态目录无法验证，每Connection保存来源与时间 |
| 非工具模型不能被排除 | S01 Model无强制工具执行条件 | 无tools文本模型本地HTTP成功 | 直接复用；不能把“支持tools”设为目录准入门槛 |
| A-009 Base URL/兼容协议 | S02 model.baseUrl；S09 compat字段 | /custom/v1/chat/completions保留代理路径；仅一个兼容族 | 薄适配端点校验；不能按名称猜兼容 |
| A-005 原生/统一参数 | S02/04有不同Options，samplingParams和onPayload可改payload | temperature=0/top_p透传；Anthropic预算1024；DeepSeek thinking启用 | 对已核参数直接复用编码；其余须能力表与生效检测 |
| A-005-P2 不支持参数不伪称生效 | 未知JS option被忽略，部分选项按provider条件忽略（S02/04） | native未知字段未发送；adapter只测试有限白名单拒绝 | 薄适配小范围；全模型参数能力/类型/范围/模式仍存在缺口 |
| A-005-P3 保留字段冲突 | samplingParams在命名字段后Object.assign；onPayload可替换任意body（S02） | native实际model被覆盖；adapter限制请求参数及模型默认键 | 保留旧encode约束；不对不可信配置开放onPayload/headers；本批model.headers非空直接拒绝 |
| 参数继承与显式省略 | S02模型samplingParams可与选项合并 | 四层WEX优先级未批准，本轮不定义 | 保留WEX候选；不能采用SDK覆盖顺序代替产品决策 |
| R1 推理等级/预算 | S02 reasoningEffort/compat、S04 thinking budget、S09 level map | DeepSeek启用、Anthropic预算模拟通过；等级钳制/所有模型未测 | 部分直接复用，等级/预算不等价；WEX呈现真实能力 |
| R2 签名与续传 | S02 reasoning_content、S03 encrypted reasoning、S04 thought signature | DeepSeek带工具后续payload保留reasoning；跨模型转换去掉thinking | 部分直接复用消息编码；加WEX身份封装 |
| DEC-07/08 Continuation作用域 | S05主要比较provider/api/model，不比较Connection/request | 换endpoint但同ID仍保留thinking已复现；本轮封装逐字段拒串用与大小边界 | 保留旧实现约束并补request/revision/endpoint/key引用；持久化/撤销未验 |
| A-005-M2 不支持图片不得忽略 | S05明确downgradeUnsupportedImages，替换成image omitted文本 | 用户图被静默降级探针通过；adapter对用户/工具图前置拒绝 | 原生不兼容；薄适配必须先拒绝再取Key/派发 |
| 声明支持的图片输入 | S02 image_url/data URL；S04各自图像格式 | 图片payload编码模拟通过；不是图像理解实测 | 可复用已核编码；文件大小/MIME/上传/真实模型待验 |
| 音频/视频/文件 | S09聊天input模态枚举仅text/image，types.d.ts无通用音视频内容路径 | 本轮未执行音频/视频/上传 | 存在缺口；不能由文字/图片成功推断多模态全支持 |
| 多模态输出 | 独立images类型/ProviderImages能力，不等于聊天消息音视频输出（S01/types） | 未运行图片生成、音频或视频生成 | 无法验证；独立连接能力后续研究，不扩大本批 |
| 普通与流式生成 | S01 Models.complete = stream.result；S02固定stream:true | 流式与收集结果、Faux两次请求通过；没有测试stream:false原生HTTP | 收集式生成可复用；旧非流式HTTP能力应保留 |
| DEC-01 字节/SSE | S02委托OpenAI SDK SSE解析 | 每字节UTF8/CRLF/多行data/注释通过 | 已测族可复用，不外推所有Provider |
| DEC-02 有效finish_reason | S02默认要求，compat.supportsFinishReason可禁用 | EOF/DONE单独、部分EOF均error | 默认可复用；实验前置拒绝宽松配置并独立要求raw终态 |
| DEC-03 唯一终态/截断 | S02允许length以done(length)返回，后续终态可覆盖 | length/filter/重复/冲突样本，adapter拒绝；DONE之后仍见下项 | 保留严格终态规则；薄适配仅覆盖已测raw-event路径 |
| DONE后数据 | OpenAI SDK在DONE后忽略余帧，S02拿不到该raw-event | native与candidate都完成；KNOWN GAP测试明确确认不兼容 | 存在缺口；须transport级完整终态校验或保留Rust解码，不能宣布替换通过 |
| DEC-04 工具JSON完整性 | S02/S06有argumentsError，仍能得到toolUse/toolcall_end | 不完整JSON仍返回工具块；adapter对error/非对象/重复ID/空名拒绝 | 薄适配最终校验；增量不能向执行入口发布 |
| 工具Schema | S06提供工具校验辅助，部分有coercion能力 | 实验用typebox Value.Check严格检查字符串/必填，不进行数值转字符串 | 留WEX严格校验；不能依SDK解析结果直接执行 |
| DEC-05 重复/多choice/角色/终态后内容 | S02取choices[0]，不等于旧严格拒绝 | 原生忽略第二主choice，接受finish后内容；adapter观察回调拒绝 | 保留旧规则；缺sequence的协议不能承诺识别所有重放 |
| DEC-06 内存/帧/响应/事件 | S06 FIFO无容量参数；SDK累积message/JSON | adapter有raw frame/总bytes/本地事件上限，分别越界拒绝 | 保留旧有界语义；未证明生产者背压或完整队列join，存在缺口 |
| Token/cache/usage/cost | S02 usage，S01 calculateCost，模型目录定价 | 未返回usage时SDK填0；adapter另保留原始usage或null、估价标签 | 薄适配；未知不写0账单，目录价格不是真实收费 |
| DEC-09 厂商错误/脱敏 | S02 errorMessage可含厂商body；SDK在observer前抛内嵌error | HTTP 200 error及401/403/429/500模拟通过，外层静态错误，不重试 | 薄适配错误分类/受限证据；SDK原错误不入聊天/普通回执 |
| DEC-10 取消/迟到 | signal在S02传SDK；S06无满队列join契约 | 本地HTTP永不再发块时取消<1秒；已取消零请求；完整队列join未运行 | 局部可复用，结果未知与远端取消另记 |
| DEC-11 三种超时 | timeoutMs依SDK；S02 HTTP没有统一三类分类 | header/connect等待、idle、total注入分别触发；本地TCP握手/OS DNS未验 | 薄适配小范围；header等待不冒充真实connect超时验收 |
| 自动重试/未知结果 | S07当前Chat retry helper默认0；不同Provider行为分别核查 | 显式maxRetries:0，4种HTTP错误each仅发1次 | 保留WEX attempt策略；不采用SDK自动重试管理业务 |
| DEC-12 认证/代理/重定向 | S07支持Node代理工具/env；并非WEX每Connection安全策略 | 无凭证URL、实际307不跟随；显式代理实验直接拒绝，未试真实代理 | 端点/重定向薄适配；代理存在缺口，无静默直连 |
| Google transport | S04 Google明确不支持自定义fetch | 本轮精确错误“Custom fetch is not supported” | 存在缺口；Chat守卫不能通用于Google，不能因此放弃守卫 |
| Provider切换/上下文转换 | S05转换工具ID、跨模型去thinking等，无WEX来源判权 | 同model换endpoint仍留thinking；替身拒新目标，零取Key | 转换代码可复用，先独立授权实际外发目标/内容 |
| 版本兼容与更新 | S09 compat开关；model/adapter版本会变 | 同1.4.0 main与npm已有接口漂移 | 固定锁与指纹；升级重跑全部向量；不改在途快照 |
| Operation/Attempt/Receipt | SDK不拥有WEX账本 | 替身顺序permission→credential→attempt→Pi→receipt；attempt失败零派发；receipt失败保留observed | 仅验证边界；实际账本仍connections，需正式模块后续验收 |
| DEC-14/15 工具写入/并发占用 | Pi AI无WEX权限/资源锁职责 | 返回两个重叠意图，零executeTool；取消不改替身未知事实 | 边界可保留；真实Core/文件锁/在途写入验收未运行 |

## 不可以复用的“上层便利”

- 不将 Models/credential-store、OAuth/sessionId/cache affinity、自动重试策略当 WEX Connection/身份/授权/账本。
- 不使用 Agent Loop、DSH Session、Cordis；没有为本批引入这些系统。
- `sealContinuation/openContinuation` 仅为受信内部替身，plain对象不是签名、秘密保管或反篡改存储；正式受控存储仍归原owner。
- adapter仅Chat实验，默认上限为实验值而非更改旧Rust或产品限额；不负责Windows系统凭证、真实DLP、runtime资源占用或独立验收。
