# 九号行政智绘引擎｜当前切片 Handoff

最后更新：2026-09-03  
当前分支：`codex/slice-demo`  
当前阶段：员工活动 P0 A1–A4 已完成，准备接入正式资产并进入 B2 竖版视觉切片

## 1. 当前结论

项目继续采用已经锁定的生成方式：

```text
结构化表单
  -> DeepSeek 生成结构化文案
  -> 用户确认或修改允许编辑的文案
  -> DeepSeek 编译受控视觉 Prompt
  -> Seedream 生成无文字主视觉
  -> HTML/CSS 固定模板组合
  -> Playwright 输出 PNG
  -> 内容与品牌规则校验
```

当前 Demo 已证明这条链路可行。现阶段不继续扩展场景和模板数量，等待正式模板后再进行视觉与字段协议精修。

## 1.1 2026-09-03 P0 契约进度

已完成：

- A1：BrandSpec v1 运行时契约，锁定 `#FAE24C`、MiSans、
  H0 120px、H1 80px、标题最多三行及公司 Logo 左/行政标识右。
- A2：四规格 TemplateFamily Manifest，记录尺寸、自动高度、安全区、
  模块投影、焦点区、双标识区、二维码区和溢出策略。
- A3：引入 `CampaignBrief`、`ConfirmedCampaignDocument`、
  `VisualMaster` 和 `Artifact`；现有单竖版链路继续兼容。
- A3 兼容验证：本地 15 条历史任务均可迁移读取。
- A4：建立正常、三行标题边界、标题超限、缺可选模块、二维码、
  长正文和图片降级七类四规格 Fixture。

已锁定默认物料包：

```text
portrait_1080x1920
landscape_1920x1080
banner_2227x950
longform_1080xAuto
```

当前运行时仍只实际渲染原有竖版；A1–A4 是多规格契约与可复现基线，
不是四规格视觉模板已经完成。B2 竖版通过视觉评审前，不批量精修横版、
Banner 和长图。

资产盘点：

- `/Users/ninebot/Desktop/assets/VI_MiSans_202604.zip` 包含 MiSans
  TTF/OTF 多字重文件。
- 截至 2026-09-03，本次文件扫描未在 `/Users/ninebot/Desktop/assets`
  中发现独立 Logo 文件；开始 B1 前需要再次确认 Logo 的实际文件名或位置。

## 2. 场景与模板的产品理解

最终产品不应为每个子场景复制一套页面代码，而应使用配置驱动：

```text
场景配置
  = 字段协议
  + 必填/选填规则
  + 不可改写字段
  + 文案 Prompt
  + 视觉 Prompt / StylePack
  + 允许的输出 Format
  + 模板 ID
  + 校验规则
```

推荐关系：

- 一级场景：员工活动、员工福利、员工通知、调查问卷。
- 二级场景：节日活动、安全活动、差旅活动、竞赛活动、俱乐部活动等。
- 相近子场景共享表单渲染器、内容模块和 HTML 母版。
- 只有信息结构、模块组合或视觉层级明显不同时，才新增模板。
- 用户不选择任意版式，不使用自由画布。

## 3. 当前切片范围

当前只开放：

- 场景：`employee_activity`
- 语言：`zh-CN`
- Format：`portrait_1080x1920`
- 输出：PNG
- 模板：一个临时员工活动模板
- 图片：一个受控主视觉资产
- 可选二维码：只接受确定性链接

当前不做：

- 其他三个一级场景。
- 横版、Banner、长图、A4 和 150 × 80mm。
- PDF、多语言和自由画布。
- 模板上传后台。
- 多维表格同步。
- PostgreSQL、Redis/BullMQ 和生产部署。

## 4. 已完成的生成能力

### 4.1 两阶段生成

原来的一键生成已拆分为：

1. 用户提交活动信息。
2. DeepSeek 生成结构化文案。
3. 任务进入 `READY_FOR_COPY_REVIEW`。
4. 用户确认或修改标题、副标题、摘要、活动亮点和参与方式。
5. 用户确认后才调用图片模型。
6. 生成主视觉、合成模板并输出 PNG。

这样可以避免用户尚未确认文案时产生图片费用。

### 4.2 不可改写字段

以下字段在模型调用前后逐字段比较：

- 输出 Format。
- 场次。
- 日期。
- 时间。
- 地点。
- 注意事项。
- 联系方式。
- 是否启用二维码。
- 二维码链接。
- CTA 文案。

模型修改这些字段时，不允许进入渲染器。

### 4.3 视觉 Prompt

当前会进行第二次 DeepSeek 调用，生成结构化插画 Brief：

```text
subject
action
setting
composition
palette
style
mood
negative
```

调用前会移除：

- 员工姓名和联系方式。
- 精确内部地点。
- 日期和时间。
- 报名链接。
- Logo、二维码和海报正文。

固定负向约束：

```text
不要文字、字母、数字、Logo、二维码、水印、签名
```

视觉 Brief LLM 失败时，会使用本地规则生成 Brief，不阻塞图片阶段。

当前限制：视觉 Prompt 使用用户最初填写的 `visualIntent`、活动类型和主题关键词，不读取用户在文案确认阶段修改后的标题与摘要。

### 4.4 Seedream

已接入：

- Provider：`seedream`
- Model：`doubao-seedream-5-0-260128`
- 服务：火山方舟北京区域

实现了：

- 90 秒超时。
- 429/临时 5xx 有限重试。
- URL 或 Base64 响应解析。
- 临时 URL 立即下载。
- 图片失败使用默认品牌资产。
- 结果明确记录 `generated` 或 `fallback`。
- 图片扩展名与实际文件格式匹配。

曾发现 Seedream URL 返回 JPEG，但旧实现统一保存为 `.png`；该问题已修复。

### 4.5 固定模板渲染

当前模板继续使用受控 HTML/CSS：

- Logo、正文、日期、地点和二维码不由图片模型生成。
- Playwright 等待字体与资源后截图。
- 输出固定为 1080 × 1920 PNG。
- 每个版本记录模板、Prompt、模型、图片资产、输出路径和校验结果。

### 4.6 只换主视觉

结果页已增加“只换主视觉”：

- 保留已确认文案。
- 保留模板与 Format。
- 只重新执行视觉 Brief、生图、渲染和校验。
- 创建新版本，不覆盖历史版本。

## 5. 已修复的体验问题

多行列表字段原来在用户按回车时立即过滤尾部空行，导致无法输入第二行。

已修复：

- 活动亮点支持回车输入多条。
- 参与方式支持回车输入多条。
- 场次补充说明支持回车输入多条。
- AI 文案确认阶段的列表字段支持回车。
- 空行和首尾空格只在提交时清理。

已增加相应单元测试。

## 6. 主视觉与完整底图的讨论结论

当前实现把图片放在固定 `.hero` 区域。

正式模板也可以改成 AI 图片铺满整张海报：

```text
AI 生成 9:16 无文字完整背景
  -> CSS 铺满 1080 × 1920
  -> 主要人物或核心视觉集中在指定焦点区
  -> 文字、Logo、二维码按固定规则叠加
```

正式模板应明确选择：

- `hero_slot`：图片只在局部主视觉槽位。
- `full_bleed_background`：图片作为完整底图。

如果使用完整底图，需要补充：

- 模型支持的竖版生成比例。
- 主视觉焦点区域。
- 标题和正文安全区。
- Logo 与二维码禁入区。
- `cover` 裁切策略。
- 渐变、遮罩或半透明信息卡。
- 对应的默认降级背景。

该能力尚未实现，等待正式模板决定。

## 7. API 联调状态

### 7.1 DeepSeek

已真实验证：

- Provider：`deepseek`
- Model：`deepseek-chat`
- Schema：`PosterDocument 1.6`
- JSON 可解析。
- Zod 校验通过。
- 不可改写字段保持一致。
- 单次探针约 2 秒，实际耗时受网络影响。

### 7.2 Seedream

已真实验证：

- Provider：`seedream`
- Model：`doubao-seedream-5-0-260128`
- 成功生成并下载 2048 × 2048 主视觉。
- 本地 OCR 未识别出文字候选。
- 探针约 42 秒，实际耗时受模型服务影响。

### 7.3 真实端到端任务

已跑通：

```text
QUEUED
  -> VALIDATING_INPUT
  -> GENERATING_COPY
  -> READY_FOR_COPY_REVIEW
  -> GENERATING_ASSET
  -> RENDERING
  -> VALIDATING_OUTPUT
  -> READY_FOR_REVIEW
```

验证结果：

- `copyProvider = deepseek`
- `imageProvider = seedream`
- `assetMode = generated`
- 输出为真实 1080 × 1920 PNG
- 内容校验通过
- 预览下载接口成功
- 用户实际测试了生成与“只换主视觉”链路

## 8. Provider 与错误处理

已实现：

- 浏览器不直接访问模型供应商。
- 密钥只由服务端读取。
- 外部响应先作为未知数据解析，再进入领域层。
- DeepSeek 非法 JSON/Schema 结果允许重试一次。
- 401/403 不自动重试。
- 429 和临时 5xx 有限重试。
- 图片失败时使用默认资产。
- 稳定项目错误码，不向浏览器暴露堆栈和密钥。
- 创建任务及后续动作都有幂等键。

已增加独立探针：

```bash
npm run probe:copy
ALLOW_PAID_MODEL_PROBE=1 npm run probe:image
```

图片探针必须显式设置付费确认变量。

## 9. 飞书局域网接入

### 9.1 当前模式

当前 `.env.local` 已切换为：

```text
AUTH_MODE=feishu
NEXT_PUBLIC_APP_URL=http://10.6.4.183:3000
FEISHU_REDIRECT_URI=http://10.6.4.183:3000/api/auth/feishu/callback
```

以下配置已存在，但不应写入文档或 Git：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `SESSION_SECRET`

`.env.local` 已被 `.gitignore` 排除。

当前局域网入口：

```text
http://10.6.4.183:3000
```

局域网 IP 可能随网络变化，重新连接网络后需要重新确认。

### 9.2 已实现的飞书能力

已安装官方 SDK：

```text
@larksuiteoapi/node-sdk 1.73.1
```

已实现：

- `GET /api/auth/feishu/start`
- `GET /api/auth/feishu/callback`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- OAuth 一次性 `state` 校验。
- 使用 SDK OAuth v3 Token 交换。
- 通过 user access token 获取基础用户信息。
- 使用 `tenant_key + open_id` 作为稳定内部用户 ID。
- 签名 HttpOnly、SameSite=Lax Session Cookie。
- 不保存 user access token。
- 页面未登录时跳转飞书授权。
- 任务创建、查询、文案确认、重新生图和 PNG 下载均校验任务所有者。

HTTP 局域网模式下 Cookie 无法启用 `Secure`；迁移到 HTTPS 后代码会自动启用。

### 9.3 已验证

已验证：

- 首页返回 307 到飞书登录入口。
- 登录入口正确跳转到 `accounts.feishu.cn`。
- Authorization URL 包含 App ID。
- Authorization URL 包含一次性 `state`。
- 回调地址正确指向局域网：

```text
http://10.6.4.183:3000/api/auth/feishu/callback
```

- 局域网 IP 的 3000 端口可以从本机访问。
- 用户反馈飞书应用权限申请已成功。
- 已从飞书工作台完成真实交互式授权。
- OAuth 回调成功并设置 Session。
- 登录后首页正常返回，用户已确认可在飞书内打开应用。

尚未完成最终验证：

- 使用飞书身份完成一条新的端到端生成任务。
- 使用第二位飞书用户验证任务与 PNG 越权隔离。

### 9.4 飞书后台应配置

```text
桌面端主页：
http://10.6.4.183:3000

移动端主页：
http://10.6.4.183:3000

重定向 URL：
http://10.6.4.183:3000/api/auth/feishu/callback

H5 可信域名：
http://10.6.4.183:3000
```

同时需要：

- 网页应用能力。
- 测试用户加入应用可用范围。
- 测试版本已发布。
- 如果准备接结果通知，开启机器人能力。
- 结果通知最小权限：`im:message:send_as_bot`。

### 9.5 本地绕过飞书

不修改 `.env.local`，临时使用本地免登录模式：

```bash
AUTH_MODE=local npm run dev
```

恢复飞书模式：

```bash
npm run dev
```

当前服务启动时使用 `.env.local` 的 `AUTH_MODE=feishu`。

### 9.6 飞书尚未接入

- 机器人生成完成通知。
- 结果消息卡片。
- 飞书事件订阅。
- 卡片动作回调。
- 多维表格同步。

建议下一步只增加机器人主动完成通知，不接收用户消息，也不增加事件回调。

## 10. 当前 UI 与接口

主要页面：

```text
/
```

生成接口：

```text
POST /api/jobs
GET  /api/jobs/:jobId
POST /api/jobs/:jobId/confirm-copy
POST /api/jobs/:jobId/regenerate-asset
GET  /api/files/:filename
```

飞书身份接口：

```text
GET  /api/auth/feishu/start
GET  /api/auth/feishu/callback
GET  /api/auth/session
POST /api/auth/logout
```

## 11. 正式模板到达后必须确认

不要在模板到达前自行猜测以下内容：

- 具体员工活动二级场景。
- 必填字段与可选字段。
- AI 可编辑字段与不可改写字段。
- 标题、副标题、正文和规则最大字数。
- 模板 ID 与版本。
- Logo 和行政标识的版本、位置、尺寸与安全区。
- 主视觉是局部槽位还是完整底图。
- 主视觉焦点和文字安全区。
- 固定模块和可选模块组合。
- 二维码位置、尺寸、安全区和无二维码状态。
- 缺失字段时的重排方式。
- 字号、换行、溢出和最小字号。
- 默认降级主视觉与背景资产。

收到正式模板后的顺序：

1. 确认二级场景。
2. 拆解模板槽位与模块。
3. 确认字段协议。
4. 更新 Zod Schema 和 Fixture。
5. 实现正式 HTML/CSS。
6. 接入正式 Logo、字体、品牌色和默认资产。
7. 调整视觉 Prompt 和图片比例。
8. 建立视觉回归基线。
9. 完成正常、长文本、缺字段和图片失败测试。
10. 再进行一次真实端到端验证。

## 12. 已收到但尚未正式应用的品牌基础

| 类型 | 当前输入 |
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

当前海报仍为临时视觉，不应被视为正式品牌模板。

## 13. 质量检查

最近一次检查：

- TypeScript 类型检查：通过。
- ESLint：通过。
- 单元测试：34 项通过。
- 15 条历史任务 Campaign 迁移读取：通过。
- Next.js Build：本轮 A1–A4 未重新执行。
- DeepSeek 真实探针：通过。
- Seedream 真实探针：通过。
- 真实两阶段端到端任务：通过。
- 输出 PNG 尺寸检查：1080 × 1920。

本轮只完成 A1–A4 契约和 Fixture，未开始 B2 模板实现，因此没有建立或更新正式视觉基线，也未重新执行 `render:fixture`。

## 14. 已知风险与限制

### Demo 技术限制

- 任务仍保存在本地 JSON 文件。
- Worker 仍与 Web 在同一应用进程。
- 本地任务存储没有数据库级原子并发保护。
- 生成文件保存在本地磁盘。
- 局域网电脑关机或进程退出后服务不可用。
- 局域网 IP 变化会使飞书配置失效。
- 当前没有任务历史页面和正式版本管理 UI。

### 视觉限制

- BrandSpec v1 与四规格 Manifest 已锁定，正式 HTML/CSS 尚未实现。
- MiSans 字体包已找到，但字体文件和授权说明尚未接入项目。
- 独立 Logo 文件位置仍待确认。
- 当前品牌校验仍是基础内容检查。
- 全幅背景模式已进入契约，但尚未实现。
- 当前图片模型仍使用方形 2K 输出，正式竖版背景需要调整比例。

### 飞书限制

- 真实 OAuth 登录已验证，但尚未完成第二用户越权测试。
- 尚无机器人结果通知。
- HTTP 局域网模式不具备 HTTPS 的 Cookie 和传输保护。
- 仅适合脱敏测试数据和小范围联调。

### 依赖安全

`npm audit --omit=dev` 当前报告：

- 4 项 high。
- 1 项 moderate。
- 0 项 critical。

主要涉及当前 Next/PostCSS、Playwright 和 Sharp 依赖链。未执行自动强制升级，以免在 Demo 联调阶段引入 Next 主版本破坏。进入公网或生产试点前必须单独升级和复测。

## 15. Git 与回退

已存在两个回退点：

```text
93c7a91
snapshot-2026-09-02-pre-slice
执行前基线

ab9b5c3
checkpoint-2026-09-02-api-slice
两阶段文案与图片切片

8987344
A1 BrandSpec v1

ebd495f
A2 四规格 TemplateFamily Manifest

8b559a7
A3 Campaign/Bundle 契约

a82bd84
A4 四规格 Fixture

7dc21a4
A3 历史任务兼容修复
```

当前分支：

```text
codex/slice-demo
```

当前工作区不是干净状态。以下修改尚未提交：

- 多行输入换行修复及测试。
- 飞书 OAuth、Session 与身份权限隔离。
- 飞书官方 SDK 依赖。
- 局域网配置文档。
- `.env.example`。
- Next.js 局域网开发来源配置。

用户之前明确要求多行输入修复“不用提交，修复就好”，因此没有为上述后续修改创建新的 Git checkpoint。

查看相对已验证切片的变化：

```bash
git diff checkpoint-2026-09-02-api-slice
git status --short
```

不要在未确认的情况下执行：

```text
git reset --hard
git clean
```

这些命令可能删除当前尚未提交的飞书与体验修复。

## 16. 关键文件

### 契约与任务

- `src/contracts/poster.ts`
- `src/contracts/job.ts`
- `src/worker/run-job.ts`
- `src/server/job-store.ts`

### 模型

- `src/providers/copy-provider.ts`
- `src/providers/prompt-compiler.ts`
- `src/providers/illustration-provider.ts`
- `src/providers/provider-error.ts`

### 模板与界面

- `src/templates/employee-activity.ts`
- `src/components/activity-studio.tsx`
- `src/components/multiline-fields.ts`

### 飞书

- `src/integrations/feishu/client.ts`
- `src/integrations/feishu/auth.ts`
- `src/integrations/feishu/session.ts`
- `src/integrations/feishu/session-token.ts`
- `src/integrations/feishu/README.md`
- `src/server/auth.ts`
- `src/app/api/auth/`

### 计划与记录

- `task.md`
- `docs/PHASE1.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRACTS.md`

## 17. 下一步优先级

### P0：B1 正式资产接入

- [ ] 从 MiSans 压缩包提取本切片实际使用的字重。
- [ ] 确认字体服务端渲染授权说明。
- [ ] 找到公司 Logo 与行政标识正式源文件及颜色/反白版本。
- [ ] 实现共享 Brand Header；字体或标识未加载时阻止渲染。

### P1：B2 竖版正式切片

- [ ] 只实现 `portrait_1080x1920` 全幅背景切片。
- [ ] 用 A4 Fixtures 生成首批评审 PNG。
- [ ] 检查 MiSans、双标识、H0/H1、标题三行、安全区和二维码。
- [ ] 竖版通过视觉评审前，不批量精修横版、Banner 和长图。

### P2：飞书结果通知

- [ ] 确认机器人能力与 `im:message:send_as_bot` 已生效。
- [ ] 生成完成后向创建者 `open_id` 发送结果卡片。
- [ ] 卡片只提供状态、摘要和“查看海报”链接。
- [ ] 通知失败只记录并重试，不改变核心任务状态。

### P3：补齐验证

- [ ] 使用飞书用户完成一条新的端到端生成任务。
- [ ] 使用第二位飞书用户验证任务与 PNG 越权隔离。
- [ ] DeepSeek 改写不可变字段的 Mock 测试。
- [ ] Seedream 失败降级测试。
- [ ] 同输入同模板的确定性结构测试。
- [ ] 飞书 Session 缺失、篡改、过期和越权 API 测试。
- [ ] 正式模板正常、长文本、缺字段和视觉回归测试。
