import { describe, expect, it } from "vitest";
import { readJsonRequest } from "@/server/request-json";

describe("JSON route request boundary", () => {
  it("turns an empty body into a stable validation result", async () => {
    await expect(
      readJsonRequest(
        new Request("http://localhost/api/jobs", { method: "POST" })
      )
    ).resolves.toEqual({ ok: false, message: "请求内容不能为空" });
  });

  it("turns malformed JSON into a stable validation result", async () => {
    await expect(
      readJsonRequest(
        new Request("http://localhost/api/jobs", {
          method: "POST",
          body: "{"
        })
      )
    ).resolves.toEqual({ ok: false, message: "请求内容不是有效的 JSON" });
  });

  it("preserves valid JSON as unknown data for schema validation", async () => {
    await expect(
      readJsonRequest(
        new Request("http://localhost/api/jobs", {
          method: "POST",
          body: JSON.stringify({ format: "banner_2227x950" })
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: { format: "banner_2227x950" }
    });
  });
});
