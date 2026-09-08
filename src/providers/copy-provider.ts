import { z } from "zod";
import { configured, serverEnv } from "@/lib/env";
import {
  posterDocumentSchema,
  t01PortraitSubtitleMaxCharacters,
  textCharacterCount,
  type EmployeeActivityInput,
  type PosterDocument
} from "@/contracts/poster";
import { ProviderError, requestJson } from "./provider-error";

const copyPromptVersion = "employee-activity-copy-v1-9";
const systemPrompt =
  '你是企业行政活动文案助手。只输出一个 JSON 对象，不能输出 Markdown。必须完整返回这些字段：schemaVersion、scene、locale、outputFormat、category、title、slogan、subtitle、summary、sessions、audience、highlights、participationSteps、notice、includeQr、ctaLabel、qrPayload、qrAssetId、contact、immutableSource。schemaVersion 必须是 "1.7"，scene 必须是 "employee_activity"，locale 必须是 "zh-CN"。title、outputFormat、category、sessions、audience、notice、contact、includeQr、ctaLabel、qrPayload、qrAssetId 必须逐字保留输入内容。slogan 与 subtitle 是必填 T01 竖版标题文案：slogan 必须是“九号员工活动名称 / ENGLISH”单行格式（如“九号员工网球公开赛 / TENNIS”）；subtitle 必须是一句自然中文。输入已有值时逐字保留。不能创造活动事实；不能输出 HTML、CSS、Logo 或二维码。';

const deepSeekResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) })
      })
    )
    .min(1)
});

export type CopyResult = {
  document: PosterDocument;
  provider: string;
  model: string;
  promptVersion: string;
};

export async function generateCopy(
  input: EmployeeActivityInput
): Promise<CopyResult> {
  if (!hasOptionalCopyInput(input)) {
    return {
      document: fallbackCopy(input),
      provider: "demo-copy-empty-optional",
      model: "none",
      promptVersion: copyPromptVersion
    };
  }
  if (!configured.copy) {
    return {
      document: fallbackCopy(input),
      provider: "demo-copy",
      model: "demo-copy",
      promptVersion: copyPromptVersion
    };
  }

  let lastError: ProviderError | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const payload = deepSeekResponseSchema.parse(
        await requestJson(
          `${serverEnv.LLM_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serverEnv.LLM_API_KEY}`
            },
            body: JSON.stringify({
              model: serverEnv.LLM_MODEL,
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: JSON.stringify({
                    task: "保留锁定标题；只在输入为空时生成宣言标题与副标题，并返回完整 PosterDocumentV1_7。",
                    constraints: {
                      title: "逐字保留 input.activityName，不改写、不扩写",
                      slogan: "输入不为空时逐字保留；为空时必须生成“九号员工活动名称 / ENGLISH”格式，例如“九号员工网球公开赛 / TENNIS”；单行，最多 40 字",
                      subtitle: `T01 竖版实际展示字段；宽度 952px、高度自适应，建议 25 个字以内；一句中文，不换行，最多 ${t01PortraitSubtitleMaxCharacters} 个字（含标点）；信息不足时返回空字符串，不要用长段落填充`,
                      summaryMaxLength: 150,
                      highlights: "保留输入；为空时返回空数组",
                      participationSteps: "保留输入；为空时返回空数组"
                    },
                    input
                  })
                }
              ]
            })
          },
          {
            timeoutMs: 30_000,
            retries: 1,
            classify: classifyLlmStatus,
            networkError: () =>
              new ProviderError(
                "LLM_REQUEST_FAILED",
                "文案服务暂时不可用",
                true
              ),
            invalidResponse: () =>
              new ProviderError(
                "LLM_INVALID_OUTPUT",
                "文案服务返回了空响应或非 JSON 数据",
                true
              )
          }
        )
      );

      const generated = JSON.parse(payload.choices[0].message.content) as Record<string, unknown>;
      const document = posterDocumentSchema.parse({
        ...generated,
        // Schema identity and immutable facts are owned by the application.
        // Never trust a model-provided object here, even when its text fields
        // are otherwise valid.
        schemaVersion: "1.7",
        scene: "employee_activity",
        locale: "zh-CN",
        outputFormat: input.outputFormat,
        category: input.category,
        // The activity theme is a locked fact and is the T01 title. AI may
        // optimize optional copy, never the title itself.
        title: input.activityName,
        slogan: input.slogan || generated.slogan,
        subtitle: input.subtitle || generated.subtitle,
        sessions: input.sessions,
        audience: input.audience,
        notice: input.notice,
        includeQr: input.includeQr,
        ctaLabel: input.ctaLabel,
        qrPayload: input.qrPayload,
        qrAssetId: input.qrAssetId,
        contact: input.contact,
        deadline: input.deadline,
        rules: input.rules,
        prize: input.prize,
        immutableSource: {
          outputFormat: true,
          sessions: true,
          audience: true,
          contact: true,
          includeQr: true,
          ctaLabel: true,
          qrPayload: true,
          qrAssetId: true,
          notice: true
        }
      });
      assertImmutable(input, document);
      assertT01CopyCapacity(document);

      return {
        document,
        provider: "deepseek",
        model: serverEnv.LLM_MODEL ?? "unknown",
        promptVersion: copyPromptVersion
      };
    } catch (error) {
      if (
        error instanceof ProviderError &&
        error.code !== "LLM_INVALID_OUTPUT"
      ) {
        throw error;
      }
      lastError = invalidOutputError(error);
      if (attempt === 1) throw lastError;
    }
  }

  throw (
    lastError ??
    new ProviderError("LLM_INVALID_OUTPUT", "文案结果未通过内容校验")
  );
}

function invalidOutputError(error: unknown) {
  if (error instanceof ProviderError) return error;
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".") || "root";
    return new ProviderError(
      "LLM_INVALID_OUTPUT",
      `文案结果字段 ${field} 未通过校验：${issue?.message ?? "格式错误"}`,
      true
    );
  }
  if (error instanceof SyntaxError) {
    return new ProviderError(
      "LLM_INVALID_OUTPUT",
      "文案服务未返回有效 JSON",
      true
    );
  }
  return new ProviderError(
    "LLM_INVALID_OUTPUT",
    "文案结果未通过结构化内容校验",
    true
  );
}

function classifyLlmStatus(status: number) {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "LLM_AUTH_FAILED",
      "文案服务配置或权限无效",
      false,
      status
    );
  }
  if (status === 429) {
    return new ProviderError(
      "LLM_RATE_LIMITED",
      "文案服务繁忙，请稍后重试",
      true,
      status
    );
  }
  return new ProviderError(
    "LLM_REQUEST_FAILED",
    "文案服务请求失败",
    status >= 500,
    status
  );
}

function assertImmutable(
  input: EmployeeActivityInput,
  document: PosterDocument
) {
  const immutableMatches =
    document.outputFormat === input.outputFormat &&
    JSON.stringify(document.sessions) === JSON.stringify(input.sessions) &&
    document.audience === input.audience &&
    document.notice === input.notice &&
    document.contact === input.contact &&
    document.includeQr === input.includeQr &&
    document.ctaLabel === input.ctaLabel &&
    document.qrPayload === input.qrPayload &&
    document.qrAssetId === input.qrAssetId;

  if (!immutableMatches) {
    throw new ProviderError(
      "IMMUTABLE_FIELD_CHANGED",
      "重要活动信息被意外改写"
    );
  }
}

function assertT01CopyCapacity(document: PosterDocument) {
  if (!document.slogan.trim() || !document.subtitle.trim()) {
    throw new ProviderError(
      "LLM_INVALID_OUTPUT",
      "文案服务未生成完整的宣言标题和副标题，请重试"
    );
  }
  if (
    textCharacterCount(document.subtitle) > t01PortraitSubtitleMaxCharacters
  ) {
    throw new ProviderError(
      "LLM_INVALID_OUTPUT",
      `文案服务返回的副标题超过 T01 模板 ${t01PortraitSubtitleMaxCharacters} 字限制`,
      true
    );
  }
  if (/[\r\n]/.test(document.subtitle)) {
    throw new ProviderError(
      "LLM_INVALID_OUTPUT",
      "文案服务返回的副标题包含换行，无法直接排入 T01 模板",
      true
    );
  }
}

function fallbackCopy(input: EmployeeActivityInput): PosterDocument {
  return {
    schemaVersion: "1.7",
    scene: "employee_activity",
    locale: "zh-CN",
    outputFormat: input.outputFormat,
    category: input.category,
    title: input.activityName,
    slogan: input.slogan,
    subtitle: input.subtitle,
    summary: "",
    sessions: input.sessions,
    audience: input.audience,
    highlights: input.highlights,
    participationSteps: input.participationSteps,
    notice: input.notice,
    includeQr: input.includeQr,
    ctaLabel: input.ctaLabel,
    qrPayload: input.qrPayload,
    qrAssetId: input.qrAssetId,
    contact: input.contact,
    deadline: input.deadline,
    rules: input.rules,
    prize: input.prize,
    immutableSource: {
      outputFormat: true,
      sessions: true,
      audience: true,
      contact: true,
      includeQr: true,
      ctaLabel: true,
      qrPayload: true,
      qrAssetId: true,
      notice: true
    }
  };
}

function hasOptionalCopyInput(input: EmployeeActivityInput) {
  return [
    input.slogan,
    input.subtitle,
    ...input.highlights,
    ...input.participationSteps,
    input.notice,
    input.deadline,
    input.rules,
    input.prize
  ].some((value) => value.trim().length > 0);
}
