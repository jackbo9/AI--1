"use client";
/* eslint-disable @next/next/no-img-element -- authenticated images */
import { teaMarkup } from "@/templates/tea-layout";
import { sameTeaFields } from "@/contracts/tea";
import { PosterViewport } from "../activity-studio/poster-viewport";
import { VisualOptionCard } from "../activity-studio/visual-option-card";
import type { TeaController } from "./use-tea-studio";

export function TeaPreview({ controller: c }: { controller: TeaController }) {
  const selected = c.job?.options.find(o => o.id === c.job?.selectedVisualOptionId);
  return <aside className="ead-preview tea-preview"><h3>海报预览 <small>1080 × 1920</small></h3><div className="tea-poster" dangerouslySetInnerHTML={{ __html: teaMarkup(c.fields, selected?.previewUrl, "/brand/tea/brand.svg") }} />{!selected && <p>生成后，这里会显示食品主视觉</p>}</aside>;
}

function TeaCreation({ c }: { c: TeaController }) {
  const busy = c.pending || c.working;
  const changed = Boolean(c.job && !sameTeaFields(c.job.fields, c.fields));
  return <section className="tea-form">
    <label>这次准备了什么下午茶？<textarea rows={4} maxLength={2000} value={c.fields.brief} onChange={e => c.update("brief", e.target.value)} placeholder="例如：本周五准备无花果下午茶，主打新鲜、多汁、清甜，希望突出切面细腻的果肉。" /></label>
    <button type="button" className="tea-secondary" disabled={busy || !c.fields.brief.trim()} onClick={c.extract}>{c.pending && !c.expanded ? "正在整理…" : "AI 整理内容"}</button>
    {c.expanded && <>
      <div className="tea-copy-fields">{([ ["food", "食品", 100], ["title", "主标题", 7], ["subtitle", "副标题", 24] ] as const).map(([key, label, limit]) => <label key={key}>{label}<small>{Array.from(c.fields[key]).length} / {limit}</small><input value={c.fields[key]} onChange={e => c.update(key, e.target.value)} /></label>)}</div>
      <div className="tea-visual-section"><header><div><h2>生成主视觉</h2><p>高端食品摄影 · 浅色背景 · 竖版海报</p></div></header>
        <details><summary>调整画面描述</summary><label>画面描述<textarea rows={5} maxLength={1200} disabled={busy} value={c.fields.visualPrompt} onChange={e => c.update("visualPrompt", e.target.value)} /></label></details>
        {changed && <p className="tea-note">内容已修改，重新生成将建立新版本，旧图片会保留在原任务中。</p>}
        <button type="button" className="ead-primary" disabled={busy} onClick={() => c.action("generate")}>{c.working ? "正在生成，请稍候…" : c.job?.options.length ? "重新生成两张主视觉" : "生成两张主视觉"}</button>
        <div className="ead-option-grid">{c.job?.options.map((o, i) => o.status === "READY" ? <VisualOptionCard selected={c.job?.selectedVisualOptionId === o.id} disabled={Boolean(busy || changed)} key={o.id} onSelect={() => c.action("select", o.id)} src={o.previewUrl} label={`下午茶方案 ${i + 1}`} /> : <div className="ead-generation-placeholder" key={o.id} role="status"><b>方案 {i + 1}</b><p>{o.status === "FAILED" ? o.error : "正在生成图片…"}</p>{o.status === "FAILED" && <button type="button" disabled={busy || changed} onClick={() => c.action("retry", o.id)}>重试该方案</button>}</div>)}</div>
        {Boolean(c.job?.options.length) && <button type="button" className="ead-primary" disabled={busy || changed || !c.job?.selectedVisualOptionId} onClick={() => c.action("confirm", c.job?.selectedVisualOptionId)}>使用所选方案并排版 →</button>}
      </div>
    </>}
  </section>;
}

export function TeaStudio({ controller: c, fixture }: { controller: TeaController; fixture: boolean }) {
  const busy = c.pending || c.working, output = c.job?.outputs.at(-1);
  return <div className="ead-activity-content tea-studio"><div className="ead-title-row"><div><em>员工福利 · 下午茶</em><h1>制作一张下午茶海报</h1><p>把食品与心意，变成一张福利海报</p></div></div>
    {fixture && <p role="status">交互演练 · 固定无花果文案与演示图片，不调用模型，不提供正式下载</p>}
    {c.restoring ? <p role="status">正在恢复下午茶任务…</p> : c.stage < 3 ? <TeaCreation c={c} /> : <section className="tea-result">{c.job?.status === "RENDERING" ? <p role="status">正在排版与检查，请稍候…</p> : <><PosterViewport target="portrait_1080x1920">{output?.previewUrl ? <img className="tea-final-image" src={output.previewUrl} alt="下午茶正式海报" /> : <div className="tea-empty-result">{output && !output.exportAllowed ? "文字对比度未通过，当前不能导出" : "暂无正式成品"}</div>}</PosterViewport><div className="tea-result-actions"><h3>海报检查</h3>{output?.messages.map(m => <p key={m}>{m}</p>)}<p>请目视确认食品质感、文字留白与裁切。</p>{output?.previewUrl && <><a className="ead-primary" href={output.previewUrl} download>下载 PNG</a><a className="tea-secondary" href={`${output.previewUrl}?format=jpg`} download>下载 JPG</a></>}<button type="button" disabled={busy} onClick={() => c.setStage(1)}>返回调整</button><button type="button" disabled={busy} onClick={c.restart}>开始新海报</button></div></>}</section>}
    {(c.error || c.job?.error) && <p role="alert" className="ead-error">{c.error || c.job?.error}</p>}
  </div>;
}
