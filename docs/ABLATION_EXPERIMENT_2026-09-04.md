# 当前单竖版切片消融实验

日期：2026-09-04

## 结论

当前最值得消掉的不是 Provider、安全校验或可读性门禁，而是尚未真正启用的多规格领域模型在单竖版链路中的双轨写入。

按当前用户可见能力，`input + versions` 已足以支撑创建任务、文案确认、生成、预览、下载和“只换主视觉”。`campaignBrief + confirmedDocument + visualMaster + artifacts` 目前主要是为四规格扇出准备的第二套状态表示。它们和旧结构同时写入，增加了一致性、迁移和排障成本，却没有改变当前单竖版产物。

另一个可以立即移除的对象是手写 `posterDocumentJsonSchema`：当前没有任何调用方，而且它只描述了 Zod 契约的一部分，不能作为实际模型输出约束。

## 实验边界

保留当前已上线的行为：

- 飞书身份与任务所有者校验。
- 两阶段文案确认。
- 不可改写字段校验。
- Seedream 失败降级。
- T01 HTML/CSS 渲染与可读性发布门。
- 单竖版 PNG、历史版本、预览和下载。

本轮没有调用付费模型，也没有修改当前工作区业务代码。删减版位于临时副本，只用于编译和测试；临时副本不作为交付物。

## 基线

| 指标 | 结果 |
|---|---:|
| TypeScript/TSX 生产代码 | 4,799 行 |
| TypeScript 测试代码 | 1,198 行 |
| 单元测试 | 45/45 通过 |
| ESLint | 通过 |
| Next.js 生产构建 | 通过 |
| 首页 First Load JS | 108 kB |

## A1：旁路多规格双轨写入

临时删减：

- Worker 直接读取当前单竖版 `job.input`，不再执行 `CampaignBrief -> legacy portrait input` 往返转换。
- 文案确认不再额外写入 `ConfirmedCampaignDocument`。
- 单竖版生成不再额外写入 `VisualMaster` 和 `Artifact`，继续写当前 UI 和下载链路已经支持的 `GenerationVersion`。
- 当前 Worker 和历史版本兼容转换不再读取四规格 TemplateFamily manifest。

结果：

| 指标 | 基线 | A1 |
|---|---:|---:|
| 生产代码差异 | 0 | +7 / -79，净减 72 行 |
| 单元测试 | 45/45 | 45/45 |
| ESLint | 通过 | 通过 |
| 生产构建 | 通过 | 通过 |
| 首页 First Load JS | 108 kB | 108 kB |

判断：这些抽象对当前单竖版闭环不是运行必需项。收益主要是减少状态数量和认知负担，不是前端性能。

注意：现有测试没有覆盖完整 Worker 状态机，所以这个结果足以证明“当前编译和已测行为不依赖双写”，但不足以直接授权删除历史兼容逻辑。正式简化前应补一条无付费 Provider 的 Worker 集成测试。

## A2：移除未使用的手写 JSON Schema

在 A1 上继续删除 `posterDocumentJsonSchema`。

结果：

| 指标 | A1 + A2 |
|---|---:|
| 生产代码差异 | +7 / -115，净减 108 行 |
| 单元测试 | 45/45 |
| 生产构建 | 通过 |

判断：可以删除，或改为从 Zod 自动生成后由模型调用真实消费。当前手写对象零引用，并且没有完整描述 `PosterDocument` 的所有字段结构，属于无效的重复真源。

## 本地任务数据审计

只比较结构和 ID，不输出任务内容：

| 项目 | 数量 |
|---|---:|
| 本地任务 | 29 |
| 同时存在 Artifact 与 GenerationVersion 的任务 | 19 |
| 两种输出数量不一致 | 0 |
| 两种最新输出路径不一致 | 0 |
| 磁盘中的 `input` 与 `campaignBrief` 事实不一致 | 17 |
| `confirmedDocument.documentVersionId` 不在 `versions[].id` 中 | 13 |
| `visualMaster.sourceDocumentVersionId` 不在 `versions[].id` 中 | 9 |
| `artifact.documentVersionId` 不在 `versions[].id` 中 | 13 |

17 个事实差异全部来自历史任务新增的 `audience` 字段；读取时兼容层会补默认值。这不是当前产物错误，但说明两个事实真源会自然漂移。

后三项 ID 不一致也不一定是数据损坏：代码可能想区分“确认文案版本”和“生成结果版本”。问题在于两者都使用 `documentVersionId` 语义，且当前没有独立内容版本表或查询路径，导致关联含义无法从结构本身判断。

## 建议删减顺序

### P0：可以立即处理

1. 删除未使用的手写 `posterDocumentJsonSchema`；如果模型接口以后需要 JSON Schema，从 Zod 单向生成并增加消费测试。
2. 删除只包一层 `runCopyStage` 的 `runJob` 函数，API 直接调用 `runCopyStage`。

### P1：当前单竖版应简化，但先补测试

1. 明确当前阶段唯一运行真源为 `input + GenerationVersion`。
2. 暂停在单竖版 Worker 中双写 `ConfirmedCampaignDocument / VisualMaster / Artifact`。
3. 保留一次性读取迁移器，先不要删除历史兼容代码。
4. 增加一条 Worker 集成测试，覆盖创建、确认、生成、预览、下载、重新生图和失败降级，再应用 A1 补丁。
5. 四规格真正开始扇出时，一次性切换到 Campaign 模型；不要长期维持双写。

### P2：保留为设计资产，不要伪装成运行时能力

- `BrandSpec v1` 和四规格 `TemplateFamilyManifest` 当前主要由测试消费，T01 渲染器仍直接写死尺寸、色值和位置。二选一：让渲染器真正消费这些契约，或把它们明确放到 design/spec 层；不应继续称为已经生效的运行时契约。
- 横版、Banner、长图的 manifest 和 Fixture 可以保留为后续验收规格，但在对应渲染器出现前，不应进入当前单竖版任务状态。

## 不建议消掉的边界

| 边界 | 原因 |
|---|---|
| `provider-error` | 同时复用在文案、Prompt 和图片请求，统一了超时、重试和错误分类，并有边界测试。 |
| `session-token` | 把纯签名校验与 Next.js Cookie/Headers 隔离，能独立测试过期与篡改路径，是安全边界。 |
| `t01-readability` | 直接参与渲染和发布门，防止重要文字因背景不可读；属于产品约束，不是装饰抽象。 |
| `brand-header` | 负责正式 Logo、字体嵌入、反白 Logo 派生和失败阻断，并有资产测试。 |
| Provider 模块边界 | 当前只是轻量函数模块，并没有额外的接口/工厂层；供应商隔离是已锁定架构要求。 |
| Prompt sanitization | 会移除姓名、联系方式、精确地点、日期、链接和 Logo/二维码指令，属于隐私与安全边界。 |

第二次 LLM Prompt Compiler 是否必要，不能只靠编译消融判断。它同时已有确定性 fallback；若要继续验证，应使用同一批输入做盲评，比较图片合规率、可读性降级率、生成耗时和调用成本，再决定是否固定使用本地规则。

## 推荐目标形态

当前阶段：

```text
EmployeeActivityInput
  -> CopyDraft / confirmed PosterDocument
  -> GenerationVersion[]
  -> PNG
```

四规格实现后再切换：

```text
CampaignBrief
  -> ConfirmedCampaignDocument
  -> VisualMaster
  -> Artifact[]
```

关键不是永远删除 Campaign 模型，而是避免在只有一个真实 Artifact 时同时维护两套真源。
