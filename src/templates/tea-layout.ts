import type { TeaFields } from "@/contracts/tea";

export const teaTemplateVersion = "tea-1.0.0";
export const teaLayout = { width: 1080, height: 1920, x: 72, titleBaseline: 416, subtitleBaseline: 497, titleSize: 120, subtitleSize: 28, maxWidth: 936 };
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function teaMarkup(fields: Pick<TeaFields, "title" | "subtitle">, image: string | undefined, brand: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="下午茶海报"><rect width="1080" height="1920" fill="white"/>${image ? `<image href="${escape(image)}" width="1080" height="1920" preserveAspectRatio="xMidYMax slice"/>` : ""}<image href="${escape(brand)}" width="1080" height="1920"/><text x="72" y="416" font-family="TeaMiSans" font-size="120" font-weight="700" fill="#000">${escape(fields.title)}</text><text x="72" y="497" font-family="TeaMiSans" font-size="28" font-weight="400" fill="#000">${escape(fields.subtitle)}</text></svg>`;
}
