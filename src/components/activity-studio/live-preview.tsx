"use client";

/* eslint-disable @next/next/no-img-element -- generated PNGs and local brand assets are intentional. */
import type { PosterDocument } from "@/contracts/poster";
import type { RenderTargetId } from "@/contracts/brand";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import { renderTargetOptions } from "./activity-studio-model";
import type { ActivityJob, FormState, Stage } from "./types";

export function LivePreview({
  form,
  copy,
  hasQr,
  job,
  stage,
  statusLabel,
  fixtureMode,
  renderTargets,
  activeRenderTarget,
  onRenderTarget
}: {
  form: FormState;
  copy?: PosterDocument;
  hasQr: boolean;
  job?: ActivityJob;
  stage: Stage;
  statusLabel: string;
  fixtureMode: boolean;
  renderTargets: RenderTargetId[];
  activeRenderTarget: RenderTargetId;
  onRenderTarget: (target: RenderTargetId) => void;
}) {
  const version = job?.versions.at(-1);
  const selectedTargets = renderTargetOptions.filter((option) =>
    renderTargets.includes(option.id)
  );
  const active = selectedTargets.find((option) => option.id === activeRenderTarget)
    ?? selectedTargets[0];
  if (!active) return null;
  const useFixtureDraft = fixtureMode && active.id !== "portrait_1080x1920";
  return <aside className="ead-preview"><div className="ead-preview-head"><header><b>实时预览</b><span>{fixtureMode ? "Fixture 演练" : statusLabel}</span></header><div className="ead-size-tabs">{selectedTargets.map((target) => <button type="button" key={target.id} className={target.id === active.id ? "is-selected" : ""} aria-pressed={target.id === active.id} onClick={() => onRenderTarget(target.id)}><strong>{target.name}</strong><small>{target.size}</small></button>)}</div><small className="ead-size-note">{fixtureMode ? "切换尺寸查看对应的信息投影与构图安全区" : "当前正式链路仅生成竖版；多尺寸选择将在后续接入"}</small></div><div className="ead-canvas-wrap"><div className={`ead-poster-frame is-${active.id}`}>{job?.previewUrl && !useFixtureDraft ? <img className="ead-generated-poster" src={job.previewUrl} alt={`生成的${active.name}`} /> : <DraftPreview form={form} copy={copy} hasQr={hasQr} target={active.id} />}</div></div>{stage === 4 && job?.previewUrl && <div className="ead-exportbar"><a href={job.previewUrl} download={fixtureMode ? `employee-activity-${active.id}-fixture.svg` : "employee-activity-t01.png"}>{fixtureMode ? `下载${active.name}演练稿` : version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载试用稿"}</a><small>{fixtureMode ? `${active.name} Fixture 演练稿 · 不代表真实生成质量` : `当前尺寸：1080 × 1920 · ${version?.validation.strategy === "trial" ? "试用策略" : "严格策略"}`}</small></div>}</aside>;
}

function DraftPreview({ form, copy, hasQr, target }: { form: FormState; copy?: PosterDocument; hasQr: boolean; target: RenderTargetId }) {
  const sessions = [form.session, ...(form.secondSession ? [form.secondSession] : [])];
  const participation = copy?.participationSteps?.length ? copy.participationSteps : normalizeLines(splitDraftLines(form.rules));
  const compact = target === "banner_2227x950";
  const showQr = hasQr && target !== "landscape_1920x1080" && !compact;
  return <div className={`t01-preview is-${target}`}><img className="t01-preview-background" src="/brand/employee-activity-fallback.svg" alt="" /><header className="t01-preview-header"><img src="/brand/company-logo.svg" alt="九号公司" /><img src="/brand/administration-mark.svg" alt="行政" /></header><section className="t01-preview-title"><h3>{copy?.title || form.activityName || "活动主题"}</h3><p>{copy ? copy.subtitle : form.supplement || "活动说明将在确认后显示"}</p></section><section className="t01-preview-info t01-preview-sessions"><h4>活动时间/地点</h4>{sessions.map((session, index) => <p key={`${index}-${session.date}`}>{session.date || "日期"} {session.time || "时间"} · {session.location || "地点"}</p>)}</section><section className="t01-preview-info t01-preview-audience"><h4>参与对象</h4><p>{form.audience || "参与对象"}</p></section>{!compact && <section className={`t01-preview-info t01-preview-participation ${showQr ? "has-qr" : ""}`}><h4>参与方式</h4>{participation.slice(0, 2).map((step, index) => <p key={`${index}-${step}`}>{step}</p>)}</section>}{showQr && <aside className="t01-preview-qr"><b>QR</b><span>扫码报名</span></aside>}<footer className="t01-preview-footer"><span>九号行政</span><span>员工活动</span></footer></div>;
}
