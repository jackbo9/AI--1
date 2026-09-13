import type { ActivityStudioFixtureJob } from "@/components/activity-studio-fixture";
import type { RenderTargetId } from "@/contracts/brand";

export type Stage = 1 | 2 | 3;

export type ActivityJob = ActivityStudioFixtureJob;

export type SessionState = {
  date: string;
  time: string;
  location: string;
};

export type FinalistGroupState = {
  label: string;
  entrants: Array<{ name: string; region: string }>;
};

export type FormState = {
  renderTargets: RenderTargetId[];
  activeRenderTarget: RenderTargetId;
  activityName: string;
  slogan: string;
  subtitle: string;
  session: SessionState;
  audience: string;
  rules: string;
  qrUrl: string;
  qrAssetId: string;
  qrAssetPreviewUrl?: string;
  qrAssetName: string;
  finalistGroups: FinalistGroupState[];
  sportType: "auto" | "tennis" | "badminton" | "basketball" | "football" | "volleyball" | "table_tennis" | "tug_of_war" | "running" | "other";
  themeColor: "auto" | "blue" | "green" | "red" | "yellow" | "purple" | "orange" | "neutral";
  peopleMode: "auto" | "forbid" | "allow";
  visualType: "auto" | "action" | "equipment" | "venue";
  visualTreatment: string;
  sportsConfirmed: boolean;
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
  | "selectVisual"
  | "confirmAsset"
  | "replace";

export type StudioIdentity = {
  displayName: string;
  provider: "local" | "feishu";
};

export type ActivityStudioProps = {
  identity: StudioIdentity;
  fixtureMode?: boolean;
};
