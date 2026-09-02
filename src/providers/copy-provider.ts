import { configured, serverEnv } from "@/lib/env";
import { posterDocumentSchema, type EmployeeActivityInput, type PosterDocument } from "@/contracts/poster";

const systemPrompt = "你是企业行政活动文案助手。只输出符合 PosterDocumentV1_5 的 JSON，不能输出 Markdown。sessions、notice、contact、ctaLabel、qrPayload 必须逐字保留输入内容；不能创造奖品、合作方、场地或规则；不能输出 HTML、CSS、Logo 或二维码。";
export async function generateCopy(input: EmployeeActivityInput): Promise<{ document: PosterDocument; provider: string }> {
  if (!configured.copy) return { document: fallbackCopy(input), provider: "demo-copy" };
  const response = await fetch(`${serverEnv.LLM_BASE_URL}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serverEnv.LLM_API_KEY}` }, body: JSON.stringify({ model: serverEnv.LLM_MODEL, temperature: 0.6, response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: JSON.stringify(input) }] }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`文案服务请求失败（${response.status}）`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error("文案服务未返回内容"); const document = posterDocumentSchema.parse(JSON.parse(raw));
  if (JSON.stringify(document.sessions) !== JSON.stringify(input.sessions) || document.notice !== input.notice || document.contact !== input.contact || document.ctaLabel !== input.ctaLabel || document.qrPayload !== input.qrPayload) throw new Error("文案服务修改了不可改写字段");
  return { document, provider: "deepseek" };
}
function fallbackCopy(input: EmployeeActivityInput): PosterDocument { return { schemaVersion: "1.5", scene: "employee_activity", locale: "zh-CN", category: input.category, title: input.activityName, subtitle: "一起出发，把日常过得更有意思", summary: input.description, sessions: input.sessions, highlights: input.highlights, participationSteps: input.participationSteps, notice: input.notice, ctaLabel: input.ctaLabel, qrPayload: input.qrPayload, contact: input.contact, immutableSource: { sessions: true, contact: true, ctaLabel: true, qrPayload: true, notice: true } }; }
