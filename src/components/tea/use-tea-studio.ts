"use client";
import { useEffect, useRef, useState } from "react";
import { emptyTeaFields, teaFieldsSchema, teaScene, sameTeaFields, type TeaFields, type TeaJob } from "@/contracts/tea";
import type { Stage } from "../activity-studio/types";

async function jsonRequest(url: string, body?: unknown) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "操作失败，请重试");
  return data;
}
export function useTeaStudio(active: boolean, initialJobId?: string, fixture = false) {
  const [fields, setFields] = useState<TeaFields>({ ...emptyTeaFields });
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<Stage>(1);
  const [job, setJob] = useState<TeaJob>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(initialJobId));
  const revision = useRef(0), lock = useRef(false), currentFields = useRef(fields);
  currentFields.current = fields;
  const working = job?.status === "GENERATING_ASSET" || job?.status === "RENDERING";
  const jobId = job?.id;
  const update = (key: keyof TeaFields, value: string) => { revision.current += 1; setFields(f => ({ ...f, [key]: value })); };
  useEffect(() => {
    if (!initialJobId || fixture) { setRestoring(false); return; }
    let live = true;
    void jsonRequest(`/api/jobs/${initialJobId}`).then((loaded: TeaJob) => {
      if (!live) return;
      if (loaded.scene !== teaScene) throw new Error("任务场景不匹配");
      setJob(loaded); setFields(loaded.fields); setExpanded(true);
      setStage(loaded.status === "READY_FOR_REVIEW" || loaded.status === "RENDERING" ? 3 : 1);
    }).catch(e => live && setError(e.message)).finally(() => live && setRestoring(false));
    return () => { live = false; };
  }, [initialJobId, fixture]);
  useEffect(() => {
    if (!active) return;
    const query = new URLSearchParams(window.location.search);
    query.set("scene", teaScene);
    if (jobId && !fixture) query.set("job", jobId); else if (!restoring) query.delete("job");
    window.history.replaceState(null, "", `?${query}`);
  }, [active, jobId, fixture, restoring]);
  useEffect(() => {
    if (!jobId || !working || fixture) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const next = await jsonRequest(`/api/jobs/${jobId}`) as TeaJob; if (live) { setJob(next); setError(next.error); if (next.error) setStage(1); } }
      catch { if (live) setError("状态读取暂时失败，正在重新连接；请勿重复生成。"); }
      if (live) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1000);
    return () => { live = false; clearTimeout(timer); };
  }, [jobId, working, fixture]);

  const perform = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(undefined);
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : "操作失败，请重试"); }
    finally { lock.current = false; setPending(false); }
  };
  const extract = () => perform(async () => {
    const before = revision.current;
    const brief = currentFields.current.brief.trim();
    if (!brief) throw new Error("请填写下午茶想法");
    const result = fixture ? { fields: { ...emptyTeaFields, brief, food: "无花果", title: "午后鲜享", subtitle: "新鲜无花果，清甜好时光", visualPrompt: "新鲜无花果切面，细腻果肉，自然色，浅色留白。" }, missing: [] } : await jsonRequest("/api/tea/extract", { brief });
    if (revision.current !== before) { setError("内容已被修改，本次整理结果未覆盖你的输入。"); return; }
    setFields(result.fields); setExpanded(true);
    if (result.missing.includes("food")) setError("未识别到食品，请在下方补充食品名称。");
  });
  const ensureJob = async () => {
    const parsed = teaFieldsSchema.safeParse(currentFields.current);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (job && sameTeaFields(job.fields, parsed.data)) return job;
    const next: TeaJob = fixture ? { scene: teaScene, id: crypto.randomUUID(), userId: "fixture", idempotencyKey: crypto.randomUUID(), actionIdempotencyKeys: [], sourceVersionId: crypto.randomUUID(), fields: parsed.data, options: [], outputs: [], status: "READY_FOR_VISUAL_REVIEW", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : await jsonRequest("/api/jobs", { scene: teaScene, fields: parsed.data, previousJobId: job?.id, idempotencyKey: crypto.randomUUID() });
    setJob(next); return next;
  };
  const submit = () => perform(async () => { await ensureJob(); setStage(1); });
  const action = (kind: "generate" | "retry" | "select" | "confirm", optionId?: string) => perform(async () => {
    const current = kind === "generate" ? await ensureJob() : job;
    if (!current) throw new Error("请先确认内容");
    if (kind !== "generate" && !sameTeaFields(current.fields, currentFields.current)) throw new Error("内容已修改，请重新生成图片后再选择排版。");
    if (fixture) {
      if (kind === "generate") setJob({ ...current, options: [0, 1].map(i => ({ id: crypto.randomUUID(), batchId: "fixture", direction: `演练方案 ${i + 1}`, status: "READY", description: fields.visualPrompt, sourceVersionId: current.sourceVersionId, previewUrl: "/brand/employee-activity-fallback.svg" })) });
      else if (kind === "select") setJob({ ...current, selectedVisualOptionId: optionId });
      else if (kind === "confirm") { setStage(3); setError("交互演练已完成；正式海报需在真实流程中生成。"); }
      return;
    }
    const endpoint = { generate: "confirm-visual", retry: "visual-options/retry", select: "visual-options/select", confirm: "visual-options/confirm" }[kind];
    const next = await jsonRequest(`/api/jobs/${current.id}/${endpoint}`, { idempotencyKey: crypto.randomUUID(), sourceVersionId: current.sourceVersionId, optionId, description: currentFields.current.visualPrompt }) as TeaJob;
    setJob(next); if (kind === "confirm") setStage(3);
  });
  const restart = () => { revision.current++; setFields({ ...emptyTeaFields }); setJob(undefined); setExpanded(false); setStage(1); setError(undefined); };
  return { fields, expanded, stage, setStage, job, error, pending, restoring, working, update, extract, submit, action, restart };
}
export type TeaController = ReturnType<typeof useTeaStudio>;
