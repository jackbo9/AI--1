"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PosterDocument } from "@/contracts/poster";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import { completedFinalistGroups } from "./activity-studio-model";
import type { ActivityJob, FormState, Stage } from "./types";
import type { RenderTargetId } from "@/contracts/brand";
import { LightweightT01Preview } from "./lightweight-t01-preview";
import {
  renderTargetOptions,
  selectedRenderTarget
} from "./render-target-options";

export function LivePreview({ form, copy, hasQr, job, stage, fixtureMode, activeRenderTarget, onRenderTarget }: { form: FormState; copy?: PosterDocument; hasQr: boolean; job?: ActivityJob; stage: Stage; fixtureMode: boolean; activeRenderTarget: RenderTargetId; onRenderTarget: (target: RenderTargetId) => void }) {
  const version = job?.versions.at(-1);
  const selectedVisualOption = job?.visualOptions?.find(
    (option) => option.id === job.selectedVisualOptionId
  );
  const displayTarget = selectedRenderTarget(
    form.renderTargets,
    activeRenderTarget
  );
  const document = useMemo<PosterDocument>(() => copy ?? {
    schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", outputFormat: "portrait_1080x1920", category: "team",
    title: form.activityName || "活动主题", slogan: form.slogan, subtitle: form.subtitle, summary: "", sessions: [{ label: "活动安排", date: form.session.date || "2026-01-01", time: "", location: form.session.location || "待定", details: [] }], audience: form.audience || "参与对象", highlights: [], participationSteps: normalizeLines(splitDraftLines(form.rules)), notice: "", includeQr: hasQr, ctaLabel: "扫码报名", qrPayload: form.qrUrl, qrAssetId: form.qrAssetId, contact: "", finalistGroups: completedFinalistGroups(form), immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true, finalistGroups: true }
  }, [copy, form, hasQr]);
  const [html, setHtml] = useState("");
  const previewCache = useRef(new Map<string, string>());
  const previewKey = useMemo(
    () => JSON.stringify({ document, format: displayTarget }),
    [displayTarget, document]
  );
  useEffect(() => {
    if (stage === 2) return;
    const cached = previewCache.current.get(previewKey);
    if (cached) {
      setHtml((current) => current === cached ? current : cached);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/templates/t01-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: previewKey, signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("preview")))
        .then((payload: { html: string }) => {
          previewCache.current.set(previewKey, payload.html);
          setHtml((current) => current === payload.html ? current : payload.html);
        }).catch(() => undefined);
    }, 160);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [previewKey, stage]);
  const portraitResult =
    stage === 3 && displayTarget === "portrait_1080x1920"
      ? job?.previewUrl
      : undefined;
  const visibleTargets = renderTargetOptions.filter(({ id }) =>
    form.renderTargets.includes(id)
  );
  return <aside className="ead-preview"><div className="ead-preview-head"><header><b>海报预览</b></header><div className={`ead-size-tabs ${visibleTargets.length === 1 ? "is-single" : ""}`} role="group" aria-label="切换已选海报尺寸">{visibleTargets.map(({ id, label }) => <button type="button" key={id} className={displayTarget === id ? "is-selected" : ""} aria-pressed={displayTarget === id} onClick={() => onRenderTarget(id)}>{label}</button>)}</div></div><div className="ead-canvas-wrap"><div className={`ead-poster-frame is-${displayTarget}`}>{stage === 2 ? selectedVisualOption ? <LightweightT01Preview document={selectedVisualOption.sourceDocument} imageUrl={selectedVisualOption.previewUrl} optionId={selectedVisualOption.id} format={displayTarget} /> : <span className="t01-preview-loading">生成并选择主视觉后，可在这里查看完整海报</span> : portraitResult ? <img className="ead-generated-poster" src={portraitResult} alt="生成的体育赛事海报" /> : html ? <iframe title="海报预览" className={`t01-preview-frame is-${displayTarget}`} srcDoc={html} sandbox="" /> : <span className="t01-preview-loading">正在更新预览…</span>}</div></div>{stage === 3 && portraitResult && <div className="ead-exportbar"><a href={portraitResult} download={fixtureMode ? "employee-activity-fixture.svg" : "employee-activity-t01.png"}>{version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载待确认结果"}</a><small>{version?.validation.passed ? "质量检查通过" : "图文对比度待优化，可重新选择主视觉"}</small></div>}</aside>;
}
