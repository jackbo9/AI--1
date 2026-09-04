import type { PosterDocument } from "@/contracts/poster";

/** A deterministic projection of confirmed activity content, not model output. */
export type T01TemplateContent = {
  title: string;
  description: string;
  sessions: Array<{ label?: string; date: string; time: string; location: string }>;
  audience: string;
  deadline: string;
  contact: string;
  ruleSections: Array<{ title: string; body: string }>;
  registrationNote: string;
};

export type T01TemplateAssets = {
  companyLogo: string;
  administrationLogo: string;
  image: string;
  qr?: string;
};

/** Preserve all rule text; a labelled paragraph can become a named card. */
export function ruleSectionsFromText(rules: string): T01TemplateContent["ruleSections"] {
  const paragraphs = rules.trim().split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map((paragraph) => {
    const match = /^([^\n：:]{1,24})[：:]\s*([\s\S]+)$/.exec(paragraph);
    return match
      ? { title: match[1].trim(), body: match[2].trim() }
      : { title: "活动规则", body: paragraph };
  });
}

export function t01ContentFromDocument(document: PosterDocument): T01TemplateContent {
  const rules = document.rules?.trim() || document.participationSteps.join("\n");
  return {
    title: document.title,
    description: document.subtitle || document.summary,
    sessions: document.sessions,
    audience: document.audience,
    deadline: document.deadline ?? "",
    contact: document.contact,
    ruleSections: [
      ...(document.highlights.length ? [{ title: "比赛项目", body: document.highlights.join(" / ") }] : []),
      ...ruleSectionsFromText(rules),
      ...(document.notice.trim() ? [{ title: "注意事项", body: document.notice }] : [])
    ],
    registrationNote: document.ctaLabel
  };
}
