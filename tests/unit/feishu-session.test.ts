import { describe, expect, it } from "vitest";
import {
  signSession,
  verifySession
} from "@/integrations/feishu/session-token";

const secret = "test-session-secret-with-at-least-32-characters";
const payload = {
  userId: "feishu:tenant:open-id",
  openId: "open-id",
  tenantKey: "tenant",
  displayName: "测试用户",
  expiresAt: 2_000
};

describe("Feishu session token", () => {
  it("verifies an untampered session", () => {
    const token = signSession(payload, secret);
    expect(verifySession(token, secret, 1_000)).toEqual(payload);
  });

  it("rejects tampered and expired sessions", () => {
    const token = signSession(payload, secret);
    expect(verifySession(`${token}x`, secret, 1_000)).toBeUndefined();
    expect(verifySession(token, secret, 3_000)).toBeUndefined();
  });
});
