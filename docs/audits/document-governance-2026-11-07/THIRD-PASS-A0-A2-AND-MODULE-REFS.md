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
