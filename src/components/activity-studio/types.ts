import type { GenerationJob } from "@/contracts/job";

export type Stage = 1 | 2 | 3 | 4;

export type ActivityJob = Pick<
  GenerationJob,
  | "status"
  | "currentStep"
  | "error"
  | "copyDraft"
  | "visualInput"
  | "visualDraft"
  | "versions"
> & {
  id?: string;
  previewUrl?: string;
};

export type SessionState = {
  date: string;
  time: string;
  location: string;
};

export type FormState = {
  activityName: string;
  session: SessionState;
  secondSession?: SessionState;
  audience: string;
  supplement: string;
  deadline: string;
  contact: string;
  rules: string;
  prize: string;
  qrUrl: string;
};

export type CopyReview = {
  summary: string;
  rules: string;
  prize: string;
};

export type QrMode = "none" | "add";

export type PendingAction =
  | "submit"
  | "copy"
  | "refine"
  | "visual"
  | "replace";

export type StudioIdentity = {
  displayName: string;
  provider: "local" | "feishu";
};
