/** Shared T01 portrait title-area contract for the renderer and manifest. */
export const t01PortraitLayout = {
  contentLeft: 64,
  contentWidth: 952,
  titleFontSize: 125,
  titleLineHeight: 130,
  titleMaxLines: 6,
  titleRecommendedCharacters: 14,
  subtitleFontSize: 28,
  subtitleLineHeight: 35,
  subtitleMaxLines: 2,
  subtitleRecommendedCharacters: 25,
  titleSubtitleGap: 22,
  // Figma 426:4: title group y=222, required slogan line 32.5px, then 22px gap.
  titleTop: 276.5,
  titleAreaBottom: 1196,
  infoPanelTop: 1260,
  infoTop: 1298,
  infoWidth: 952,
  infoBottom: 1818,
  qrTop: 1496,
  qrLeft: 850,
  qrSize: 134,
  figmaSource: "426:4"
} as const;
