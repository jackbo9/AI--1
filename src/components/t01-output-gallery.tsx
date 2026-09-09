"use client";

/* eslint-disable @next/next/no-img-element -- previews are deterministic server-rendered PNGs. */
import { useEffect, useState } from "react";
import type { RenderTargetId } from "@/contracts/brand";
import styles from "./t01-output-gallery.module.css";

const formats = [
  ["portrait_1080x1920", "竖版", "1080 × 1920"],
  ["landscape_1920x1080", "横版", "1920 × 1080"],
  ["banner_2227x950", "Banner", "2227 × 950"],
  ["longform_1080xAuto", "长图", "1080 × 3000"]
] as const;
type Format = (typeof formats)[number][0];
type Output = {
  id: string; format: Format; status: string; width: number; height?: number;
  visualFamilyId: string; previewUrl?: string; error?: { message: string };
  validation: { passed: boolean; exportAllowed?: boolean; messages: string[] };
};

export function T01OutputGallery({ jobId, renderTargets }: { jobId: string; renderTargets: RenderTargetId[] }) {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [family, setFamily] = useState<string>();
  const [selected, setSelected] = useState<Format>("portrait_1080x1920");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/jobs/${jobId}/formats`, { cache: "no-store", signal: controller.signal });
        const data = await readJson<{ outputs: Output[]; currentVisualFamilyId?: string; error?: { message?: string } }>(response);
        if (!response.ok) throw new Error(data.error?.message ?? "读取尺寸失败");
        if (disposed) return;
        setOutputs(data.outputs); setFamily(data.currentVisualFamilyId); setError("");
        if (data.outputs.some((item: Output) => item.status === "RENDERING")) timer = setTimeout(refresh, 1500);
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "读取尺寸失败");
      }
    }
    void refresh();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [jobId, reload]);
  const visibleFormats = formats.filter(([format]) => renderTargets.includes(format));
  const safeSelected = renderTargets.includes(selected) ? selected : renderTargets[0] ?? "portrait_1080x1920";
  const current = [...outputs].reverse().find(output => output.format === safeSelected && (!family || output.visualFamilyId === family));
  return <section className={styles.gallery} aria-label="海报尺寸输出">
    <h3>本次选择的物料</h3>
    <p>各尺寸会使用已确认的文案和主视觉；横向尺寸的主体呈现可能不同。</p>
    <div className={styles.tabs} role="group" aria-label="选择物料尺寸">
      {visibleFormats.map(([format, name, size]) => <button type="button" key={format} aria-pressed={safeSelected === format} onClick={() => setSelected(format)}><strong>{name}</strong><small>{size}</small></button>)}
    </div>
    <p className={styles.hint}>{safeSelected === "longform_1080xAuto" ? "长图展示详细规则、报名截止和联系人；空信息不占位，页面随内容增高。奖品暂无独立槽位。" : "此规格只展示模板支持的核心信息；未展示字段仍保留在活动内容中。"}</p>
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setReload(value => value + 1)}>重新读取</button></p>}
    {current?.status === "RENDERING" && <p role="status">正在排版和检查该尺寸…</p>}
    {current?.status === "FAILED" && <p role="alert" className={styles.error}>{current.error?.message ?? "该尺寸未生成成功"}。其他已完成尺寸仍可下载。</p>}
    {current?.previewUrl && <>
      <div className={styles.preview}><img src={current.previewUrl} alt={`${formats.find(item => item[0] === safeSelected)?.[1]}海报预览`} /></div>
      <ul className={styles.messages}>{current.validation.messages.map((message, index) => <li key={index}>{message}</li>)}</ul>
      <a className={styles.download} href={current.previewUrl} download={`poster-${safeSelected}.png`}>{current.validation.passed ? "下载 PNG" : "下载待确认结果"} · {current.width} × {current.height}</a>
    </>}
    {!current?.previewUrl && current?.status !== "RENDERING" && <p>{safeSelected === "portrait_1080x1920" ? "竖版结果正在准备。" : "该尺寸正在等待排版。"}</p>}
  </section>;
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
