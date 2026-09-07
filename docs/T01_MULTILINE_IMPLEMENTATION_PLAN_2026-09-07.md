# T01 多行标题与副标题自适应：Luna 执行计划

## 目标与执行基线

将 T01 竖版标题从单行改为受控多行，副标题随标题实际高度下移，间距恒定。沿用 HTML/CSS + Playwright 确定性渲染，不需要新模型、服务或数据库迁移。

本计划基于 2026-09-07 实际读取：分支 `codex/update-image-generation-logic`，HEAD `03a3fef`，当时工作区干净。执行前重新核对分支及用户更改，不切回旧的 `codex/slice-demo`。本轮仅新增本计划，尚未实施或部署。

设计来源：https://www.figma.com/design/HOcHU5gCOtyWPREqAEL04s/智慧引擎AI?node-id=325-317

执行前遵循 AGENTS.md，阅读 README.md、HANDOFF.md、docs/ARCHITECTURE.md、docs/CONTRACTS.md。结构查找优先 CodeGraph；重新读取 Figma 前加载 figma-design-to-code 技能，中文排版实现时加载 apply-chinese-typesetting 技能。

## 已核对的设计与差距

| 项目 | 当前实现 | 新 Figma / 本轮决定 |
|---|---|---|
| 画布 | 1080 × 1920 | 保持 |
| 标题 | 宽 690、高 144；120px / 600 / 1.2；最多一行 | 节点 387:710：120px / Semibold / 1.2，高度随内容增长；示例为三行 |
| 标题区宽度 | 标题 690、副标题 720 | 节点 387:709：1080 宽容器，两侧 padding 80，内容宽 920 |
| 标题到副标题 | margin-top 25px | 同一纵向 Auto Layout，gap 13px |
| 副标题 | 28px / 400 / 1.45，固定高 82 | 节点 387:711 同字号行高，自然高度 |
| 上部位置 | 标题 x=81、y=223 | 新稿上层 x=-1；标题内容约 x=79、y=222.518。实现按节点测量，避免凭旧坐标猜测 |
| 入口限制 | 最多 5 字 | 取消“5 字等于一行”的容量代理，采用有限输入长度 + 浏览器实际行数校验 |

设计截图证明支持三行，未定义无限行数。本计划建议第一版支持 **1–3 行**，第四行阻止生成；这是执行策略，不声称是设计方已明确规定的最大值。副标题保留现有 40 字业务上限，建议最多两行；自然换行不等于要求模型插入换行符。

新稿另外调整了底部信息组（时间/地点分开）、32/24px 字号、二维码 150px 及位置、页脚和 Logo 边距。这些属于额外差异，本轮不直接照搬整张新稿，也不改业务字段投影。交付应说明“标题区同步”，不能宣称整张海报已完全同步新 Figma。示例网球背景不替换运行时生成资产。

## 按顺序实施

### 1. 统一模板容量与版本

- [ ] 在现有模板元数据附近建立可共享的纯数据布局配置：标题宽 920、字号 120、行高 144、最多 3 行；副标题宽 920、字号 28、行高 40.6、gap 13。避免 UI、API、渲染器重复硬编码。
- [ ] 修改 `src/templates/employee-activity.ts` 的 employeeActivityTemplate 与 `src/templates/activity-template-family.ts` 的竖版 Manifest，使声明一致；更新 Figma 来源为 325:317 / 387:709。
- [ ] 升级竖版 templateVersion，例如 `1.3.0-t01-multiline`，核查 `src/worker/run-job.ts` 输出版本记录。新生成结果使用新版本；历史 JSON、图片及校验结论保持不可变。
- [ ] 横版、Banner、长图容量各自保留。不要把所有 titleMaxLines 全局替换成 3。

### 2. 打通输入到校验的路径

涉及 `src/contracts/poster.ts`、`src/app/api/jobs/route.ts`、`src/components/activity-studio/activity-studio-model.ts`、`src/components/activity-studio/steps/step-one.tsx`。

- [ ] 移除 T01 特有的 5 字拦截和说明。建议 T01 入口使用与 PosterDocument.title 一致的 40 字安全上限；40 字不是保证能排下三行，UI 必须明确“最多三行，实际排版校验为准”。保留超长输入在模型调用前拒绝。
- [ ] 不扩大通用领域约束到无限长度；核对 activityName 的 48 字通用上限与 T01 入口/模型输出 40 字之间的边界，避免进入模型后才因 Schema 失败。
- [ ] 主题仍是不可改写事实，不允许 AI 为了排下而缩写、删字或修改标题。自然换行交给 CSS，第一版不增加手工换行编辑器。
- [ ] 检查 `src/providers/copy-provider.ts` 相关提示和输出校验。副标题 40 字限制继续生效，不要因标题多行而放开 summary 上限或让 AI 控制版式。

### 3. 使用真实内容流排版

修改 `employeeActivityPosterMarkup`：保留标题区整体锚点，内部改为纵向 flex，`gap: 13px`；标题与副标题 `margin: 0; height: auto; flex-shrink: 0`，移除这两个文本槽的裁切。标题、副标题共用 920px 内容宽度。

布局关系：`subtitle.top = title.top + title.height + 13`。不能继续固定标题高 144，也不要逐行计算并手工写副标题 top。

- [ ] 标题使用自然换行，移除当前 `text-wrap: balance` 对分行的干预，以匹配 Figma 顺序填充的三行示例；保留中文禁则，英文长词应能受控折行。
- [ ] 副标题为空时不输出空段落，也不保留 gap。修正现有 `document.subtitle || document.summary` 回退：补充说明不能偷偷变成副标题。
- [ ] 两三行标题只推动副标题；底部业务信息、二维码不随标题整体下移。
- [ ] 字号、字重、行高不随标题长度缩小；不使用 line-clamp、ellipsis 或 overflow:hidden 静默解决超限。

### 4. 同步预检、溢出与可读性

核心入口为 `preflightEmployeeActivity` 和 `renderEmployeeActivity`，两者已经复用 `assertLayoutCapacity`。应在共享函数里完成修改，防止预检与正式渲染出现不同结论。

- [ ] 将 `titleLineCount > 1` 改为读取模板最大行数，继续通过字体加载后的 Range 实测；过滤空矩形并处理亚像素差异。保留稳定错误码 `brand.title.max_lines`，错误文案改为最多三行。
- [ ] 副标题取消固定高度后，scrollHeight 不再能判断全部容量；新增实际行数检查、标题区边界检查和与底部信息/Logo/二维码的碰撞检查，错误继续阻止输出。
- [ ] 明确标题区最大占用：按三行标题 + gap + 两行副标题约 526.2px，结合实际锚点记录安全区；不能只检查是否越出整张画布。
- [ ] 当前 analyzeBackground / analyzeAppliedTreatment 已按文本 Range 采样，复用该机制覆盖全部新增行。核查 `src/templates/t01-readability.ts` 静态 bounds 和报告中的区域边界，不让旧的单行区域造成误导。
- [ ] 核对现有构图约束（从 illustration-provider.ts 引用的配置追踪）是否仍按单行预留空间；必要时只更新代码控制的文字留白区。用户确认的视觉描述保持不变，不新增视觉模型复核。
- [ ] strict/trial 都必须拦截容量失败；trial 仅保留既有可读性警告机制。确认超限标题在图片模型调用前被 preflight 拦截。

### 5. 多规格与历史兼容

- [ ] 长标题可能通过竖版却不适合横版/Banner。核查 `src/server/t01-format-service.ts`、`src/templates/t01-extra-renderer.ts`，保持按 Artifact 独立失败及明确容量错误；不能缩写共享标题，也不能使已通过竖版失效。
- [ ] 历史产物继续可读，新生成/重渲染使用新输出版本。此次不批量重新生成历史任务。
- [ ] 此项只包含本地实施及验收。线上同步须按现有部署文档发布新代码并冒烟验证；本计划未核查线上运行版本，也未授权 Luna 自动发布。

## 必须交付的验证

- [ ] 更新 `tests/unit/poster.test.ts`、`create-job-route.test.ts`、`brand-assets.test.ts` 中旧的 5 字/一行断言；保留更长输入拒绝、字段不可改写断言。
- [ ] 更新 `tests/fixtures/campaign-bundle.ts`：原 title-three-lines 从拒绝改为符合实测的成功；title-overflow 明确产生第四行，不能只凭 Fixture 名称判断。
- [ ] 增加真实 Chromium 排版用例和 PNG：单行、双行、三行、四行拒绝；三行+两行副标题；空副标题但有 summary；中英数字标点及长英文；有/无二维码。
- [ ] 对所有成功用例测量副标题与标题元素框间距 `13px ± 1px`，不以字形墨迹边缘代替行盒；输出仍为 1080×1920，底部信息锚点不漂移。三行标题高度应约 432px。
- [ ] 使用新 Figma 示例标题“赛事主题赛事主题赛事主题赛事主题”核对三行断行；用现有品牌字体生成截图，人工检查中文禁则、缺字、无遮挡和全部正文可见。
- [ ] 测试超限在图片调用前失败且无图片调用；三行竖版成功后横版容量失败只影响对应 Artifact；历史输出版本不被覆盖。
- [ ] 执行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run render:b2-review`、`npm run render:t01-readability-review`，以及新增多行渲染脚本/浏览器测试。对因文字位置变化而改变的对比度结果检查像素后再调整预期，不能盲目重置基线。
- [ ] 更新 HANDOFF.md、docs/CONTRACTS.md、docs/ARCHITECTURE.md 中 T01 单行/5 字及版本说明，搜索清理其余过时描述。

Luna 完成后报告：修改文件、最终容量策略、实际测试结果、PNG 路径、未验证项和部署状态。无需调用付费模型来验证纯排版逻辑；使用 Fixture 和本地背景即可。

## 执行记录（2026-09-07）

- 已完成本地实现：共享 `t01-portrait-layout.ts`；竖版模板版本 `1.3.0-t01-multiline`；标题 40 字输入上限、120px/1.2、920px 内容宽、最多三行；副标题最多 40 字、最多两行，空值不输出槽位；标题与副标题行盒间距 13px。
- 已完成预检与渲染门禁：加载 MiSans 后用 Chromium Range 实测行数、标题区边界、间距和正文容量；四行标题返回 `brand.title.max_lines`，strict/trial 均在图片调用前阻断。横版、Banner、长图容量保持原策略。
- 已完成 Fixture 与测试：Figma 示例标题三行成功；四行标题、长正文按预期阻断；新增真实 Chromium 测试覆盖单/双/三/四行、三行+两行副标题、空副标题、间距和输出尺寸。
- 已完成检查：`npm run typecheck`、`npm run lint`、`npm test`（81 项）、`npm run render:b2-review`、`npm run render:t01-readability-review`、`npm run build` 均通过。三行 PNG：[b2-review-title-three-lines.png](/Users/ninebot/Desktop/AI智绘/data/generated/b2-review-title-three-lines.png)。
- 未验证项：未部署线上，未执行真实付费模型调用或飞书端到端；本轮同步标题区及时间/地点底部信息模块，不声称整张海报完全同步 Figma 新稿。视觉检查已人工查看本地降级背景 PNG；真实生成背景仍需设计方验收。
