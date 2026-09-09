import type { T01TemplateAssets, T01TemplateContent } from "./t01-template-content";

type WideFormat = "landscape_1920x1080" | "banner_2227x950";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function textSlot(name: string, text: string, maxLines: number, className = name): string {
  return `<p class="t01-wide-${className}" data-capacity="${name}" data-max-lines="${maxLines}" data-readability="${name}">${escapeHtml(text)}</p>`;
}

function cross(className: string): string {
  return `<i class="t01-grid-cross ${className}" aria-hidden="true"></i>`;
}

/** Figma nodes 426:74 (landscape) and 426:140 (banner). */
export function wideMarkup(
  format: WideFormat,
  content: T01TemplateContent,
  assets: T01TemplateAssets
): { html: string; css: string } {
  const banner = format === "banner_2227x950";
  const times = content.sessions
    .map((session) => [session.date, session.time].filter(Boolean).join(" "))
    .join("\n");
  const locations = content.sessions.map((session) => session.location).join("\n");
  const rules = content.ruleSections
    .map(({ title, body }) => title && title !== "活动规则" && title !== "赛事规则" ? `${title}：${body}` : body)
    .join(" / ");
  const eyebrow = content.slogan;
  const description = content.description.trim();
  const arrow = assets.registrationArrow
    ? `<img class="t01-registration-arrow" src="${escapeHtml(assets.registrationArrow)}" alt="">`
    : "";
  const landscapeInfo = banner ? "" : `<section class="t01-landscape-info">
    <div class="t01-guide"><b>上场指南</b><h2>先看这里。</h2>${assets.qr ? `<div class="t01-registration-cta"><span>一起上场</span>${arrow}</div>` : ""}</div>
    <div class="t01-landscape-grid" aria-hidden="true">
      <i class="t01-grid-line v v1"></i><i class="t01-grid-line v v2"></i><i class="t01-grid-line v v3"></i><i class="t01-grid-line h"></i>
      ${["c1","c2","c3","c4","c5","c6"].map(cross).join("")}
    </div>
    <section class="t01-fact t01-time"><h3><span>01</span>比赛时间</h3>${textSlot("sessions", times, 2, "fact-copy")}</section>
    <section class="t01-fact t01-location"><h3><span>02</span>比赛地点</h3>${textSlot("locations", locations, 2, "fact-copy")}</section>
    <section class="t01-fact t01-audience"><h3><span>03</span>参与对象</h3>${textSlot("audience", content.audience, 2, "fact-copy")}</section>
    <section class="t01-fact t01-rules"><h3><span>04</span>赛事规则</h3>${textSlot("rules", rules, 2, "fact-copy")}${content.deadline ? `<p class="t01-deadline">晋升通道：${escapeHtml(content.deadline)}</p>` : ""}</section>
    ${assets.qr ? `<aside class="t01-landscape-qr"><img src="${escapeHtml(assets.qr)}" alt="报名二维码"><p>扫码报名</p></aside>` : ""}
  </section>`;

  return {
    html: `<main class="t01-extra ${banner ? "t01-banner" : "t01-landscape"}" lang="zh-CN" data-background-mode="full_bleed_background">
      <img class="t01-wide-background" src="${escapeHtml(assets.image)}" alt="活动主视觉">
      ${banner ? "" : '<div class="t01-landscape-panel" aria-hidden="true"></div>'}
      <header class="t01-wide-brand"><img class="t01-wide-company" data-brand-company-logo src="${escapeHtml(assets.companyLogo)}" alt="九号公司"><img class="t01-wide-administration" src="${escapeHtml(assets.administrationLogo)}" alt="行政"></header>
      <i class="t01-wide-divider" data-readability-companion="title-block" aria-hidden="true"></i>
      <section class="t01-wide-title-block" data-readability="title-block">
        <p class="t01-wide-eyebrow">${escapeHtml(eyebrow)}</p>
        ${textSlot("title", content.title, 2)}
        ${description ? textSlot("description", description, 2) : ""}
      </section>
      ${landscapeInfo}
    </main>`,
    css: `
      .t01-extra,.t01-extra *{box-sizing:border-box}
      .t01-extra{position:relative;isolation:isolate;overflow:hidden;background:#fff;color:#151515;font-family:MiSans,sans-serif;font-weight:400;font-synthesis:none;line-break:strict;word-break:normal;overflow-wrap:break-word;font-kerning:normal}
      .t01-landscape{width:1920px;height:1080px}.t01-banner{width:2227px;height:950px}
      .t01-extra p,.t01-extra h2,.t01-extra h3{margin:0;white-space:pre-wrap}
      .t01-wide-background{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:-2}
      .t01-landscape-panel{position:absolute;left:0;top:780px;width:1920px;height:300px;background:#f2f2ee;z-index:-1}
      .t01-wide-brand{position:absolute;left:64px;right:64px;top:64px;height:66.014px;display:flex;align-items:center;justify-content:space-between}
      .t01-wide-company{width:224px;height:66.014px;object-fit:contain;object-position:left center}.t01-wide-administration{width:61.2px;height:61.2px;object-fit:contain}
      .t01-wide-divider{position:absolute;left:64px;right:64px;top:178px;height:2px;background:#151515}
      .t01-wide-title-block{position:absolute;left:64px;top:230px;width:1188px;display:flex;flex-direction:column;gap:22px;overflow:visible}
      .t01-wide-eyebrow{font-size:26px;font-weight:500;line-height:32.5px}
      .t01-wide-title{width:100%;font-size:164px;font-weight:600;line-height:170px}
      .t01-wide-description{width:100%;font-size:28px;font-weight:500;line-height:35px}
      .t01-landscape-info{position:absolute;left:64px;top:807px;width:1792px;height:225px;color:#181818}
      .t01-guide{position:absolute;left:0;top:0;width:290px;height:218px}.t01-guide>b{display:block;width:max-content;height:37px;padding:5px 10px;background:#181818;color:#f2f2ee;font-size:21px;font-weight:600;line-height:25.2px}.t01-guide h2{position:absolute;left:0;top:57px;width:290px;font-size:39px;font-weight:600;line-height:46.8px}
      .t01-registration-cta{position:absolute;left:0;top:135px;height:37px;display:flex;align-items:center;gap:28px}.t01-registration-cta span{display:block;min-width:130px;height:37px;padding:5px 10px;background:#f7e600;font-size:21px;font-weight:600;line-height:25.2px}.t01-registration-arrow{width:33px;height:33px}
      .t01-grid-line{position:absolute;background:#c8c8c1}.t01-grid-line.v{top:0;width:1px;height:218px}.t01-grid-line.v1{left:310px}.t01-grid-line.v2{left:905px}.t01-grid-line.v3{left:1580px}.t01-grid-line.h{left:344px;top:100px;width:1198px;height:1px}
      .t01-grid-cross{position:absolute;width:14px;height:14px;transform:translate(-50%,-50%)}.t01-grid-cross::before,.t01-grid-cross::after{content:'';position:absolute;background:#75756f}.t01-grid-cross::before{left:0;top:6px;width:14px;height:2px}.t01-grid-cross::after{left:6px;top:0;width:2px;height:14px}.t01-grid-cross.c1{left:310px;top:0}.t01-grid-cross.c2{left:310px;top:218px}.t01-grid-cross.c3{left:905px;top:0}.t01-grid-cross.c4{left:905px;top:218px}.t01-grid-cross.c5{left:1580px;top:0}.t01-grid-cross.c6{left:1580px;top:218px}
      .t01-fact{position:absolute;display:flex;flex-direction:column;gap:17px;overflow:hidden}.t01-fact h3{display:flex;gap:14px;font-size:23px;font-weight:600;line-height:28px}.t01-fact h3 span{width:32px;color:#75756f;font-size:20px;font-weight:500;line-height:24px}.t01-wide-fact-copy{font-size:28px;font-weight:400;line-height:38.4px}.t01-time{left:344px;top:0;width:530px}.t01-location{left:344px;top:115px;width:530px}.t01-location .t01-wide-fact-copy{font-size:28px;line-height:38.4px}.t01-audience{left:942px;top:0;width:600px}.t01-rules{left:942px;top:115px;width:600px}.t01-rules .t01-wide-fact-copy{font-size:28px;line-height:38.4px}.t01-deadline{position:absolute;left:0;top:88px;width:600px;color:#75756f;font-size:20px;font-weight:400;line-height:24px}
      .t01-landscape-qr{position:absolute;left:1640px;top:22px;width:134px}.t01-landscape-qr img{display:block;width:134px;height:134px;border:1px solid #c8c8c1;background:#fff;object-fit:contain}.t01-landscape-qr p{margin-top:10px;font-size:20px;line-height:24px;text-align:center}
      .t01-banner .t01-wide-title-block{top:220px;width:1393px}.t01-banner .t01-wide-title{font-size:164px;font-weight:600;line-height:170px}.t01-banner .t01-wide-background{height:950px}
    `
  };
}
