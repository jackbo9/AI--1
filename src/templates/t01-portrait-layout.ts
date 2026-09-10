/** Shared T01 portrait title-area contract for the renderer and manifest. */
export const t01PortraitLayout = {
  contentLeft: 64,
  contentWidth: 952,
  titleFontSize: 125,
  titleLineHeight: 130,
  titleMaxLines: 2,
  titleRecommendedCharacters: 14,
  subtitleFontSize: 28,
  subtitleLineHeight: 35,
  subtitleMaxLines: 2,
  subtitleRecommendedCharacters: 25,
  titleSubtitleGap: 22,
  // Figma 426:4: title group y=222, required slogan line 32.5px, then 22px gap.
  titleTop: 276.5,
  titleAreaBottom: 1196,
  infoPanelTop: 1292,
  infoTop: 1346,
  infoWidth: 952,
  infoBottom: 1874,
  qrTop: 1591,
  qrLeft: 846,
  qrSize: 134,
  figmaSource: "600:3370"
} as const;
