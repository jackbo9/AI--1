import { z } from "zod";
import { configured, serverEnv } from "@/lib/env";
import {
  posterDocumentSchema,
  type EmployeeActivityInput,
  type PosterDocument
} from "@/contracts/poster";
import { ProviderError, requestJson } from "./provider-error";

const copyPromptVersion = "employee-activity-copy-v1-7";
const systemPrompt =
  '你是企业行政活动文案助手。只输出一个 JSON 对象，不能输出 Markdown。必须完整返回这些字段：schemaVersion、scene、locale、outputFormat、category、title、subtitle、summary、sessions、audience、highlights、participationSteps、notice、includeQr、ctaLabel、qrPayload、contact、immutableSource。schemaVersion 必须是 "1.7"，scene 必须是 "employee_activity"，locale 必须是 "zh-CN"。outputFormat、category、sessions、audience、notice、contact、includeQr、ctaLabel、qrPayload 必须逐字保留输入内容。immutableSource 必须把 outputFormat、sessions、audience、contact、includeQr、ctaLabel、qrPayload、notice 全部设为 true。不能创造奖品、合作方、场地或规则；不能输出 HTML、CSS、Logo 或二维码。';

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
                    task: "优化允许编辑的标题、副标题、摘要、活动亮点和参与方式，并返回完整 PosterDocumentV1_7。",
                    constraints: {
                      titleMaxLength: 40,
                      subtitleMaxLength: 56,
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

      const document = posterDocumentSchema.parse({
        ...(JSON.parse(payload.choices[0].message.content) as Record<string, unknown>),
        // The activity theme is a locked fact and is the T01 title. AI may
        // optimize optional copy, never the title itself.
        title: input.activityName,
        sessions: input.sessions,
        audience: input.audience,
        notice: input.notice,
        includeQr: input.includeQr,
        ctaLabel: input.ctaLabel,
        qrPayload: input.qrPayload,
        contact: input.contact,
        deadline: input.deadline,
        rules: input.rules,
        prize: input.prize
      });
      assertImmutable(input, document);

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
    document.qrPayload === input.qrPayload;

  if (!immutableMatches) {
    throw new ProviderError(
      "IMMUTABLE_FIELD_CHANGED",
      "重要活动信息被意外改写"
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
    subtitle: "",
    summary: input.description,
    sessions: input.sessions,
    audience: input.audience,
    highlights: input.highlights,
    participationSteps: input.participationSteps,
    notice: input.notice,
    includeQr: input.includeQr,
    ctaLabel: input.ctaLabel,
    qrPayload: input.qrPayload,
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
      notice: true
    }
  };
}

function hasOptionalCopyInput(input: EmployeeActivityInput) {
  return [
    input.description,
    ...input.highlights,
    ...input.participationSteps,
    input.notice,
    input.deadline,
    input.rules,
    input.prize
  ].some((value) => value.trim().length > 0);
}
