import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/integrations/feishu/session";

export const runtime = "nodejs";

export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) {
    return NextResponse.json(
      {
        authenticated: false,
        error: { code: "AUTH_REQUIRED", message: "请先通过飞书登录" }
      },
      { status: 401 }
    );
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: identity.userId,
      displayName: identity.displayName,
      provider: identity.provider
    }
  });
}
