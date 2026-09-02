import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  requestJson
} from "@/providers/provider-error";
import { detectImageFormat } from "@/providers/illustration-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider request boundary", () => {
  it("retries one transient response and then parses JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await requestJson(
      "https://provider.invalid/test",
      { method: "POST" },
      {
        timeoutMs: 1_000,
        retries: 1,
        classify: (status) =>
          new ProviderError(
            "LLM_RATE_LIMITED",
            "服务繁忙",
            status === 429,
            status
          ),
        networkError: () =>
          new ProviderError("LLM_REQUEST_FAILED", "网络失败", true)
      }
    );

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestJson(
        "https://provider.invalid/test",
        { method: "POST" },
        {
          timeoutMs: 1_000,
          retries: 1,
          classify: (status) =>
            new ProviderError(
              "LLM_AUTH_FAILED",
              "鉴权失败",
              false,
              status
            ),
          networkError: () =>
            new ProviderError("LLM_REQUEST_FAILED", "网络失败", true)
        }
      )
    ).rejects.toMatchObject({ code: "LLM_AUTH_FAILED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps downloaded image extensions consistent with their bytes", () => {
    expect(
      detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))
    ).toEqual({ extension: "jpg", mimeType: "image/jpeg" });
    expect(
      detectImageFormat(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toEqual({ extension: "png", mimeType: "image/png" });
  });
});
