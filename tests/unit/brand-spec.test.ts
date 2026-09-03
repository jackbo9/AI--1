import { describe, expect, it } from "vitest";
import fixture from "../fixtures/brand-spec.v1.json";
import { brandSpecV1 } from "@/brand/brand-spec-v1";
import { brandSpecSchema } from "@/contracts/brand";

describe("BrandSpec v1", () => {
  it("locks the approved tokens and default output bundle", () => {
    expect(brandSpecSchema.parse(fixture)).toEqual(brandSpecV1);
    expect(brandSpecV1.tokens.colors.adminYellow).toBe("#FAE24C");
    expect(brandSpecV1.tokens.typography).toMatchObject({
      family: "MiSans",
      h0Px: 120,
      h1Px: 80,
      titleMaxLines: 3
    });
    expect(brandSpecV1.defaultRenderTargets).toHaveLength(4);
  });

  it("rejects approximate yellow and reversed brand marks", () => {
    expect(
      brandSpecSchema.safeParse({
        ...fixture,
        tokens: {
          ...fixture.tokens,
          colors: {
            ...fixture.tokens.colors,
            adminYellow: "#FFE102"
          }
        }
      }).success
    ).toBe(false);

    expect(
      brandSpecSchema.safeParse({
        ...fixture,
        tokens: {
          ...fixture.tokens,
          brandHeader: {
            ...fixture.tokens.brandHeader,
            companyLogoPosition: "right"
          }
        }
      }).success
    ).toBe(false);
  });
});
