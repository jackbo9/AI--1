"use client";

/* eslint-disable @next/next/no-img-element -- generated PNGs and local brand assets are intentional. */
import type { PosterDocument } from "@/contracts/poster";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import type { ActivityJob, FormState, Stage } from "./types";

export function LivePreview({
  form,
  copy,
  hasQr,
  job,
  stage,
  statusLabel,
  fixtureMode
}: {
  form: FormState;
  copy?: PosterDocument;
  hasQr: boolean;
  job?: ActivityJob;
  stage: Stage;
  statusLabel: string;
  fixtureMode: boolean;
}) {
  const version = job?.versions.at(-1);
  return <aside className="ead-preview"><div className="ead-preview-head"><header><b>实时预览</b><span>{fixtureMode ? "Fixture 演练" : statusLabel}</span></header><div className="ead-size-tabs"><button type="button" className="is-selected">1080 × 1920</button></div><small className="ead-size-note">排版导出中可生成横版、Banner 和长图</small></div><div className="ead-canvas-wrap"><div className="ead-poster-frame is-portrait">{job?.previewUrl ? <img className="ead-generated-poster" src={job.previewUrl} alt="生成的员工活动海报" /> : <DraftPreview form={form} copy={copy} hasQr={hasQr} />}</div></div>{stage === 4 && job?.previewUrl && <div className="ead-exportbar"><a href={job.previewUrl} download={fixtureMode ? "employee-activity-fixture.svg" : "employee-activity-t01.png"}>{fixtureMode ? "下载演练稿" : version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载风险结果"}</a><small>{fixtureMode ? "Fixture 成品 · 不代表真实生成质量" : version?.validation.passed ? "质量检查通过" : "图文对比度未通过，可重新生成主视觉"}</small></div>}</aside>;
}

function DraftPreview({ form, copy, hasQr }: { form: FormState; copy?: PosterDocument; hasQr: boolean }) {
  const rules = copy?.participationSteps?.length ? copy.participationSteps : normalizeLines(splitDraftLines(form.rules));
  const subtitle = copy ? copy.subtitle : form.supplement || "活动说明将在确认后显示";
  return <div className="t01-preview"><img className="t01-preview-background" src="/brand/employee-activity-fallback.svg" alt="" /><header className="t01-preview-header"><img src="/brand/company-logo.svg" alt="九号公司" /><img src="/brand/administration-mark.svg" alt="行政" /></header><i className="t01-preview-divider" /><section className="t01-preview-title"><h3>{copy?.title || form.activityName || "活动主题"}</h3>{subtitle && <p>{subtitle}</p>}</section><div className="t01-preview-info-panel" /><div className={`t01-preview-info-stack ${hasQr ? "has-qr" : ""}`}><b>活动指南</b><h5>先看这里。</h5><section className="t01-preview-session-block"><h4>活动时间</h4><p>{form.session.date || "日期"} {form.session.time || "时间"}</p></section><section className="t01-preview-session-block"><h4>活动地点</h4><p>{form.session.location || "地点"}</p></section><section className="t01-preview-audience"><h4>参与对象</h4><p>{form.audience || "参与对象"}</p></section><section className="t01-preview-participation"><h4>活动规则</h4>{rules.slice(0, 4).map((step, index) => <p key={`${index}-${step}`}>{step}</p>)}</section></div>{hasQr && <aside className="t01-preview-qr"><b>QR</b><span>扫码报名</span></aside>}</div>;
}
