import type { ActivityStudioFixtureJob } from "@/components/activity-studio-fixture";

export type Stage = 1 | 2 | 3 | 4;

export type ActivityJob = ActivityStudioFixtureJob;

export type SessionState = {
  date: string;
  time: string;
  location: string;
};

export type FormState = {
  activityName: string;
  session: SessionState;
  audience: string;
  supplement: string;
  deadline: string;
  contact: string;
  rules: string;
  prize: string;
  qrUrl: string;
  qrAssetId: string;
  qrAssetPreviewUrl?: string;
  qrAssetName: string;
};

export type CopyReview = {
  subtitle: string;
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

export type ActivityStudioProps = {
  identity: StudioIdentity;
  fixtureMode?: boolean;
};
