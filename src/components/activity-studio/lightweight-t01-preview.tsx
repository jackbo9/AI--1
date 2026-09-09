"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type SyntheticEvent } from "react";
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
  format
}: {
  document: PosterDocument;
  imageUrl: string;
  optionId: string;
  format: RenderTargetId;
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
      const detected = detectToneFromDisplayedHero(event.currentTarget, format);
      toneCache.set(toneKey, detected);
      setTone(detected);
    } catch {
      toneCache.set(toneKey, "dark");
      setTone("dark");
    }
  }

  const session = document.sessions[0];
  const participation = document.participationSteps.join(" / ");
  const qrUrl = document.qrAssetId
    ? `/api/uploads/qr/${document.qrAssetId}`
    : qrDataUrl;

  return (
    <div className={`t01-preview t01-selected-preview is-${tone} is-format-${format}`}>
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
    </div>
  );
}

function detectToneFromDisplayedHero(
  image: HTMLImageElement,
  format: RenderTargetId
) {
  const wide = format === "landscape_1920x1080" || format === "banner_2227x950";
  const width = wide ? 200 : 146;
  const height = wide ? 112 : 171;
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !image.naturalWidth || !image.naturalHeight) return "dark";

  const scale = Math.max(
    width / image.naturalWidth,
    height / image.naturalHeight
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
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
