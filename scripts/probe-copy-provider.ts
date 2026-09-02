import input from "../tests/fixtures/employee-activity.normal.json";
import { employeeActivityInputSchema } from "../src/contracts/poster";
import { serverEnv } from "../src/lib/env";
import { generateCopy } from "../src/providers/copy-provider";
import { ProviderError } from "../src/providers/provider-error";

async function main() {
  const startedAt = Date.now();
  const result = await generateCopy(employeeActivityInputSchema.parse(input));

  if (result.provider !== "deepseek") {
    throw new ProviderError(
      "LLM_REQUEST_FAILED",
      "文案探针未使用真实 DeepSeek 配置"
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: result.provider,
        model: result.model,
        baseUrl: new URL(serverEnv.LLM_BASE_URL!).origin,
        elapsedMs: Date.now() - startedAt,
        schemaVersion: result.document.schemaVersion,
        immutableFieldsPreserved: true
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code:
          error instanceof ProviderError
            ? error.code
            : "LLM_PROBE_FAILED",
        message:
          error instanceof Error ? error.message : "文案模型探针失败"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
