import type {
  CampaignBrief,
  ConfirmedCampaignDocument,
  EmployeeActivityInput,
  GenerationStatus,
  OutputFormat,
  PosterDocument,
  VisualMaster
} from "./poster";
import type {
  BrandSpecVersion,
  RenderTargetId
} from "./brand";
import type { T01ReadabilityReport } from "@/templates/t01-readability";

export type OutputValidation = {
  passed: boolean;
  exportAllowed?: boolean;
  strategy?: "strict" | "trial";
  messages: string[];
  readability?: T01ReadabilityReport;
};

export type GenerationVersion = {
  id: string;
  createdAt: string;
  posterDocument: PosterDocument;
  outputFormat: OutputFormat;
  templateVersion: string;
  promptVersion: string;
  illustrationPromptVersion: string;
  modelInfo: {
    copyProvider: string;
    copyModel: string;
    compilerProvider: string;
    imageProvider: string;
    imageModel: string;
  };
  assetMode: "generated" | "fallback";
  assetDetail?: string;
  assetPath: string;
  outputPath: string;
  validation: OutputValidation;
};

export type ArtifactStatus =
  | "PENDING"
  | "RENDERING"
  | "READY"
  | "FAILED";

export type Artifact = {
  id: string;
  renderTargetId: RenderTargetId;
  status: ArtifactStatus;
  createdAt: string;
  brandSpecVersion: BrandSpecVersion;
  documentVersionId: string;
  visualFamilyId: string;
  width: number;
  heightMode: "fixed" | "auto";
  height?: number;
  templateId: string;
  templateVersion: string;
  assetMode: "generated" | "derived" | "fallback";
  assetDetail?: string;
  assetPath?: string;
  outputPath?: string;
  validation: OutputValidation;
  error?: { code: string; message: string };
};

export type CopyDraft = {
  document: PosterDocument;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
};

export type VisualInput = {
  originalIntent: string;
  sourceCopyCreatedAt: string;
  createdAt: string;
};

export type VisualDraft = {
  description: string;
  brief: VisualMaster["brief"];
  provider: string;
  model?: string;
  promptVersion: string;
  sourceCopyCreatedAt: string;
  createdAt: string;
  fallback: boolean;
};

export type ConfirmedVisual = {
  description: string;
  sourceDraftCreatedAt: string;
  createdAt: string;
};

export type GenerationJob = {
  id: string;
  traceId: string;
  idempotencyKey: string;
  actionIdempotencyKeys: string[];
  userId: string;
  /**
   * @deprecated 仅用于读取 2026-09-03 之前的单竖版任务和维持当前
   * B2 切片运行；新编排以 campaignBrief 为业务事实真源。
   */
  input: EmployeeActivityInput;
  campaignBrief?: CampaignBrief;
  status: GenerationStatus;
  currentStep: string;
  retryCount: number;
  copyDraft?: CopyDraft;
  visualInput?: VisualInput;
  visualDraft?: VisualDraft;
  confirmedVisual?: ConfirmedVisual;
  confirmedDocument?: ConfirmedCampaignDocument;
  visualMaster?: VisualMaster;
  artifacts?: Artifact[];
  error?: { code: string; message: string };
  /**
   * @deprecated 当前结果页仍读取单输出版本；Bundle UI 完成后移除。
   */
  versions: GenerationVersion[];
  createdAt: string;
  updatedAt: string;
};

export type CampaignGenerationJob = GenerationJob & {
  campaignBrief: CampaignBrief;
  artifacts: Artifact[];
};
