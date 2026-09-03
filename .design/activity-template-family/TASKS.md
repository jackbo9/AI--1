# Build Tasks: 员工活动正式模板家族 P0

Generated from: `.design/activity-template-family/DESIGN_BRIEF.md` + `BRAND_SPEC_V1.md`  
Date: 2026-09-03

> BrandSpec v1 六项规则已锁定。P0 的目标是一份活动输入和一次文案确认，稳定生成四个可独立校验、预览与下载的 Artifact。

## P0 完成定义

- 一次提交、一次文案确认，默认生成竖版、横版、Banner、长图四项。
- 用户可以预览并单独下载任一通过校验的规格，也可以下载整组。
- 四项共享相同业务事实、确认文案、视觉母题和 `brandSpecVersion = 1`。
- 长图按内容自动增高，重要文本不裁切；固定规格标题不超过三行。
- 下载前通过 Brand Check；失败项不可下载，但不影响其他合格项。
- LLM 不生成 HTML/CSS，所有品牌几何规则均来自模板 Manifest。

## Phase A｜契约与可复现基线

- [x] **A1. 固化 BrandSpec v1 为运行时契约**：建立 `BrandTokens` 与 `BrandSpec` Schema，写入 `adminYellow: #FAE24C`、`H0: 120px`、`H1: 80px`、标题最多三行及双标识左右关系；为 `brandSpecVersion` 建立版本字段和 Fixture。_Creates: brand contract/tokens; reuses Zod conventions._
- [x] **A2. 建立四规格 TemplateFamily Manifest**：定义四个稳定 RenderTarget ID、固定尺寸或 `heightMode: auto`、各自 `safeArea`、标题级别、模块投影、焦点区、Logo/二维码区和溢出策略；安全边距从对应 SVG 测量并写入各规格。_Creates: template-family manifest; depends on A1._
- [x] **A3. 将单输出模型升级为 Campaign/Bundle**：把当前写死的 `outputFormat` 升级为一次 `CampaignBrief`、一份 `ConfirmedCampaignDocument`、一个 `VisualMaster` 和四个 `Artifact`；增加旧竖版任务读取兼容。_Modifies: `src/contracts/poster.ts`, `src/contracts/job.ts`, `src/server/job-store.ts`; depends on A2._
- [x] **A4. 准备四规格 Fixture 套件**：覆盖正常内容、三行标题边界、标题超限、缺可选模块、二维码、长正文和图片降级；每种 Fixture 声明四项预期尺寸、高度范围和 Brand Check 结果。_Creates/modifies: `tests/fixtures`; depends on A1-A3._

## Phase B｜品牌头部与模板纵向切片

- [ ] **B1. 接入正式字体与双标识资产**：引入可用于服务端渲染的 MiSans、公司 Logo 和行政标识正式文件；实现公司 Logo 左、行政标识右的共享 Brand Header，并保持比例。字体或资产未加载时渲染失败。_Modifies: `public/brand`, templates and renderer; requires formal assets._
- [ ] **B2. 完成 1080x1920 竖版正式切片**：用语义化 HTML/CSS 重建全幅背景、Brand Header、H0/H1 标题、核心信息、可选模块、CTA/二维码和页脚；用 A4 Fixtures 输出首批可评审 PNG。_Modifies: `src/templates/employee-activity.ts`; depends on A2, A4, B1._
- [ ] **B3. 完成 1920x1080 与 2227x950 投影**：共享事实与视觉母题，但按各自 Manifest 控制信息密度；Banner 只保留主题和关键时间信息，不通过整体缩字硬塞。_Creates: landscape and banner renderers; depends on B2._
- [ ] **B4. 完成 1080xAuto 长图模块系统**：按已启用模块自然排版并测量文档高度后截图；3000px 只作为设计样例，不设固定高度，不裁切正文。_Creates: auto-height longform renderer; depends on B2._

## Phase C｜LLM 与视觉母题边界

- [ ] **C1. 让视觉 Brief 基于已确认内容**：使用 `ConfirmedCampaignDocument + 脱敏事实 + ActivityStylePack` 编译一次 VisualMaster，替换当前只读取原始 `visualIntent` 的逻辑；四规格不得分别改写语义。_Modifies: `src/providers/prompt-compiler.ts`, worker and contracts; can parallel Phase B after A3._
- [ ] **C2. 实现四宽高比的受控视觉派生**：同一 `visualFamilyId` 锁定主体、动作、色板和风格；按每个 Manifest 的焦点区生成或派生背景，并记录策略、Prompt 与资产版本。失败时使用对应规格默认背景。_Modifies: illustration provider/request and worker; depends on A2, C1._
- [ ] **C3. 实现确定性图文适配**：代码从受控枚举选择明暗主题、Logo 版本、文字色和遮罩；对 Logo、标题和正文区域执行对比度检测，失败时切换受控方案或降级背景。_Creates: image-treatment contract and contrast validator; depends on B2-B4, C2._

## Phase D｜Bundle 编排、预览与下载

- [ ] **D1. 将 Worker 改为四 Artifact 扇出**：文案只确认一次、VisualMaster 只编译一次，再为四个 RenderTarget 独立渲染、校验和保存版本；单项失败不回滚其他成功项，重试保持幂等且不重复收费。_Modifies: `src/worker/run-job.ts`, store and job API; depends on A3, B2-B4, C2._
- [ ] **D2. 把结果页改为四规格预览**：显示每个 Artifact 的缩略图、尺寸/自动高度、状态与校验结果；生成前不要求用户选规格，生成后允许选择单项下载。_Modifies: `src/components/activity-studio.tsx`, styles and job response types; depends on D1._
- [ ] **D3. 实现单项与整组导出**：单项下载只放行对应已通过校验的 Artifact；整组下载打包全部合格项并记录导出版本、用户和时间。_Creates/modifies: export APIs and result UI; depends on D1-D2, E1._

## Phase E｜发布级 Brand Check

- [ ] **E1. 建立下载前品牌发布门**：校验 BrandSpec 版本、正式字体、双标识位置/比例、安全边距、`#FAE24C`、H0/H1、标题三行限制、正文溢出、二维码静区、主视觉焦点区、固定尺寸和长图完整高度；error 阻止对应 Artifact 下载。_Modifies: `src/validation`, worker states and file/export APIs; depends on A1-A4, B2-B4._
- [ ] **E2. 建立四规格视觉回归**：用正常、长标题、缺模块、二维码和长图长正文 Fixture 生成正式基线；将参考模板和渲染结果按同尺寸并排人工检查，不把路径化 SVG 直接作为运行时模板。_Creates: render baselines and review evidence; depends on B1-B4, C3, E1._
- [ ] **E3. 完成自动化与真实闭环验收**：执行 typecheck、lint、unit test、build、四规格渲染测试和一次真实 DeepSeek/Seedream 端到端任务；记录耗时、费用、降级路径和未验证项。_Modifies/creates: contract, worker and E2E tests; depends on all P0 tasks._

## Agent 执行顺序

```text
A1 -> A2 -> A3 -> A4
             |-> B1 -> B2 -> B3/B4 -> C3 -> E1/E2
             |-> C1 -> C2 -----------^
             `-> D1 -> D2 -> D3
                         E1 ---------^
全部完成 -> E3
```

每个任务单独提交或保留检查点。第一张正式竖版（B2）评审通过前，不批量精修另外三个规格。

## 与表单同事的接口

- P0 渲染链只依赖经过 Schema 校验的 `CampaignBrief` 和 `ConfirmedCampaignDocument`，不依赖表单具体控件。
- 表单同事交付“用户事实 / 用户可选偏好 / AI 派生内容”字段矩阵，以及必填、可选、不可改写和 AI 可编辑标记。
- 字段矩阵完成前，A4 使用当前字段构造 Fixture，不阻塞 BrandSpec、Manifest 和模板切片。
- AI 文案只返回一份结构化内容，不返回四套独立文案或任意 HTML；各 RenderTarget 由代码确定性投影。

## P0 外部依赖

- 行政标识正式源文件及允许使用的颜色/反白版本。
- MiSans 服务端渲染字体文件及授权确认。

缺少这些资产时可完成 A、C、D 的契约和编排，并可用明确标记的非发布占位 Fixture 验证；不得建立正式视觉基线或声称通过品牌验收。

## P0 明确不做

- 不扩员工福利、通知和问卷一级场景。
- 不建设 RAG、模板市场、自由画布或任意 CSS 编辑。
- 不让用户在生成前逐项选规格；默认生成四项，生成后选择下载。
- 不同时迁移 PostgreSQL/Redis，除非四 Artifact 幂等无法在现有存储中安全验证。
