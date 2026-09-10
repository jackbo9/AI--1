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
  it("projects both sessions into an auto-height longform with a recap photo slot", () => {
    const { html, css } = longformMarkup(content, assets);
    expect(html).toContain("2026-09-18");
    expect(html).toContain("2026-09-19");
    expect(html).not.toContain("决赛名单");
    expect(html).toContain("赛区回顾");
    expect(html).toContain("替换为该赛区赛事照片");
    expect(css).toContain("top:75px");
    expect(css).toContain("top:145px");
    expect(css).toContain("bottom:12px");
  });
  it("renders up to six entrants in each fixed finalist group and grows the longform canvas", () => {
    const sixEntrants = ["张三", "李四", "王五", "赵六", "钱七", "孙八"].map((name) => ({ name, region: "华东赛区" }));
    const one = longformMarkup({ ...content, finalistGroups: [{ label: "男单", entrants: [{ name: "张三", region: "华东赛区" }] }] }, assets);
    const { html } = longformMarkup({ ...content, finalistGroups: [{ label: "男单", entrants: sixEntrants }] }, assets);
    expect(html).toContain("决赛名单");
    expect(html).toContain("张三");
    expect(html).toContain("华东赛区");
    expect(html).toContain("孙八");
    expect(html).toContain("--lf-roster-row-height:181.05px");
    expect(html).not.toContain("slice(0, 4)");
    expect(one.html).toContain("--lf-roster-row-height:84.35px");
    expect(one.html).not.toContain("--lf-canvas-height:3000px");
  });
  it("keeps the Figma 600:3531 baseline at 3000px for five groups of four", () => {
    const fourEntrants = ["甲", "乙", "丙", "丁"].map((name) => ({ name, region: "XX赛区" }));
    const finalistGroups = ["男单", "女单", "混合双人", "男子双人", "女子双人"].map((label) => ({ label, entrants: fourEntrants }));
    const { html } = longformMarkup({ ...content, finalistGroups }, assets);
    expect(html).toContain("--lf-recap-top:2418px");
    expect(html).toContain("--lf-canvas-height:3000px");
  });
  it("keeps the complete venue in a recap label that can expand horizontally", () => {
    const { html } = longformMarkup({ ...content, sessions: [{ date: "2026-09-18", time: "", location: "九号园区体育馆" }] }, assets);
    expect(html).toContain("<strong>九号园区体育馆</strong>");
    const { css } = longformMarkup(content, assets);
    expect(css).toContain("width:max-content");
    expect(css).toContain("right:0");
  });
});
