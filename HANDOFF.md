# 九号行政智绘引擎｜当前切片 Handoff

最后更新：2026-09-04
当前分支：`codex/slice-demo`  
当前阶段：T01 四规格模板及 Demo 接入已实现；当前运行方式、验证范围和限制以第 18–19 节为准，前文阶段记录保留为历史背景。

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

当前 Demo 保留四步文案／视觉确认流程，并已增加 T01 横版、Banner 和长图。先完成竖版，再按需复用同一已生成素材排版其他规格；不再次调用模型。各规格状态、错误和下载资格独立记录。

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

上述 A1–A4 是 2026-09-03 的契约基线，当时仅渲染竖版；2026-09-04 用户授权扩展后，其他三规格的确定性模板和 Demo 输出入口已经接入，详见第 19 节。

资产盘点与接入：

- 已从 `/Users/ninebot/Desktop/assets/VI_MiSans_202604.zip` 提取
  MiSans Regular、Medium、Heavy OTF 到 `public/brand/fonts/`。
- 已从 `/Users/ninebot/Desktop/assets/02 Foundations/Design Foundations/Logo/`
  接入 `九号公司.svg` 与 `行政.svg`，分别保存为
  `public/brand/company-logo.svg` 与 `public/brand/administration-mark.svg`。
- 使用这些文件仅代表本次内部 Demo 技术接入；字体服务端渲染与分发授权说明仍需由资产所有方确认。

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
- Format：`portrait_1080x1920`、`landscape_1920x1080`、`banner_2227x950`、`longform_1080xAuto`
- 输出：PNG
- 模板：T01 活动模板族，四种规格分别投影字段
- 图片：一个受控主视觉资产
- 可选二维码：只接受确定性链接

当前不做：

- 其他三个一级场景。
- A4 和 150 × 80mm。
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
- Schema：`PosterDocument 1.7`（T01 增加不可改写的 `audience`）
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

Phase B｜T01 已按 Figma `191:2777` 空白母版和 `191:3642` 体育赛事案例完成实现；
已人工打开正常与二维码样张检查，但仍未获得设计方批准的视觉回归基线：

- `npm run typecheck`：通过。
- `npm run lint -- --quiet`：通过。
- `npm test`：38/38 通过。
- `npm run render:b2-review`：正常、缺可选字段、二维码与默认资产
  PNG 已输出为 1080 × 1920；两种多行标题与长文案按预期阻止导出。
- 已验证：无二维码样张不存在二维码 DOM、说明、CTA 条或箭头；有二维码样张
  使用 `x=864, y=1574, 144×144`，第三组文本列避让二维码安全区。

### 13.1 T01 C3a/C3b/E1a/E2a 可读性发布门（2026-09-03）

- src/templates/t01-readability.ts 在最终 object-fit: cover 裁切后声明并采样
  header、title、sessions、audience、participation、qr、footer。每区记录亮度
  P05/P50/P95、边缘密度、候选色的通过率与 P05 对比度。
- 发布门的像素样本来自浏览器实际文本 Range 的逐行包围区，而不是整块预留背景；
  这样不会因文字区内未使用的图像细节误触发降级。遮罩范围仍按完整声明区计算。
- Prompt Compiler 已升级为 illustration-brief-v4-t01-layout-contract：无论 LLM 返回什么
  composition，运行时都会写入同一份 T01 构图 contract。它强制原生 9:16、人物/道具仅在
  x=42–94%、y=30–66% 的中部活动带，顶部、底部信息、二维码和页脚为低纹理留白。
- treatment 仅可从 dark_text_clean、dark_text_light_scrim、
  light_text_dark_scrim、fallback_background 选择；遮罩强度仅为
  0 / 0.12 / 0.20 / 0.28 / 0.36，取最低通过档，不提供用户主题或自由遮罩控制。
- 22px 正文、18px 页脚/二维码说明按 4.5:1；28px 分组标题与 120px 标题按
  3:1。实现用每区 P05 必须达到对应阈值，且通过像素至少 95%，不以平均值放行。
- 遮罩以横向出血、上下长渐隐的局部雾化渐变实现；无圆角、描边、阴影和白色信息卡。
  时间/地点与参与对象在同一 treatment 时合并为一层，避免可见的叠层边界；
  参与方式、二维码说明和页脚保持独立选择。
- 当前秋日 Fixture 结果：顶部/标题/页脚 dark_text_clean@0，时间地点与参与对象
  dark_text_light_scrim@0.28，参与方式保持 dark_text_clean@0。
- 深色 header 会选择 light_text_dark_scrim@0 与 inverse 公司 Logo；inverse 版本从
  正式黑色 SVG 主文件的同一矢量路径生成，不使用 CSS filter。
- 品牌降级背景已改为 v2 极简底图：仅保留浅色基底与右下弱行政黄光晕，不再包含人物、道具或
  额外叙事内容；它只承担失败兜底。
- 若所有受控文字/遮罩候选均不达标，渲染器切换品牌降级背景并重新分析；降级背景仍失败时抛出
  brand.readability.contrast_failed，不写出 PNG。只有 validation.passed=true 的
  READY Artifact/Version 可由下载接口读取。每次结果将完整的 treatment、初始分析和合成后验证
  写入 Artifact 与 GenerationVersion。
- 多背景回归：浅色低纹理、深色低纹理、秋日高纹理、标题浅/正文深、标题深/正文浅、
  无法通过的棋盘背景和默认降级背景均已固定；每种背景重复渲染的 PNG SHA-256 一致。

本轮实际执行：

- npm run typecheck：通过。
- npm run lint -- --quiet：通过。
- npm test：44/44 通过。
- npm run render:b2-review：通过；既有标题/容量阻断行为保持。
- npm run render:t01-readability-review：7/7 背景类别通过，棋盘背景按预期触发品牌降级。
- 已人工打开秋日局部遮罩、反白 Logo 深色标题和失败背景降级的 1080 × 1920 PNG。

尚未验证：

- 尚未用新的 Seedream 实拍背景重新跑一次真实飞书端到端任务；当前多背景为固定 SVG 回归，
  真实秋日样张仍需设计方验收。
- 2026-09-03 已用新的 v4 layout / 纪实摄影 Prompt 发起一次真实 Seedream 探针：
  当前 `size: "2K"` 集成参数返回原生 `1600 × 2848` JPEG（约 9:16），
  最终使用输入背景通过；仅 sessions 区使用 `dark_text_light_scrim@0.12`，
  未触发 fallback。单次耗时约 38.6 秒。
- 该结果只证明本模型在本次请求中能响应竖版与安全区描述；模型没有暴露已验证的硬坐标、
  固定安全区、种子或确定性构图控制，仍须保留模板侧门禁并继续采样。
- 视觉门禁测量背景像素而非 OCR/字符覆盖率；极端字形抗锯齿与第三方图片解码差异尚未纳入。

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

- B2 只实现 `portrait_1080x1920`；横版、Banner 和长图仍只有 Manifest，
  未开始视觉精修。
- B2 使用全幅背景、MiSans Regular/Semibold、公司 Logo 左 / 行政标识右、
  标题最多一行、固定二维码区和浅色品牌降级背景，但尚未完成设计方人工视觉评审。
- 当前图片模型仍使用方形 2K 输出；Prompt 已要求 9:16 的中右主体和左侧
  信息安全区，真实模型的比例参数仍待供应商能力与设计方确认。
- 当前品牌校验仍以模板资产可用、字体加载、标题三行和正文容量为主；
  尚未接入 OCR / 像素级品牌校验。

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

- [x] 从 MiSans 压缩包提取本切片实际使用的 Regular / Medium / Heavy 字重。
- [ ] 确认字体服务端渲染授权说明。
- [x] 找到公司 Logo 与行政标识正式源文件；公司反白版由同一正式 SVG 矢量主文件生成，
  但独立的品牌签发反白资产尚未提供。
- [x] 实现共享 Brand Header；字体或任一标识未加载时阻止渲染。

### P1：B2 竖版正式切片

- [x] 只实现 `portrait_1080x1920` 全幅背景切片。
- [x] 用 A4 Fixtures 生成首批评审 PNG（`npm run render:b2-review`）。
- [x] 检查 MiSans、双标识、H0 标题、标题三行、安全区、二维码和正文容量。
- [ ] 设计方完成 B2 竖版视觉评审；通过前，不批量精修横版、Banner 和长图。

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

## 18. 2026-09-04 视觉流程执行记录

- 改版前回退点：提交 `6b9008f57f3d988499b9cda94b1eaaee41e51c2f`，标签 `checkpoint-2026-09-04-pre-ui-visual-split`。
- 已按原型 HTML 接入浅色三栏工作台、四步进度、分步文案/视觉确认、真实质量状态和 T01 竖版预览。
- 已新增视觉阶段状态与 `refine-visual`、`confirm-visual` 接口；文案确认不再提前调用图片模型。
- 已新增 `READABILITY_MODE=strict|trial`，输出记录 `exportAllowed` 与策略；试用策略保留可读性警告，不把警告改写为通过。
- 二维码图片上传仅为前端待办入口，未上传图片字节；后端仍只接受 HTTP(S) URL。
- Prompt Compiler 已将用户创意与 T01 固定构图约束分离，系统约束只在最终图片 prompt 注入一次；视觉确认支持 420 字，图片调用前执行最终 prompt Schema 与真实字体/模板容量预检。
- 文案确认会把编辑后的补充说明投影到 T01 顶部说明，规则/奖品不再被原始输入覆盖；选填内容全空时跳过文案模型且不生成兜底副标题。
- JSON 任务存储已改为单进程串行 read-modify-write + 临时文件原子替换，视觉动作使用串行幂等认领；试用导出按具体版本 `exportAllowed ?? passed` 判定。
- 已执行：`npm run typecheck`、`npm run lint`、`npm test`（45/45）、`npm run build`、`npm run render:t01-readability-review`（4/4），并人工查看高纹理 T01 PNG。桌面/手机完整浏览器流程、真实飞书生图下载、第二用户越权和真实付费图片调用尚未完成。
- 当前稳定修复提交：`7a8f183`（`fix: stabilize demo workflow and trial export`）；回退使用 `checkpoint-2026-09-04-pre-ui-visual-split` 标签，未配置远端，不执行推送；`tmp/`、`data/jobs.json`、生成 PNG 与密钥均不纳入提交。
- 远端核对：当前仓库未配置 `origin`，未执行推送；`tmp/` 未纳入回退提交。

## 19. 2026-09-04 T01 四规格接入

- 已按精确 Figma 节点接入：竖版 `191:2777`；横版 `191:3112`／案例 `191:3677`；Banner `191:3138`／案例 `191:3708`；长图 `191:3158`。新增模板版本 `t01-figma-2026-09-04-v1`，不覆盖原竖版模板。
- 结果区增加四规格选择、独立生成／重试、实际 PNG 预览与下载。其他规格必须基于已完成且允许导出的竖版；复用该版本确认内容和主视觉，只裁切／排版，不调用文案或图片模型。横向裁切可能改变主体呈现，尚不为每规格重生图。
- `GET/POST /api/jobs/:jobId/formats` 使用任务所有者校验。认领时冻结来源文档；同内容版本、视觉族、模板版本和规格复用未失败 Artifact，失败重试创建新项。一个规格失败不影响已完成规格。
- 横版展示标题、说明、全部场次、参与对象及规则；Banner 展示标题、全部场次与对象组成的核心信息及说明。长图还展示截止、联系人、规则分段和条件二维码；奖品仍无独立槽位。未投影字段继续保存，详见 `docs/TEMPLATE_FIELD_MATRIX_2026-09-04.md`。
- 固定规格按真实文本容量阻止溢出，不截断事实或静默缩字。长图使用独立图片槽和文档流，高度 1920–12000，空组隐藏。横版／Banner 采样实际文字区背景对比度；长图文字使用固定纯色区域，**未执行背景像素对比度采样**，不能将其检查通过解释为完整视觉质量通过。
- 本轮验证记录：执行 agent 报告 48 项测试通过，`scripts/render-t01-formats.ts` 成功渲染新增三规格；空长图 1920、长正文样例 4189，超长标题被阻止。长图独立样例约 3000，已人工查看 PNG。真实飞书会话中的完整四规格下载与多用户隔离仍需联调；这些记录不代表部署或推送已完成。

## 20. 2026-09-04 Demo 可读性观察模式

- 用户决定在当前 Demo 暂停两项自动视觉干预：图片生成成功后的整张背景替换，以及局部背景遮罩。最终 PNG 保留图片模型返回的原始背景；只允许按原图选择深色或浅色文字与对应 Logo。
- 可读性采样和记录仍保留。`READABILITY_MODE=trial` 下，图文对比度不通过会以“文字与背景对比度待优化”警告呈现，并允许作为试用稿预览／下载；不得把警告写成通过。`strict` 下仍阻止不通过的导出，但同样不再自动换底图或加遮罩。
- 图片模型本身失败时，默认品牌资产降级仍保留，且必须明确记录为图片生成失败；这与“图片已生成但文字不可读”的设计评审样张不同。
- 该观察模式用于和设计同学共同定位真实可读性问题，不是最终品牌发布标准。恢复自动干预前必须以新的模板／设计决策和视觉回归确认。
