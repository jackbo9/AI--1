import type { EmployeeActivityInput, VisualPreference } from "@/contracts/poster";
import type { RenderTargetId } from "@/contracts/brand";
import type { ActivityJob } from "./types";

type ErrorPayload = { error?: { message?: string } };

export type ApiResult<T> = {
  ok: boolean;
  payload: T;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error("服务返回空响应，请稍后重试");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("服务返回了无法解析的响应，请刷新后重试");
  }
}

async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { ok: response.ok, payload: await readJson<T>(response) };
}

export async function fetchActivityJob(id: string): Promise<ApiResult<ActivityJob | ErrorPayload>> {
  const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    return { ok: false, payload };
  }
  return { ok: true, payload: await readJson<ActivityJob>(response) };
}

export function requestJobCreation(input: EmployeeActivityInput, idempotencyKey: string, skipCopy = false, renderTargets?: RenderTargetId[]) {
  return postJson<{ jobId?: string; error?: { message: string } }>("/api/jobs", {
    input,
    idempotencyKey,
    skipCopy,
    renderTargets
  });
}

export function requestCopyConfirmation(
  jobId: string,
  content: {
    title: string;
    slogan: string;
    subtitle: string;
    summary: string;
    highlights: string[];
    participationSteps: string[];
    rules: string;
    prize: string;
  },
  idempotencyKey: string
) {
  return postJson<ErrorPayload>(`/api/jobs/${jobId}/confirm-copy`, {
    content,
    idempotencyKey
  });
}

export function requestVisualRefinement(
  jobId: string,
  visualIntent: string,
  preferences: VisualPreference,
  idempotencyKey: string
) {
  return postJson<ErrorPayload>(`/api/jobs/${jobId}/refine-visual`, {
    visualIntent,
    preferences,
    idempotencyKey
  });
}

export function requestVisualConfirmation(
  jobId: string,
  sourceDraftCreatedAt: string,
  description: string,
  idempotencyKey: string
) {
  return postJson<ErrorPayload>(`/api/jobs/${jobId}/confirm-visual`, {
    sourceDraftCreatedAt,
    description,
    idempotencyKey
  });
}

export function requestVisualReplacement(jobId: string, idempotencyKey: string) {
  return postJson<ErrorPayload>(`/api/jobs/${jobId}/regenerate-asset`, {
    idempotencyKey
  });
}

export function requestVisualOptionSelection(jobId: string, optionId: string) {
  return postJson<ErrorPayload>(
    `/api/jobs/${jobId}/visual-options/select`,
    { optionId }
  );
}

export function requestVisualOptionConfirmation(
  jobId: string,
  optionId: string,
  idempotencyKey: string
) {
  return postJson<ErrorPayload>(
    `/api/jobs/${jobId}/visual-options/confirm`,
    { optionId, idempotencyKey }
  );
}

export async function requestQrUpload(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/uploads/qr", {
    method: "POST",
    body: formData
  });
  return {
    ok: response.ok,
    payload: await readJson<{
      assetId?: string;
      filename?: string;
      previewUrl?: string;
      error?: { message?: string };
    }>(response)
  };
}
