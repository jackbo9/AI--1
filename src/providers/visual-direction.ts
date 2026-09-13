import { sportsCanvasPrompt } from "@/contracts/sports-canvas";

/** Locked sports art direction; logos, facts and QR remain renderer-owned. */
export const editorialDirection =
  "APPLE MINIMALISM + NIKE ATHLETIC ENERGY + PREMIUM EDITORIAL SPORTS PHOTOGRAPHY。Apple负责留白、空间、材质、克制、色彩控制和层级；Nike负责动势、非对称、尺度、大胆裁切和张力。一个主焦点加最多1–2个辅助元素，不默认巨大单物件。从低机位、微距细节、偏心构图、大面积留白、场地几何、真实运动模糊、高速冻结、自然光、浅景深中只选最合适的1–3项，不全部堆叠。真实材质、物理、自然运动与受力，避免体育新闻、场馆宣传和团建照。主题色仅为整体倾向，可来自环境、器材、材质或光影，不指定单一配色组合，不套同色滤镜、不强行染色。";
export const editorialComposition = sportsCanvasPrompt("portrait_1080x1920");

export function peopleDirection(mode: "auto" | "forbid" | "allow" = "auto") {
  return mode === "forbid"
    ? "禁止人物、人体、手脚、面部和剪影"
    : mode === "allow"
      ? "画面包含运动员局部参与动作：手、腿或鞋与器材发生真实接触；禁止正面大脸、多人合影、看镜头和企业摆拍"
      : "根据动作需要决定是否出现运动员局部，优先器材与运动瞬间；避免正面大脸和多人合影";
}
