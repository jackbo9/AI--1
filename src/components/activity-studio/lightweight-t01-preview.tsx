"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type CSSProperties, type SyntheticEvent } from "react";
import { rosterLayout, rosterRowHeight } from "@/templates/t01-roster-layout";
import type { PosterDocument } from "@/contracts/poster";
import type { RenderTargetId } from "@/contracts/brand";
import {
  choosePreviewTextTone,
  type PreviewTextTone
} from "./preview-tone";

const toneCache = new Map<string, PreviewTextTone>();

export function LightweightT01Preview({
  document,
  imageUrl,
  optionId,
  format,
  fullCanvas = false
}: {
  document: PosterDocument;
  imageUrl: string;
  optionId: string;
  format: RenderTargetId;
  fullCanvas?: boolean;
}) {
  const toneKey = `${optionId}:${format}`;
  const [tone, setTone] = useState<PreviewTextTone>(
    () => toneCache.get(toneKey) ?? "dark"
  );
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    setTone(toneCache.get(toneKey) ?? "dark");
  }, [toneKey]);

  useEffect(() => {
    let active = true;
    setQrDataUrl("");
    if (
      !document.includeQr ||
      document.qrAssetId ||
      !document.qrPayload
    ) {
      return () => {
        active = false;
      };
    }
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(document.qrPayload, {
          width: 144,
          margin: 0,
          errorCorrectionLevel: "M"
        })
      )
      .then((value) => {
        if (active) setQrDataUrl(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [document.includeQr, document.qrAssetId, document.qrPayload]);

  function adaptTone(event: SyntheticEvent<HTMLImageElement>) {
    try {
      const detected = detectToneFromDisplayedHero(event.currentTarget, format, fullCanvas);
      toneCache.set(toneKey, detected);
      setTone(detected);
    } catch {
      toneCache.set(toneKey, "dark");
      setTone("dark");
    }
  }

  const session = document.sessions[0];
  const participation = document.participationSteps.join(" / ");
  const finalistGroups = document.finalistGroups ?? [];
  const longformMetrics = format === "longform_1080xAuto"
    ? longformPreviewMetrics(finalistGroups)
    : undefined;
  const previewStyle = longformMetrics
    ? ({
        "--t01-preview-longform-height": `${longformMetrics.height}px`,
        "--t01-preview-recap-top": `${longformMetrics.recapTop}px`
      } as CSSProperties)
    : undefined;
  const qrUrl = document.qrAssetId
    ? `/api/uploads/qr/${document.qrAssetId}`
    : qrDataUrl;

  return (
    <div className={`t01-preview t01-selected-preview is-${tone} is-format-${format} ${fullCanvas ? "is-full-canvas" : ""}`} style={previewStyle}>
      <img
        className="t01-preview-background"
        src={imageUrl}
        alt=""
        onLoad={adaptTone}
      />
      <div className="t01-preview-info-panel" />
      <header className="t01-preview-header">
        <img src="/brand/company-logo.svg" alt="九号公司" />
        <img src="/brand/administration-mark.svg" alt="行政" />
      </header>
      <i className="t01-preview-divider" />
      {document.slogan && (
        <p className="t01-preview-eyebrow">{document.slogan}</p>
      )}
      <div className="t01-preview-title">
        <h3>{document.title}</h3>
        {document.subtitle && <p>{document.subtitle}</p>}
      </div>
      <div
        className={`t01-preview-info-stack ${document.includeQr ? "has-qr" : ""}`}
      >
        <b>{format === "longform_1080xAuto" ? "上场之前" : "活动指南"}</b>
        <h5>{format === "longform_1080xAuto" ? "时间地点，记一下。" : "先看这里。"}</h5>
        <section className="t01-preview-session-block">
          <h4>活动时间</h4>
          <p>{formatSessionDate(session?.date, session?.time) || "待定"}</p>
        </section>
        <section className="t01-preview-session-block">
          <h4>活动地点</h4>
          <p>{session?.location || "待定"}</p>
        </section>
        <section className="t01-preview-audience">
          <h4>参与对象</h4>
          <p>{document.audience}</p>
        </section>
        <section className="t01-preview-participation">
          <h4>活动规则</h4>
          <p>{participation}</p>
        </section>
      </div>
      {document.includeQr && (
        <aside className="t01-preview-qr">
          {qrUrl ? <img src={qrUrl} alt="活动二维码" /> : <b>QR</b>}
          <span>{document.ctaLabel || "扫码报名"}</span>
        </aside>
      )}
      {format === "longform_1080xAuto" && (
        <>
          {finalistGroups.length > 0 && <section className="t01-preview-longform-roster">
            <header>
              <b>决赛名单</b>
              <strong>高手，都在这。</strong>
              <span>{finalistGroups.length} 个组别</span>
            </header>
            {finalistGroups.map((group, index) => (
              <div
                className={`t01-preview-roster-group${index % 2 ? " is-tinted" : ""}`}
                key={index}
                style={{ height: `${longformRosterRowHeight(group.entrants.length)}px` }}
              >
                <b>{group.label}</b>
                <div>{group.entrants.map((entrant, entrantIndex) => (
                  <p key={`${entrant.name}-${entrant.region}-${entrantIndex}`}><strong>{entrant.name}</strong><span>{entrant.region}</span></p>
                ))}</div>
              </div>
            ))}
          </section>}
          <section className="t01-preview-longform-recap">
            <b>赛区回顾</b>
            <strong>精彩，还在继续。</strong>
            <span>{session?.location || "赛事现场"}</span>
            <div>赛事照片将在后续物料中补充</div>
          </section>
        </>
      )}
    </div>
  );
}

function longformPreviewMetrics(
  groups: Array<{ entrants: Array<{ name: string; region: string }> }>
) {
  const scale = 292 / 1080;
  const recapTop = rosterLayout(groups).recapTop * scale;
  return {
    recapTop: Math.ceil(recapTop),
    height: Math.ceil(recapTop + 582 * scale)
  };
}

function longformRosterRowHeight(entrantCount: number) {
  return rosterRowHeight(entrantCount) * (292 / 1080);
}

function detectToneFromDisplayedHero(
  image: HTMLImageElement,
  format: RenderTargetId,
  fullCanvas: boolean
) {
  const wide = format === "landscape_1920x1080" || format === "banner_2227x950";
  const width = wide ? 200 : 146;
  const height = wide ? 112 : 171;
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !image.naturalWidth || !image.naturalHeight) return "dark";

  if (fullCanvas && format === "portrait_1080x1920") {
    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * 1292 / 1920, 0, 0, width, height);
    return choosePreviewTextTone(context.getImageData(0, 0, width, height).data, width, height);
  }
  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    format === "longform_1080xAuto" ? 0 : (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  const pixels = context.getImageData(0, 0, width, height);
  return choosePreviewTextTone(pixels.data, width, height);
}

function formatSessionDate(value?: string, time?: string) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
    : value;
  return time ? `${date} ${time}` : date;
}
