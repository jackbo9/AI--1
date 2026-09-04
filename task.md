# 当前切片 Demo 对齐与执行任务

更新时间：2026-09-03  
状态：B1–B2 竖版草案已完成，等待视觉评审；本文件中“等待模板”条目仅保留为历史决策记录  
范围：只完成一个员工活动切片，不扩展完整 M1

## 0. 2026-09-03 Phase B 执行状态

- [x] B1：接入正式公司 Logo、行政标识与 MiSans Regular / Medium / Heavy。
- [x] B1：Playwright 在字体或任一标识加载失败时阻止正式 PNG 导出。
- [x] B2：实现 `portrait_1080x1920` 全幅背景模板，并保留确定性文字、Logo 与二维码。
- [x] B2：标题限制为三行；长正文超过竖版容量时阻止导出，不裁切重要文本。
- [x] B2：运行正常、三行标题、缺可选字段、二维码和图片降级 PNG Fixture；
  标题超限与长文案 Fixture 按预期阻止。
- [ ] 设计方人工评审 B2 竖版 PNG。评审通过前，不开始横版、Banner、长图的视觉精修。

## 1. 本阶段目标

完成一条可以真实演示的最小链路：

```text
员工活动表单
  -> DeepSeek 生成并校验结构化文案
  -> 用户确认文案
  -> Seedream 生成无文字主视觉
  -> 正式 HTML/CSS 模板合成
  -> 品牌与内容基础校验
  -> 1080 × 1920 PNG 预览和下载
```

当前切片固定为：

- 一级场景：员工活动。
- 二级场景：等待今天晚些时候的正式模板确认。
- 语言：简体中文。
- 输出 Format：竖版 `1080 × 1920`。
- 模板：一个固定模板，不提供模板市场或多模板选择。
- AI 图片：只进入模板声明的主视觉槽位。
- Logo、二维码、日期、时间、地点和正文：由代码确定性绘制。

## 2. 已确认的产品与技术对齐

- M1 的一级场景为员工活动、员工福利、员工通知、调查问卷。
- 用户选择业务场景，不从空 Prompt 或自由画布开始。
- 一类业务场景对应受控母版，不让用户自由搭建版式。
- Format 与业务场景分离，由场景配置决定允许输出的尺寸。
- 必填字段随具体场景自动出现；可选字段按需增加。
- 二维码内容可以替换，但位置、尺寸和安全区由模板锁定。
- AI 可以优化文案并生成主视觉，但不能生成 Logo、二维码或正文图层。
- HTML/CSS + Playwright 负责最终排版与 PNG 输出。
- 用户需要能够只重新生成主视觉，不改动已确认文案。

## 3. 现在可以立刻执行的任务

这些工作不依赖今天晚些时候的完整模板，可以先完成。

### 3.1 锁定切片边界

- [x] 保留唯一开放场景 `employee_activity`。
- [x] 暂时只支持 `portrait_1080x1920`。
- [x] 在领域数据中显式记录输出 Format，避免尺寸只存在于 CSS。
- [x] 不实现其他三个一级场景。
- [x] 不实现横版、Banner、长图、A4 和 150 × 80mm。
- [x] 不实现模板上传、模板选择后台和自由画布。

### 3.2 验证当前 API 配置

当前 `.env.local` 已配置：

- DeepSeek：`deepseek-chat`
- Seedream：`doubao-seedream-5-0-260128`
- Seedream 服务：火山方舟北京区域

执行时不得输出或记录 API Key。

- [x] 检查所需变量是否存在，只输出布尔状态、Provider、模型和 Base URL 域名。
- [x] 独立调用一次 DeepSeek，确认鉴权、模型名和 JSON 输出有效。
- [x] 独立调用一次 Seedream，确认鉴权、模型名、请求参数和图片下载有效。
- [x] 记录响应状态、耗时、模型和错误码，不记录完整输入及密钥。
- [x] 确认两次探针均使用脱敏测试内容。
- [x] 探针通过后再运行完整任务，避免在 UI 调试中重复产生图片费用。

### 3.3 完善 API Provider 边界

- [x] 浏览器不得直接访问 DeepSeek 或 Seedream。
- [x] 所有密钥只由服务端 `src/lib/env.ts` 读取。
- [x] DeepSeek 响应先解析为未知外部数据，再经过 Zod Schema。
- [x] Seedream 响应先检查 `data[0].url` 或 `data[0].b64_json`。
- [x] Seedream 返回临时 URL 时立即下载到本地存储，不能把临时 URL 当成最终产物。
- [x] 为外部调用设置超时和有限重试。
- [x] 401/403 归类为配置或权限错误，不自动重复请求。
- [x] 429 和临时 5xx 最多重试一次，并使用短暂退避。
- [x] DeepSeek 非法 JSON 或 Schema 不通过时，允许修复/重试一次。
- [x] Seedream 失败后使用默认品牌资产，但结果必须明确标记为 `fallback`。
- [x] 同一幂等键不得重复触发收费模型调用。

### 3.4 先完成与模板无关的交互骨架

- [x] 将当前一次性生成流程拆成“生成文案”和“确认后生成视觉”两个阶段。
- [x] 文案确认页允许修改可编辑字段。
- [x] 日期、时间、地点、二维码内容和其他不可改写字段保持锁定。
- [x] 增加“是否需要二维码”开关。
- [x] 未开启二维码时不显示二维码输入。
- [x] 暂时只接受二维码链接；上传图片能力等待正式模板确认后决定。
- [x] 结果页增加“只换主视觉”操作入口。
- [x] 只换主视觉时复用已确认的文案和模板版本。

### 3.5 保留当前可复现测试

- [x] 保留正常、长文本、缺字段三组 Fixture。
- [x] 增加 API Provider 的脱敏 Mock 测试。
- [ ] 测试 DeepSeek 修改不可改写字段时任务失败。
- [ ] 测试 Seedream 失败时使用默认资产。
- [ ] 测试同一输入与模板可以重复生成相同排版结构。

## 4. 必须等待今天晚些时候输入后才能开始的任务

以下任务依赖正式模板，不提前猜测，避免重复返工。

### 4.1 确认具体业务切片

- [ ] 正式模板属于员工活动中的哪一个二级场景。
- [ ] 该二级场景的必填字段。
- [ ] 可选字段及其出现条件。
- [ ] 不可改写字段。
- [ ] 可由 AI 优化的字段。
- [ ] 标题、副标题、正文、规则和提示的最大字数。

候选二级场景包括：

- 节日活动
- 安全活动
- 差旅活动
- 竞赛活动
- 俱乐部活动

### 4.2 正式模板实现

- [ ] 模板 ID 和版本。
- [ ] Logo 与行政标识的版本、位置、尺寸和安全距离。
- [ ] 主视觉是全局底图、局部底图还是独立槽位。
- [ ] 主视觉焦点区域和禁止放置重要内容的区域。
- [ ] 标题、正文、时间地点和 CTA 的位置与层级。
- [ ] 固定模块和可选模块的组合规则。
- [ ] 二维码位置、尺寸、安全区和无二维码时的版式变化。
- [ ] 缺少可选字段时的收缩或重排策略。
- [ ] 最小字号、换行、缩字和溢出处理。
- [ ] 最终背景、装饰素材和默认降级主视觉。

### 4.3 品牌视觉落地

基础规范已经收到，但应在正式模板中确认具体使用方式：

| 类型 | 当前基础输入 |
|---|---|
| 字体 | MiSans |
| Brand Black | `#000000` |
| Surface | `#F5F5F2` |
| Admin Yellow | `#FAE24C` |
| Accent Red | `#DA291C` |
| Accent Blue | `#05AFF3` |
| Accent Green | `#00AF66` |
| Accent Orange | `#FF9E1B` |
| 字级 | H1 80 / H2 48 / H3 36 / Body 28 / Caption 18 |
| 间距 | 16 / 32 / 48 / 64 |
| 圆角 | 16 / 24 |

等待模板后执行：

- [ ] 将字体文件以具有服务端渲染许可的方式放入项目。
- [ ] Playwright 截图前等待 MiSans 加载完成。
- [ ] 使用模板指定的颜色，而不是把全部辅助色同时加入海报。
- [ ] 替换当前临时蓝、米、橙色视觉。
- [ ] 替换当前临时主视觉和占位资产。
- [ ] 建立正式模板的视觉回归基线。

### 4.4 模板相关品牌校验

正式模板完成后再实现几何与视觉规则：

- [ ] Logo 正确性。
- [ ] 字体正确性。
- [ ] 品牌色正确性。
- [ ] 标题层级。
- [ ] 正文字号。
- [ ] 安全边距。
- [ ] 信息容量和文字溢出。
- [ ] 二维码尺寸、安全区和可扫描性。
- [ ] 主视觉是否符合场景及安全区。
- [ ] 输出尺寸是否为 1080 × 1920。

本切片只需要给出逐项结果，不实现复杂 Brand Score。

## 5. API 接入实施办法

### 5.1 调用链

```text
.env.local
  -> src/lib/env.ts
  -> CopyProvider / PromptCompiler / IllustrationProvider
  -> Worker
  -> Template Renderer
  -> GenerationVersion
  -> GET /api/jobs/:jobId
  -> 网页预览
```

前端只允许调用本项目 API：

```text
POST /api/jobs
GET  /api/jobs/:jobId
```

不得把模型 API Key、Authorization Header 或供应商响应直接发送给浏览器。

### 5.2 环境变量

```env
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=由用户本地填写
LLM_MODEL=deepseek-chat

IMAGE_PROVIDER=seedream
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com
IMAGE_API_KEY=由用户本地填写
IMAGE_MODEL=doubao-seedream-5-0-260128
```

启动时检查：

```ts
configured.copy =
  Boolean(LLM_BASE_URL && LLM_API_KEY && LLM_MODEL);

configured.image =
  IMAGE_PROVIDER === "seedream" &&
  Boolean(IMAGE_BASE_URL && IMAGE_API_KEY && IMAGE_MODEL);
```

Demo 可以保留未配置时的本地降级，但真实联调验收必须确认：

```text
copyProvider = deepseek
imageProvider = seedream
assetMode = generated
```

不能把 `demo-copy`、`demo-image` 或 `fallback` 误认为 API 已接通。

### 5.3 DeepSeek 文案接口

请求：

```http
POST https://api.deepseek.com/chat/completions
Authorization: Bearer ${LLM_API_KEY}
Content-Type: application/json
```

最小请求体：

```json
{
  "model": "deepseek-chat",
  "temperature": 0.3,
  "response_format": {
    "type": "json_object"
  },
  "messages": [
    {
      "role": "system",
      "content": "只输出符合 PosterDocument Schema 的 JSON，不输出 Markdown 或 HTML。"
    },
    {
      "role": "user",
      "content": "经过字段分级和脱敏的员工活动输入"
    }
  ]
}
```

处理步骤：

1. 检查 HTTP 状态。
2. 读取 `choices[0].message.content`。
3. `JSON.parse`。
4. 使用 `posterDocumentSchema.parse`。
5. 对所有不可改写字段逐字段比较。
6. 只有全部通过后才允许进入图片生成和渲染。

DeepSeek 不负责：

- 返回 HTML/CSS。
- 决定绝对坐标。
- 生成 Logo URL。
- 生成二维码。
- 修改日期、时间、地点或已确认规则。

### 5.4 Seedream 图片接口

请求：

```http
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
Authorization: Bearer ${IMAGE_API_KEY}
Content-Type: application/json
```

当前模型的最小请求体：

```json
{
  "model": "doubao-seedream-5-0-260128",
  "prompt": "脱敏后的主视觉描述。不要文字、字母、数字、Logo、二维码、水印或签名。",
  "size": "2K",
  "response_format": "url",
  "watermark": false,
  "sequential_image_generation": "disabled",
  "n": 1
}
```

处理步骤：

1. 检查 HTTP 状态。
2. 读取 `data[0].url` 或 `data[0].b64_json`。
3. 如果是 URL，立即下载图片。
4. 检查文件非空、类型可读取、尺寸满足渲染要求。
5. 保存成本地不可变资产。
6. 将资产路径交给模板，不把供应商 URL 直接写入最终版本。

发送给 Seedream 的内容只允许包含：

- 活动主题。
- 人物或主体。
- 动作。
- 环境。
- 氛围。
- 构图和安全区。
- 模板需要的色彩与风格约束。

必须移除：

- 员工姓名、电话和联系方式。
- 精确内部地点。
- 日期和时间。
- 报名链接。
- Logo 和二维码。
- 海报标题及正文。

### 5.5 超时、重试与降级

| 调用 | 超时建议 | 重试 | 最终行为 |
|---|---:|---:|---|
| DeepSeek 文案 | 30 秒 | 最多 1 次 | 失败则任务失败并显示可理解错误 |
| DeepSeek 主视觉 Brief | 20 秒 | 最多 1 次 | 可使用本地规则生成 Brief |
| Seedream 生图 | 90 秒 | 最多 1 次 | 使用默认品牌资产继续渲染 |
| 图片下载 | 30 秒 | 最多 1 次 | 使用默认品牌资产 |

重试前必须检查：

- 是否已经取得有效响应。
- 是否已经保存生成资产。
- 同一任务是否已经存在对应步骤产物。
- 重试是否可能再次收费。

### 5.6 错误码

建议在项目内统一为稳定错误码：

| 错误码 | 用户文案 |
|---|---|
| `LLM_AUTH_FAILED` | 文案服务配置或权限无效 |
| `LLM_RATE_LIMITED` | 文案服务繁忙，请稍后重试 |
| `LLM_INVALID_OUTPUT` | 文案结果未通过内容校验 |
| `IMMUTABLE_FIELD_CHANGED` | 重要活动信息被意外改写 |
| `IMAGE_AUTH_FAILED` | 图片服务配置或权限无效 |
| `IMAGE_RATE_LIMITED` | 图片服务繁忙，已尝试使用默认视觉 |
| `IMAGE_GENERATION_FAILED` | 主视觉生成失败，已使用默认视觉 |
| `IMAGE_DOWNLOAD_FAILED` | 主视觉下载失败，已使用默认视觉 |
| `RENDER_FAILED` | 海报排版生成失败 |
| `OUTPUT_VALIDATION_FAILED` | 海报未通过输出检查 |

客户端只接收稳定错误码和可理解文案，不接收供应商原始响应、堆栈或密钥。

### 5.7 模型探针的实施方式

开始执行代码修改时，先增加两个独立的服务端探针：

```text
scripts/probe-copy-provider.ts
scripts/probe-image-provider.ts
```

对应命令：

```text
npm run probe:copy
ALLOW_PAID_MODEL_PROBE=1 npm run probe:image
```

规则：

- 文案探针只发送一份最小脱敏 Fixture。
- 图片探针可能产生费用，未设置 `ALLOW_PAID_MODEL_PROBE=1` 时必须拒绝执行。
- 探针直接调用 Provider，不创建业务任务，不写入正式任务记录。
- 图片探针可以把测试图片写入明确的临时探针目录。
- 探针结束时只输出以下信息：

```json
{
  "ok": true,
  "provider": "seedream",
  "model": "doubao-seedream-5-0-260128",
  "elapsedMs": 0,
  "output": "已省略的本地测试文件路径"
}
```

- 输出中不得包含 API Key、Authorization Header、完整供应商响应或临时下载 URL。
- 探针失败时返回非零退出码，并输出项目内稳定错误码。

探针执行顺序：

1. 运行环境变量检查。
2. 运行 `npm run probe:copy`。
3. 检查结构化 JSON 和不可改写字段。
4. 经确认后运行付费图片探针。
5. 检查生成图片文件。
6. 两个探针都通过后才运行 UI 完整链路。

### 5.8 API 联调验收

### DeepSeek 单独验收

- [ ] HTTP 请求成功。
- [ ] 实际模型为 `deepseek-chat`。
- [ ] 返回可解析 JSON。
- [ ] 通过 PosterDocument Zod 校验。
- [ ] 日期、时间、地点等字段保持原值。
- [ ] 日志不包含 API Key。

### Seedream 单独验收

- [ ] HTTP 请求成功。
- [ ] 实际模型为 `doubao-seedream-5-0-260128`。
- [ ] 返回 URL 或 Base64 图片。
- [ ] 图片被立即下载并保存。
- [ ] 产物不是空文件。
- [ ] 任务记录为 `assetMode = generated`。
- [ ] 失败时能够明确进入默认资产降级。

### 完整链路验收

- [ ] `POST /api/jobs` 返回 `202` 和 `jobId`。
- [ ] 任务依次经过文案、主视觉、渲染和校验步骤。
- [ ] 最终状态为 `READY_FOR_REVIEW`。
- [ ] `GET /api/jobs/:jobId` 返回预览地址。
- [ ] 预览地址返回真实 `1080 × 1920` PNG。
- [ ] GenerationVersion 记录模板、Prompt、模型和资产模式。
- [ ] UI 能区分真实生图与默认资产降级。
- [ ] 相同幂等键重复提交不会再次调用收费 API。

## 6. 正式模板到达后的执行顺序

严格按以下顺序完成，不并行扩展范围：

1. 确认正式模板对应的二级场景。
2. 将模板拆解成固定区域、可变文本槽位、主视觉槽位和可选模块。
3. 确认字段协议、不可改写字段和最大字数。
4. 更新该切片的 Zod Schema 与 Fixture。
5. 实现正式 HTML/CSS 模板。
6. 接入 MiSans、正式 Logo、品牌色和默认资产。
7. 调整 Seedream Prompt，使构图匹配模板安全区。
8. 实现文案确认后再生成视觉。
9. 实现只换主视觉。
10. 运行正常、长文本、缺字段和生图失败测试。
11. 生成 PNG 并人工检查视觉基线。
12. 完成一次真实 API 的端到端演示。

## 7. 本切片完成定义

满足以下条件后，才可以称为当前切片 Demo 完成：

- [ ] 用户无需编写 Prompt 即可填写员工活动。
- [ ] DeepSeek 真实生成结构化文案。
- [ ] 用户可以确认或修改允许编辑的文案。
- [ ] 不可改写字段在调用前后完全一致。
- [ ] Seedream 真实生成一张不含正文、Logo 和二维码的主视觉。
- [ ] 正式模板输出 `1080 × 1920` PNG。
- [ ] Logo、文字和二维码均由代码确定性排版。
- [ ] 用户可以预览和下载 PNG。
- [ ] 用户可以只重新生成主视觉。
- [ ] 图片 API 失败时默认资产降级仍可输出海报。
- [ ] 正常、长文本和缺字段测试通过。
- [ ] typecheck、lint、相关单元测试和一次完整链路检查通过。

## 8. 本阶段明确不做

- 其余三个一级场景。
- 全套线上和线下 Format。
- 长图自动高度。
- 多模板选择。
- 模板上传与配置后台。
- 自由画布。
- PDF。
- 多语言。
- 多维表格同步。
- 飞书机器人消息和卡片交互。
- PostgreSQL、Redis/BullMQ 和生产部署。
- 复杂 Brand Score。

核心切片稳定后，再按照项目既定顺序接入任务持久化、飞书身份和机器人通知。

## 9. 执行记录与回退点

### 2026-09-02 基线冻结

- Git 基线提交：`93c7a91`
- 快照标签：`snapshot-2026-09-02-pre-slice`
- 开发分支：`codex/slice-demo`
- `.env.local`、本地任务数据和生成产物均未进入 Git。

查看相对基线的全部修改：

```bash
git diff snapshot-2026-09-02-pre-slice
```

需要回到执行前版本时，优先新建保留分支，再切回基线：

```bash
git branch recovery/current-slice
git switch main
```

不要在未确认的情况下执行 `git reset --hard` 或删除本地生成产物。

### 2026-09-02 API 与链路验证

- DeepSeek 探针成功：
  - Provider：`deepseek`
  - Model：`deepseek-chat`
  - Schema：`1.6`
  - 不可改写字段校验通过
- Seedream 探针成功：
  - Provider：`seedream`
  - Model：`doubao-seedream-5-0-260128`
  - 返回并下载 2048 × 2048 主视觉
  - 本地 OCR 未识别出文字候选
- 两阶段真实任务成功：
  - `QUEUED -> GENERATING_COPY -> READY_FOR_COPY_REVIEW`
  - 用户确认文案后进入 `GENERATING_ASSET`
  - 最终状态为 `READY_FOR_REVIEW`
  - `assetMode = generated`
  - 输出为 1080 × 1920 PNG
  - 内容校验通过
- 已发现并修复图片 URL 返回 JPEG、旧实现却保存为 `.png` 的扩展名不一致问题。
