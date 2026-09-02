# Build Tasks: Phase 1.5 品牌化高信息量活动海报

Generated from: `.design/phase-1-5/DESIGN_BRIEF.md`  
Date: 2026-09-02

## Foundation

- [x] **升级活动内容契约并生成三组可视 Fixture**：扩展 `EmployeeActivityInput` 和 `PosterDocument`，支持品牌资产、1–2 个场次、亮点、参与方式、注意事项、CTA/二维码；同时建立标准、长文本和双场次 Fixture，并为不可改写字段补充单元测试。_Modifies: `src/contracts/poster.ts`, `tests/fixtures`, `tests/unit/poster.test.ts`._
- [x] **建立模板 v1.5 元数据和品牌资产规则**：声明 `1080 x 1920`、Logo 插槽/安全区、主视觉插槽、正文模块、最小字号、最大长度和溢出策略；没有正式 Logo 时使用明确标注的本地占位资产。_Modifies: `src/templates/employee-activity.ts`; creates controlled brand assets under `public/brand`._

## Core UI

- [x] **先完成可评审的品牌头部与主视觉切片**：在模板 v1.5 中实现 Logo、安全区、活动类别、强标题层级和 Seedream 主视觉槽位，以“现代企业活动编辑设计”为方向完成第一张可视基线，优先验证整体审美而不是继续堆字段。_Depends on: 模板 v1.5 元数据和品牌资产规则. Modifies: `src/templates/employee-activity.ts`._
- [x] **实现双场次核心信息卡**：支持一个或两个站点/场次，每个场次稳定呈现标签、日期、时间、地点及最多三条补充信息；长地点和双场次必须有可检查的换行/溢出行为。_Depends on: 活动内容契约. Modifies: `src/templates/employee-activity.ts`._
- [x] **实现亮点、参与方式、注意事项与品牌页脚**：把真实行政活动的信息密度补齐为可扫描模块，并确保重要说明具有足够对比度；CTA 和二维码无值时整个模块收起，不留空洞。_Depends on: 双场次核心信息卡. Modifies: `src/templates/employee-activity.ts`._
- [x] **把输入页升级为渐进式高信息量表单**：保留现有 `ActivityStudio`，新增场次、亮点、参与方式、注意事项和可选 CTA/二维码分组；最多添加第二场，字段错误显示在对应分组附近。_Modifies: `src/components/activity-studio.tsx`, `src/app/globals.css`._
- [x] **迁移 3001 的产品外壳和实时预览体验**：把侧边导航、场景卡、分组工作区和右侧实时预览迁入主项目，但接回主项目真实任务 API 和最终 PNG；删除假用户与误导性占位功能，预览不得用省略号隐藏日期、地点等重要信息。_Reuses visual structure from `/Users/ninebot/Desktop/AI智绘_副本`; modifies main app page and `ActivityStudio`._

## Real Model Slice

- [ ] **接通 DeepSeek 的扩展结构化文案**：更新系统 Prompt 和 JSON Schema，对扩展字段解析、不可改写字段逐项对比、非法模型输出和一次修复/重试进行验证；任务版本记录实际模型与 Prompt 版本。_Modifies: `src/providers/copy-provider.ts`, `src/contracts/poster.ts`, `src/worker/run-job.ts`._
- [ ] **接通 Seedream 5.0 Lite 单图生成**：使用火山方舟 `/api/v3/images/generations`、2K PNG、无水印、关闭组图，立即下载返回资源；把失败原因、模型和降级状态写入版本，不允许静默假装真实生图成功。_Modifies: `src/providers/illustration-provider.ts`, `src/lib/env.ts`, `.env.example`, `src/worker/run-job.ts`._
- [x] **用简短视觉意图替换固定氛围选择**：把三个互斥风格卡改成 10–180 字的 `visualIntent` 输入和非互斥灵感词，提示用户描述主体、动作、环境和感觉，并阻止在这里承载 Logo、日期地点、二维码和正文。_Modifies: contracts, `src/components/activity-studio.tsx`, `src/app/globals.css`._
- [x] **实现受控 Prompt Compiler**：使用独立 DeepSeek Prompt 将 `visualIntent`、去敏后的场景语义和品牌 StylePack 编译为 `IllustrationBrief` JSON，校验主体、动作、环境、构图、色彩、风格、安全区和负向约束，再由代码拼接最终 Seedream Prompt；保存独立 `promptVersion` 并测试 Prompt 注入、敏感字段移除和空输入降级。_Creates a prompt compiler provider/service; modifies `src/providers/illustration-provider.ts`, contracts and worker._
- [ ] **完成真实双模型海报切片**：从一组双场次 Fixture 发起任务，真实生成文案和主视觉并输出模板 v1.5 PNG；页面必须分别标明 DeepSeek、Seedream、模板和校验状态。_Depends on: DeepSeek 扩展文案, Seedream 单图生成, 模板内容模块. Modifies: `src/components/activity-studio.tsx`, `src/contracts/job.ts`._

## Interactions & States

- [ ] **实现“只换主视觉”与内容新版本**：只换主视觉必须复用已确认文案和模板，内容修改必须创建不可变新版本；生成中禁用重复操作并保持幂等。_Modifies: job API, worker, `ActivityStudio`._
- [ ] **补齐模型失败、降级和校验状态**：DeepSeek Schema 失败、Seedream 超时、默认资产降级、字体失败、文本溢出和飞书通知失败都显示可理解状态；核心输出与通知状态分离。_Modifies: providers, worker, job contract, result UI._
- [ ] **接入飞书身份和结果卡片**：将工作台用户映射为内部稳定 ID，生成完成后上传/引用 PNG 并发送带“查看海报”链接的卡片；首版不接机器人消息和卡片动作回调。_Creates/modifies: `src/integrations/feishu`, auth/API routes; reuses existing job result page._

## Responsive & Polish

- [ ] **完成输入页响应式与中文排版检查**：桌面双栏、窄屏单栏；检查中文标点换行、禁则、字段标签、键盘焦点、错误提示和减少动态偏好。_Modifies: `src/app/globals.css`, `src/components/activity-studio.tsx`._
- [ ] **建立模板视觉回归与输出检查**：为标准、长文本和双场次生成基线 PNG，检查尺寸、Logo 比例、安全区、最低字号、缺字、遮挡和重要内容裁切；真实 API 测试与普通 CI 凭据隔离。_Creates/modifies: render tests, `tests/renders`, CI configuration._

## Review

- [ ] **Phase 1.5 设计评审**：对照 brief 检查品牌存在感、视觉层级、信息密度、参考图精神而非表面复刻、可访问性和长文本稳定性。
- [ ] **Phase 1.5 端到端验收**：从飞书工作台进入，提交双场次活动和一句视觉描述，验证 Prompt Compiler 去敏并生成受控 Prompt，真实调用 DeepSeek 与 Seedream，生成并下载 PNG，收到飞书卡片，再验证一次 Seedream 失败降级。
