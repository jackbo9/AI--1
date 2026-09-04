# 目标架构与技术栈

2026-09-04 视觉指导：`providers/visual-direction.ts` 保存精简摄影与构图指导，通过集中环境变量 `VISUAL_STYLE_MODE` 可回退。确认后的创意正文不再次调用 LLM，也不重置颜色和主体。该修改不改变前端场景入口及一图四规格裁切方式。

## 1. 架构原则

1. 飞书是入口和协作层，不是海报计算与渲染引擎。
2. LLM 只输出符合 Schema 的结构化内容。
3. 图片模型只生产可变视觉素材，不生产正文、Logo 或二维码。
4. 海报由确定性模板渲染，允许复现和视觉回归测试。
5. 模型、存储、飞书和渲染器均通过适配器隔离。
6. 所有生成任务异步执行，支持幂等、重试、降级和审计。
7. Demo 与生产采用相同领域契约，但基础设施可逐级替换。
8. 员工活动以 Campaign 为生成单位：一次事实输入、一次文案确认和一个视觉母题，投影为多个独立 Artifact。
9. 视觉创意必须经过独立输入、优化和用户确认；确认后的描述直接进入图片 Provider，不隐式二次改写。

## 2. 逻辑架构

```text
┌──────────────────────────────────────────────┐
│ 飞书                                         │
│ 工作台网页应用 · 机器人 · 消息卡片 · 身份权限 │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│ Web / API                                   │
│ 场景表单 · 预览 · 编辑 · 导出 · 任务查询       │
└──────────────────────┬───────────────────────┘
                       │ 创建异步任务
┌──────────────────────▼───────────────────────┐
│ Job Orchestrator / Worker                    │
│ 校验 → 文案确认 → VisualMaster → Artifact 扇出 │
└───────┬──────────┬──────────┬──────────┬─────┘
        │          │          │          │
      LLM       图片模型   模板渲染器   规则校验器
                       │
               HTML/CSS + Playwright
                       │
┌──────────────────────▼───────────────────────┐
│ PostgreSQL · S3/MinIO · 日志/指标             │
└──────────────────────────────────────────────┘

可选：多维表格通过 API 同步模板配置、任务摘要和反馈。
```

员工活动 P0 的默认物料包为：

- `portrait_1080x1920`
- `landscape_1920x1080`
- `banner_2227x950`
- `longform_1080xAuto`

四项共享 `CampaignBrief`、`ConfirmedCampaignDocument`、
`VisualMaster` 和 `brandSpecVersion`，但每个 Artifact 独立记录模板、
尺寸、素材、校验和错误。某一规格失败不得回滚其他合格规格。
2026-09-04 用户已授权并实现 T01 四规格接入。当前 Demo 的增量实现见下文，区别于未来一次请求扇出四规格的目标架构。

### 2.1 当前 Demo 的四规格实现（2026-09-04）

现有竖版链路先完成文案／视觉确认和生成；`T01OutputGallery` 再通过 `/api/jobs/:jobId/formats` 按需请求横版、Banner、长图。`t01-format-service` 在任务串行更新中认领并冻结来源文档与素材引用；`t01-extra-renderer` 使用 `t01-wide`／`t01-longform` 输出确定性 PNG，不再次调用模型。

每个追加 Artifact 独立记录尺寸、来源内容版本、视觉族、模板版本、输出路径、校验和错误；同来源和模板版本复用未失败项，失败重试创建新 Artifact。当前仍使用本地 JSON 和 Web 进程的异步执行，不等于 PostgreSQL 或持久队列已经上线。

字段投影由 `t01-template-content` 与具体模板控制；长图包含截止、联系人和完整规则，固定规格只承载声明槽位，未展示字段仍保留。固定尺寸溢出阻止输出；长图按文档流计算高度并限制在 1920–12000。所有规格复用现有主视觉，宽图通过 cover 裁切，尚无专属生图或自动构图保证。

横版／Banner 检测实际文字区背景对比度：严格模式不合格阻止，试用模式保留警告并允许试用稿。长图使用固定纯色正文区，未进行背景像素对比度采样；当前实际检查为字体与图片加载、容量及输出尺寸，不声称已检查语义、二维码可扫描性或所有视觉质量。

### 2.3 本地私有二维码资产（2026-09-04）

Demo 支持上传 PNG/JPEG/WebP 二维码图片。Web API 先用 magic bytes 和像素尺寸校验，再将原始字节与 owner metadata 保存在 `data/uploads/qr/`；读取接口按飞书／本地身份做资源所有者校验，不公开磁盘路径。任务中仅保存 `qrAssetId`，渲染器接收受控 Data URI，不直接依赖本地存储实现。生产试点应将此实现替换为 `StorageProvider` 后的私有对象存储或 MinIO；上传图片仍不进入 LLM、图片模型或 Prompt。

### 2.2 T01 Demo 可读性观察模式（2026-09-04）

为让设计评审看到图片模型原始背景与文字的实际冲突，竖版 T01 暂停“可读性失败后自动替换默认背景”和“局部背景遮罩”两项干预。渲染器只在原图上选择深／浅文字和匹配的公司 Logo，并继续记录像素对比度分析。

`trial` 允许对比度不通过的 PNG 作为明确标记的试用稿预览和下载；`strict` 仍阻止这类导出。两种策略都不替换已成功生成的背景，也不添加遮罩。图片模型调用本身失败时的默认品牌资产降级不受此模式影响。

## 3. 推荐技术栈

### 应用层

| 能力 | MVP 选择 | 原因 |
|---|---|---|
| 语言 | TypeScript | 前后端共享类型，适合现有经验与 AI 辅助开发 |
| Web | Next.js App Router | 页面、API 和服务端渲染可在同一项目启动 |
| UI | React + Tailwind CSS | 快速构建产品 UI；海报模板不要依赖 Tailwind 运行时 |
| 数据校验 | Zod + JSON Schema | 同时约束表单、API、LLM 输出和测试 Fixture |
| 飞书 | `@larksuiteoapi/node-sdk` | 官方 SDK，处理 API、Token、事件、机器人与卡片 |
| ORM | Prisma 或等价轻量 ORM | 数据结构可迁移至标准 PostgreSQL；实施时只选一种 |
| 测试 | Vitest + Playwright | 领域逻辑、API 和渲染视觉回归 |

### 生成层

| 能力 | MVP 选择 | 演进 |
|---|---|---|
| 文案 | 公司批准的 LLM，通过 Provider Adapter | 可替换不同模型，不让业务代码依赖供应商 SDK |
| 插画 | 公司批准的图片模型，通过 Provider Adapter | 失败时回退品牌默认资产 |
| 排版 | HTML/CSS + Playwright/Chromium | 高并发固定模板可迁移 SVG + resvg |
| 品牌校验 | 规则引擎 + 模板元数据 | 后续增加 OCR/视觉模型辅助检查 |
| 任务 | PostgreSQL 任务表 | 并发和重试复杂后迁移 Redis + BullMQ |

### 基础设施

| 阶段 | 数据库 | 文件 | 部署 |
|---|---|---|---|
| 本地 Demo | SQLite 或本地 PostgreSQL | 本地文件 | 本机进程/Docker |
| 内部试点 | PostgreSQL | 公司 S3 兼容存储或 MinIO | 公司测试服务器 + Docker |
| 正式上线 | 公司托管 PostgreSQL | 公司对象存储 | 公司容器平台，技术团队负责运维 |

## 4. 为什么 MVP 使用浏览器渲染

现有物料既有活动型海报，也有表格、二维码和自动高度长图。HTML/CSS 浏览器排版对以下问题更友好：

- 中文字体、换行和段落。
- 表格、卡片、标签及二维码。
- 长图自动高度。
- 多语言内容溢出。
- 设计师与前端共同调试。
- PNG 和 PDF 双格式输出。

渲染流程：

1. 将校验后的 PosterDocument 注入模板。
2. 等待字体、插画和图片资源加载完成。
3. 运行模板内溢出检测。
4. Playwright 按目标尺寸截图。
5. 运行输出图尺寸、文件大小和基础像素检查。
6. 上传对象存储，保存不可变版本 URL。

## 5. 应用进程划分

MVP 可以是同一代码库、两个进程：

- `web`：页面、飞书登录、API、任务查询。
- `worker`：模型调用、渲染、校验、存储和通知。

两者通过 PostgreSQL 任务表通信。这样保持开发简单，也避免网页请求等待几十秒。正式试点再引入 Redis/BullMQ，不在第一天增加运维负担。

## 6. Provider 接口

业务逻辑不得直接调用具体厂商 SDK。至少抽象：

```ts
interface CopyProvider {
  generate(input: CopyRequest): Promise<PosterDocument>;
}

interface IllustrationProvider {
  generate(input: IllustrationRequest): Promise<GeneratedAsset>;
}

interface StorageProvider {
  put(input: PutObjectRequest): Promise<StoredObject>;
}

interface RenderProvider {
  render(input: RenderRequest): Promise<RenderedOutput>;
}
```

每次任务记录 provider、model、promptVersion、templateVersion、耗时和可计量用量。

## 7. 安全边界

- 飞书 App Secret 和模型密钥只存在服务端 Secret 管理中。
- 浏览器不得直接调用模型供应商。
- Webhook 和卡片回调必须验证签名/Token，并防止重放。
- 日志默认不记录完整员工信息、活动名单和模型密钥。
- 文件 URL 默认私有或短期签名，不产生永久公网链接。
- 下载、查看历史和审核遵循飞书用户身份与应用角色。
- 提交模型前执行字段级脱敏和外部模型使用策略检查。

## 8. 可观测性最低要求

每个任务必须有 `traceId`，并记录：

- 用户与租户标识（按合规要求脱敏）。
- 场景、模板与风格包版本。
- 各步骤开始/结束、耗时和错误码。
- 模型、Prompt 版本和用量。
- 重试次数及是否使用降级资产。
- 最终输出、校验结果与用户操作。

## 9. 2026-09-04 云端 Demo 实际部署

当前 Demo 已在阿里云杭州 ECS 上以单个 Next.js 进程运行，Nginx 终止 IP HTTPS，systemd 负责开机启动和失败重启。Web/异步任务仍共享进程；任务 JSON、上传图片、生成图片保存在 `/opt/ai-zhihui/shared/data`，没有引入 PostgreSQL、Redis 或新的模型供应商。

应用仅监听本机 3000，公网 443 通过飞书会话保护业务 API；80 用于证书验证和跳转。Let's Encrypt IP 短期证书通过 systemd 定时检查续期。环境变量文件不进入源码，运行账户为 poster。飞书后台切换及实际用户验收尚未完成，详见 `deploy/README.md`；这仍是 Demo 部署，不等于生产基础设施或全部视觉回归已通过。
