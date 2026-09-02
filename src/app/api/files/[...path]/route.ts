import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(_: Request, context: { params: Promise<{ path: string[] }> }) { const filename = (await context.params).path.join("/"); if (!/^[a-zA-Z0-9-]+\.png$/.test(filename)) return new NextResponse("Not found", { status: 404 }); try { return new NextResponse(await readFile(path.join(process.cwd(), "data", "generated", filename)), { headers: { "Content-Type": "image/png", "Content-Disposition": `inline; filename="${filename}"` } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
