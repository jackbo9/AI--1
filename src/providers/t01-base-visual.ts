import type { VisualDraft } from "@/contracts/job";
import {
  illustrationBriefSchema,
  type IllustrationBrief,
  type PosterDocument
} from "@/contracts/poster";

export const t01BaseVisualPromptVersion = "t01-sports-base-visual-v2";

type SportProfile = {
  name: string;
  elements: string;
  motion: string;
  palette: string;
  mood: string;
};

const sportProfiles: Array<[RegExp, SportProfile]> = [
  [/羽毛球|羽球/, {
    name: "羽毛球",
    elements: "羽毛球、球拍、拍线、球网",
    motion: "高速飞行、拍面接触、羽毛材质特写或锐利轨迹",
    palette: "蓝、紫、绿或白中选择一个主色，搭配黑白中性色",
    mood: "轻盈、锐利、快速、灵活"
  }],
  [/乒乓球|乒乓/, {
    name: "乒乓球",
    elements: "乒乓球、球拍、胶皮、球网、台面边线",
    motion: "高速旋转、击球接触、弹跳轨迹或器材超近景",
    palette: "红、蓝或黑中选择一个主色，搭配白色中性色",
    mood: "精准、快速、锐利、竞技"
  }],
  [/网球/, {
    name: "网球",
    elements: "网球、球拍、拍线、球网、硬地场地线",
    motion: "高速飞行、拍面接触、低机位或弧线轨迹",
    palette: "网球绿、酸橙黄绿、深绿或蓝中选择一个主色，搭配黑白中性色",
    mood: "精准、干净、快速、高级"
  }],
  [/篮球/, {
    name: "篮球",
    elements: "篮球、篮筐、篮网、篮板、球场线",
    motion: "冲向篮筐、穿网瞬间、低机位、材质特写或高速拖影",
    palette: "篮球橙、蓝、黑或红中选择一个主色，搭配白色中性色",
    mood: "力量、爆发、竞技、城市感"
  }],
  [/足球/, {
    name: "足球",
    elements: "足球、球门、球网、草地或场地线",
    motion: "高速飞行、触球瞬间、低机位或空间纵深",
    palette: "绿、蓝、黑或白中选择一个主色，搭配深色中性色",
    mood: "速度、冲击、竞技、空间感"
  }],
  [/排球/, {
    name: "排球",
    elements: "排球、球网、场地线",
    motion: "高速飞行、触网或击球瞬间、低机位或运动轨迹",
    palette: "蓝、黄、橙或白中选择一个主色，搭配深色中性色",
    mood: "弹性、速度、冲击、竞技"
  }],
  [/拔河/, {
    name: "拔河",
    elements: "粗绳、绳结、纤维、地面摩擦痕迹",
    motion: "绳索拉紧、纤维受力、斜向张力或抓地摩擦",
    palette: "深红、橙、深绿或自然麻绳色中选择一个主色，搭配黑色中性色",
    mood: "张力、力量、协作、对抗"
  }]
];

const genericSportProfile: SportProfile = {
  name: "体育赛事",
  elements: "赛事最具代表性的器材、场地结构和运动轨迹",
  motion: "器材特写、高速冻结、真实运动模糊、低机位或场地几何线",
  palette: "根据赛事选择一个主色，搭配黑、白或深色中性色",
  mood: "真实、鲜活、有力量、有速度"
};

export function createT01BaseVisualDescription(document: PosterDocument) {
  const profile = sportProfileFor(document);
  return [
    `赛事类型：${profile.name}。`,
    `画面建议：从${profile.elements}中选择最有识别度的元素，表现${profile.motion}。`,
    `色彩倾向：${profile.palette}。`,
    `整体感受：${profile.mood}、真实、有品牌感。`
  ].join("\n");
}

export function createT01BaseVisualBrief(
  document: PosterDocument
): IllustrationBrief {
  const profile = sportProfileFor(document);
  return illustrationBriefSchema.parse({
    subject: `从${profile.elements}中选择 1–3 个核心符号，不出现人物`,
    action: profile.motion,
    setting: "真实专业运动现场，外围背景连续、简洁、可延展",
    composition:
      "LEFT TOP 为低信息标题安全区；主视觉中心位于 X 68%–78%、Y 48%–58%；关键主体不贴边",
    palette: profile.palette,
    style: "高端体育品牌 Campaign 与 Editorial Sports Photography，真实摄影，非 3D、非 CGI",
    mood: profile.mood,
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

export function sportProfileFor(document: PosterDocument): SportProfile {
  const source = `${document.title} ${document.slogan} ${document.subtitle} ${document.rules ?? ""}`;
  return sportProfiles.find(([pattern]) => pattern.test(source))?.[1] ??
    genericSportProfile;
}
