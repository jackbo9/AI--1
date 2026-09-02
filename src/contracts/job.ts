import type {
  EmployeeActivityInput,
  GenerationStatus,
  OutputFormat,
  PosterDocument
} from "./poster";

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
  validation: { passed: boolean; messages: string[] };
};

export type CopyDraft = {
  document: PosterDocument;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
};

export type GenerationJob = {
  id: string;
  traceId: string;
  idempotencyKey: string;
  actionIdempotencyKeys: string[];
  userId: string;
  input: EmployeeActivityInput;
  status: GenerationStatus;
  currentStep: string;
  retryCount: number;
  copyDraft?: CopyDraft;
  error?: { code: string; message: string };
  versions: GenerationVersion[];
  createdAt: string;
  updatedAt: string;
};
