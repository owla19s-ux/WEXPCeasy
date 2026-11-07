# WEXPCeasy｜A0/A1/A2 入口及模块引用第三轮收口记录（2026-11-07）

> 性质：文档治理的阶段性实际提交记录；不是全仓最新递归文件树审计、源码验收或 Windows 实机验证。

## 已完成并提交

| 范围 | 处理 | 提交 |
| --- | --- | --- |
| `docs/PROJECT.md` | 项目概要统一指向 A0/A1/A2，补 environments 独立 owner，旧路径降为兼容资料 | `51129f63` |
| `docs/README.md` | 216 反向覆盖、条款追踪、契约语义、批次历史与外部研究索引优先指向正式 A0/A2 归档正文 | `dbcc778b` |
| `README.md` | 按需资料的产品功能表与版本状态表改指 A1/A2，避免重复旧入口 | `a70acfff` |
| `space/README.md` | 正式功能、版本状态、历史契约与核验材料引用改指对应 A0/A1/A2 | `b3dc6c2e` |
| `connections/README.md` | 版本状态与历史连接契约引用改指 A2/A0 | `ceafefc1` |
| `AI/README.md` | 历史 AI 契约链接改指 A0 | `85e2fc43` |
| `conversations/README.md` | 历史会话契约链接改指 A0 | `ba43778d` |

修改仅限文档。上述历史归档目标中的部分重要路径已按远端文件读取确认存在；**未做全部相对链接/锚点自动化测试**。

## 第一阶段残余检查分类

1. `docs/` 根目录的 `README.md`、`PROJECT.md`、`维加项目总体说明.md`、`DOCUMENT-AUTHORITY-AND-MAINTENANCE-2026-11-02.md`、`MODULE-CONTRACTS.md`：前四者中已有明确现行导航/产品/治理权威分工；`MODULE-CONTRACTS.md` 仍是历史第四批研究索引，**不应升级成现行接口规范**，后续可转纯历史入口但需先清查反向引用。
2. `docs/audits/document-governance-2026-11-04/`：保留当时原始 inventory、links、duplicates、verify 脚本及证据组，不能将其作为最新 HEAD 的验证结果。未经完整反向引用与校验不拆组删除。
3. `docs/audits/document-governance-2026-11-07/`：原回执与第三轮记录保留过程证据；版本核验正文优先指向 A2 中的证据文件。旧路径临时兼容。
4. `docs/product/`、`docs/versions/`、`docs/research/`、`docs/batch6-8/`、`references/` 中尚存旧路径：目前仍有源码目录 README/CONTRACT 或历史文档引用，不得提前批量删除。历史运行日志、第三方源码样本及许可证原位保留。
5. 是否仍存在**未归 A0/A1/A2 的独立正文**，须在获得最新 main 完整递归文件树和正文对照后才能判定；不能仅凭关键词搜索或既有 323 文件旧库存宣告清零。

## 第二阶段推进边界

已开始修正 Space、Connections、AI、Conversations 四个模块 README 的直接引用。下一轮逐一检查其余源码域 README、CONTRACT、依赖与文档反向引用；保留真实接口/实现现状，禁止用文本替换推导产品变更。

## 最后统一删除的门槛

同时满足：新权威正文存在、旧页没有独立事实或原始证据、最新主分支全量反向引用归零、相对链接/标题锚点/大小写验证通过、移动后历史来源仍可追溯。未满足则保留兼容页。

## 验证缺口（不得标完成）

未运行 `node tools/check-docs.mjs --json --strict`、`node --test tools/check-docs.test.mjs`、`python docs/audits/document-governance-2026-11-04/verify.py --output ...`；当前环境不能直接取得可执行的完整仓库工作树。未进行最新 HEAD 的全量路径/反向引用枚举和 Windows/CI 验收。

## 2026-11-07 续批：第二阶段模块文档直接引用迁移

在前次四个业务模块入口基础上，续批已修改下列就近文档：

- `app/README.md`、`app/CONTRACT.md`：历史契约与版本状态指向 A0/A2。
- `UI/README.md`、`UI/CONTRACT.md`：基础 UI 设计与功能映射的正式正文指向 A1。
- `shared/README.md`、`shared/CONTRACT.md`：归档契约指向 A0。
- `permissions/README.md`、`permissions/CONTRACT.md`：历史契约与正式权限政策区分为 A0/A1，版本状态指向 A2。
- `connections/api/README.md`、`connections/api/CONTRACT.md`：API/连接器历史契约、研究索引指向 A0。
- `connections/github/README.md`、`connections/local/README.md`、`connections/local/CONTRACT.md`、`connections/dsh/README.md`：相应历史契约及研究引用指向 A0。
- `AI/roles/README.md`：AI 归档契约与研究报告指向 A0。
- `workflows/README.md`、`workflows/CONTRACT.md`：历史契约指向 A0、版本总表指向 A2。
- `environments/README.md`：产品功能总表及版本状态入口指向 A1/A2。
- `views/CONTRACT.md`、`plugins/CONTRACT.md`：产品功能与模块映射指向 A1、历史跨模块契约指向 A0。
- `dsh/README.md`：版本状态入口指向 A2。
- `UI/conversation/README.md`、`UI/settings/README.md`：归档契约与研究索引指向 A0。

本批采用原文件 SHA 的 GitHub Contents 更新，不改产品源码、配置、依赖清单或测试。这里的“引用迁移”**不构成逐个模块的契约语义复验完成**。其中 `app`、`UI`、`views`、`plugins` 仍有旧 `docs/architecture/`、`docs/audits/`、`docs/batch6/`、`docs/planning/` 等追溯链接：需要按各目标文件是否具备独立历史证据决定是否继续迁移，不能仅按路径前缀批量删除。未找到或未读取到的 CONTRACT 不擅自新建。

### 尚待完成与删除条件

- 最新 HEAD 的完整树枚举、全量 Markdown 解析、相对路径及锚点检查、反向引用零残留检查，**均未执行**。
- `docs/audits/document-governance-2026-11-04/` 原始 JSON/脚本与批次证据保持原位。
- 模块 README/CONTRACT 的内容及代码事实深度对齐、依赖有效性与 CI/Windows 验收仍需独立证据；本次仅确认并修改明确的资料定位关系。
- 禁止在完成全量引用与证据审查前统一删除旧兼容文件。
