"use client";
import { useState } from "react";
import { useTeaStudio } from "../tea/use-tea-studio";
import { TeaStudio, TeaPreview } from "../tea/tea-studio";

import { LoadingCard } from "./fields";
import { LivePreview } from "./live-preview";
import { StepFour } from "./steps/step-four";
import { StepOne } from "./steps/step-one";
import { StepThree } from "./steps/step-three";
import { StudioShell } from "./studio-shell";
import type { ActivityStudioProps } from "./types";
import { useActivityStudioController } from "./use-activity-studio-controller";

export function ActivityStudio({ identity, fixtureMode = false, initialTea = false, initialTeaJobId }: ActivityStudioProps & { initialTea?: boolean; initialTeaJobId?: string }) {
  const [selectedScene, setSelectedScene] = useState(initialTea ? "02" : "01");
  const tea = useTeaStudio(selectedScene === "02", initialTeaJobId, fixtureMode);
  const {
    form,
    stage,
    setStage,
    job,
    visualDescription,
    descriptionStale,
    qrMode,
    qrUploadPending,
    error,
    restoring,
    pendingAction,
    previewCopy,
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
    retryVisual,
    assistTitles,
    refineVisual,
    confirmVisual,
    selectVisualOption,
    confirmSelectedVisual,
    replaceVisual,
    startNewPoster
  } = useActivityStudioController(fixtureMode, initialTea);

  return <StudioShell
    identity={identity}
    selectedScene={selectedScene}
    onScene={scene => {
      setSelectedScene(scene);
      if (scene !== "02") {
        const query = new URLSearchParams(window.location.search);
        query.delete("scene"); query.delete("job");
        if (job?.id) query.set("job", job.id);
        window.history.replaceState(null, "", query.size ? `?${query}` : window.location.pathname);
      }
    }}
    stage={selectedScene === "02" ? tea.stage : stage}
    onStage={selectedScene === "02" ? next => { if (!tea.pending && !tea.working) tea.setStage(next); } : setStage}
    preview={selectedScene === "02" ? <TeaPreview controller={tea} /> : <LivePreview
      form={form}
      activeRenderTarget={form.activeRenderTarget}
      onRenderTarget={selectRenderTarget}
      copy={previewCopy}
      hasQr={qrMode === "add" && (Boolean(form.qrUrl) || Boolean(form.qrAssetId))}
      job={job}
      stage={stage}
      fixtureMode={fixtureMode}
    />}
  >
    {selectedScene === "02" ? <TeaStudio controller={tea} fixture={fixtureMode} /> : <div className="ead-activity-content">
      <div className="ead-title-row"><div><em>体育赛事</em><h1>制作一套活动海报</h1><p>填写活动信息，依次确认文案与画面</p></div></div>
      {restoring ? <LoadingCard title="正在恢复任务" detail="正在读取本地预览状态…" /> : stage === 1 && <StepOne form={form} qrMode={qrMode} qrUploadPending={qrUploadPending} aiReady={job?.status === "READY_FOR_COPY_REVIEW"} aiCandidate={job?.status === "READY_FOR_COPY_REVIEW" && job.copyDraft ? { slogan: job.copyDraft.document.slogan, subtitle: job.copyDraft.document.subtitle } : undefined} onToggleRenderTarget={toggleRenderTarget} onField={updateForm} onQrUrl={updateQrUrl} onSession={updateSession} onQrMode={changeQrMode} onQrUpload={uploadQr} onClearQrAsset={clearQrAsset} onAssist={assistTitles} onSubmit={submit} error={error ?? job?.error?.message} pending={pendingAction === "copy" || pendingAction === "submit" || job?.status === "QUEUED" || job?.status === "GENERATING_COPY"} />}
      {!restoring && stage === 2 && <StepThree error={error ?? job?.error?.message} onRetry={retryVisual} descriptionStale={descriptionStale} job={job} form={form} onField={updateForm} visualDescription={visualDescription} onDescription={changeVisualDescription} onRefine={refineVisual} onBack={() => setStage(1)} onGenerate={confirmVisual} onSelect={selectVisualOption} onConfirmVisual={confirmSelectedVisual} pendingRefine={pendingAction === "refine"} pendingGenerate={pendingAction === "visual"} pendingSelect={pendingAction === "selectVisual"} pendingConfirmVisual={pendingAction === "confirmAsset"} />}
      {!restoring && stage === 3 && <StepFour job={job} renderTargets={form.renderTargets} activeRenderTarget={form.activeRenderTarget} onRenderTarget={selectRenderTarget} onReplace={replaceVisual} onRestart={startNewPoster} pending={pendingAction === "replace"} fixtureMode={fixtureMode} />}
      {stage === 3 && (error || job?.error) && <p className="ead-error">{error ?? `${job?.error?.message}（${job?.error?.code}）`}</p>}
    </div>}
  </StudioShell>;
}
