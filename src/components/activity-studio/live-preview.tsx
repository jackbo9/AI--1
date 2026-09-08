"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { PosterDocument } from "@/contracts/poster";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import type { ActivityJob, FormState, Stage } from "./types";
import type { RenderTargetId } from "@/contracts/brand";

const previewTargets: Array<[RenderTargetId, string]> = [["portrait_1080x1920", "竖版"], ["landscape_1920x1080", "横版"], ["banner_2227x950", "Banner"], ["longform_1080xAuto", "长图"]];

export function LivePreview({ form, copy, hasQr, job, stage, statusLabel, fixtureMode, activeRenderTarget, onRenderTarget }: { form: FormState; copy?: PosterDocument; hasQr: boolean; job?: ActivityJob; stage: Stage; statusLabel: string; fixtureMode: boolean; activeRenderTarget: RenderTargetId; onRenderTarget: (target: RenderTargetId) => void }) {
  const version = job?.versions.at(-1);
  const document = useMemo<PosterDocument>(() => copy ?? {
    schemaVersion: "1.7", scene: "employee_activity", locale: "zh-CN", outputFormat: "portrait_1080x1920", category: "team",
    title: form.activityName || "活动主题", slogan: form.slogan, subtitle: form.subtitle, summary: "", sessions: [{ label: "活动安排", date: form.session.date || "2026-01-01", time: "", location: form.session.location || "待定", details: [] }], audience: form.audience || "参与对象", highlights: [], participationSteps: normalizeLines(splitDraftLines(form.rules)), notice: "", includeQr: hasQr, ctaLabel: "扫码报名", qrPayload: form.qrUrl, qrAssetId: form.qrAssetId, contact: "", immutableSource: { outputFormat: true, sessions: true, audience: true, contact: true, includeQr: true, ctaLabel: true, qrPayload: true, qrAssetId: true, notice: true }
  }, [copy, form, hasQr]);
  const [html, setHtml] = useState("");
  const previewCache = useRef(new Map<string, string>());
  const previewKey = useMemo(
    () => JSON.stringify({ document, format: activeRenderTarget }),
    [activeRenderTarget, document]
  );
  useEffect(() => {
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
  }, [previewKey]);
  const portraitResult = activeRenderTarget === "portrait_1080x1920" ? job?.previewUrl : undefined;
  return <aside className="ead-preview"><div className="ead-preview-head"><header><b>实时预览</b><span>{fixtureMode ? "Fixture 演练" : statusLabel}</span></header><div className="ead-size-tabs">{previewTargets.filter(([target]) => form.renderTargets.includes(target)).map(([target, name]) => <button type="button" key={target} className={activeRenderTarget === target ? "is-selected" : ""} onClick={() => onRenderTarget(target)}>{name}</button>)}</div><small className="ead-size-note">与最终模板共用同一份 HTML/CSS</small></div><div className="ead-canvas-wrap"><div className={`ead-poster-frame is-${activeRenderTarget}`}>{portraitResult ? <img className="ead-generated-poster" src={portraitResult} alt="生成的员工活动海报" /> : html ? <iframe title="T01 海报预览" className={`t01-preview-frame is-${activeRenderTarget}`} srcDoc={html} sandbox="" /> : <span className="t01-preview-loading">正在同步模板…</span>}</div></div>{stage === 4 && portraitResult && <div className="ead-exportbar"><a href={portraitResult} download={fixtureMode ? "employee-activity-fixture.svg" : "employee-activity-t01.png"}>{fixtureMode ? "下载演练稿" : version?.validation.exportAllowed === false ? "下载不可用" : version?.validation.passed ? "下载 PNG" : "下载风险结果"}</a><small>{fixtureMode ? "Fixture 成品 · 不代表真实生成质量" : version?.validation.passed ? "质量检查通过" : "图文对比度未通过，可重新生成主视觉"}</small></div>}</aside>;
}
