"use client";

/* eslint-disable @next/next/no-img-element -- previews are deterministic server-rendered PNGs. */
import { useEffect, useState } from "react";
import styles from "./t01-output-gallery.module.css";

const formats = [
  ["portrait_1080x1920", "竖版", "1080 × 1920"],
  ["landscape_1920x1080", "横版", "1920 × 1080"],
  ["banner_2227x950", "Banner", "2227 × 950"],
  ["longform_1080xAuto", "长图", "1080 × 自动高度"]
] as const;
type Format = (typeof formats)[number][0];
type Output = {
  id: string; format: Format; status: string; width: number; height?: number;
  visualFamilyId: string; previewUrl?: string; error?: { message: string };
  validation: { passed: boolean; exportAllowed?: boolean; messages: string[] };
};

export function T01OutputGallery({ jobId }: { jobId: string }) {
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [family, setFamily] = useState<string>();
  const [selected, setSelected] = useState<Format>("portrait_1080x1920");
  const [pending, setPending] = useState(false);
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
  const current = [...outputs].reverse().find(output => output.format === selected && (!family || output.visualFamilyId === family));
  async function generate() {
    if (pending || selected === "portrait_1080x1920") return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/formats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: selected }) });
      const payload = await readJson<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(payload.error?.message ?? "该尺寸生成失败");
      setReload(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "该尺寸生成失败"); }
    finally { setPending(false); }
  }
  return <section className={styles.gallery} aria-label="T01 四尺寸输出">
    <h3>同一活动，四种物料</h3>
    <p>复用已确认的文案和本次主视觉。生成其他尺寸不会再次调用图片模型；横向裁切可能改变主体呈现。</p>
    <div className={styles.tabs} role="group" aria-label="选择物料尺寸">
      {formats.map(([format, name, size]) => <button type="button" key={format} aria-pressed={selected === format} onClick={() => setSelected(format)}><strong>{name}</strong><small>{size}</small></button>)}
    </div>
    <p className={styles.hint}>{selected === "longform_1080xAuto" ? "长图展示详细规则、报名截止和联系人；空信息不占位，页面随内容增高。奖品暂无独立槽位。" : "此规格只展示模板支持的核心信息；未展示字段仍保留在活动内容中。"}</p>
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setReload(value => value + 1)}>重新读取</button></p>}
    {current?.status === "RENDERING" && <p role="status">正在排版和检查该尺寸…</p>}
    {current?.status === "FAILED" && <p role="alert" className={styles.error}>{current.error?.message ?? "该尺寸未生成成功"}。其他已完成尺寸仍可下载。</p>}
    {current?.previewUrl && <>
      <div className={styles.preview}><img src={current.previewUrl} alt={`${formats.find(item => item[0] === selected)?.[1]}海报预览`} /></div>
      <ul className={styles.messages}>{current.validation.messages.map((message, index) => <li key={index}>{message}</li>)}</ul>
      <a className={styles.download} href={current.previewUrl} download={`T01-${selected}.png`}>{current.validation.passed ? "下载 PNG" : "下载试用稿"} · {current.width} × {current.height}</a>
    </>}
    {selected !== "portrait_1080x1920" && !current?.previewUrl && current?.status !== "RENDERING" && <button type="button" className={styles.generate} disabled={pending} onClick={() => void generate()}>{pending ? "正在提交…" : current?.status === "FAILED" ? "重试此尺寸" : "生成此尺寸"}</button>}
    {selected === "portrait_1080x1920" && !current && <p>竖版结果请查看右侧预览。</p>}
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
