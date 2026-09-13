import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/integrations/feishu/session";
import { serverEnv } from "@/lib/env";
import { syncUserIdentity } from "./postgres-job-repository";

export async function requireApiIdentity() {
  const identity = await getCurrentIdentity();
  if (identity && serverEnv.DATABASE_URL) await syncUserIdentity(identity);
  return identity;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: {
        code: "AUTH_REQUIRED",
        message: "请从飞书工作台重新进入应用"
      }
    },
    { status: 401 }
  );
}

export function forbiddenResponse() {
  return NextResponse.json(
    {
      error: {
        code: "JOB_FORBIDDEN",
        message: "你无权访问该生成任务"
      }
    },
    { status: 403 }
  );
}
