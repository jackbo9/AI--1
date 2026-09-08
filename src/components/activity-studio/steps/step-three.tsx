"use client";
import { useId } from "react";
import { LoadingCard, SectionHead } from "../fields";
import type { ActivityJob } from "../types";

export function StepThree({ job, visualDescription, onDescription, onRefine, onBack, onConfirm, pendingRefine, pendingConfirm }: { job?: ActivityJob; visualDescription: string; onDescription: (value: string) => void; onRefine: () => void; onBack: () => void; onConfirm: () => void; pendingRefine: boolean; pendingConfirm: boolean }) {
  const promptId = useId();
  const hasDraft = Boolean(job?.visualDraft);
  if (job?.status === "REFINING_VISUAL") return <LoadingCard title="正在优化画面描述" detail={job.currentStep} />;
  if (job?.status === "GENERATING_ASSET" || job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT") return <LoadingCard title="正在生成主视觉" detail={job.currentStep} />;
  return <section className="ead-visual-workbench"><div className="ead-visual-block"><SectionHead index="02" title="编辑视觉描述" hint="已按体育赛事品牌标准生成基础描述" /><label className="ead-visual-label" htmlFor={promptId}>主视觉生成描述</label><textarea id={promptId} className="ead-visual-prompt" rows={10} maxLength={420} value={visualDescription} onChange={(event) => onDescription(event.target.value)} placeholder="基础描述加载中，可直接编辑赛事类型、主题色和视觉表现。" /><div className="ead-generate-row"><p>可直接修改后确认，也可让 AI 基于当前文本优化；默认以赛事器材和运动瞬间为主体，不生成人物。</p><button type="button" className="ead-primary" onClick={onRefine} disabled={visualDescription.trim().length < 10 || pendingRefine}>{pendingRefine ? "正在优化…" : "AI 优化"}</button></div>{hasDraft && <div className="ead-draft-badge">{job!.visualDraft!.provider === "t01-base-description" ? "品牌标准基础描述 · 尚未确认" : job!.visualDraft!.fallback ? "本地规则优化 · 尚未确认" : `${job!.visualDraft!.provider} 优化结果 · 尚未确认`}</div>}</div><div className="ead-visual-divider" /><div className="ead-visual-block ead-visual-confirm"><div className="ead-visual-confirm-head"><h3>确认视觉描述</h3><small>这一步不是确认主视觉图片</small></div><p className="ead-model-note">确认后保存这份描述，并将它直接用于下一次主视觉生成。</p><div className="ead-stage-actions ead-visual-actions"><button type="button" className="ead-secondary" onClick={onBack} disabled={pendingConfirm}>返回文案</button><button type="button" className="ead-primary" onClick={onConfirm} disabled={!job?.visualDraft || visualDescription.trim().length < 10 || pendingConfirm}>{pendingConfirm ? "正在生成…" : "确认描述并生成主视觉 →"}</button></div></div></section>;
}
