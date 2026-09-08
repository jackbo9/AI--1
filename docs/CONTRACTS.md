# 领域、API 与生成契约

2026-09-08 T01 主视觉方案补充：`GenerationJob.visualOptions` 是追加式方案列表；每项必须保存图片、确认生成描述、来源文案版本与完整来源 `PosterDocument`、Prompt／Brief、图片 Provider、模型及可选 `T01ReadabilityReport`。新方案在图片生成后计算并保存与最终渲染一致的标题黑／白文字和 Logo 版本；缺少报告的历史方案在首次预览时补算。`selectedVisualOptionId` 表示当前选择，刷新后保持；`confirmedVisualOptionId` 只在用户明确确认并完成排版后写入。`confirm-visual` 现在只确认描述并新增图片方案，完成后返回视觉阶段，不自动排版。`POST visual-options/select` 只切换选择；预览接口根据任务所有权读取选中图片，将其内嵌进同一 T01 模板与该方案来源文案、可读性处理形成实时完整海报，不写输出文件、不创建版本。`POST visual-options/confirm` 才开始使用选中图片排版。生成失败不得删除已有方案，同一幂等键不得重复调用图片模型。
2026-09-08 体育赛事 Prompt 补充：T01 基础描述必须根据已确认标题／规则识别赛事类型，并提供 1–3 个核心器材符号、自动主色、真实体育摄影语言和统一母版构图。默认禁止人物、人体、手脚、面部、合影与团建摆拍；最终图片 Prompt 必须再次追加该禁止项，不能只依赖可编辑描述。固定构图为 `LEFT TOP = TITLE SAFE AREA`、`CENTER-RIGHT = MAIN VISUAL`（X 68%–78%、Y 48%–58%）和 `SURROUNDING AREA = EXTENDABLE BACKGROUND`。前端流程编号固定为 1 文案、2 主视觉、3 查看与下载。
2026-09-08 T01 视觉描述补充：确认文案后必须立即创建非空 `VisualDraft`，其 `sourceCopyCreatedAt` 等于当前文案版本；描述至少包含主体、风格、色彩和 T01 顶部品牌／标题安全区。用户可直接编辑或调用 `refine-visual` 基于当前文本优化，优化失败不得丢失已编辑文字。`confirm-visual` 当前语义为“确认视觉描述并开始生成”，保存的 `ConfirmedVisual` 同时记录来源草稿与来源文案版本；它不代表用户已经确认生成出的主视觉。文案版本变化或重新进入视觉编辑时必须清除旧的确认状态。第三轮的多方案与主视觉选择契约尚未实现。
2026-09-07 T01 可读性补充：竖版活动时间／地点、参与对象和参与方式构成一个统一文字色视觉组。每个区域仍保留独立像素测量和校验结果，但渲染选择必须为组内全部区域应用同一种深色或浅色文字；严格模式要求所选颜色逐区域通过，试用模式允许保留警告但不得在组内混用黑白。2026-09-07 图片 Provider 补充：确认后的 Illustration Prompt 是供应商无关的不可变输入；切换 `seedream` 与 `openai-images` 只允许映射端点、鉴权、尺寸、响应格式和供应商专属参数，不得重新编写或截断 Prompt。生成版本继续记录实际 Provider、模型和 Prompt 版本。2026-09-07 文案容量补充：T01 竖版的提交主题最多 40 个字，实际排版最多三行；Web 在填写时显示限制，`POST /api/jobs` 在任何模型调用前拒绝超限标题。标题不由 AI 缩写、删字或改写，CSS 自然换行，预检按加载 MiSans 后的 Range 行盒实测。`subtitle` 是实际排入 T01 的副标题，确认时最多 40 字、最多两行；`summary` 保持最多 150 字的补充信息，不能再被隐式复制到 `subtitle`，副标题为空时不输出空槽位。Copy Prompt 必须要求一句、不换行的短副标题，服务端对模型输出再次校验。视觉确认补充：IllustrationBrief 可记录 `confirmedDescription`（最多420字）及 `visualStyleMode`（editorial/legacy）。存在确认正文时，图片 Provider 以该正文组装请求，旧 subject/action/setting/palette 不再覆盖它；系统附加构图及禁止项仍生效。优化草稿需展示颜色，超过确认长度返回明确错误，不静默丢弃字段。新增字段可选，旧版本仍可读取。

本文定义 MVP 的稳定边界。实现可以调整，但不得绕开这些契约让 LLM 自由控制版式或业务状态。

## 1. 核心实体

### Scenario

定义业务场景及内容字段，如员工活动、通知、福利。

关键字段：

- `id`、`version`、`name`
- `requiredFields`、`optionalFields`
- `immutableFields`
- `aiEditableFields`
- `supportedLocales`
- `supportedChannels`
- `allowedTemplateIds`

### Template

定义确定性版式和插槽。

关键字段：

- `id`、`version`、`sceneIds`
- `width`、`heightMode`、`minHeight`、`maxHeight`
- `slots`：文字、图片、Logo、二维码、表格
- `overflowRules`
- `brandRules`
- `supportedLocales`

### StylePack

定义可变视觉资产和图片生成约束。

关键字段：

- `id`、`version`、`name`
- `palette`
- `illustrationReferences`
- `promptTemplate`
- `negativePrompt`
- `safeArea`
- `fallbackAssetId`

### GenerationJob

一次用户生成任务。

关键字段：

- `id`、`traceId`、`userId`
- `scenarioId`、`templateId`、`stylePackId`
- `status`、`currentStep`
- `inputSnapshot`
- `contentVersionId`、`outputVersionId`
- `errorCode`、`retryCount`
- `createdAt`、`updatedAt`

### GenerationVersion

不可变的生成版本，用于回滚和审计。

关键字段：

- `posterDocument`
- `generatedAssetIds`
- `templateVersion`
- `promptVersion`
- `modelInfo`
- `validationResults`
- `outputFiles`

### CampaignBrief

一次活动物料包共享的业务事实，不绑定单一输出尺寸。

关键字段：

- `schemaVersion`、`scene`、`locale`
- `brandSpecVersion`
- 活动名称、场次、日期、时间、地点、规则和二维码事实
- 默认四个 `renderTargets`

### ConfirmedCampaignDocument

用户完成一次文案确认后的不可变内容版本。它不包含 HTML/CSS 或
单一 `outputFormat`，四个规格由代码按 Manifest 投影。

### VisualMaster

四个规格共享的视觉母题，记录：

- `visualFamilyId`
- 来源内容版本
- 结构化插画 Brief 与 Prompt 版本
- 各 RenderTarget 的生成、派生或降级资产

### Artifact

物料包中的单个不可变输出。每项独立记录：

- `renderTargetId`
- 固定尺寸或自动高度
- `brandSpecVersion`
- 模板、内容和视觉版本
- 输出文件与 Brand Check
- 独立状态和错误

员工活动 BrandSpec v1 默认包含：

```text
portrait_1080x1920
landscape_1920x1080
banner_2227x950
longform_1080xAuto
```

旧版单竖版任务在读取时转换为 `CampaignBrief`，已有竖版结果映射为
一个兼容 Artifact，不原地覆盖历史 JSON。

## 2. PosterDocument 示例

LLM 必须返回与场景 Schema 匹配的数据。示例：

```json
{
  "schemaVersion": "1.0",
  "scene": "employee_activity",
  "locale": "zh-CN",
  "title": "Travel Day",
  "subtitle": "探索差旅新可能",
  "summary": "北京站与常州站双城联动",
  "events": [
    {
      "label": "北京站",
      "date": "2026-08-28",
      "time": "16:00-17:30",
      "location": "A4 户外广场"
    }
  ],
  "highlights": ["现场互动", "限量伴手礼"],
  "disclaimer": "具体合作资源以现场为准",
  "immutableSource": {
    "date": true,
    "time": true,
    "location": true
  }
}
```

禁止让 LLM 返回任意 HTML、CSS、绝对坐标、Logo URL 或二维码内容。模板选择可以由系统建议，但必须落在场景允许的模板集合内。

## 3. 任务状态机

```text
DRAFT
  -> QUEUED
  -> VALIDATING_INPUT
  -> GENERATING_COPY
  -> SELECTING_TEMPLATE
  -> GENERATING_ASSET       # 可跳过
  -> RENDERING
  -> VALIDATING_OUTPUT
  -> READY_FOR_REVIEW
  -> APPROVED
  -> EXPORTED

任一步骤 -> FAILED_RETRYABLE -> QUEUED
任一步骤 -> FAILED_FINAL
READY_FOR_REVIEW -> QUEUED   # 局部修改或重新生成新版本

试用版视觉流程在 `READY_FOR_COPY_REVIEW` 后进入：

```text
READY_FOR_VISUAL_INPUT -> REFINING_VISUAL -> READY_FOR_VISUAL_REVIEW
READY_FOR_VISUAL_REVIEW -> GENERATING_ASSET -> READY_FOR_VISUAL_REVIEW
READY_FOR_VISUAL_REVIEW -> RENDERING  # 仅确认已选主视觉后
```

文案确认不会启动图片模型；只有确认视觉草稿后才进入生图。
```

任务处理必须幂等。同一 `idempotencyKey` 重复提交不得重复产生收费模型调用或多个最终版本。

## 4. MVP API 草案

### 创建任务

`POST /api/jobs`

请求：场景、原始字段、语言、渠道、模板/风格偏好。  
响应：`202 Accepted`，返回 `jobId`、`status` 和查询地址。

T01 竖版入口的 `activityName` 最多 40 个字，实际排版最多三行。超过时返回 `422`
和 `T01_TITLE_TOO_LONG`，此时任务、LLM 和图片调用均不会创建。

视觉阶段接口：

- `POST /api/jobs/:jobId/refine-visual`：保存原始画面想法并异步生成可编辑草稿。
- `POST /api/jobs/:jobId/confirm-visual`：校验草稿版本并使用用户确认的描述新增一个主视觉方案，生成后停留在视觉阶段。
- `POST /api/jobs/:jobId/visual-options/select`：保存当前选中的主视觉方案，不调用模型。
- `POST /api/jobs/:jobId/visual-options/confirm`：确认当前选中方案并开始 T01 竖版排版。

确认文案中的 `subtitle` 是竖版海报实际展示的短副标题，最多 40
个字；`summary` 最多 150 字，作为补充说明单独保存。确认接口不能以
`summary` 不覆盖 `subtitle`；`subtitle` 为空时竖版不输出副标题槽位。

T01 视觉契约补充：用户创意描述与固定版式构图约束分开存储；系统约束只在最终图片提示词组装时注入一次，且图片调用前先通过最终 prompt Schema。视觉确认描述上限为 420 字，超限返回可编辑的中文错误，不静默截断。

二维码事实使用 `includeQr`、`qrPayload` 与 `qrAssetId`：链接和上传图片必须二选一，二者均为空时关闭二维码。`qrAssetId` 是受保护本地资产引用，不接受浏览器传入文件路径或公网图片 URL；它与二维码链接一起是不可改写字段，且绝不进入 LLM 或图片模型 Prompt。

### 二维码图片上传（2026-09-04）

- `POST /api/uploads/qr`：仅接受 `multipart/form-data` 中的 `file`；服务端通过 magic bytes 校验 PNG/JPEG/WebP，不信任客户端 MIME；最大 5MB，图片边长限制为 96–8192px。
- 成功后返回 `{ assetId, previewUrl, filename, width, height }`。Demo 将原图私有保存到 `data/uploads/qr/`，metadata 同目录原子写入；该目录不提交 Git。
- `GET /api/uploads/qr/:assetId`：仅资源所有者可读，`Cache-Control: private, no-store`；不暴露磁盘路径。
- 渲染时上传图片转换为内嵌 Data URI 注入受控二维码槽；URL 模式仍由服务端 `qrcode` 包生成 PNG。当前只校验文件格式、尺寸与模板加载，**未验证上传图片是否为可扫码二维码**。

T01 Demo 当前使用可读性观察模式：成功生成的背景不会因对比度不通过而替换为默认资产，也不会添加局部背景遮罩。渲染结果继续保存原图上的深／浅文字选择、像素测量与 `passed`。`trial` 只在字体、Logo、容量等硬检查通过时令 `exportAllowed=true`，同时保留可读性警告；`strict` 令其不可导出。图片模型调用失败的默认资产降级仍独立记录，不能伪装成可读性失败结果。

### 查询任务

`GET /api/jobs/:jobId`

返回当前步骤、进度、错误、最新版本和预览 URL。

### T01 四规格追加输出（2026-09-04 已实现）

`GET /api/jobs/:jobId/formats` 返回独立 Artifact 状态、尺寸、来源版本、视觉族、校验、错误和允许访问的预览 URL，以及当前视觉族 ID；`POST` 接收 `{ "format": "landscape_1920x1080" | "banner_2227x950" | "longform_1080xAuto" }`，返回 `202` 与 `artifactId`、`reused`。

- 两接口均验证任务所有者。追加生成要求任务为 `READY_FOR_REVIEW` 且最新竖版版本满足 `exportAllowed ?? passed`；不支持绕过竖版直接生成长图。
- 认领时冻结来源 `PosterDocument` 与素材引用；同规格、内容版本、视觉族和模板版本复用未失败项。失败重试追加 Artifact，不覆盖旧结果；不同规格失败彼此隔离。
- 追加输出只复用已生成资产并确定性裁切／排版，不调用模型。新增模板版本为 `t01-figma-2026-09-04-v1`；素材记录 `derived` 或原始 `fallback`。
- 横版：标题、说明、全部场次、参与对象、规则；Banner：标题、场次与对象核心信息、说明；长图：标题、说明、全部场次、对象、截止、规则分段、联系人、报名说明和条件二维码。奖品没有独立槽位；未投影字段不从领域数据删除。详细映射见 `TEMPLATE_FIELD_MATRIX_2026-09-04.md`。
- 标题及固定槽位按真实行数／边界测量，超限返回 `TEMPLATE_CONTENT_OVERFLOW`，不缩字或截断。长图宽 1080，高度按内容计算为 1920–12000，超出返回 `TEMPLATE_HEIGHT_EXCEEDED`。
- 横版／Banner 对比度失败在严格模式返回 `TEMPLATE_CONTRAST_FAILED`，试用模式 `passed=false`、`exportAllowed=true` 并保留警告。长图未做像素对比度采样，结果消息必须注明；其 `passed=true` 仅代表本轮执行的检查通过。
- 图片 URL 与下载资格按具体 Artifact 的 `exportAllowed ?? passed` 判定，不按当前全局策略追溯放开历史失败产物。当前未验证二维码可扫描性或画面语义。

### 修改文案

`PATCH /api/jobs/:jobId/content`

只允许修改场景协议中可编辑字段。创建新版本，不覆盖历史版本。

### 重新生成插画

`POST /api/jobs/:jobId/regenerate-asset`

保留文案与模板，只创建新的视觉资产和输出版本。

### 更换模板

`POST /api/jobs/:jobId/change-template`

仅允许同一场景支持的模板；重新运行溢出和品牌校验。

### 确认与导出

`POST /api/jobs/:jobId/approve`  
`POST /api/jobs/:jobId/export`

导出请求包含目标尺寸和格式，返回异步导出任务或已有文件。

## 5. 自动校验结果

```json
{
  "passed": false,
  "checks": [
    {
      "ruleId": "content.required.location",
      "severity": "error",
      "message": "活动地点不能为空",
      "field": "events[0].location",
      "autoFixable": false
    },
    {
      "ruleId": "typography.title.overflow",
      "severity": "warning",
      "message": "标题超过当前模板建议长度，系统已缩小一级字号",
      "field": "title",
      "autoFixable": true
    }
  ]
}
```

最低规则类别：

- 必填字段、日期时间格式和不可改写字段。
- Logo 版本、尺寸、安全区和拉伸。
- 品牌色和最低对比度。
- 最低字号、文本溢出和遮挡。
- 二维码最小尺寸和清晰度。
- 图片缺失、低分辨率和安全区冲突。

## 6. 飞书交互契约

- 飞书身份映射成内部 `userId`，不要用姓名作为主键。
- 机器人事件和卡片回调快速确认，耗时生成任务进入队列。
- 机器人只展示任务摘要、状态、预览和跳转链接，不承担完整编辑器。
- 多维表格同步失败不得影响核心生成任务完成。
- 多维表格只保存任务摘要和输出引用，不保存模型密钥。

## 7. 错误与降级

| 故障 | MVP 行为 |
|---|---|
| LLM 输出不符合 Schema | 自动修复/重试一次，仍失败则返回可理解错误 |
| 图片模型超时 | 使用风格包默认插画，标记为降级 |
| 字体加载失败 | 阻止导出，不生成缺字海报 |
| 公司 Logo 或行政标识加载失败 | 阻止导出，不生成缺少品牌标识的海报 |
| T01 竖版标题超过三行 | 返回 `brand.title.max_lines`，阻止导出 |
| B2 竖版正文超过声明容量 | 返回 `content.capacity`，阻止导出；不得静默裁切重要内容 |
| 存储上传失败 | 保留本地临时产物并重试，不通知用户已完成 |
| 飞书通知失败 | 任务仍为完成状态，异步重试通知 |
