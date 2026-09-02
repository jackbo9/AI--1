# 九号行政智绘引擎

面向集团行政专员的飞书内行政海报生成工具。项目当前处于方案锁定与开发准备阶段，尚未开始应用代码实现。

## 已锁定方案

采用“飞书企业自建应用 + 网页应用 + 机器人 + 自建生成后端”的方案 B：

- 飞书负责工作台入口、企业身份、组织权限和消息通知。
- 自建网页应用负责场景化输入、预览、局部修改和导出。
- 自建后端负责 AI 编排、模板选择、确定性排版、品牌校验和文件生成。
- 多维表格保留为可选的模板配置、任务运营和反馈后台，不作为核心渲染引擎或唯一业务数据库。

## 文档入口

- [HANDOFF.md](./HANDOFF.md)：产品、合作方式、范围、验收和待确认事项。
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)：目标架构、技术栈和部署演进。
- [docs/CONTRACTS.md](./docs/CONTRACTS.md)：数据模型、API、任务状态和 AI 输出协议。
- [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)：按纵向闭环拆分的开发顺序。
- [AGENTS.md](./AGENTS.md)：后续编码代理和开发者必须遵守的项目约束。
- [.env.example](./.env.example)：环境变量清单，不包含真实密钥。

## 第一条开发原则

不要先做完整网页或飞书接入。第一条可验证链路必须是：

```text
固定测试数据
  -> Zod/JSON Schema 校验
  -> 一个 HTML/CSS 模板
  -> Playwright 渲染
  -> PNG 文件
  -> 基础品牌规则校验结果
```

该链路跑通后，再逐步接入 LLM、插画模型、任务队列和飞书。

## 建议的代码目录（开始实现时创建）

```text
src/
  app/                 # Next.js 页面和 Route Handlers
  components/          # 产品 UI 组件
  contracts/           # Zod Schema、API 类型、领域类型
  server/              # 鉴权、任务服务、数据库访问
  worker/              # 异步生成任务处理
  providers/           # LLM、图片模型、存储适配器
  integrations/feishu/ # 飞书登录、机器人、卡片、OpenAPI
  templates/           # 海报模板与渲染组件
  validation/          # 品牌与内容规则校验
tests/
  fixtures/            # 固定输入和预期结果
  renders/             # 视觉回归基线
```

## 当前不应做的事

- 不要让图片模型生成 Logo、二维码或海报正文。
- 不要把 Figma Agent 当作线上排版运行时。
- 不要把 App Secret、模型密钥放在浏览器或多维表格字段里。
- 不要在场景和模板协议未确认前批量制作页面。
- 不要把 Demo 能运行等同于具备生产级安全与稳定性。

