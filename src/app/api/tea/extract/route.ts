import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiIdentity, unauthorizedResponse } from "@/server/auth";
import { readJsonRequest } from "@/server/request-json";
import { extractTea } from "@/providers/tea-provider";
import { ProviderError } from "@/providers/provider-error";

export async function POST(request: Request) {
  if (!await requireApiIdentity()) return unauthorizedResponse();
  const body = await readJsonRequest(request);
  const parsed = z.object({ brief: z.string().trim().min(1, "请填写下午茶想法").max(2000) }).safeParse(body.ok ? body.value : undefined);
  if (!parsed.success) return NextResponse.json({ error: { message: "请填写不超过 2000 字的下午茶想法" } }, { status: 400 });
  try { return NextResponse.json(await extractTea(parsed.data.brief)); }
  catch (cause) { return NextResponse.json({ error: { message: cause instanceof ProviderError ? cause.message : "整理失败，请重试" } }, { status: 502 }); }
}
