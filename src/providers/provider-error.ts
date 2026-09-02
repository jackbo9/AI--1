export type ProviderErrorCode =
  | "LLM_AUTH_FAILED"
  | "LLM_RATE_LIMITED"
  | "LLM_REQUEST_FAILED"
  | "LLM_INVALID_OUTPUT"
  | "IMMUTABLE_FIELD_CHANGED"
  | "IMAGE_AUTH_FAILED"
  | "IMAGE_RATE_LIMITED"
  | "IMAGE_GENERATION_FAILED"
  | "IMAGE_DOWNLOAD_FAILED";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

type RequestOptions = {
  timeoutMs: number;
  retries?: number;
  classify: (status: number) => ProviderError;
  networkError: () => ProviderError;
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestJson(
  url: string,
  init: RequestInit,
  options: RequestOptions
): Promise<unknown> {
  const retries = options.retries ?? 1;
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      if (!response.ok) {
        const error = options.classify(response.status);
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        return (await response.json()) as unknown;
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        lastError = options.networkError();
        if (attempt === retries) throw lastError;
      }
    }

    await wait(350 * (attempt + 1));
  }

  throw (
    lastError ??
    options.networkError()
  );
}

export async function requestBytes(
  url: string,
  options: Omit<RequestOptions, "classify" | "networkError"> & {
    classify?: (status: number) => ProviderError;
  }
): Promise<{ bytes: Buffer; contentType: string }> {
  const retries = options.retries ?? 1;
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs)
      });
      if (!response.ok) {
        const error =
          options.classify?.(response.status) ??
          new ProviderError(
            "IMAGE_DOWNLOAD_FAILED",
            "主视觉下载失败",
            response.status === 429 || response.status >= 500,
            response.status
          );
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        return {
          bytes,
          contentType: response.headers.get("content-type") ?? ""
        };
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        lastError = new ProviderError(
          "IMAGE_DOWNLOAD_FAILED",
          "主视觉下载失败",
          true
        );
        if (attempt === retries) throw lastError;
      }
    }

    await wait(350 * (attempt + 1));
  }

  throw (
    lastError ??
    new ProviderError("IMAGE_DOWNLOAD_FAILED", "主视觉下载失败")
  );
}
