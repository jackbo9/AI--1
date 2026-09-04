import { describe, expect, it } from "vitest";
import { createClientUuid } from "@/lib/client-uuid";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createClientUuid", () => {
  it("uses randomUUID when the browser provides it", () => {
    const expected = "bb5b3f59-79e3-4d52-9da8-e9f2025a1732";

    expect(
      createClientUuid({
        randomUUID: () => expected
      })
    ).toBe(expected);
  });

  it("creates a valid UUID when randomUUID is unavailable", () => {
    const value = createClientUuid({
      getRandomValues: (bytes) => {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      }
    });

    expect(value).toMatch(uuidPattern);
  });

  it("still creates a valid UUID in an older webview without Web Crypto", () => {
    expect(createClientUuid(undefined)).toMatch(uuidPattern);
  });
});
