import { brandSpecSchema } from "@/contracts/brand";

export const brandSpecV1 = brandSpecSchema.parse({
  brandSpecVersion: 1,
  id: "ninebot-admin-employee-activity",
  scene: "employee_activity",
  status: "locked",
  tokens: {
    colors: {
      brandBlack: "#000000",
      surface: "#F5F5F2",
      adminYellow: "#FAE24C",
      activityRed: "#DA291C"
    },
    typography: {
      family: "MiSans",
      h0Px: 120,
      h1Px: 80,
      titleMaxLines: 3
    },
    brandHeader: {
      companyLogoPosition: "left",
      administrationMarkPosition: "right",
      preserveAspectRatio: true
    }
  },
  defaultRenderTargets: [
    "portrait_1080x1920",
    "landscape_1920x1080",
    "banner_2227x950",
    "longform_1080xAuto"
  ],
  rules: {
    titleOverflow: "block_export",
    longformHeight: "auto",
    importantTextCropping: "forbidden",
    llmLayoutControl: "forbidden",
    imageModelText: "forbidden"
  }
});
