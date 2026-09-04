import { readFile } from "node:fs/promises";
import path from "node:path";

type EmbeddedBrandAssets = {
  companyLogo: string;
  companyLogoInverse: string;
  administrationMark: string;
  fontFaceCss: string;
};

export class BrandAssetError extends Error {
  readonly code = "BRAND_ASSET_UNAVAILABLE";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BrandAssetError";
  }
}

const brandRoot = path.join(process.cwd(), "public", "brand");

export const brandAssetPaths = {
  companyLogo: path.join(brandRoot, "company-logo.svg"),
  administrationMark: path.join(brandRoot, "administration-mark.svg"),
  fonts: {
    regular: path.join(brandRoot, "fonts", "MiSans-Regular.otf"),
    semibold: path.join(brandRoot, "fonts", "MiSans-Semibold.otf")
  }
} as const;

let assetsPromise: Promise<EmbeddedBrandAssets> | undefined;

function dataUri(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function embedBrandAssets(): Promise<EmbeddedBrandAssets> {
  try {
    const [companyLogo, administrationMark, regular, semibold] =
      await Promise.all([
        readFile(brandAssetPaths.companyLogo),
        readFile(brandAssetPaths.administrationMark),
        readFile(brandAssetPaths.fonts.regular),
        readFile(brandAssetPaths.fonts.semibold)
      ]);

    // The inverse mark is derived only from the approved vector master. This
    // keeps the logo geometry intact and avoids CSS filters at render time.
    const companyLogoInverse = Buffer.from(
      companyLogo.toString("utf8").replaceAll('fill="black"', 'fill="white"')
    );

    return {
      companyLogo: dataUri(companyLogo, "image/svg+xml"),
      companyLogoInverse: dataUri(companyLogoInverse, "image/svg+xml"),
      administrationMark: dataUri(administrationMark, "image/svg+xml"),
      fontFaceCss: [
        `@font-face{font-family:"MiSans";src:url("${dataUri(
          regular,
          "font/otf"
        )}") format("opentype");font-style:normal;font-weight:400;font-display:block}`,
        `@font-face{font-family:"MiSans";src:url("${dataUri(
          semibold,
          "font/otf"
        )}") format("opentype");font-style:normal;font-weight:600;font-display:block}`
      ].join("")
    };
  } catch (error) {
    throw new BrandAssetError(
      "正式品牌资产未完整加载，已阻止生成海报。",
      { cause: error }
    );
  }
}

export function loadEmbeddedBrandAssets() {
  if (!assetsPromise) {
    assetsPromise = embedBrandAssets().catch((error: unknown) => {
      assetsPromise = undefined;
      throw error;
    });
  }
  return assetsPromise;
}

export function brandHeaderMarkup(
  assets: EmbeddedBrandAssets,
  variant: "primary" | "inverse"
) {
  const companyLogo =
    variant === "inverse" ? assets.companyLogoInverse : assets.companyLogo;
  return `<header class="brand-header" data-brand-header>
    <img class="company-logo" data-brand-company-logo data-logo-variant="${variant}" src="${companyLogo}" alt="九号公司">
    <img class="administration-mark" data-brand-administration-mark src="${assets.administrationMark}" alt="行政">
  </header>`;
}
