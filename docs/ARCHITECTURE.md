# 目标架构与技术栈

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
在 `portrait_1080x1920` 通过 B2 视觉评审前，不批量精修其他规格。

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
