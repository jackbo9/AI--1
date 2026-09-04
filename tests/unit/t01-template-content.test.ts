import { describe, expect, it } from "vitest";
import { ruleSectionsFromText } from "../../src/templates/t01-template-content";
import { longformMarkup } from "../../src/templates/t01-longform";
import { wideMarkup } from "../../src/templates/t01-wide";

const content = { title: "赛事主题", description: "", sessions: [{ date: "2026-09-18", time: "18:30", location: "体育馆" }, { date: "2026-09-19", time: "19:30", location: "会议厅" }], audience: "全体员工", deadline: "9月16日", contact: "", ruleSections: [], registrationNote: "" };
const assets = { companyLogo: "logo.svg", administrationLogo: "admin.svg", image: "background.png" };

describe("T01 confirmed content projections", () => {
  it("preserves unlabelled multi-line rules and labelled paragraphs without truncation", () => {
    expect(ruleSectionsFromText("第一条\n第二条\n\n赛制：三局两胜")).toEqual([{ title: "活动规则", body: "第一条\n第二条" }, { title: "赛制", body: "三局两胜" }]);
    expect(ruleSectionsFromText("")).toEqual([]);
  });
  it("keeps both sessions in wide formats, escaping markup", () => {
    for (const format of ["landscape_1920x1080", "banner_2227x950"] as const) {
      const { html } = wideMarkup(format, { ...content, title: '<img src=x onerror="x">' }, assets);
      expect(html).toContain("2026-09-18"); expect(html).toContain("2026-09-19");
      expect(html).toContain("&lt;img"); expect(html).not.toContain('<img src=x');
      expect(html).not.toContain("data-qr");
    }
  });
  it("shows saved deadline in longform and omits empty registration/rules", () => {
    const { html } = longformMarkup(content, assets);
    expect(html).toContain("9月16日");
    expect(html).not.toContain('class="lf-section lf-registration"');
    expect(html).not.toContain('class="lf-section lf-rules"');
    expect(html).not.toContain("IMAGE SLOT");
  });
});
