import type { T01TemplateAssets, T01TemplateContent } from "./t01-template-content";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

/** Figma 191:3158. Content grows in normal flow; the renderer enforces max height. */
export function longformMarkup(
  content: T01TemplateContent,
  assets: T01TemplateAssets
): { html: string; css: string } {
  const rules = content.ruleSections.filter((rule) => rule.title.trim() || rule.body.trim());
  const hasCore = Boolean(content.sessions.length || content.audience.trim() || content.deadline.trim());
  const hasRegistration = Boolean(assets.qr || content.contact.trim() || content.registrationNote.trim());
  let sectionNumber = 0;
  const heading = (label: string) => `<h2 class="lf-section-title" data-capacity><span>${String(++sectionNumber).padStart(2, "0")}</span> ${label}</h2>`;
  const sessions = content.sessions.map((session) => `<div class="lf-session" data-capacity>
    ${session.label?.trim() ? `<p class="lf-session-label">${escapeHtml(session.label)}</p>` : ""}
    <p>${escapeHtml([session.date, session.time].filter(Boolean).join(" "))}</p>
    <p>${escapeHtml(session.location)}</p>
  </div>`).join("");

  const html = `<article class="t01-extra t01-longform" lang="zh-CN" data-capacity>
  <header class="lf-brand-header" data-brand-header>
    <img class="lf-company-logo" data-brand-company-logo src="${escapeHtml(assets.companyLogo)}" alt="九号公司">
    <img class="lf-administration-logo" data-brand-administration-mark src="${escapeHtml(assets.administrationLogo)}" alt="行政">
  </header>
  <div class="lf-intro">
    <h1 class="lf-title" data-title data-capacity data-max-lines="3">${escapeHtml(content.title)}</h1>
    ${content.description.trim() ? `<p class="lf-description" data-capacity>${escapeHtml(content.description)}</p>` : ""}
  </div>
  <div class="lf-image-slot"><img src="${escapeHtml(assets.image)}" alt="活动主视觉" data-visual-asset></div>
  ${hasCore ? `<section class="lf-section lf-core">
    ${heading("核心信息")}
    <div class="lf-core-grid">
      ${content.sessions.length ? `<div class="lf-info-card" data-capacity><h3>时间 / 地点</h3><div class="lf-info-body" data-capacity>${sessions}</div></div>` : ""}
      ${content.audience.trim() || content.deadline.trim() ? `<div class="lf-info-card" data-capacity>
        ${content.audience.trim() ? `<h3>参与对象</h3><div class="lf-info-body"><p>${escapeHtml(content.audience)}</p>${content.deadline.trim() ? `<p>报名截止：${escapeHtml(content.deadline)}</p>` : ""}</div>` : `<h3>报名截止</h3><div class="lf-info-body"><p>${escapeHtml(content.deadline)}</p></div>`}
      </div>` : ""}
    </div>
  </section>` : ""}
  ${rules.length ? `<section class="lf-section lf-rules">
    ${heading("活动规则")}
    <ol class="lf-rule-list">${rules.map((rule, index) => `<li class="lf-rule-card">
      <span class="lf-rule-number" aria-hidden="true">${index + 1}</span>
      <div class="lf-rule-content" data-capacity>${rule.title.trim() ? `<h3 data-capacity>${escapeHtml(rule.title)}</h3>` : ""}${rule.body.trim() ? `<p data-capacity>${escapeHtml(rule.body)}</p>` : ""}</div>
    </li>`).join("")}</ol>
  </section>` : ""}
  ${hasRegistration ? `<section class="lf-section lf-registration">
    ${heading("报名方式")}
    <div class="lf-registration-card${assets.qr ? " lf-with-qr" : ""}">
      ${assets.qr ? `<div class="lf-qr-frame"><img src="${escapeHtml(assets.qr)}" alt="报名二维码" data-qr></div>` : ""}
      <div class="lf-registration-copy" data-capacity>
        <h3>${assets.qr ? "扫码报名" : content.contact.trim() ? "联系报名" : "报名说明"}</h3>
        ${content.deadline.trim() ? `<p>报名截止 ${escapeHtml(content.deadline)}</p>` : ""}
        ${content.registrationNote.trim() ? `<p>${escapeHtml(content.registrationNote)}</p>` : ""}
        ${content.contact.trim() ? `<p class="lf-contact">联系人：${escapeHtml(content.contact)}</p>` : ""}
      </div>
    </div>
  </section>` : ""}
  <footer class="lf-footer" data-capacity><span>九号行政｜ADMINISTRATION</span><span>员工活动 / ACTIVITY</span></footer>
</article>`;

  const css = `
.t01-longform, .t01-longform * { box-sizing: border-box; }
.t01-longform {
  width: 1080px; min-height: 1920px; padding: 82px 72px 80px;
  display: flex; flex-direction: column; background: #fff; color: #000;
  font-family: "MiSans", sans-serif; font-weight: 400; font-synthesis: none;
  line-break: strict; word-break: normal; overflow-wrap: anywhere;
}
.t01-longform p, .t01-longform h1, .t01-longform h2, .t01-longform h3,
.t01-longform ol { margin: 0; padding: 0; }
.t01-longform img { display: block; }
.t01-longform p, .t01-longform h1, .t01-longform h3 { white-space: pre-wrap; }
.t01-longform .lf-brand-header {
  height: 82.518px; flex: 0 0 82.518px; margin: 0 9px;
  display: flex; align-items: center; justify-content: space-between;
}
.t01-longform .lf-company-logo { width: 280px; height: 82.518px; object-fit: contain; }
.t01-longform .lf-administration-logo { width: 76.5px; height: 76.5px; object-fit: contain; }
.t01-longform .lf-intro { margin-top: 58.482px; min-height: 357px; padding-bottom: 48px; }
.t01-longform .lf-title { width: 690px; font-size: 120px; line-height: 1.2; font-weight: 600; }
.t01-longform .lf-description { margin-top: 13px; font-size: 28px; line-height: 1.45; }
.t01-longform .lf-image-slot {
  width: 936px; height: 780px; flex: 0 0 780px; border: 1px solid #e2e2df;
  border-radius: 24px; overflow: hidden; background: #f5f5f2;
}
.t01-longform .lf-image-slot img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
.t01-longform .lf-section { margin-top: 76px; }
.t01-longform .lf-section-title { font-size: 36px; line-height: 1.2; font-weight: 500; }
.t01-longform .lf-section-title span { margin-right: 12px; }
.t01-longform .lf-section-title::after {
  content: ""; display: block; margin-top: 16.8px; width: 96px;
  height: 8px; border-radius: 4px; background: #da291c;
}
.t01-longform .lf-core-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px; margin-top: 28px; }
.t01-longform .lf-info-card { min-height: 168px; padding: 24px; border-radius: 20px; background: #f5f5f2; }
.t01-longform .lf-info-card:only-child { grid-column: 1 / -1; }
.t01-longform .lf-info-card h3, .t01-longform .lf-rule-content h3 { font-size: 28px; line-height: 1.2; font-weight: 500; }
.t01-longform .lf-info-body { margin-top: 14.4px; font-size: 22px; line-height: 1.45; }
.t01-longform .lf-session + .lf-session { margin-top: 16px; }
.t01-longform .lf-session-label { font-weight: 600; }
.t01-longform .lf-rule-list { list-style: none; margin-top: 28px; display: flex; flex-direction: column; gap: 20px; }
.t01-longform .lf-rule-card {
  display: grid; grid-template-columns: 48px minmax(0, 1fr); column-gap: 20px;
  padding: 24px 32px 24px 24px; min-height: 144px; background: #f5f5f2; border-radius: 20px;
}
.t01-longform .lf-rule-number {
  display: block; width: 48px; height: 48px; padding-top: 4px; text-align: center;
  border-radius: 24px; background: #fff0ed; color: #da291c;
  font-size: 22px; line-height: 1.2; font-weight: 600;
}
.t01-longform .lf-rule-content p { font-size: 22px; line-height: 1.45; }
.t01-longform .lf-rule-content h3 + p { margin-top: 8.4px; }
.t01-longform .lf-registration { margin-top: 92px; }
.t01-longform .lf-registration-card {
  display: flex; align-items: flex-start; gap: 40px; margin-top: 28px;
  padding: 30px 24px; border-radius: 24px; background: #f5f5f2;
}
.t01-longform .lf-with-qr { min-height: 300px; }
.t01-longform .lf-qr-frame {
  flex: 0 0 240px; width: 240px; height: 240px; padding: 8px;
  border: 2px solid #da291c; border-radius: 18px; background: #fff;
}
.t01-longform .lf-qr-frame img { width: 100%; height: 100%; object-fit: contain; }
.t01-longform .lf-registration-copy { flex: 1; min-width: 0; padding-top: 12px; padding-right: 40px; }
.t01-longform .lf-registration-copy h3 { margin-bottom: 16.8px; font-size: 36px; line-height: 1.2; font-weight: 500; }
.t01-longform .lf-registration-copy p { font-size: 24px; line-height: 1.45; }
.t01-longform .lf-registration-copy .lf-contact { margin-top: 24px; font-size: 18px; line-height: 1.4; color: #75787b; }
.t01-longform .lf-footer {
  display: flex; justify-content: space-between; align-items: flex-end;
  flex: 1; gap: 24px; min-height: 88px; padding-top: 62.8px;
  color: #75787b; font-size: 18px; line-height: 1.4;
}
`;
  return { html, css };
}
