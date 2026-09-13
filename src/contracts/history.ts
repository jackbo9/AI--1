import { z } from "zod";

export const historyStatusSchema = z.enum([
  "copy_review",
  "visual_review",
  "processing",
  "completed",
  "failed"
]);

export type HistoryStatus = z.infer<typeof historyStatusSchema>;

export type JobHistoryItem = {
  workId: string;
  latestJobId: string;
  scene: "employee_activity" | "employee-afternoon-tea";
  title: string;
  subtitle?: string;
  status: HistoryStatus;
  updatedAt: string;
  versionCount: number;
  coverUrl?: string;
  hasDownloadableOutput: boolean;
  resumeStage: 1 | 2 | 3;
};

export type JobHistoryResponse = {
  items: JobHistoryItem[];
  nextCursor?: string;
};

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
  cursor: z.string().optional()
});
