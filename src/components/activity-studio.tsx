"use client";

/* eslint-disable @next/next/no-img-element -- generated PNGs and local brand assets are intentional. */
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  t01PortraitSubtitleMaxCharacters,
  t01PortraitTitleMaxCharacters,
  textCharacterCount,
  type EmployeeActivityInput,
  type PosterDocument
} from "@/contracts/poster";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import { createClientUuid } from "@/lib/client-uuid";
import { T01OutputGallery } from "@/components/t01-output-gallery";
import {
  createFixtureCopyJob,
  createFixtureReadyJob,
  createFixtureVisualDraftJob,
  UI_FIXTURE_JOB_ID,
  UI_FIXTURE_STORAGE_KEY,
  type ActivityStudioFixtureJob
} from "@/components/activity-studio-fixture";

type Stage = 1 | 2 | 3 | 4;
type Job = ActivityStudioFixtureJob;
type SessionState = { date: string; time: string; location: string };
type FormState = { activityName: string; session: SessionState; secondSession?: SessionState; audience: string; supplement: string; deadline: string; contact: string; rules: string; prize: string; qrUrl: string; qrAssetId: string; qrAssetPreviewUrl?: string; qrAssetName: string };
type CopyReview = {
  subtitle: string;
  summary: string;
  rules: string;
  prize: string;
};

const initialForm: FormState = {
  activityName: "羽球挑战赛",
  session: { date: "2026-09-18", time: "18:30–20:30", location: "九号园区体育馆" },
  audience: "全体员工",
  supplement: "零基础也能参加，现场自由组队",
  deadline: "9月16日 18:00",
  contact: "行政服务台",
  rules: "小组循环赛\n三局两胜",
  prize: "冠军运动礼包\n参与纪念礼",
  qrUrl: "",
  qrAssetId: "",
  qrAssetName: ""
};

function newFormState(): FormState {
  return {
    ...initialForm,
    session: { ...initialForm.session }
  };
}
const scenes = [
  ["01", "员工活动", "节日 / 安全 / 差旅 / 体育赛事 / 员工俱乐部", "当前切片"],
  ["02", "员工福利", "下午茶 / 周边折扣 / 体检与商务保险 / 员工关怀", "后续开放"],
  ["03", "员工通知", "安全通知 / 温馨提示 / 截止提醒", "后续开放"],
  ["04", "调查问卷", "满意度调研 / 体验改善 / 行政调研", "后续开放"]
] as const;
const stages: Array<[Stage, string]> = [[1, "填写需求"], [2, "确认文案"], [3, "生成主视觉"], [4, "排版导出"]];

export function ActivityStudio({ identity, fixtureMode = false }: { identity: { displayName: string; provider: "local" | "feishu" }; fixtureMode?: boolean }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [stage, setStage] = useState<Stage>(1);
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<Job>();
  const [copyReview, setCopyReview] = useState<CopyReview>();
  const [visualIdea, setVisualIdea] = useState("");
  const [visualDescription, setVisualDescription] = useState("");
  const [qrMode, setQrMode] = useState<"none" | "add">("none");
  const [qrUploadPending, setQrUploadPending] = useState(false);
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const [pendingAction, setPendingAction] = useState<"submit" | "copy" | "refine" | "visual" | "replace">();
  const refreshingRef = useRef(false);
  const visualDescriptionRef = useRef("");
  const working = Boolean(job && ["QUEUED", "VALIDATING_INPUT", "GENERATING_COPY", "REFINING_VISUAL", "GENERATING_ASSET", "RENDERING", "VALIDATING_OUTPUT"].includes(job.status));
  const version = job?.versions.at(-1);
  const previewCopy = job?.copyDraft?.document && copyReview
    ? { ...job.copyDraft.document, subtitle: copyReview.subtitle, summary: copyReview.summary, rules: copyReview.rules, prize: copyReview.prize, participationSteps: normalizeLines(splitDraftLines(copyReview.rules)) }
    : job?.copyDraft?.document;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const storedJobId = searchParams.get("job");
    if (fixtureMode) {
      const storedFixture = window.sessionStorage.getItem(UI_FIXTURE_STORAGE_KEY);
      if (storedJobId === UI_FIXTURE_JOB_ID && storedFixture) {
        try {
          const loaded = JSON.parse(storedFixture) as Job;
          setJobId(UI_FIXTURE_JOB_ID);
          setJob(loaded);
          hydrateJob(loaded);
        } catch {
          window.sessionStorage.removeItem(UI_FIXTURE_STORAGE_KEY);
        }
      }
      return;
    }
    if (!storedJobId) return;
    setRestoring(true);
    setJobId(storedJobId);
    void refreshJob(storedJobId).then((loaded) => {
      if (loaded) hydrateJob(loaded);
      setRestoring(false);
    });
  }, [fixtureMode]);
  useEffect(() => {
    if (!jobId || !working || fixtureMode) return;
    const timer = window.setInterval(() => {
      if (!refreshingRef.current) void refreshJob(jobId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [fixtureMode, jobId, working]);
  useEffect(() => {
    if (fixtureMode && job) {
      window.sessionStorage.setItem(UI_FIXTURE_STORAGE_KEY, JSON.stringify(job));
    }
  }, [fixtureMode, job]);
  useEffect(() => {
    if (!job) return;
    if (job.status === "READY_FOR_COPY_REVIEW") {
      setStage(2);
      if (job.copyDraft) setCopyReview((current) => current ?? { subtitle: job.copyDraft!.document.subtitle, summary: job.copyDraft!.document.summary, rules: job.copyDraft!.document.rules ?? "", prize: job.copyDraft!.document.prize ?? "" });
    } else if (["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(job.status)) {
      setStage(3);
      if (job.visualDraft && !visualDescriptionRef.current) {
        visualDescriptionRef.current = job.visualDraft.description;
        setVisualDescription(job.visualDraft.description);
      }
    } else if (job.status === "READY_FOR_REVIEW") setStage(4);
  }, [job]);

  async function refreshJob(id: string) {
    if (refreshingRef.current) return undefined;
    refreshingRef.current = true;
    try {
      const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(payload.error?.message ?? "任务状态读取失败，请刷新重试");
        return undefined;
      }
      const loaded = await readJson<Job>(response);
      setJob(loaded);
      return loaded;
    } catch {
      setError("本地预览连接中断，请确认开发服务仍在运行后重试");
      return undefined;
    } finally {
      refreshingRef.current = false;
    }
  }
  function hydrateJob(loaded: Job) {
    const document = loaded.copyDraft?.document;
    if (document) setForm((current) => ({ ...current, activityName: document.title, session: document.sessions[0] ?? current.session, secondSession: document.sessions[1] ? { date: document.sessions[1].date, time: document.sessions[1].time, location: document.sessions[1].location } : undefined, audience: document.audience, supplement: document.subtitle || document.summary, rules: document.rules ?? "", prize: document.prize ?? "", qrUrl: document.qrPayload, qrAssetId: document.qrAssetId, qrAssetPreviewUrl: document.qrAssetId ? `/api/uploads/qr/${document.qrAssetId}` : undefined, qrAssetName: document.qrAssetId ? "已上传二维码图片" : "", contact: document.contact, deadline: document.deadline ?? "" }));
    if (loaded.visualInput) setVisualIdea(loaded.visualInput.originalIntent);
    if (loaded.visualDraft) {
      visualDescriptionRef.current = loaded.visualDraft.description;
      setVisualDescription(loaded.visualDraft.description);
    }
  }
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateSession(index: 0 | 1, key: keyof SessionState, value: string) { setForm((current) => ({ ...current, [index === 0 ? "session" : "secondSession"]: { ...(index === 0 ? current.session : current.secondSession), [key]: value } })); }
  function updateQrUrl(value: string) {
    setForm((current) => ({
      ...current,
      qrUrl: value,
      qrAssetId: value.trim() ? "" : current.qrAssetId,
      qrAssetPreviewUrl: value.trim() ? undefined : current.qrAssetPreviewUrl,
      qrAssetName: value.trim() ? "" : current.qrAssetName
    }));
  }
  async function uploadQr(file?: File) {
    if (!file) return;
    setError(undefined);
    setQrUploadPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/uploads/qr", {
        method: "POST",
        body: formData
      });
      const payload = await readJson<{
        assetId?: string;
        filename?: string;
        previewUrl?: string;
        error?: { message?: string };
      }>(response);
      if (!response.ok || !payload.assetId || !payload.previewUrl) {
        setError(payload.error?.message ?? "二维码图片上传失败");
        return;
      }
      setForm((current) => ({
        ...current,
        qrUrl: "",
        qrAssetId: payload.assetId!,
        qrAssetPreviewUrl: payload.previewUrl,
        qrAssetName: payload.filename ?? file.name
      }));
      setQrMode("add");
    } catch {
      setError("二维码图片上传失败，请确认服务仍在运行后重试");
    } finally {
      setQrUploadPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const validationError = validateForm(form);
    if (validationError) return setError(validationError);
    setPendingAction("submit");
    setJob(undefined); setCopyReview(undefined); visualDescriptionRef.current = ""; setVisualDescription("");
    try {
      if (fixtureMode) {
        const input = normalizeForm(form);
        setJobId(UI_FIXTURE_JOB_ID);
        window.history.replaceState(null, "", `?fixture=1&job=${UI_FIXTURE_JOB_ID}`);
        setJob({ id: UI_FIXTURE_JOB_ID, status: "GENERATING_COPY", currentStep: "Fixture 正在生成文案", versions: [] });
        await pauseFixture();
        setJob(createFixtureCopyJob(input));
        return;
      }
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: normalizeForm(form), idempotencyKey: createClientUuid() }) });
      const payload = await readJson<{ jobId?: string; error?: { message: string } }>(response);
      if (!response.ok || !payload.jobId) return setError(payload.error?.message ?? "提交需求失败");
      setJobId(payload.jobId);
      window.history.replaceState(null, "", `?job=${payload.jobId}`);
      setJob({ id: payload.jobId, status: "QUEUED", currentStep: "已进入文案生成队列", versions: [] });
    } finally { setPendingAction(undefined); }
  }
  async function confirmCopy() {
    if (!jobId || !copyReview || !job?.copyDraft) return;
    setError(undefined);
    const document = job.copyDraft.document;
    setPendingAction("copy");
    try {
      if (fixtureMode) {
        await pauseFixture();
        setJob({
          ...job,
          status: "READY_FOR_VISUAL_INPUT",
          currentStep: "等待输入画面想法",
          copyDraft: {
            ...job.copyDraft,
            document: {
              ...document,
              subtitle: copyReview.subtitle,
              summary: copyReview.summary,
              participationSteps: normalizeLines(splitDraftLines(copyReview.rules)),
              rules: copyReview.rules,
              prize: copyReview.prize
            }
          }
        });
        return;
      }
      const response = await fetch(`/api/jobs/${jobId}/confirm-copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: { title: document.title, subtitle: copyReview.subtitle, summary: copyReview.summary, highlights: document.highlights, participationSteps: normalizeLines(splitDraftLines(copyReview.rules)), rules: copyReview.rules, prize: copyReview.prize }, idempotencyKey: createClientUuid() }) });
      const payload = await readJson<{ error?: { message: string } }>(response);
      if (!response.ok) return setError(payload.error?.message ?? "确认文案失败");
      await refreshJob(jobId);
    } finally { setPendingAction(undefined); }
  }
  async function refineVisual() {
    if (job?.status === "REFINING_VISUAL") return;
    if (!jobId || visualIdea.trim().length < 10) return setError("请至少描述 10 个字的画面想法");
    if (visualIdea.trim().length > 420) return setError("画面想法最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    setPendingAction("refine");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "REFINING_VISUAL", currentStep: "Fixture 正在优化画面描述" } : current);
        await pauseFixture();
        setJob((current) => current ? createFixtureVisualDraftJob(current, visualIdea.trim()) : current);
        return;
      }
      const response = await fetch(`/api/jobs/${jobId}/refine-visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visualIntent: visualIdea.trim(), idempotencyKey: createClientUuid() }) });
      const payload = await readJson<{ error?: { message: string } }>(response);
      if (!response.ok) setError(payload.error?.message ?? "优化画面描述失败"); else await refreshJob(jobId);
    } finally { setPendingAction(undefined); }
  }
  async function confirmVisual() {
    if (!jobId || !job?.visualDraft || visualDescription.trim().length < 10) return setError("请先完成画面描述优化并确认内容");
    if (visualDescription.trim().length > 420) return setError("画面描述最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    setPendingAction("visual");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "GENERATING_ASSET", currentStep: "Fixture 正在生成主视觉" } : current);
        await pauseFixture();
        setJob((current) => current ? { ...current, status: "RENDERING", currentStep: "Fixture 正在排版" } : current);
        await pauseFixture();
        setJob((current) => current ? createFixtureReadyJob(current) : current);
        return;
      }
      const response = await fetch(`/api/jobs/${jobId}/confirm-visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceDraftCreatedAt: job.visualDraft.createdAt, description: visualDescription.trim(), idempotencyKey: createClientUuid() }) });
      const payload = await readJson<{ error?: { message: string } }>(response);
      if (!response.ok) setError(payload.error?.message ?? "确认主视觉失败"); else await refreshJob(jobId);
    } finally { setPendingAction(undefined); }
  }
  async function replaceVisual() {
    if (!jobId) return;
    setPendingAction("replace");
    try {
      if (fixtureMode) {
        await pauseFixture();
        visualDescriptionRef.current = "";
        setVisualDescription("");
        setJob((current) => current ? { ...current, status: "READY_FOR_VISUAL_INPUT", currentStep: "等待输入新的画面想法", visualDraft: undefined } : current);
        setStage(3);
        return;
      }
      const response = await fetch(`/api/jobs/${jobId}/regenerate-asset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: createClientUuid() }) });
      const payload = await readJson<{ error?: { message: string } }>(response);
      if (!response.ok) setError(payload.error?.message ?? "返回视觉编辑失败"); else { visualDescriptionRef.current = ""; setVisualDescription(""); setStage(3); await refreshJob(jobId); }
    } finally { setPendingAction(undefined); }
  }
  function startNewPoster() {
    const query = new URLSearchParams(window.location.search);
    query.delete("job");
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query.size ? `?${query}` : "")
    );
    setJobId(undefined);
    setJob(undefined);
    setCopyReview(undefined);
    setVisualIdea("");
    visualDescriptionRef.current = "";
    setVisualDescription("");
    setQrMode("none");
    setQrUploadPending(false);
    setError(undefined);
    setForm(newFormState());
    setStage(1);
  }
  const statusLabel = useMemo(() => !job ? "填写完成后开始生成" : job.status === "READY_FOR_COPY_REVIEW" ? "文案待确认" : ["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"].includes(job.status) ? "视觉待确认" : job.status === "READY_FOR_REVIEW" ? "海报已生成" : job.status === "FAILED_FINAL" ? "任务未完成" : job.currentStep, [job]);

  return <div id="employee-activity-demo" lang="zh-CN"><div className="ead-window">
    <header className="ead-topbar"><div className="ead-brand"><img className="ead-brandmark" src="/brand/administration-mark.svg" alt="" /><div><strong>AI 行政设计助手</strong><small>员工活动海报生成</small></div></div><nav className="ead-progress" aria-label="生成流程">{stages.map(([number, label]) => <button type="button" key={number} className={number === stage ? "is-current" : number < stage ? "is-done" : ""} onClick={() => number <= stage && setStage(number)} disabled={number > stage}><i>{number}</i>{label}</button>)}</nav><button type="button" className="ead-save" disabled title="保存功能后续开放">保存草稿</button></header>
    <div className="ead-body"><aside className="ead-sidebar"><h2>选择业务场景</h2><div className="ead-scene-list">{scenes.map(([number, title, description, state]) => <button type="button" className={`ead-scene ${number === "01" ? "is-active" : ""}`} key={number} disabled={number !== "01"}><span className="ead-scene-number">{number}</span><span><b>{title}</b><small>{description}</small></span><em>{state}</em></button>)}</div><div className="ead-side-footer"><button type="button" className="ead-history-entry" disabled title="历史记录待接入"><i>↺</i><b>生成记录</b></button><div className="ead-profile"><span className="ead-avatar">九</span><span><b>{identity.displayName}</b><small>九号公司 · {identity.provider === "feishu" ? "飞书账号" : "本地演示"}</small></span></div></div></aside>
    <main className="ead-workspace"><div className="ead-activity-content"><div className="ead-title-row"><div><em>员工活动</em><h1>制作一套活动海报</h1><p>一份内容，先确认文案，再生成主视觉</p></div><small>{fixtureMode ? "Fixture 交互演练 · 不调用真实模型" : `${identity.provider === "feishu" ? "飞书账号" : "本地演示"} · 状态随任务恢复`}</small></div>{restoring ? <LoadingCard title="正在恢复任务" detail="正在读取本地预览状态…" /> : stage === 1 && <StepOne form={form} qrMode={qrMode} qrUploadPending={qrUploadPending} onField={updateForm} onQrUrl={updateQrUrl} onSession={updateSession} onAddSecond={() => setForm((current) => ({ ...current, secondSession: { date: "", time: "", location: "" } }))} onRemoveSecond={() => setForm((current) => ({ ...current, secondSession: undefined }))} onQrMode={(mode) => { setQrMode(mode); if (mode === "none") setForm((current) => ({ ...current, qrUrl: "", qrAssetId: "", qrAssetPreviewUrl: undefined, qrAssetName: "" })); }} onQrUpload={uploadQr} onClearQrAsset={() => setForm((current) => ({ ...current, qrAssetId: "", qrAssetPreviewUrl: undefined, qrAssetName: "" }))} onSubmit={submit} pending={pendingAction === "submit"} />}{!restoring && stage === 2 && <StepTwo form={form} review={copyReview} job={job} onChange={setCopyReview} onBack={() => setStage(1)} onConfirm={confirmCopy} pending={pendingAction === "copy"} />}{!restoring && stage === 3 && <StepThree job={job} visualIdea={visualIdea} visualDescription={visualDescription} onIdea={setVisualIdea} onDescription={(value) => { visualDescriptionRef.current = value; setVisualDescription(value); }} onRefine={refineVisual} onBack={() => setStage(2)} onConfirm={confirmVisual} pendingRefine={pendingAction === "refine"} pendingConfirm={pendingAction === "visual"} />}{!restoring && stage === 4 && <StepFour job={job} onReplace={replaceVisual} onRestart={startNewPoster} pending={pendingAction === "replace"} fixtureMode={fixtureMode} />}{(error || job?.error) && <p className="ead-error">{error ?? `${job?.error?.message}（${job?.error?.code}）`}</p>}</div></main>
      <aside className="ead-preview"><div className="ead-preview-head"><header><b>实时预览</b><span>{fixtureMode ? "Fixture 演练" : statusLabel}</span></header><div className="ead-size-tabs"><button type="button" className="is-selected">1080 × 1920</button></div><small className="ead-size-note">排版导出中可生成横版、Banner 和长图</small></div><div className="ead-canvas-wrap"><div className="ead-poster-frame is-portrait">{job?.previewUrl ? <img className="ead-generated-poster" src={job.previewUrl} alt="生成的员工活动海报" /> : <Preview form={form} copy={previewCopy} hasQr={qrMode === "add" && (Boolean(form.qrUrl) || Boolean(form.qrAssetId))} />}</div></div>{stage === 4 && job?.previewUrl && <div className="ead-exportbar"><a href={job.previewUrl} download={fixtureMode ? "employee-activity-fixture.svg" : "employee-activity-t01.png"}>{fixtureMode ? "下载演练稿" : version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载试用稿"}</a><small>{fixtureMode ? "Fixture 成品 · 不代表真实生成质量" : `当前尺寸：1080 × 1920 · ${version?.validation.strategy === "trial" ? "试用策略" : "严格策略"}`}</small></div>}</aside>
    </div></div></div>;
}

function StepOne({ form, qrMode, qrUploadPending, onField, onQrUrl, onSession, onAddSecond, onRemoveSecond, onQrMode, onQrUpload, onClearQrAsset, onSubmit, pending }: { form: FormState; qrMode: "none" | "add"; qrUploadPending: boolean; onField: <K extends keyof FormState>(key: K, value: FormState[K]) => void; onQrUrl: (value: string) => void; onSession: (index: 0 | 1, key: keyof SessionState, value: string) => void; onAddSecond: () => void; onRemoveSecond: () => void; onQrMode: (mode: "none" | "add") => void; onQrUpload: (file?: File) => void; onClearQrAsset: () => void; onSubmit: (event: FormEvent) => void; pending: boolean }) {
  const sessionFields = (session: SessionState, index: 0 | 1) => <div className="ead-session-block" key={index}><div className="ead-session-heading"><b>{index === 0 ? "第一场" : "第二场"}</b>{index === 1 && <button type="button" onClick={onRemoveSecond}>移除</button>}</div><div className="ead-grid"><Field label="日期" required type="date" value={session.date} onChange={(value) => onSession(index, "date", value)} /><Field label="时间" required value={session.time} onChange={(value) => onSession(index, "time", value)} /><Field className="ead-span-2" label="地点" required value={session.location} onChange={(value) => onSession(index, "location", value)} /></div></div>;
  return <form onSubmit={onSubmit}><section className="ead-section"><SectionHead index="01" title="必填信息" hint="用于锁定活动事实，不由 AI 擅自修改" /><div className="ead-grid"><Field className="ead-span-2" label="主题" required value={form.activityName} maxLength={t01PortraitTitleMaxCharacters} hint={`T01 竖版标题最多 ${t01PortraitTitleMaxCharacters} 个字，超出无法生成`} onChange={(value) => onField("activityName", value)} /><Field className="ead-span-2" label="参与对象" required value={form.audience} onChange={(value) => onField("audience", value)} /></div>{sessionFields(form.session, 0)}{form.secondSession ? sessionFields(form.secondSession, 1) : <button type="button" className="ead-add-session" onClick={onAddSecond}>＋ 添加第二场</button>}</section><section className="ead-section"><SectionHead index="02" title="可选信息" hint="未填写的内容不会出现在海报上" /><div className="ead-grid"><TextField className="ead-span-2" label="补充说明" value={form.supplement} onChange={(value) => onField("supplement", value)} /><Field label="截止时间" value={form.deadline} onChange={(value) => onField("deadline", value)} /><Field label="联系人" value={form.contact} onChange={(value) => onField("contact", value)} /><TextField label="活动规则（长图可用空行分段、标题：正文）" value={form.rules} onChange={(value) => onField("rules", value)} /><TextField label="奖品" value={form.prize} onChange={(value) => onField("prize", value)} /><div className="ead-qr-subsection"><div className="ead-qr-title"><b>二维码</b><small>链接生成或上传图片二选一</small></div><div className="ead-qr-options"><button type="button" className={qrMode === "none" ? "is-selected" : ""} onClick={() => onQrMode("none")}>○ 不添加</button><button type="button" className={qrMode === "add" ? "is-selected" : ""} onClick={() => onQrMode("add")}>＋ 添加</button></div>{qrMode === "add" && <div className="ead-qr-add"><div className="ead-qr-add-grid"><input type="url" placeholder="粘贴报名 URL（会生成二维码）" value={form.qrUrl} onChange={(event) => onQrUrl(event.target.value)} /><label className="ead-upload-label">{qrUploadPending ? "正在上传…" : "上传二维码图片"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={qrUploadPending} onChange={(event) => { onQrUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div><div className="ead-upload-status"><span>{qrUploadPending ? "正在安全校验并保存二维码图片…" : form.qrAssetId ? `已上传：${form.qrAssetName}（将进入最终海报）` : form.qrUrl ? "URL 将用于服务端生成二维码" : "支持 PNG / JPEG / WebP，最大 5MB，最小 96 × 96 像素"}</span>{form.qrAssetId && <button type="button" onClick={onClearQrAsset}>移除图片</button>}</div></div>}</div></div></section><button type="submit" className="ead-primary" disabled={pending || qrUploadPending}>{pending ? "正在提交…" : qrUploadPending ? "二维码图片上传中…" : "交给 AI 优化文案 →"}</button><p className="ead-submit-note">主题限 {t01PortraitTitleMaxCharacters} 个字；主题、日期、时间、地点和参与对象将在后续步骤保持不变。二维码链接或已上传图片会作为锁定事实进入最终海报。</p></form>;
}
function StepTwo({ form, review, job, onChange, onBack, onConfirm, pending }: { form: FormState; review?: CopyReview; job?: Job; onChange: (value: CopyReview) => void; onBack: () => void; onConfirm: () => void; pending: boolean }) {
  const document = job?.copyDraft?.document;
  if (!review || !document) return <LoadingCard title="正在生成文案" detail={job?.currentStep ?? "请稍候…"} />;
  return <section className="ead-section"><SectionHead index="02" title="确认文案" hint="必填事实只读；可选叙述可继续微调" /><div className="ead-copy-note">副标题会直接进入 T01 竖版海报，最多 {t01PortraitSubtitleMaxCharacters} 个字；AI 已按该容量生成，仍可编辑。</div><div className="ead-readonly-facts"><span><b>主题</b>{form.activityName}</span><span><b>时间</b>{[form.session, ...(form.secondSession ? [form.secondSession] : [])].map((session) => `${session.date} · ${session.time}`).join(" / ")}</span><span><b>地点</b>{[form.session, ...(form.secondSession ? [form.secondSession] : [])].map((session) => session.location).join(" / ")}</span><span><b>对象</b>{form.audience}</span></div><div className="ead-compare"><div><small>原始输入</small><p>{form.supplement || "未填写"}</p><p>{form.rules || "未填写"}</p><p>{form.prize || "未填写"}</p></div><div><small>AI 优化后，可编辑</small><TextField label={`副标题（最多 ${t01PortraitSubtitleMaxCharacters} 字）`} value={review.subtitle} maxLength={t01PortraitSubtitleMaxCharacters} onChange={(value) => onChange({ ...review, subtitle: value })} /><TextField label="补充说明（不展示在当前竖版）" value={review.summary} onChange={(value) => onChange({ ...review, summary: value })} /><TextField label="活动规则" value={review.rules} onChange={(value) => onChange({ ...review, rules: value })} /><TextField label="奖品" value={review.prize} onChange={(value) => onChange({ ...review, prize: value })} /></div></div><p className="ead-unprojected">截止时间与联系人用于长图，竖版不展示；奖品保存到任务，当前暂无独立展示槽位。</p><div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onBack} disabled={pending}>返回修改</button><button type="button" className="ead-primary" onClick={onConfirm} disabled={pending}>{pending ? "正在确认…" : "确认文案，进入主视觉 →"}</button></div></section>;
}
function StepThree({ job, visualIdea, visualDescription, onIdea, onDescription, onRefine, onBack, onConfirm, pendingRefine, pendingConfirm }: { job?: Job; visualIdea: string; visualDescription: string; onIdea: (value: string) => void; onDescription: (value: string) => void; onRefine: () => void; onBack: () => void; onConfirm: () => void; pendingRefine: boolean; pendingConfirm: boolean }) {
  const promptId = useId();
  const hasDraft = Boolean(job?.visualDraft);
  const promptValue = hasDraft ? visualDescription : visualIdea;
  const updatePrompt = hasDraft ? onDescription : onIdea;
  if (job?.status === "REFINING_VISUAL") return <LoadingCard title="正在优化画面描述" detail={job.currentStep} />;
  if (job?.status === "GENERATING_ASSET" || job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT") return <LoadingCard title="正在生成主视觉" detail={job.currentStep} />;
  return <section className="ead-visual-workbench"><div className="ead-visual-block"><SectionHead index="03" title="确认主视觉 Prompt" hint="确认内容直接进入图片模型" /><label className="ead-visual-label" htmlFor={promptId}>{hasDraft ? "确认前可编辑的画面描述" : "你的画面想法"}</label><textarea id={promptId} className="ead-visual-prompt" rows={5} value={promptValue} onChange={(event) => updatePrompt(event.target.value)} placeholder="例如：几位同事在室内羽毛球场轻松对打，橙红色运动摄影，画面有能量但保持克制" /><div className="ead-constraint-row"><div><b>固定视觉约束</b><span>由系统在 Provider 边界统一注入</span></div><div className="ead-constraint-chips"><span>无文字 / Logo / 二维码</span><span>左上低信息留白</span><span>中右视觉主体</span><span>确认文本不再改写</span></div></div><div className="ead-generate-row"><p>{hasDraft ? "当前草稿可直接编辑后确认；重新优化时会基于最初画面想法生成新草稿。" : "描述主体、动作、环境、风格和氛围。未指定风格时默认采用自然商业摄影。"}</p><button type="button" className="ead-primary" onClick={onRefine} disabled={visualIdea.trim().length < 10 || pendingRefine}>{pendingRefine ? "正在优化…" : hasDraft ? "重新优化草稿" : "AI 优化画面描述"}</button></div>{hasDraft && <div className="ead-draft-badge">{job!.visualDraft!.fallback ? "本地规则兜底 · 仍需确认" : `${job!.visualDraft!.provider} 已生成优化草稿`}</div>}</div><div className="ead-visual-divider" /><div className="ead-visual-block ead-visual-confirm"><SectionHead index="04" title="确认并生成" hint="当前为一张视觉母图，不伪造候选版本" /><p className="ead-model-note">只会把确认后的描述交给图片模型；不会自动再次改写。横版、Banner 和长图会复用同一视觉母图。</p><div className="ead-stage-actions ead-visual-actions"><button type="button" className="ead-secondary" onClick={onBack} disabled={pendingConfirm}>返回文案</button><button type="button" className="ead-primary" onClick={onConfirm} disabled={!job?.visualDraft || visualDescription.trim().length < 10 || pendingConfirm}>{pendingConfirm ? "正在生成…" : "确认并生成主视觉 →"}</button></div></div></section>;
}
function StepFour({ job, onReplace, onRestart, pending, fixtureMode }: { job?: Job; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  return <><StepFourQuality job={job} onReplace={onReplace} onRestart={onRestart} pending={pending} fixtureMode={fixtureMode} />{!fixtureMode && job?.id && job.previewUrl && <T01OutputGallery key={job.id} jobId={job.id} />}</>;
}
function StepFourQuality({ job, onReplace, onRestart, pending, fixtureMode }: { job?: Job; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  if (!job?.previewUrl) return <LoadingCard title="正在排版导出" detail={job?.currentStep ?? "请稍候…"} />;
  const validation = job.versions.at(-1)?.validation;
  const checks = [["字体与双 Logo 资产", validation?.checks?.fontAndLogos], ["标题与正文没有溢出", validation?.checks?.capacity], ["图文对比度", validation?.readability?.passed], ["输出尺寸 1080 × 1920", validation?.checks?.outputSize]] as const;
  const trialWarning = validation && !validation.passed && validation.exportAllowed;
  return <section className="ead-section ead-quality"><div className="ead-quality-head"><div><h3>{fixtureMode ? "Fixture 交互验收" : "品牌质量校验"}</h3><p>{fixtureMode ? "四步交互已跑通；未执行真实生成与品牌检查" : trialWarning ? "基础检查通过，可下载试用稿" : validation?.passed ? "全部实际检查通过" : "存在阻断项，暂不可下载"}</p></div><div className={`ead-status-pill ${validation?.passed ? "is-pass" : trialWarning ? "is-warning" : "is-fail"}`}>{fixtureMode ? "演练通过" : validation?.passed ? "通过" : trialWarning ? "警告" : "阻断"}</div></div><div className="ead-check-grid">{checks.map(([label, passed]) => <div className={`ead-check-row ${passed === false ? "is-failed" : ""}`} key={label}><i>{passed === undefined ? "—" : passed ? "✓" : "!"}</i><span>{label}</span><small>{fixtureMode ? "Fixture 模拟" : passed === undefined ? "未记录" : passed ? "通过" : label === "图文对比度" ? "文字与背景对比度待优化" : "未通过"}</small></div>)}</div>{trialWarning && !fixtureMode && <p className="ead-trial-note">当前使用试用策略：保留已生成背景，不替换为默认底图，也不添加背景遮罩；真实可读性警告不改写为通过。可下载试用稿。</p>}<div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onRestart}>开始新海报</button><button type="button" className="ead-secondary" onClick={onReplace} disabled={pending}>{pending ? "正在返回…" : "只换主视觉"}</button></div></section>;
}
function LoadingCard({ title, detail }: { title: string; detail: string }) { return <section className="ead-section ead-loading"><span className="ead-loading-dot" /><h3>{title}</h3><p>{detail}</p></section>; }
function SectionHead({ index, title, hint }: { index: string; title: string; hint: string }) { return <div className="ead-section-head"><div><span className="ead-index">{index}</span><h3>{title}</h3></div><small>{hint}</small></div>; }
function Field({ className = "", label, value, onChange, required = false, type = "text", maxLength, hint }: { className?: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; maxLength?: number; hint?: string }) { const id = useId(); return <div className={`ead-field ${className}`}><label htmlFor={id}>{label} {required && <i>必填</i>}</label><input id={id} type={type} value={value} required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />{(hint || maxLength) && <small className="ead-field-hint">{hint}{hint && maxLength ? " · " : ""}{maxLength ? `${textCharacterCount(value)} / ${maxLength}` : ""}</small>}</div>; }
function TextField({ className = "", label, value, onChange, placeholder = "", maxLength }: { className?: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) { const id = useId(); return <div className={`ead-field ${className}`}><label htmlFor={id}>{label}</label><textarea id={id} rows={3} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />{maxLength && <small className="ead-field-hint">{textCharacterCount(value)} / {maxLength}</small>}</div>; }
function Preview({ form, copy, hasQr }: { form: FormState; copy?: PosterDocument; hasQr: boolean }) {
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  const participation = copy?.participationSteps?.length ? copy.participationSteps : normalizeLines(splitDraftLines(form.rules));
  return <div className="t01-preview"><img className="t01-preview-background" src="/brand/employee-activity-fallback.svg" alt="" /><header className="t01-preview-header"><img src="/brand/company-logo.svg" alt="九号公司" /><img src="/brand/administration-mark.svg" alt="行政" /></header><section className="t01-preview-title"><h3>{copy?.title || form.activityName || "活动主题"}</h3><p>{copy ? copy.subtitle : form.supplement || "活动说明将在确认后显示"}</p></section><section className="t01-preview-info t01-preview-sessions"><h4>活动时间/地点</h4>{sessions.map((session, index) => <p key={`${index}-${session.date}`}>{session.date || "日期"} {session.time || "时间"} · {session.location || "地点"}</p>)}</section><section className="t01-preview-info t01-preview-audience"><h4>参与对象</h4><p>{form.audience || "参与对象"}</p></section><section className={`t01-preview-info t01-preview-participation ${hasQr ? "has-qr" : ""}`}><h4>参与方式</h4>{participation.slice(0, 2).map((step, index) => <p key={`${index}-${step}`}>{step}</p>)}</section>{hasQr && <aside className="t01-preview-qr"><b>QR</b><span>扫码报名</span></aside>}<footer className="t01-preview-footer"><span>九号行政</span><span>员工活动</span></footer></div>;
}
function validateForm(form: FormState) {
  if (!form.activityName.trim()) return "请填写活动主题";
  if (textCharacterCount(form.activityName) > t01PortraitTitleMaxCharacters) return `T01 竖版主题最多 ${t01PortraitTitleMaxCharacters} 个字，请精简后再生成`;
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  if (sessions.some((session) => !session.date || !session.time.trim() || !session.location.trim())) return "请完整填写每一场的日期、时间和地点";
  if (!form.audience.trim()) return "请填写参与对象";
  if (form.qrUrl && !/^https?:\/\//i.test(form.qrUrl)) return "二维码 URL 必须以 http:// 或 https:// 开头";
  if (form.qrUrl && form.qrAssetId) return "二维码链接与上传图片只能选择一种";
  return undefined;
}
function normalizeForm(form: FormState): EmployeeActivityInput {
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  return { outputFormat: "portrait_1080x1920", activityName: form.activityName.trim(), category: "team", themeKeywords: [], description: form.supplement.trim(), sessions: sessions.map((session, index) => ({ label: index === 0 ? "第一场" : "第二场", date: session.date, time: session.time.trim(), location: session.location.trim(), details: [] })), audience: form.audience.trim(), highlights: [], participationSteps: normalizeLines(splitDraftLines(form.rules)), notice: "", includeQr: Boolean(form.qrUrl || form.qrAssetId), ctaLabel: "", qrPayload: form.qrUrl.trim(), qrAssetId: form.qrAssetId, contact: form.contact.trim(), visualIntent: "", deadline: form.deadline.trim(), rules: form.rules.trim(), prize: form.prize.trim() };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error("服务返回空响应，请稍后重试");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("服务返回了无法解析的响应，请刷新后重试");
  }
}

function pauseFixture() {
  return new Promise((resolve) => window.setTimeout(resolve, 350));
}
