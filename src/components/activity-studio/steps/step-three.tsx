"use client";
import { useId } from "react";
import { LoadingCard, SectionHead } from "../fields";
import type { ActivityJob } from "../types";

export function StepThree({ job, visualIdea, visualDescription, onIdea, onDescription, onRefine, onBack, onConfirm, pendingRefine, pendingConfirm }: { job?: ActivityJob; visualIdea: string; visualDescription: string; onIdea: (value: string) => void; onDescription: (value: string) => void; onRefine: () => void; onBack: () => void; onConfirm: () => void; pendingRefine: boolean; pendingConfirm: boolean }) {
  const promptId = useId();
  const hasDraft = Boolean(job?.visualDraft);
  const promptValue = hasDraft ? visualDescription : visualIdea;
  const updatePrompt = hasDraft ? onDescription : onIdea;
  if (job?.status === "REFINING_VISUAL") return <LoadingCard title="正在优化画面描述" detail={job.currentStep} />;
  if (job?.status === "GENERATING_ASSET" || job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT") return <LoadingCard title="正在生成主视觉" detail={job.currentStep} />;
  return <section className="ead-visual-workbench"><div className="ead-visual-block"><SectionHead index="03" title="确认主视觉 Prompt" hint="确认内容直接进入图片模型" /><label className="ead-visual-label" htmlFor={promptId}>{hasDraft ? "确认前可编辑的画面描述" : "你的画面想法"}</label><textarea id={promptId} className="ead-visual-prompt" rows={5} value={promptValue} onChange={(event) => updatePrompt(event.target.value)} placeholder="例如：几位同事在室内羽毛球场轻松对打，橙红色运动摄影，画面有能量但保持克制" /><div className="ead-generate-row"><p>{hasDraft ? "当前草稿可直接编辑后确认；重新优化时会基于最初画面想法生成新草稿。" : "描述主体、动作、环境、风格和氛围。未指定风格时默认采用自然商业摄影。"}</p><button type="button" className="ead-primary" onClick={onRefine} disabled={visualIdea.trim().length < 10 || pendingRefine}>{pendingRefine ? "正在优化…" : hasDraft ? "重新优化草稿" : "AI 优化画面描述"}</button></div>{hasDraft && <div className="ead-draft-badge">{job!.visualDraft!.fallback ? "本地规则兜底 · 仍需确认" : `${job!.visualDraft!.provider} 已生成优化草稿`}</div>}</div><div className="ead-visual-divider" /><div className="ead-visual-block ead-visual-confirm"><SectionHead index="04" title="确认并生成" hint="当前为一张视觉母图，不伪造候选版本" /><p className="ead-model-note">只会把确认后的描述交给图片模型；不会自动再次改写。横版、Banner 和长图会复用同一视觉母图。</p><div className="ead-stage-actions ead-visual-actions"><button type="button" className="ead-secondary" onClick={onBack} disabled={pendingConfirm}>返回文案</button><button type="button" className="ead-primary" onClick={onConfirm} disabled={!job?.visualDraft || visualDescription.trim().length < 10 || pendingConfirm}>{pendingConfirm ? "正在生成…" : "确认并生成主视觉 →"}</button></div></div></section>;
}
