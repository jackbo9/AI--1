# 领域、API 与生成契约

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
```

任务处理必须幂等。同一 `idempotencyKey` 重复提交不得重复产生收费模型调用或多个最终版本。

## 4. MVP API 草案

### 创建任务

`POST /api/jobs`

请求：场景、原始字段、语言、渠道、模板/风格偏好。  
响应：`202 Accepted`，返回 `jobId`、`status` 和查询地址。

### 查询任务

`GET /api/jobs/:jobId`

返回当前步骤、进度、错误、最新版本和预览 URL。

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
| 文本溢出 | 按模板规则缩字/换模板；不得静默裁切重要内容 |
| 存储上传失败 | 保留本地临时产物并重试，不通知用户已完成 |
| 飞书通知失败 | 任务仍为完成状态，异步重试通知 |

