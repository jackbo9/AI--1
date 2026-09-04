"use client";

/* eslint-disable @next/next/no-img-element -- generated PNGs and local brand assets are intentional. */
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { EmployeeActivityInput, PosterDocument } from "@/contracts/poster";
import { splitDraftLines } from "@/components/multiline-fields";
import { createClientUuid } from "@/lib/client-uuid";

type Stage = 1 | 2 | 3 | 4;
type Job = {
  id?: string;
  status: string;
  currentStep: string;
  error?: { code: string; message: string };
  previewUrl?: string;
  copyDraft?: { document: PosterDocument; provider: string; model: string; createdAt: string };
  visualDraft?: { description: string; provider: string; promptVersion: string; sourceCopyCreatedAt: string; createdAt: string; fallback: boolean };
  versions: Array<{ assetMode: string; assetDetail?: string; outputFormat: string; templateVersion: string; modelInfo: { copyProvider: string; imageProvider: string }; validation: { passed: boolean; exportAllowed?: boolean; strategy?: "strict" | "trial"; messages: string[]; readability?: { passed: boolean; backgroundMode: string } } }>;
};
type SessionState = { date: string; time: string; location: string };
type FormState = { activityName: string; session: SessionState; secondSession?: SessionState; audience: string; supplement: string; deadline: string; contact: string; rules: string; prize: string; qrUrl: string };
type CopyReview = { summary: string; rules: string; prize: string };

const initialForm: FormState = {
  activityName: "夏日羽毛球挑战赛",
  session: { date: "2026-09-18", time: "18:30–20:30", location: "九号园区体育馆" },
  audience: "全体员工",
  supplement: "零基础也能参加，现场自由组队",
  deadline: "9月16日 18:00",
  contact: "行政服务台",
  rules: "小组循环赛\n三局两胜",
  prize: "冠军运动礼包\n参与纪念礼",
  qrUrl: ""
};
const scenes = [
  ["01", "员工活动", "节日 / 安全 / 差旅 / 体育赛事 / 员工俱乐部", "当前切片"],
  ["02", "员工福利", "下午茶 / 周边折扣 / 体检与商务保险 / 员工关怀", "后续开放"],
  ["03", "员工通知", "安全通知 / 温馨提示 / 截止提醒", "后续开放"],
  ["04", "调查问卷", "满意度调研 / 体验改善 / 行政调研", "后续开放"]
] as const;
const stages: Array<[Stage, string]> = [[1, "填写需求"], [2, "确认文案"], [3, "生成主视觉"], [4, "排版导出"]];

export function ActivityStudio({ identity }: { identity: { displayName: string; provider: "local" | "feishu" } }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [stage, setStage] = useState<Stage>(1);
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<Job>();
  const [copyReview, setCopyReview] = useState<CopyReview>();
  const [visualIdea, setVisualIdea] = useState("");
  const [visualDescription, setVisualDescription] = useState("");
  const [qrMode, setQrMode] = useState<"none" | "add">("none");
  const [qrUploadName, setQrUploadName] = useState("");
  const [error, setError] = useState<string>();
  const working = Boolean(job && ["QUEUED", "VALIDATING_INPUT", "GENERATING_COPY", "REFINING_VISUAL", "GENERATING_ASSET", "RENDERING", "VALIDATING_OUTPUT"].includes(job.status));
  const version = job?.versions.at(-1);

  useEffect(() => {
    const storedJobId = new URLSearchParams(window.location.search).get("job");
    if (!storedJobId) return;
    setJobId(storedJobId);
    void refreshJob(storedJobId).then((loaded) => loaded && hydrateJob(loaded));
  }, []);
  useEffect(() => {
    if (!jobId || !working) return;
    const timer = window.setInterval(() => void refreshJob(jobId), 1000);
    return () => window.clearInterval(timer);
  }, [jobId, working]);
  useEffect(() => {
    if (!job) return;
    if (job.status === "READY_FOR_COPY_REVIEW") {
      setStage(2);
      if (job.copyDraft) setCopyReview((current) => current ?? { summary: job.copyDraft!.document.summary, rules: job.copyDraft!.document.rules ?? "", prize: job.copyDraft!.document.prize ?? "" });
    } else if (["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(job.status)) {
      setStage(3);
      if (job.visualDraft && !visualDescription) setVisualDescription(job.visualDraft.description);
    } else if (job.status === "READY_FOR_REVIEW") setStage(4);
  }, [job, visualDescription]);

  async function refreshJob(id: string) {
    const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const loaded = (await response.json()) as Job;
    setJob(loaded);
    return loaded;
  }
  function hydrateJob(loaded: Job) {
    const document = loaded.copyDraft?.document;
    if (document) setForm((current) => ({ ...current, activityName: document.title, session: document.sessions[0] ?? current.session, secondSession: document.sessions[1] ? { date: document.sessions[1].date, time: document.sessions[1].time, location: document.sessions[1].location } : undefined, audience: document.audience, supplement: document.summary, rules: document.rules ?? "", prize: document.prize ?? "", qrUrl: document.qrPayload, contact: document.contact, deadline: document.deadline ?? "" }));
    if (loaded.visualDraft) setVisualDescription(loaded.visualDraft.description);
  }
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateSession(index: 0 | 1, key: keyof SessionState, value: string) { setForm((current) => ({ ...current, [index === 0 ? "session" : "secondSession"]: { ...(index === 0 ? current.session : current.secondSession), [key]: value } })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const validationError = validateForm(form);
    if (validationError) return setError(validationError);
    const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: normalizeForm(form), idempotencyKey: createClientUuid() }) });
    const payload = (await response.json()) as { jobId?: string; error?: { message: string } };
    if (!response.ok || !payload.jobId) return setError(payload.error?.message ?? "提交需求失败");
    setJobId(payload.jobId);
    window.history.replaceState(null, "", `?job=${payload.jobId}`);
    setJob({ id: payload.jobId, status: "QUEUED", currentStep: "已进入文案生成队列", versions: [] });
  }
  async function confirmCopy() {
    if (!jobId || !copyReview || !job?.copyDraft) return;
    setError(undefined);
    const document = job.copyDraft.document;
    const response = await fetch(`/api/jobs/${jobId}/confirm-copy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: { title: document.title, subtitle: document.subtitle, summary: copyReview.summary, highlights: document.highlights, participationSteps: splitDraftLines(copyReview.rules), rules: copyReview.rules, prize: copyReview.prize }, idempotencyKey: createClientUuid() }) });
    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) return setError(payload.error?.message ?? "确认文案失败");
    await refreshJob(jobId);
  }
  async function refineVisual() {
    if (!jobId || visualIdea.trim().length < 10) return setError("请至少描述 10 个字的画面想法");
    setError(undefined);
    const response = await fetch(`/api/jobs/${jobId}/refine-visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visualIntent: visualIdea.trim(), idempotencyKey: createClientUuid() }) });
    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) setError(payload.error?.message ?? "优化画面描述失败"); else await refreshJob(jobId);
  }
  async function confirmVisual() {
    if (!jobId || !job?.visualDraft || visualDescription.trim().length < 10) return setError("请先完成画面描述优化并确认内容");
    setError(undefined);
    const response = await fetch(`/api/jobs/${jobId}/confirm-visual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceDraftCreatedAt: job.visualDraft.createdAt, description: visualDescription.trim(), idempotencyKey: createClientUuid() }) });
    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) setError(payload.error?.message ?? "确认主视觉失败"); else await refreshJob(jobId);
  }
  async function replaceVisual() {
    if (!jobId) return;
    const response = await fetch(`/api/jobs/${jobId}/regenerate-asset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: createClientUuid() }) });
    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) setError(payload.error?.message ?? "返回视觉编辑失败"); else { setStage(3); await refreshJob(jobId); }
  }
  const statusLabel = useMemo(() => !job ? "填写完成后开始生成" : job.status === "READY_FOR_COPY_REVIEW" ? "文案待确认" : ["READY_FOR_VISUAL_INPUT", "READY_FOR_VISUAL_REVIEW"].includes(job.status) ? "视觉待确认" : job.status === "READY_FOR_REVIEW" ? "海报已生成" : job.status === "FAILED_FINAL" ? "任务未完成" : job.currentStep, [job]);

  return <div id="employee-activity-demo" lang="zh-CN"><div className="ead-window">
    <header className="ead-topbar"><div className="ead-brand"><img className="ead-brandmark" src="/brand/administration-mark.svg" alt="" /><div><strong>AI 行政设计助手</strong><small>员工活动海报生成</small></div></div><nav className="ead-progress" aria-label="生成流程">{stages.map(([number, label]) => <button type="button" key={number} className={number === stage ? "is-current" : number < stage ? "is-done" : ""} onClick={() => number <= stage && setStage(number)} disabled={number > stage}><i>{number}</i>{label}</button>)}</nav><button type="button" className="ead-save" disabled title="草稿保存待接入">保存草稿</button></header>
    <div className="ead-body"><aside className="ead-sidebar"><h2>选择业务场景</h2><div className="ead-scene-list">{scenes.map(([number, title, description, state]) => <button type="button" className={`ead-scene ${number === "01" ? "is-active" : ""}`} key={number} disabled={number !== "01"}><span className="ead-scene-number">{number}</span><span><b>{title}</b><small>{description}</small></span><em>{state}</em></button>)}</div><div className="ead-side-footer"><button type="button" className="ead-history-entry" disabled title="历史记录待接入"><i>↺</i><b>生成记录</b></button><div className="ead-profile"><span className="ead-avatar">九</span><span><b>{identity.displayName}</b><small>九号公司 · {identity.provider === "feishu" ? "飞书账号" : "本地演示"}</small></span></div></div></aside>
    <main className="ead-workspace"><div className="ead-activity-content"><div className="ead-title-row"><div><em>员工活动</em><h1>制作一套活动海报</h1><p>一份内容、两张母图、四种尺寸联动</p></div><small>草稿自动保存</small></div>{stage === 1 && <StepOne form={form} qrMode={qrMode} qrUploadName={qrUploadName} onField={updateForm} onSession={updateSession} onAddSecond={() => setForm((current) => ({ ...current, secondSession: { date: "", time: "", location: "" } }))} onRemoveSecond={() => setForm((current) => ({ ...current, secondSession: undefined }))} onQrMode={setQrMode} onQrUpload={setQrUploadName} onSubmit={submit} />}{stage === 2 && <StepTwo form={form} review={copyReview} job={job} onChange={setCopyReview} onBack={() => setStage(1)} onConfirm={confirmCopy} />}{stage === 3 && <StepThree job={job} visualIdea={visualIdea} visualDescription={visualDescription} onIdea={setVisualIdea} onDescription={setVisualDescription} onRefine={refineVisual} onBack={() => setStage(2)} onConfirm={confirmVisual} />}{stage === 4 && <StepFour job={job} onReplace={replaceVisual} />}{(error || job?.error) && <p className="ead-error">{error ?? `${job?.error?.message}（${job?.error?.code}）`}</p>}</div></main>
      <aside className="ead-preview"><div className="ead-preview-head"><header><b>实时预览</b><span>{statusLabel}</span></header><div className="ead-size-tabs"><button type="button" className="is-selected">1080 × 1920</button><button type="button" disabled>1920 × 1080</button><button type="button" disabled>2227 × 950</button><button type="button" disabled>1080 × Auto</button></div></div><div className="ead-canvas-wrap"><div className="ead-poster-frame is-portrait"><Preview form={form} copy={job?.copyDraft?.document} /></div></div>{stage === 4 && job?.previewUrl && <div className="ead-exportbar"><a href={job.previewUrl} download="employee-activity-t01.png">{version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载试用稿"}</a><small>当前尺寸：1080 × 1920 · {version?.validation.strategy === "trial" ? "试用策略" : "严格策略"}</small></div>}</aside>
    </div></div></div>;
}

function StepOne({ form, qrMode, qrUploadName, onField, onSession, onAddSecond, onRemoveSecond, onQrMode, onQrUpload, onSubmit }: { form: FormState; qrMode: "none" | "add"; qrUploadName: string; onField: <K extends keyof FormState>(key: K, value: FormState[K]) => void; onSession: (index: 0 | 1, key: keyof SessionState, value: string) => void; onAddSecond: () => void; onRemoveSecond: () => void; onQrMode: (mode: "none" | "add") => void; onQrUpload: (name: string) => void; onSubmit: (event: FormEvent) => void }) {
  const sessionFields = (session: SessionState, index: 0 | 1) => <div className="ead-session-block" key={index}><div className="ead-session-heading"><b>{index === 0 ? "第一场" : "第二场"}</b>{index === 1 && <button type="button" onClick={onRemoveSecond}>移除</button>}</div><div className="ead-grid"><Field label="日期" required type="date" value={session.date} onChange={(value) => onSession(index, "date", value)} /><Field label="时间" required value={session.time} onChange={(value) => onSession(index, "time", value)} /><Field className="ead-span-2" label="地点" required value={session.location} onChange={(value) => onSession(index, "location", value)} /></div></div>;
  return <form onSubmit={onSubmit}><section className="ead-section"><SectionHead index="01" title="必填信息" hint="用于锁定活动事实，不由 AI 擅自修改" /><div className="ead-grid"><Field className="ead-span-2" label="主题" required value={form.activityName} onChange={(value) => onField("activityName", value)} /><Field className="ead-span-2" label="参与对象" required value={form.audience} onChange={(value) => onField("audience", value)} /></div>{sessionFields(form.session, 0)}{form.secondSession ? sessionFields(form.secondSession, 1) : <button type="button" className="ead-add-session" onClick={onAddSecond}>＋ 添加第二场</button>}</section><section className="ead-section"><SectionHead index="02" title="可选信息" hint="未填写的内容不会出现在海报上" /><div className="ead-grid"><TextField className="ead-span-2" label="补充说明" value={form.supplement} onChange={(value) => onField("supplement", value)} /><Field label="截止时间" value={form.deadline} onChange={(value) => onField("deadline", value)} /><Field label="联系人" value={form.contact} onChange={(value) => onField("contact", value)} /><TextField label="活动规则" value={form.rules} onChange={(value) => onField("rules", value)} /><TextField label="奖品" value={form.prize} onChange={(value) => onField("prize", value)} /><div className="ead-qr-subsection"><div className="ead-qr-title"><b>二维码</b><small>可选子类</small></div><div className="ead-qr-options"><button type="button" className={qrMode === "none" ? "is-selected" : ""} onClick={() => onQrMode("none")}>○ 不添加</button><button type="button" className={qrMode === "add" ? "is-selected" : ""} onClick={() => onQrMode("add")}>＋ 添加</button></div>{qrMode === "add" && <div className="ead-qr-add"><div className="ead-qr-add-grid"><input type="url" placeholder="粘贴报名 URL" value={form.qrUrl} onChange={(event) => onField("qrUrl", event.target.value)} /><label className="ead-upload-label">上传二维码图片<input type="file" accept="image/*" onChange={(event) => onQrUpload(event.target.files?.[0]?.name ?? "")} /></label></div><div className="ead-upload-status"><span>{qrUploadName ? `已选择：${qrUploadName}（待后端接入）` : form.qrUrl ? "URL 将用于生成二维码" : "输入 URL 后生成，或选择已有二维码图片"}</span>{qrUploadName && <button type="button" onClick={() => onQrUpload("")}>移除选择</button>}</div></div>}</div></div></section><button type="submit" className="ead-primary">交给 AI 优化文案 →</button><p className="ead-submit-note">主题、日期、时间、地点和参与对象将在后续步骤保持不变。图片二维码上传待后端接入。</p></form>;
}
function StepTwo({ form, review, job, onChange, onBack, onConfirm }: { form: FormState; review?: CopyReview; job?: Job; onChange: (value: CopyReview) => void; onBack: () => void; onConfirm: () => void }) {
  const document = job?.copyDraft?.document;
  if (!review || !document) return <LoadingCard title="正在生成文案" detail={job?.currentStep ?? "请稍候…"} />;
  return <section className="ead-section"><SectionHead index="02" title="确认文案" hint="必填事实只读；可选叙述可继续微调" /><div className="ead-copy-note">AI 只优化已填写的表达方式；主题、日期、时间、地点和参与对象保持原意。</div><div className="ead-readonly-facts"><span><b>主题</b>{form.activityName}</span><span><b>时间</b>{[form.session, ...(form.secondSession ? [form.secondSession] : [])].map((session) => `${session.date} · ${session.time}`).join(" / ")}</span><span><b>地点</b>{[form.session, ...(form.secondSession ? [form.secondSession] : [])].map((session) => session.location).join(" / ")}</span><span><b>对象</b>{form.audience}</span></div><div className="ead-compare"><div><small>原始输入</small><p>{form.supplement || "未填写"}</p><p>{form.rules || "未填写"}</p><p>{form.prize || "未填写"}</p></div><div><small>AI 优化后，可编辑</small><TextField label="补充说明" value={review.summary} onChange={(value) => onChange({ ...review, summary: value })} /><TextField label="活动规则" value={review.rules} onChange={(value) => onChange({ ...review, rules: value })} /><TextField label="奖品" value={review.prize} onChange={(value) => onChange({ ...review, prize: value })} /></div></div><p className="ead-unprojected">截止时间、联系人、奖品等字段会保存到任务；当前 T01 竖版不展示新增槽位。</p><div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onBack}>返回修改</button><button type="button" className="ead-primary" onClick={onConfirm}>确认文案，进入主视觉 →</button></div></section>;
}
function StepThree({ job, visualIdea, visualDescription, onIdea, onDescription, onRefine, onBack, onConfirm }: { job?: Job; visualIdea: string; visualDescription: string; onIdea: (value: string) => void; onDescription: (value: string) => void; onRefine: () => void; onBack: () => void; onConfirm: () => void }) {
  if (job?.status === "GENERATING_ASSET" || job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT") return <LoadingCard title="正在生成主视觉" detail={job.currentStep} />;
  return <section className="ead-section"><SectionHead index="03" title="生成活动主视觉" hint="文字与 Logo 不进入图片模型" /><div className="ead-prompt-guide">描述主体、动作、环境、风格和氛围。未指定风格时默认纪实摄影；已指定插画等风格会保留。</div><TextField label="你的画面想法" value={visualIdea} onChange={onIdea} placeholder="例如：几位同事在室内羽毛球场轻松对打，橙红色运动摄影，画面有能量但保持克制" /><button type="button" className="ead-secondary ead-refine" onClick={onRefine} disabled={visualIdea.trim().length < 10}>AI 优化画面描述</button>{job?.visualDraft && <><div className="ead-draft-badge">{job.visualDraft.fallback ? "本地规则兜底 · 仍需确认" : `${job.visualDraft.provider} 已生成优化草稿`}</div><TextField label="确认前可编辑的画面描述" value={visualDescription} onChange={onDescription} /></>}<p className="ead-model-note">只会把确认后的描述交给图片模型；不会自动再次改写。</p><div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onBack}>返回文案</button><button type="button" className="ead-primary" onClick={onConfirm} disabled={!job?.visualDraft || visualDescription.trim().length < 10}>确认并生成主视觉 →</button></div></section>;
}
function StepFour({ job, onReplace }: { job?: Job; onReplace: () => void }) {
  if (!job?.previewUrl) return <LoadingCard title="正在排版导出" detail={job?.currentStep ?? "请稍候…"} />;
  const validation = job.versions.at(-1)?.validation;
  const checks = [["字体与双 Logo 资产", !validation?.messages.some((message) => /字体|Logo/.test(message))], ["标题与正文没有溢出", !validation?.messages.some((message) => /溢出|容量/.test(message))], ["图文对比度", validation?.readability?.passed ?? false], ["输出尺寸 1080 × 1920", true]] as const;
  const trialWarning = validation && !validation.passed && validation.exportAllowed;
  return <section className="ead-section ead-quality"><div className="ead-quality-head"><div><h3>品牌质量校验</h3><p>{trialWarning ? "基础检查通过，可下载试用稿" : validation?.passed ? "全部实际检查通过" : "存在阻断项，暂不可下载"}</p></div><div className={`ead-status-pill ${validation?.passed ? "is-pass" : trialWarning ? "is-warning" : "is-fail"}`}>{validation?.passed ? "通过" : trialWarning ? "警告" : "阻断"}</div></div><div className="ead-check-grid">{checks.map(([label, passed]) => <div className={`ead-check-row ${passed ? "" : "is-failed"}`} key={label}><i>{passed ? "✓" : "!"}</i><span>{label}</span><small>{passed ? "通过" : label === "图文对比度" ? "文字与背景对比度待优化" : "未通过"}</small></div>)}</div>{trialWarning && <p className="ead-trial-note">当前使用试用策略：保留已生成背景，真实可读性警告不改写为通过。可下载试用稿。</p>}<div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onReplace}>只换主视觉</button></div></section>;
}
function LoadingCard({ title, detail }: { title: string; detail: string }) { return <section className="ead-section ead-loading"><span className="ead-loading-dot" /><h3>{title}</h3><p>{detail}</p></section>; }
function SectionHead({ index, title, hint }: { index: string; title: string; hint: string }) { return <div className="ead-section-head"><div><span className="ead-index">{index}</span><h3>{title}</h3></div><small>{hint}</small></div>; }
function Field({ className = "", label, value, onChange, required = false, type = "text" }: { className?: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) { return <div className={`ead-field ${className}`}><label>{label} {required && <i>必填</i>}</label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function TextField({ className = "", label, value, onChange, placeholder = "" }: { className?: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <div className={`ead-field ${className}`}><label>{label}</label><textarea rows={3} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>; }
function Preview({ form, copy }: { form: FormState; copy?: PosterDocument }) {
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  return <div className="ead-poster"><img className="ead-poster-bg" src="/brand/employee-activity-fallback.svg" alt="" /><div className="ead-poster-overlay" /><header><img src="/brand/company-logo.svg" alt="九号公司" /><img src="/brand/administration-mark.svg" alt="行政" /></header><div className="ead-poster-title"><span>员工活动</span><h2>{copy?.title || form.activityName || "活动主题"}</h2><p>{copy?.subtitle || form.supplement || "活动说明将在确认后显示"}</p></div><div className="ead-poster-details"><b>活动时间 / 地点</b>{sessions.map((session, index) => <p key={index}>{session.date || "日期"} · {session.time || "时间"}<br />{session.location || "地点"}</p>)}<b>参与对象</b><p>{form.audience || "参与对象"}</p><b>参与方式</b><p>{copy?.rules || form.rules || "确认文案后显示"}</p></div><footer><span>九号行政</span><span>T01 · 1080 × 1920</span></footer></div>;
}
function validateForm(form: FormState) {
  if (!form.activityName.trim()) return "请填写活动主题";
  if (form.activityName.trim().length > 24) return "活动主题超过 T01 单行容量，请先缩短主题";
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  if (sessions.some((session) => !session.date || !session.time.trim() || !session.location.trim())) return "请完整填写每一场的日期、时间和地点";
  if (!form.audience.trim()) return "请填写参与对象";
  if (form.qrUrl && !/^https?:\/\//i.test(form.qrUrl)) return "二维码 URL 必须以 http:// 或 https:// 开头";
  return undefined;
}
function normalizeForm(form: FormState): EmployeeActivityInput {
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  return { outputFormat: "portrait_1080x1920", activityName: form.activityName.trim(), category: "team", themeKeywords: [], description: form.supplement.trim(), sessions: sessions.map((session, index) => ({ label: index === 0 ? "第一场" : "第二场", date: session.date, time: session.time.trim(), location: session.location.trim(), details: [] })), audience: form.audience.trim(), highlights: [], participationSteps: splitDraftLines(form.rules), notice: "", includeQr: Boolean(form.qrUrl), ctaLabel: "", qrPayload: form.qrUrl.trim(), contact: form.contact.trim(), visualIntent: "", deadline: form.deadline.trim(), rules: form.rules.trim(), prize: form.prize.trim() };
}
