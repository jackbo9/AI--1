"use client";

import { LoadingCard } from "./fields";
import { LivePreview } from "./live-preview";
import { StepFour } from "./steps/step-four";
import { StepOne } from "./steps/step-one";
import { StepThree } from "./steps/step-three";
import { StudioShell } from "./studio-shell";
import type { ActivityStudioProps } from "./types";
import { useActivityStudioController } from "./use-activity-studio-controller";

export function ActivityStudio({ identity, fixtureMode = false }: ActivityStudioProps) {
  const {
    form,
    stage,
    setStage,
    job,
    visualDescription,
    qrMode,
    qrUploadPending,
    error,
    restoring,
    pendingAction,
    previewCopy,
    statusLabel,
    updateForm,
    toggleRenderTarget,
    selectRenderTarget,
    updateSession,
    updateQrUrl,
    changeQrMode,
    clearQrAsset,
    uploadQr,
    changeVisualDescription,
    submit,
    assistTitles,
    refineVisual,
    confirmVisual,
    replaceVisual,
    startNewPoster
  } = useActivityStudioController(fixtureMode);

  return <StudioShell
    identity={identity}
    stage={stage}
    onStage={setStage}
    preview={<LivePreview
      form={form}
      activeRenderTarget={form.activeRenderTarget}
      onRenderTarget={selectRenderTarget}
      copy={previewCopy}
      hasQr={qrMode === "add" && (Boolean(form.qrUrl) || Boolean(form.qrAssetId))}
      job={job}
      stage={stage}
      statusLabel={statusLabel}
      fixtureMode={fixtureMode}
    />}
  >
    <div className="ead-activity-content">
      <div className="ead-title-row"><div><em>员工活动</em><h1>制作一套活动海报</h1><p>一份内容，先确认文案，再生成主视觉</p></div><small>{fixtureMode ? "Fixture 交互演练 · 不调用真实模型" : `${identity.provider === "feishu" ? "飞书账号" : "本地演示"} · 状态随任务恢复`}</small></div>
      {restoring ? <LoadingCard title="正在恢复任务" detail="正在读取本地预览状态…" /> : stage === 1 && <StepOne form={form} qrMode={qrMode} qrUploadPending={qrUploadPending} aiReady={job?.status === "READY_FOR_COPY_REVIEW"} aiCandidate={job?.status === "READY_FOR_COPY_REVIEW" && job.copyDraft ? { slogan: job.copyDraft.document.slogan, subtitle: job.copyDraft.document.subtitle } : undefined} onToggleRenderTarget={toggleRenderTarget} onField={updateForm} onQrUrl={updateQrUrl} onSession={updateSession} onQrMode={changeQrMode} onQrUpload={uploadQr} onClearQrAsset={clearQrAsset} onAssist={assistTitles} onSubmit={submit} pending={pendingAction === "submit"} />}
      {!restoring && stage === 2 && <StepThree job={job} visualDescription={visualDescription} onDescription={changeVisualDescription} onRefine={refineVisual} onBack={() => setStage(1)} onConfirm={confirmVisual} pendingRefine={pendingAction === "refine"} pendingConfirm={pendingAction === "visual"} />}
      {!restoring && stage === 3 && <StepFour job={job} form={form} onReplace={replaceVisual} onRestart={startNewPoster} pending={pendingAction === "replace"} fixtureMode={fixtureMode} />}
      {(error || job?.error) && <p className="ead-error">{error ?? `${job?.error?.message}（${job?.error?.code}）`}</p>}
    </div>
  </StudioShell>;
}
