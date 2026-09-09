import { describe, expect, it } from "vitest";
import { ruleSectionsFromText } from "../../src/templates/t01-template-content";
import { longformMarkup } from "../../src/templates/t01-longform";
import { wideMarkup } from "../../src/templates/t01-wide";

const content = { title: "赛事主题", slogan: "九号员工赛事 / EVENT", description: "", sessions: [{ date: "2026-09-18", time: "18:30", location: "体育馆" }, { date: "2026-09-19", time: "19:30", location: "会议厅" }], audience: "全体员工", deadline: "9月16日", contact: "", ruleSections: [], registrationNote: "" };
const assets = { companyLogo: "logo.svg", administrationLogo: "admin.svg", registrationArrow: "arrow.svg", image: "background.png" };

describe("T01 confirmed content projections", () => {
  it("preserves unlabelled multi-line rules and labelled paragraphs without truncation", () => {
    expect(ruleSectionsFromText("第一条\n第二条\n\n赛制：三局两胜")).toEqual([{ title: "活动规则", body: "第一条\n第二条" }, { title: "赛制", body: "三局两胜" }]);
    expect(ruleSectionsFromText("")).toEqual([]);
  });
  it("keeps both sessions in the landscape projection and escapes markup", () => {
    const { html } = wideMarkup("landscape_1920x1080", { ...content, title: '<img src=x onerror="x">' }, assets);
    expect(html).toContain("2026-09-18"); expect(html).toContain("2026-09-19");
    expect(html).toContain("&lt;img"); expect(html).not.toContain('<img src=x');
    expect(html).not.toContain("报名二维码");
  });
  it("keeps Banner limited to the Figma title slots", () => {
    const { html, css } = wideMarkup("banner_2227x950", content, assets);
    expect(html).not.toContain("2026-09-18");
    expect(html).not.toContain("t01-landscape-info");
    expect(css).toContain("width:1393px");
  });
  it("projects both sessions into the fixed 1080 by 3000 longform shell", () => {
    const { html } = longformMarkup(content, assets);
    expect(html).toContain("2026-09-18");
    expect(html).toContain("2026-09-19");
    expect(html).not.toContain("决赛名单");
    expect(html).not.toContain("赛区回顾");
  });
  it("renders structured finalist groups only when the contract supplies them", () => {
    const { html } = longformMarkup({ ...content, finalistGroups: [{ label: "男单", entrants: [{ name: "张三", region: "华东赛区" }] }] }, assets);
    expect(html).toContain("决赛名单");
    expect(html).toContain("张三");
    expect(html).toContain("华东赛区");
  });
});
