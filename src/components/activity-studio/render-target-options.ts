import type { RenderTargetId } from "@/contracts/brand";

export const renderTargetOptions = [
  { id: "portrait_1080x1920", label: "竖版", size: "1080 × 1920" },
  { id: "landscape_1920x1080", label: "横版", size: "1920 × 1080" },
  { id: "banner_2227x950", label: "Banner", size: "2227 × 950" },
  { id: "longform_1080xAuto", label: "长图", size: "1080 × 3000" }
] as const satisfies ReadonlyArray<{
  id: RenderTargetId;
  label: string;
  size: string;
}>;

export function renderTargetOption(target: RenderTargetId) {
  return renderTargetOptions.find((option) => option.id === target)!;
}

export function selectedRenderTarget(
  targets: RenderTargetId[],
  active: RenderTargetId
) {
  return targets.includes(active)
    ? active
    : targets[0] ?? "portrait_1080x1920";
}
