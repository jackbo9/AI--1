import type { T01TemplateAssets, T01TemplateContent } from "./t01-template-content";

type WideFormat = "landscape_1920x1080" | "banner_2227x950";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function sessionText(session: T01TemplateContent["sessions"][number]): string {
  return [session.label, session.date, session.time, session.location].filter(Boolean).join("  ");
}

function textSlot(name: string, text: string, maxLines: number, className = name): string {
  return `<p class="t01-wide-${className}" data-capacity="${name}" data-max-lines="${maxLines}" data-readability="${name}">${escapeHtml(text)}</p>`;
}

/**
 * Figma 191:3112 / 191:3138; populated variants 191:3677 / 191:3708.
 * Both are full-bleed backgrounds. The renderer selects brand variants
 * and measures actual text rectangles for capacity and contrast.
 * QR, contact and deadline have no slots in these two masters; the longform
 * projects those fields. No placeholder copy is inserted when optional data
 * is missing, and supplied session/rule text is never truncated.
 */
export function wideMarkup(
  format: WideFormat,
  content: T01TemplateContent,
  assets: T01TemplateAssets
): { html: string; css: string } {
  const banner = format === "banner_2227x950";
  const sessions = content.sessions.map(sessionText).join("\n");
  const rules = content.ruleSections.map(({ title, body }) =>
    title && title !== "活动规则" && title !== "赛事规则" ? `${title}：${body}` : body
  ).join("\n");
  const facts = [sessions, content.audience].filter(Boolean).join("  ·  ");
  const detail = banner
    ? `${textSlot("facts", facts, 2)}<div class="t01-wide-accent" aria-hidden="true"></div>${content.description ? textSlot("description", content.description, 4) : ""}`
    : `${content.description ? textSlot("description", content.description, 3) : ""}
      <section class="t01-wide-section t01-wide-sessions"><h2 data-readability="sessions-label">比赛时间/地点</h2>${textSlot("sessions", sessions, 2, "section-body")}</section>
      <section class="t01-wide-section t01-wide-audience"><h2 data-readability="audience-label">参与对象</h2>${textSlot("audience", content.audience, 1, "section-body")}</section>
      ${rules ? `<section class="t01-wide-section t01-wide-rules"><h2 data-readability="rules-label">赛事规则</h2>${textSlot("rules", rules, 4, "section-body")}</section>` : ""}`;

  return {
    html: `<main class="t01-extra ${banner ? "t01-banner" : "t01-landscape"}" lang="zh-CN" data-background-mode="full_bleed_background">
      <img class="t01-wide-background" src="${escapeHtml(assets.image)}" alt="" />
      <header class="t01-wide-brand"><img class="t01-wide-company" data-brand-company-logo src="${escapeHtml(assets.companyLogo)}" alt="九号公司" /><img class="t01-wide-administration" data-brand-administration-mark src="${escapeHtml(assets.administrationLogo)}" alt="九号行政" /></header>
      ${textSlot("title", content.title, 1)}
      ${detail}
      <footer class="t01-wide-footer"><p data-readability="footer-left">九号行政｜ADMINISTRATION</p><p data-readability="footer-right">员工活动 / ACTIVITY</p></footer>
    </main>`,
    css: `
      .t01-extra.t01-landscape,.t01-extra.t01-banner{position:relative;isolation:isolate;overflow:hidden;background:#f5f5f2;color:#000;font-family:MiSans,sans-serif;font-weight:400;line-break:strict;word-break:normal;overflow-wrap:break-word;font-kerning:normal}
      .t01-landscape{width:1920px;height:1080px}.t01-banner{width:2227px;height:950px}
      .t01-extra p,.t01-extra h2{margin:0;white-space:pre-wrap}
      .t01-wide-background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-1}
      .t01-wide-brand{position:absolute;left:72px;right:72px;top:80px;height:82.518px;display:flex;align-items:center;justify-content:space-between}
      .t01-wide-company{width:280px;height:82.518px;object-fit:contain}.t01-wide-administration{width:76.5px;height:76.5px;object-fit:contain}
      .t01-wide-title{position:absolute;left:81px;top:223px;width:690px;height:144px;font-size:120px;line-height:1.2;font-weight:600}
      .t01-wide-description{position:absolute;left:81px;top:380px;width:720px;height:121.8px;font-size:28px;line-height:1.45}
      .t01-wide-section{position:absolute;left:81px;width:921px}
      .t01-wide-section h2{font-size:28px;line-height:1.4;font-weight:600;margin-bottom:8px;color:#1c1c1e}
      .t01-wide-section-body{font-size:22px;line-height:1.4;color:#48484a}
      .t01-wide-sessions{top:540px}.t01-wide-sessions .t01-wide-section-body{height:61.6px}
      .t01-wide-audience{top:651px}.t01-wide-audience .t01-wide-section-body{height:30.8px}
      .t01-wide-rules{top:762px}.t01-wide-rules .t01-wide-section-body{height:123.2px}
      .t01-wide-footer{position:absolute;left:81px;right:81px;top:998px;display:flex;align-items:center;justify-content:space-between;font-size:18px;line-height:1.4;color:#75787b}
      .t01-wide-footer p:first-child{width:560px}.t01-wide-footer p:last-child{width:520px;text-align:right}
      .t01-banner .t01-wide-title{width:980px}
      .t01-wide-facts{position:absolute;left:81px;top:380px;width:980px;height:81.2px;font-size:28px;line-height:1.45}
      .t01-wide-accent{position:absolute;left:81px;top:484px;width:96px;height:8px;border-radius:4px;background:#da291c}
      .t01-banner .t01-wide-description{top:524px;width:920px;height:127.6px;color:#75787b;font-size:22px;line-height:1.45}
      .t01-banner .t01-wide-footer{top:884px}
    `
  };
}
