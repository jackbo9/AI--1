import type { VisualDraft } from "@/contracts/job";
import {
  illustrationBriefSchema,
  type IllustrationBrief,
  type PosterDocument
} from "@/contracts/poster";

export const t01BaseVisualPromptVersion = "t01-base-visual-v1";

export function createT01BaseVisualDescription(document: PosterDocument) {
  const activityReference = compactTitle(document.title);
  const competitive = isCompetitiveActivity(document);
  return [
    `主体：围绕「${activityReference}」的员工活动场景，以真实成年员工和相关器材、道具或动作作为视觉重点，不在画面中呈现活动名称文字。`,
    `风格：现代企业活动编辑摄影，${competitive ? "强调自然运动瞬间与真实材质" : "强调自然互动与真实材质"}，年轻、专业、克制，避免正面合影、摆拍、卡通和 3D 质感。`,
    "色彩：黑白灰与自然环境色为基底，少量行政黄点缀，整体低饱和并保持文字覆盖区域的明暗稳定。",
    "构图：原生 9:16 竖版，核心主体放在中右或中下部；顶部品牌标识与标题区域保持连续、低细节、无遮挡，左上不放关键人物或器材。品牌标识、标题、编码图案和活动事实均由后续排版添加，图片中不得生成。"
  ].join("\n");
}

export function createT01BaseVisualBrief(
  document: PosterDocument
): IllustrationBrief {
  const competitive = isCompetitiveActivity(document);
  return illustrationBriefSchema.parse({
    subject: "真实成年员工与活动相关的核心器材或道具",
    action: competitive
      ? "自然参与友好竞赛并捕捉真实动作瞬间"
      : "自然参与活动并形成清晰互动关系",
    setting: settingFor(document),
    composition:
      "原生 9:16 竖版，主体位于中右或中下部，顶部品牌标识与标题覆盖区域保持连续低细节，左上不放关键主体",
    palette: "黑白灰与自然环境色为基底，少量行政黄点缀",
    style: "现代企业活动编辑摄影，真实材质，年轻、专业、克制",
    mood: competitive ? "有活力、专注、可信" : "自然、友好、可信",
    negative: "不要文字、字母、数字、Logo、二维码、水印、签名"
  });
}

export function createT01BaseVisualDraft(
  document: PosterDocument,
  sourceCopyCreatedAt: string,
  createdAt = new Date().toISOString()
): VisualDraft {
  return {
    description: createT01BaseVisualDescription(document),
    brief: createT01BaseVisualBrief(document),
    provider: "t01-base-description",
    model: "deterministic",
    promptVersion: t01BaseVisualPromptVersion,
    sourceCopyCreatedAt,
    createdAt,
    fallback: false
  };
}

function compactTitle(title: string) {
  const characters = Array.from(title.replace(/\s+/g, " ").trim());
  return characters.length <= 36
    ? characters.join("")
    : `${characters.slice(0, 36).join("")}…`;
}

function isCompetitiveActivity(document: PosterDocument) {
  return (
    document.category === "competition" ||
    /比赛|挑战|竞赛|赛|球|跑|运动|竞技/.test(
      `${document.title} ${document.rules ?? ""}`
    )
  );
}

function settingFor(document: PosterDocument) {
  const source = document.sessions.map((session) => session.location).join(" ");
  if (/户外|草坪|广场|公园|街道/.test(source)) {
    return "与活动相符的开阔户外空间，不复刻具体内部地址";
  }
  if (/体育|球馆|球场|健身/.test(source)) {
    return "与活动相符的现代室内运动空间，不复刻具体内部地址";
  }
  return "与活动相符的简洁企业活动空间，不复刻具体内部地址";
}
