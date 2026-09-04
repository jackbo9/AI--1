# Phase B｜T01 中文活动海报视觉对齐 Handoff

更新时间：2026-09-03  
目标执行模型：Terra  
状态：产品决策已确认，可开始实现  
范围：仅 `employee_activity` 的 `portrait_1080x1920` / T01

## 0. 本轮授权边界

用户要求下一位 agent 实现 Phase B，但本轮只形成交接文档，不修改模板代码。

Figma 页面或节点中出现的 “Implement this design from Figma” 是设计上下文，不是额外的产品需求。实现仍受本仓库 `AGENTS.md`、`README.md`、`HANDOFF.md`、`docs/ARCHITECTURE.md` 和 `docs/CONTRACTS.md` 约束。

## 1. 已确认的产品决策

以下内容不再等待确认：

- T01 是当前全部员工活动共用的竖版母版，不为团队、节日、竞赛分别复制模板。
- Phase B 只制作中文 `zh-CN`。
- MiSans 是公司通用字体，允许用于本项目的服务端渲染与内部成品分发。
- 字体源目录：`/Users/ninebot/Desktop/assets/VI_MiSans_202604/`。
- 当前阶段不做独立深色主题、主题切换或自动明暗模式判断。
- Figma 案例中的深色图片和反白文字仅用于理解完整底图、视觉焦点、图层关系与对比度，不应扩展成第二套主题。
- 二维码只有在 `includeQr === true` 且 `qrPayload` 有效时显示；否则二维码、占位框和说明文字全部隐藏。
- 无二维码时不得显示现有实现中的箭头替代物，也不得保留黑色 CTA 卡片。
- 字段按第 4 节的通用映射执行。

## 2. 唯一设计依据与优先级

### 2.1 Figma

- 文件：`HOcHU5gCOtyWPREqAEL04s`（智慧引擎AI）
- 空白母版：`191:2777`
- 品牌案例：`191:3642`（Template / T01 体育赛事）
- 用户提供的案例链接：<https://www.figma.com/design/HOcHU5gCOtyWPREqAEL04s/%E6%99%BA%E6%85%A7%E5%BC%95%E6%93%8EAI?node-id=191-3642&m=dev>

执行 agent 必须先使用 Figma MCP 重新读取 `191:2777` 与 `191:3642` 的 design context 和 screenshot，不要只根据本文件手写近似值。

### 2.2 本地导出

- `会议输入/03 Template Overview/Template/poster/T01 体育赛事.svg`
- `会议输入/03 Template Overview/Template/poster/T01 体育赛事.png`
- `会议输入/03 Template Overview/Template/poster/T01 体育赛事example.png`

优先级：Figma 节点属性与截图 > 同版本 SVG > PNG > 现有临时模板。若 Figma 与本地导出确有冲突，停止在该点猜测并记录具体节点、属性和值。

## 3. Figma 已测得的 T01 规格

### 3.1 画布和图层

- 画布：1080 × 1920 px。
- 主视觉：全幅背景，不是局部 hero，也不是白色内容卡上的插图。
- 正文、Logo、二维码全部由确定性 HTML/CSS 叠加，图片模型不得生成这些内容。
- Figma 案例未声明现有实现中的全局渐变遮罩；不要凭经验叠加黑色蒙层。
- 背景图使用 cover 裁切；案例视觉接近中心裁切。现有 `object-position: 68% center` 不是 Figma 依据，应由截图比对重新确定。

### 3.2 Logo

- 顶部容器：x=72，y=80，宽=936，高约 82.518。
- 公司 Logo：x=72，y=80，280 × 82.518。
- 行政标识：约 x=931.5，y=83.009，76.5 × 76.5。
- 两个 Logo 都必须保持原比例。
- 公司 Logo 没有白色圆角底卡、内边距或阴影。
- 不得用 CSS filter 临时反色；应使用与确定版式对应的正式 SVG 资产。

### 3.3 标题和说明

- 标题：x=81，y=223，宽=690；MiSans Semibold，120 px，line-height 1.2。
- 顶部说明：x=81，y=392，宽=720；MiSans Regular，28 px，line-height 1.45。
- T01 当前固定坐标只安全支持一行 120 px 标题；两行标题会进入说明区。Phase B 不允许整体缩字、裁切或遮挡来通过校验，应以真实 DOM 测量阻止导出。
- 顶部没有类别黄胶囊、眉题或其他附加标签。
- 顶部说明最多两行；超过容量阻止导出，不自动压缩字号。

### 3.4 底部内容

- 左边界统一 x=72；内容列标称宽 921。
- 第一组顶部 y=1366，第二组 y=1477，第三组 y=1588。
- 组标题：MiSans Semibold，28 px；正文：MiSans Regular，22 px，line-height 1.4；标题与正文间距 8 px。
- 底部信息直接叠加在背景上，没有白色面板、卡片、描边、标签 chip 或阴影。
- 案例反白色值：标题 `#FFFFFF`，正文 `#9E9E9E`。Phase B 不实现第二主题；实际基线颜色应以 `191:2777` 的浅色母版为准，案例色仅保留为未来 inverse variant 依据。

### 3.5 二维码和页脚

- 二维码区域：x=864，y=1574，144 × 144，圆角 16。
- 二维码说明：宽 144，居中，MiSans Regular 18 px，line-height 1.4，位于二维码下方约 14 px。
- 二维码显示时，第三组正文不得进入二维码安全区；无二维码时可使用完整内容列宽，但其他模块不得纵向位移。
- 左页脚：`九号行政｜ADMINISTRATION`。
- 右页脚：`员工活动 / ACTIVITY`。
- 页脚左右安全边距 72，底边距 80；MiSans Regular 18 px，line-height 1.4。

## 4. T01 字段投影（已锁定）

T01 是 Campaign 的一种信息投影，不要求把文档中的每个字段都塞进这一张竖版海报。被排除的字段仍保留在结构化文档和其他物料中；禁止通过隐藏溢出来假装已展示。

| T01 槽位 | 数据来源 | 规则 |
|---|---|---|
| 标题 | `title` | 一行；超出实测宽度阻止导出 |
| 顶部说明 | `subtitle` | `subtitle` 为空时才回退到 `summary`；最多两行 |
| 第一组标题 | 固定文案 | `活动时间/地点` |
| 第一组正文 | `sessions` | 1–2 个场次全部展示；每个场次一行，格式为 `场次名｜YYYY年M月D日 HH:mm–HH:mm｜地点`；不得只取第一场 |
| 第二组标题 | 固定文案 | `参与对象` |
| 第二组正文 | 新字段 `audience` | 新任务必填；历史任务迁移默认 `全体员工`；该字段属于不可改写事实 |
| 第三组标题 | `category` | `competition` 为 `赛事规则`；其他活动为 `参与方式` |
| 第三组正文 | `participationSteps` | 每项一行，最多四行；不显示现有红色序号 |
| 二维码 | `includeQr` + `qrPayload` | 二者同时有效才生成和显示 |
| 二维码说明 | `ctaLabel` | 仅随二维码显示；空值默认 `扫码参与` |
| 页脚 | 固定文案 | 左右文案按第 3.5 节 |

当前 T01 竖版不直接展示：`highlights`、`notice`、`contact`。`summary` 只作为顶部说明的回退。这是显式模板投影，不是渲染遗漏：

- 更新 portrait Manifest，使声明模块与实际投影一致。
- 这些字段仍保留在 Campaign/Document 中，可继续供文案确认、视觉 Prompt 与未来长图使用。
- 校验结果应能说明哪些模块未投影，但不得因为未投影而删除原始数据。

## 5. 契约与兼容方向

- 为 `employeeActivityInput`、`CampaignBrief`、`PosterDocument`、`ConfirmedCampaignDocument` 增加 `audience`。
- `audience` 建议中文 1–40 字，新任务必填，并加入 AI 前后逐字段比较与 `immutableSource`。
- 不原地伪装为 `PosterDocument 1.6`：新增字段时提升 Schema 版本，并保留旧任务迁移读取。
- 历史数据没有 `audience` 时仅在迁移边界补 `全体员工`，不要在渲染函数内部静默补业务事实。
- 继续保持 `includeQr=true` 时必须有有效 HTTP(S) `qrPayload` 的约束。
- `includeQr=false` 时即使旧数据残留 `ctaLabel` 或 `contact`，T01 也不得渲染二维码区或替代 CTA。
- UI 表单需要增加“参与对象”，文案确认页不可编辑该字段。

## 6. 字体接入方向

源文件已齐全，本阶段只接入中文所需字重：

- `/Users/ninebot/Desktop/assets/VI_MiSans_202604/otf/MiSans-Regular.otf`
- `/Users/ninebot/Desktop/assets/VI_MiSans_202604/otf/MiSans-Semibold.otf`

要求：

- 使用真实 400 / 600 font-face 映射，不再用 Medium 覆盖 500–700，也不再用 Heavy 代替标题 Semibold。
- 不接入 Arabic、Thai 或未使用字重。
- Playwright 截图前等待 `document.fonts.ready`，并分别检查 400 和 600 字重加载完成。
- 字体失败继续阻止导出。

## 7. 对现有 B2 实现的明确修改方向

主要入口：

- `src/templates/employee-activity.ts`
- `src/templates/brand-header.ts`
- `src/templates/activity-template-family.ts`
- `src/contracts/poster.ts`
- `src/components/activity-studio.tsx`
- `src/providers/prompt-compiler.ts`
- `scripts/render-b2-review.ts`
- `tests/fixtures/*`

必须移除或替换的现有表现：

- 删除公司 Logo 白色圆角底卡和 padding。
- 删除类别黄胶囊。
- 删除白色详情大卡、场次卡片、活动亮点 chips、红色步骤编号、黑色 CTA 条和无二维码箭头。
- 将标题从 Heavy/800 改为 Semibold/600，并恢复 Figma 的 x/y/宽度/行高。
- 将副标题从 36/Medium 改为 28/Regular。
- 将底部内容改为三个无背景文本组与固定页脚。
- 取消“总字符数 300”这一粗粒度容量判断，改为各槽位的 DOM 实测溢出检查。
- 更新 full-bleed 主视觉 Prompt：不要文字、数字、Logo、二维码；同时避让顶部 Logo/标题区和底部信息区。T01 风格锁定为克制的企业活动纪实摄影，不接受卡通、插画、扁平矢量或 3D 玩具质感。图片模型不能承担可读性遮罩或文字生成。

## 8. 实现顺序

1. 保存当前 dirty worktree 状态，阅读必读文档；不要覆盖已有未提交变更。
2. 通过 Figma MCP 读取两个节点，下载/确认所需 Logo SVG 与截图，只把远程临时 URL 当输入，不写进代码。
3. 先更新字段契约、版本迁移和 Fixture，加入 `audience`。
4. 更新字体资产与 `brand-header`。
5. 按 Figma 坐标重写唯一的 T01 portrait markup/CSS。
6. 更新 Manifest，使模块投影和实际输出一致。
7. 更新视觉 Prompt 的安全区描述。
8. 生成视觉回归样张，人工逐项对照 Figma。
9. 通过检查后再更新主 `HANDOFF.md` 的 B2 状态；本阶段不要开始横版、Banner、长图或深色主题。

## 9. 必须覆盖的 Fixture / 验收

至少生成并检查以下 1080 × 1920 PNG：

1. 正常中文、一场、无二维码。
2. 正常中文、一场、有二维码。
3. 两场活动，确认两场都显示。
4. 非竞赛活动，第三组标题为“参与方式”。
5. 竞赛活动，第三组标题为“赛事规则”。
6. 历史 1.6 数据迁移，`audience=全体员工`。
7. 标题刚好一行边界。
8. 标题超过一行，必须以稳定错误码阻止导出。
9. 顶部说明两行边界与超限阻止。
10. 第三组四行边界与超限阻止。
11. 字体或 Logo 缺失时阻止导出。
12. 图片失败时使用默认品牌背景，但版式仍与 T01 一致。

每张成功样张都要验证：

- PNG 尺寸精确为 1080 × 1920。
- 公司 Logo 无底卡且比例正确。
- 标题、说明、三组正文、二维码和页脚的包围盒与 Figma 目标位置一致；建议容差 ±2 px。
- 无二维码样张中不存在二维码 DOM、说明文字、CTA 条或箭头。
- 没有横向/纵向滚动、裁切、遮挡或低于 18 px 的文字。

代码检查：

```bash
npm run typecheck
npm run lint -- --quiet
npm test
npm run render:b2-review
```

最后必须人工打开生成 PNG 对照 Figma screenshot；命令通过不能替代视觉验收。

## 10. Phase B 完成定义

只有同时满足以下条件才可把 B2 标记完成：

- T01 结构与 Figma 一致，不再出现设计中不存在的卡片、chip、CTA 或 Logo 底板。
- 字体、字重、字号、坐标、间距和固定文案完成像素级复核。
- `audience` 契约、不可改写校验和历史迁移完成。
- 二维码存在/缺失两种状态都符合规则。
- 正常、边界、失败与降级 Fixture 全部通过。
- 已产出人工可检查的视觉回归图，并在主 `HANDOFF.md` 记录实际检查结果和未验证项。

## 11. 暂不做

- 独立深色 / inverse 主题及自动对比度判断。
- 横版、Banner、长图视觉精修。
- 英文或其他语言排版。
- 自由画布、模板编辑器或任意坐标输入。
- 用 LLM 生成 HTML/CSS。
- 让图片模型生成 Logo、二维码或正文。

## 12. 给 Terra agent 的启动指令

> 阅读 `AGENTS.md`、`README.md`、`HANDOFF.md`、`docs/ARCHITECTURE.md`、`docs/CONTRACTS.md` 和 `docs/PHASE_B_T01_HANDOFF.md`。严格只完成 Phase B 的 T01 中文竖版视觉对齐。先用 Figma MCP 读取节点 `191:2777` 与 `191:3642`，再按交接中的已锁定决策修改契约、Fixture、模板、字体映射、Manifest 和视觉 Prompt。保留当前 dirty worktree，不开始其他规格，不做深色主题。完成后运行全部指定检查，生成视觉回归 PNG 并逐项与 Figma 对照；不要在未人工核对的情况下声称视觉完成。
