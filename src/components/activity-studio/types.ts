import type { ActivityStudioFixtureJob } from "@/components/activity-studio-fixture";
import type { RenderTargetId } from "@/contracts/brand";

export type Stage = 1 | 2 | 3 | 4;

export type ActivityJob = ActivityStudioFixtureJob;

export type SessionState = {
  date: string;
  time: string;
  location: string;
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
