import type { T01TemplateAssets, T01TemplateContent } from "./t01-template-content";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]!);
}

function cross(className: string): string {
  return `<i class="lf-cross ${className}" aria-hidden="true"></i>`;
}

/** Figma node 426:156. The legacy render-target id is retained for stored-job compatibility. */
export function longformMarkup(
  content: T01TemplateContent,
  assets: T01TemplateAssets
): { html: string; css: string } {
  const times = content.sessions
    .map((session) => [session.date, session.time].filter(Boolean).join(" "))
    .join("\n");
  const locations = content.sessions.map((session) => session.location).join("\n");
  const groups = content.finalistGroups ?? [];
  const rosterHeight = groups.reduce((total, group) => {
    const rows = Math.max(1, Math.ceil(group.entrants.length / 2));
    return total + 51 + rows * 33.35 + (rows - 1) * 15;
  }, 0);
  // Figma 600:3531: roster starts at 1700 and, with five groups of four
  // entrants, the recap starts at 2418. Keep those locked coordinates while
  // letting the roster extend the document for other entrant counts.
  const recapTop = 1700 + rosterHeight + 54.5;
  const canvasHeight = recapTop + 582;
  const rosterRows = groups.map((group, index) => {
    const entrants = group.entrants;
    const rows = Math.max(1, Math.ceil(entrants.length / 2));
    const rowHeight = 51 + rows * 33.35 + (rows - 1) * 15;
    return `<div class="lf-roster-row${index % 2 ? " is-tinted" : ""}" data-capacity="finalist-group" style="--lf-roster-row-height:${rowHeight}px">
      <p class="lf-group-name">${escapeHtml(group.label)}</p>
      <div class="lf-entrants">${entrants.map((entrant) => `<div class="lf-entrant"><b>${escapeHtml(entrant.name)}</b><span>${escapeHtml(entrant.region)}</span></div>`).join("")}</div>
    </div>`;
  }).join("");
  const roster = groups.length ? `<section class="lf-roster-heading">
      <b class="lf-kicker">决赛名单</b><h2>高手，都在这。</h2><strong>${groups.length} 个组别</strong>
      <p class="lf-column-project">项目</p><p class="lf-column-person">姓名 / 赛区</p>
    </section><div class="lf-roster" data-capacity>${rosterRows}</div>` : "";
  const recapCity = content.recap?.city || content.sessions[0]?.location || "赛事现场";
  const recapCaption = content.recap?.caption || "赛事现场";
  const recapMedia = assets.recapImage
    ? `<img src="${escapeHtml(assets.recapImage)}" alt="赛区赛事照片">`
    : `<div class="lf-recap-placeholder"><p>赛场上的每一刻，都值得回看。</p><small>替换为该赛区赛事照片</small><i aria-hidden="true">● ● ●</i></div>`;
  const recap = `<section class="lf-recap-heading">
      <b class="lf-kicker">赛区回顾</b><h2>精彩，还在继续。</h2><strong>${escapeHtml(recapCity)}</strong>${assets.registrationArrow ? `<img src="${escapeHtml(assets.registrationArrow)}" alt="">` : ""}
    </section><figure class="lf-recap">${recapMedia}<figcaption>01 / ${escapeHtml(recapCity)} · ${escapeHtml(recapCaption)}</figcaption></figure>`;
  const eyebrow = content.slogan;

  return {
    html: `<main class="t01-extra t01-longform" lang="zh-CN" data-background-mode="full_bleed_background" style="--lf-canvas-height:${canvasHeight}px;--lf-recap-top:${recapTop}px">
      <img class="lf-hero-background" src="${escapeHtml(assets.image)}" alt="活动主视觉">
      <div class="lf-information-panel" aria-hidden="true"></div>
      <header class="lf-brand-header" data-brand-header><img class="lf-company-logo" data-brand-company-logo data-readability-companion="title-block" src="${escapeHtml(assets.companyLogo)}" alt="九号公司"><img class="lf-administration-logo" src="${escapeHtml(assets.administrationLogo)}" alt="行政"></header>
      <i class="lf-hero-divider" data-readability-companion="title-block" aria-hidden="true"></i>
      <section class="lf-title-block" data-readability="title-block"><p class="lf-eyebrow">${escapeHtml(eyebrow)}</p><h1 class="lf-title" data-capacity="title" data-max-lines="2">${escapeHtml(content.title)}</h1>${content.description ? `<p class="lf-description" data-capacity="description" data-max-lines="2">${escapeHtml(content.description)}</p>` : ""}</section>
      <section class="lf-when"><b class="lf-kicker">上场之前</b><h2>时间地点，记一下。</h2><i class="lf-line horizontal top"></i><i class="lf-line horizontal bottom"></i><i class="lf-line vertical"></i>${["c1","c2","c3","c4","c5"].map(cross).join("")}
        <section class="lf-fact time"><h3><span>01</span>比赛时间</h3><p data-capacity="sessions" data-max-lines="2">${escapeHtml(times)}</p></section>
        <section class="lf-fact location"><h3><span>02</span>比赛地点</h3><p data-capacity="locations" data-max-lines="2">${escapeHtml(locations)}</p></section>
      </section>
      ${roster}${recap}
    </main>`,
    css: `
      .t01-longform,.t01-longform *{box-sizing:border-box}.t01-longform{position:relative;width:1080px;height:var(--lf-canvas-height);overflow:hidden;background:#fff;color:#181818;font-family:MiSans,sans-serif;font-weight:400;font-synthesis:none;line-break:strict;word-break:normal;overflow-wrap:break-word}.t01-longform p,.t01-longform h1,.t01-longform h2,.t01-longform h3,.t01-longform figure{margin:0}.t01-longform p,.t01-longform h1{white-space:pre-wrap}.t01-longform img{display:block}
      .lf-hero-background{position:absolute;z-index:0;left:0;top:0;width:1080px;height:1210px;object-fit:cover;object-position:center}
      .lf-information-panel{position:absolute;left:0;top:1210px;width:1080px;height:calc(var(--lf-canvas-height) - 1210px);background:#f2f2ee;z-index:1}
      .lf-brand-header{position:absolute;z-index:2;left:64px;right:64px;top:64px;height:66.014px;display:flex;align-items:center;justify-content:space-between}.lf-company-logo{width:224px;height:66.014px;object-fit:contain;object-position:left center}.lf-administration-logo{width:61.2px;height:61.2px;object-fit:contain}.lf-hero-divider{position:absolute;z-index:2;left:64px;top:184px;width:952px;height:2px;background:#151515}
      .lf-title-block{position:absolute;z-index:2;left:64px;top:222px;width:952px;display:flex;flex-direction:column;gap:22px;color:#151515}.lf-eyebrow{font-size:26px;font-weight:500;line-height:32.5px}.lf-title{width:952px;font-size:125px;font-weight:600;line-height:1.04}.lf-description{width:952px;font-size:28px;font-weight:500;line-height:35px}
      .lf-kicker{display:block;width:max-content;height:37px;padding:5px 10px;background:#181818;color:#f2f2ee;font-size:21px;font-weight:600;line-height:25.2px}
      .lf-when{position:absolute;z-index:2;left:64px;top:1244px;width:952px;height:215px}.lf-when>h2{position:absolute;left:168px;top:0;width:724px;font-size:32px;font-weight:600;line-height:38.4px}.lf-line{position:absolute;background:#c8c8c1}.lf-line.horizontal{left:0;width:952px;height:1px}.lf-line.horizontal.top{top:63px}.lf-line.horizontal.bottom{top:195px}.lf-line.vertical{left:502px;top:63px;width:1px;height:132px}
      .lf-cross{position:absolute;width:14px;height:14px;transform:translate(-50%,-50%)}.lf-cross::before,.lf-cross::after{content:'';position:absolute;background:#75756f}.lf-cross::before{left:0;top:6px;width:14px;height:2px}.lf-cross::after{left:6px;top:0;width:2px;height:14px}.lf-cross.c1{left:0;top:63px}.lf-cross.c2{left:502px;top:63px}.lf-cross.c3{left:952px;top:63px}.lf-cross.c4{left:0;top:195px}.lf-cross.c5{left:952px;top:195px}
      .lf-fact{position:absolute;top:88px;display:flex;flex-direction:column;gap:17px;overflow:hidden}.lf-fact.time{left:0;width:478px}.lf-fact.location{left:533px;width:419px}.lf-fact h3{display:flex;gap:14px;font-size:23px;font-weight:600;line-height:28px}.lf-fact h3 span{width:32px;color:#75756f;font-size:20px;font-weight:500;line-height:24px}.lf-fact>p{font-size:28px;font-weight:400;line-height:34.8px}
      .lf-roster-heading{position:absolute;z-index:2;left:64px;top:1527px;width:952px;height:154px}.lf-roster-heading h2{position:absolute;left:0;top:58px;width:770px;font-size:52px;font-weight:600;line-height:62.4px}.lf-roster-heading strong,.lf-recap-heading strong{position:absolute;height:37px;padding:5px 10px;background:#f7e600;font-size:21px;font-weight:600;line-height:25.2px}.lf-roster-heading strong{left:812px;top:77px;width:140px}.lf-column-project,.lf-column-person{position:absolute;top:128px;color:#75756f;font-size:18px;font-weight:500;line-height:22.8px}.lf-column-project{left:16px;width:174px}.lf-column-person{left:220px;width:718px}
      .lf-roster{position:absolute;z-index:2;left:64px;top:1700px;width:952px}.lf-roster-row{min-height:var(--lf-roster-row-height);padding:25px 16px 26px;display:grid;grid-template-columns:174px 716px;column-gap:30px;border-top:1px solid #d7d7cf}.lf-roster-row.is-tinted{background:#e9e9e4}.lf-group-name{font-size:34px;font-weight:600;line-height:39.1px}.lf-entrants{display:grid;grid-template-columns:repeat(2,350px);grid-auto-rows:33.35px;gap:15px 7px}.lf-entrant{display:grid;grid-template-columns:120px 210px;column-gap:20px;align-items:start}.lf-entrant b{font-size:29px;font-weight:600;line-height:33.35px}.lf-entrant span{color:#777770;font-size:24px;font-weight:400;line-height:28px}
      .lf-recap-heading{position:absolute;z-index:2;left:64px;top:var(--lf-recap-top);width:952px;height:135px}.lf-recap-heading h2{position:absolute;left:0;top:58px;width:780px;font-size:50px;font-weight:600;line-height:60px}.lf-recap-heading strong{right:0;left:auto;top:68px;width:max-content;min-width:140px;white-space:nowrap}.lf-recap-heading>img{position:absolute;left:915px;top:7px;width:33px;height:33px}.lf-recap{position:absolute;z-index:2;left:64px;top:calc(var(--lf-recap-top) + 160px);width:952px}.lf-recap>img,.lf-recap-placeholder{width:952px;height:315px}.lf-recap>img{object-fit:cover}.lf-recap-placeholder{position:relative;color:#75756f;background:#e2e2dc;text-align:center}.lf-recap-placeholder p{position:absolute;top:75px;left:35px;width:882px;font-size:38px;font-weight:600;line-height:47.5px}.lf-recap-placeholder small{position:absolute;top:145px;left:35px;width:882px;font-size:26px;line-height:32.5px}.lf-recap-placeholder i{position:absolute;bottom:12px;left:0;width:952px;font-size:10px;font-style:normal;line-height:10px;letter-spacing:5px}.lf-recap figcaption{margin-top:25px;color:#75756f;font-size:22px;font-weight:400;line-height:28px}
    `
  };
}
