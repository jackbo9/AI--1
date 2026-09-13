"use client";

import type { VisualPreference } from "@/contracts/poster";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  createFixtureBaseVisualJob,
  createFixtureBaseVisualJobFromCopy,

  createFixtureReadyJob,
  createFixtureVisualOptionJob,
  createFixtureVisualDraftJob,
  UI_FIXTURE_JOB_ID,
  UI_FIXTURE_STORAGE_KEY
} from "@/components/activity-studio-fixture";
import { normalizeLines, splitDraftLines } from "@/components/multiline-fields";
import { createClientUuid } from "@/lib/client-uuid";
import {
  fetchActivityJob,
  requestCopyConfirmation,
  requestJobCreation,
  requestQrUpload,
  requestVisualConfirmation,
  requestVisualOptionConfirmation,
  requestVisualOptionSelection,
  requestVisualRefinement,
  requestVisualReplacement
} from "./activity-studio-api";
import {
  createCopyReview,
  createPreviewCopy,
  getStageForJob,
  hydrateForm,
  initialForm,
  isJobWorking,
  newFormState,
  normalizeForm,
  validateForm
} from "./activity-studio-model";
import type {
  ActivityJob,
  CopyReview,
  FormState,
  PendingAction,
  QrMode,
  SessionState,
  Stage
} from "./types";
import type { RenderTargetId } from "@/contracts/brand";

const fixtureForm = { ...initialForm, activityName: "羽球挑战赛", slogan: "九号员工羽球赛 / BADMINTON", subtitle: "一起上场，热爱不设限", session: { date: "2026-09-18", time: "", location: "园区体育馆" }, audience: "全体员工", rules: "小组循环赛\n三局两胜" };
function visualPreferences(form: FormState): VisualPreference {
  return { themeColor: form.themeColor, peopleMode: form.peopleMode, visualType: form.visualType, visualTreatment: form.visualTreatment.trim() };
}

export function useActivityStudioController(fixtureMode: boolean) {
  const [form, setForm] = useState<FormState>(() => fixtureMode ? structuredClone(fixtureForm) : newFormState());
  const [stage, setStage] = useState<Stage>(1);
  const [jobId, setJobId] = useState<string>();
  const [job, setJob] = useState<ActivityJob>();
  const [copyReview, setCopyReview] = useState<CopyReview>();
  const [visualDescription, setVisualDescription] = useState("");
  const [qrMode, setQrMode] = useState<QrMode>("none");
  const [qrUploadPending, setQrUploadPending] = useState(false);
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const refreshingRef = useRef(false);
  const visualDescriptionRef = useRef("");
  const visualDraftCreatedAtRef = useRef("");
  const manuallyEditedRef = useRef(false);
  const actionLockRef = useRef(false);
  const refreshEpochRef = useRef(0);
  const [descriptionStale, setDescriptionStale] = useState(false);
  const working = isJobWorking(job);
  const formRef = useRef(form);
  const qrUploadEpochRef = useRef(0);
  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const storedJobId = searchParams.get("job");
    if (fixtureMode) {
      const storedFixture = window.sessionStorage.getItem(UI_FIXTURE_STORAGE_KEY);
      if (storedJobId === UI_FIXTURE_JOB_ID && storedFixture) {
        try {
          const loaded = JSON.parse(storedFixture) as ActivityJob;
          setJobId(UI_FIXTURE_JOB_ID);
          setJob(loaded);
          hydrateJob(loaded);
        } catch {
          window.sessionStorage.removeItem(UI_FIXTURE_STORAGE_KEY);
        }
      }
      return;
    }
    if (!storedJobId) return;
    setRestoring(true);
    setJobId(storedJobId);
    void refreshJob(storedJobId).then((loaded) => {
      if (loaded) hydrateJob(loaded);
      setRestoring(false);
    });
  }, [fixtureMode]);


  useEffect(() => {
    if (!jobId || !working || fixtureMode) return;
    const timer = window.setInterval(() => {
      if (!refreshingRef.current) void refreshJob(jobId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [fixtureMode, jobId, working]);

  useEffect(() => {
    if (fixtureMode && job) {
      window.sessionStorage.setItem(UI_FIXTURE_STORAGE_KEY, JSON.stringify(job));
    }
  }, [fixtureMode, job]);

  useEffect(() => {
    if (!job) return;
    const nextStage = getStageForJob(job);
    if (nextStage) setStage(nextStage);
    if (job.status === "READY_FOR_COPY_REVIEW") {
      setCopyReview((current) => current ?? createCopyReview(job));
    } else if (
      ["READY_FOR_VISUAL_INPUT", "REFINING_VISUAL", "READY_FOR_VISUAL_REVIEW"].includes(
        job.status
      ) &&
      job.visualDraft &&
      visualDraftCreatedAtRef.current !== job.visualDraft.createdAt
    ) {
      visualDraftCreatedAtRef.current = job.visualDraft.createdAt;
      const description = job.visualDraft.provider === "t01-base-description" && job.copyDraft
        ? ""
        : job.visualDraft.description;
      manuallyEditedRef.current = job.visualDraft.provider !== "t01-base-description";
      setDescriptionStale(false);
      visualDescriptionRef.current = description;
      setVisualDescription(description);
    }
  }, [job]);

  async function refreshJob(id: string) {
    if (refreshingRef.current) return undefined;
    refreshingRef.current = true;
    const epoch = refreshEpochRef.current;
    try {
      const result = await fetchActivityJob(id);
      if (epoch !== refreshEpochRef.current) return undefined;
      if (!result.ok) {
        const payload = result.payload as { error?: { message?: string } };
        setError(payload.error?.message ?? "任务状态读取失败，请刷新重试");
        return undefined;
      }
      const loaded = result.payload as ActivityJob;
      setJob(loaded);
      return loaded;
    } catch {
      setError("连接中断，请刷新页面后重试");
      return undefined;
    } finally {
      refreshingRef.current = false;
    }
  }

  function hydrateJob(loaded: ActivityJob) {
    const preferences = loaded.visualDraft?.preferences ?? loaded.visualInput?.preferences ?? loaded.confirmedVisual?.preferences;
    setForm((current) => ({ ...hydrateForm(current, loaded), ...preferences, ...(loaded.visualDraft?.sportType ? { sportType: loaded.visualDraft.sportType as FormState["sportType"] } : {}) }));
    setQrMode(loaded.copyDraft?.document.includeQr ? "add" : "none");
    manuallyEditedRef.current = loaded.visualDraft?.provider !== "t01-base-description";
    setDescriptionStale(false);
    const prefersDraft =
      loaded.visualDraft &&
      (!loaded.confirmedVisual ||
        loaded.visualDraft.createdAt > loaded.confirmedVisual.createdAt);
    if (prefersDraft && loaded.visualDraft) {
      visualDraftCreatedAtRef.current = loaded.visualDraft.createdAt;
      visualDescriptionRef.current = loaded.visualDraft.description;
      setVisualDescription(loaded.visualDraft.provider === "t01-base-description" ? "" : loaded.visualDraft.description);
    } else if (loaded.confirmedVisual) {
      visualDraftCreatedAtRef.current = loaded.confirmedVisual.sourceDraftCreatedAt;
      visualDescriptionRef.current = loaded.confirmedVisual.description;
      setVisualDescription(loaded.confirmedVisual.description);
    } else if (loaded.visualInput) {
      visualDescriptionRef.current = loaded.visualInput.originalIntent;
      setVisualDescription(loaded.visualInput.originalIntent);
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (working || pendingAction || actionLockRef.current) return;
    setForm({ ...form, [key]: value });
    if (["themeColor", "peopleMode", "visualType", "visualTreatment", "sportType"].includes(key) && job?.copyDraft) {
      if (visualDescription) setDescriptionStale(true);
      else {
        const description = "";
        visualDescriptionRef.current = description;
        setVisualDescription(description);
        setDescriptionStale(false);
      }
    }
  }

  function toggleRenderTarget(target: RenderTargetId) {
    setForm((current) => {
      const isSelected = current.renderTargets.includes(target);
      const selected = isSelected
        ? current.renderTargets.filter((item) => item !== target)
        : [...current.renderTargets, target];
      if (!selected.length) return current;
      return {
        ...current,
        renderTargets: selected,
        activeRenderTarget: isSelected
          ? (selected.includes(current.activeRenderTarget) ? current.activeRenderTarget : selected[0]!)
          : target
      };
    });
  }

  function selectRenderTarget(target: RenderTargetId) {
    if (form.renderTargets.includes(target)) updateForm("activeRenderTarget", target);
  }

  function updateSession(key: keyof SessionState, value: string) {
    setForm((current) => ({
      ...current,
      session: {
        ...current.session,
        [key]: value
      }
    }));
  }

  function updateQrUrl(value: string) {
    setForm((current) => ({
      ...current,
      qrUrl: value,
      qrAssetId: value.trim() ? "" : current.qrAssetId,
      qrAssetPreviewUrl: value.trim() ? undefined : current.qrAssetPreviewUrl,
      qrAssetName: value.trim() ? "" : current.qrAssetName
    }));
  }

  function changeQrMode(mode: QrMode) {
    qrUploadEpochRef.current += 1;
    setQrUploadPending(false);
    setQrMode(mode);
    if (mode === "none") {
      setForm((current) => ({
        ...current,
        qrUrl: "",
        qrAssetId: "",
        qrAssetPreviewUrl: undefined,
        qrAssetName: ""
      }));
    }
  }

  function clearQrAsset() {
    setForm((current) => ({
      ...current,
      qrAssetId: "",
      qrAssetPreviewUrl: undefined,
      qrAssetName: ""
    }));
  }

  async function uploadQr(file?: File) {
    if (!file) return;
    const epoch = ++qrUploadEpochRef.current;
    setError(undefined);
    setQrUploadPending(true);
    try {
      const { ok, payload } = await requestQrUpload(file);
      if (epoch !== qrUploadEpochRef.current) return;
      if (!ok || !payload.assetId || !payload.previewUrl) {
        setError(payload.error?.message ?? "二维码图片上传失败");
        return;
      }
      setForm((current) => ({
        ...current,
        qrUrl: "",
        qrAssetId: payload.assetId!,
        qrAssetPreviewUrl: payload.previewUrl,
        qrAssetName: payload.filename ?? file.name
      }));
      setQrMode("add");
    } catch {
      setError("二维码图片上传失败，请确认服务仍在运行后重试");
    } finally {
      if (epoch === qrUploadEpochRef.current) setQrUploadPending(false);
    }
  }

  function changeVisualDescription(value: string) {
    if (working || pendingAction) return;
    manuallyEditedRef.current = true;
    visualDescriptionRef.current = value;
    setVisualDescription(value);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (pendingAction || working || qrUploadPending) return;
    const validationError = validateForm(form, true, qrMode === "add");
    if (validationError) return setError(validationError);
    setPendingAction("submit");
    refreshEpochRef.current += 1;
    manuallyEditedRef.current = false;
    setDescriptionStale(false);
    setJob(undefined);
    setCopyReview(undefined);
    visualDescriptionRef.current = "";
    visualDraftCreatedAtRef.current = "";
    setVisualDescription("");
    try {
      if (fixtureMode) {
        const input = normalizeForm(form);
        setJobId(UI_FIXTURE_JOB_ID);
        window.history.replaceState(null, "", `?fixture=1&job=${UI_FIXTURE_JOB_ID}`);
        const fixtureJob = createFixtureBaseVisualJob(input);
        setJob(fixtureJob);
        return;
      }
      const { ok, payload } = await requestJobCreation(normalizeForm(form), createClientUuid(), true, form.renderTargets, jobId);
      if (!ok || !payload.jobId) return setError(payload.error?.message ?? "提交需求失败");
      setJobId(payload.jobId);
      window.history.replaceState(null, "", `?job=${payload.jobId}`);
      setJob({ id: payload.jobId, status: "READY_FOR_VISUAL_REVIEW", currentStep: "基础视觉描述已准备，等待确认", versions: [] });
      await refreshJob(payload.jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function assistTitles() {
    if (working || pendingAction || actionLockRef.current) return;
    const title = form.activityName.trim();
    if (!title) return setError("请填写一级大标题");
    if (Array.from(title).length > 40) return setError("一级大标题最多 40 字");
    actionLockRef.current = true;
    setPendingAction("copy");
    setError(undefined);
    const original = { ...form };
    try {
      let suggestion: { slogan: string; subtitle: string };
      if (fixtureMode) {
        await pauseFixture();
        suggestion = { slogan: "九号员工羽毛球赛 / BADMINTON", subtitle: "一起上场，热爱不设限" };
      } else {
        const response = await fetch("/api/copy-suggestions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }), signal: AbortSignal.timeout(65000)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "文案建议生成失败");
        suggestion = payload;
      }
      if (formRef.current.activityName !== original.activityName ||
          formRef.current.slogan !== original.slogan ||
          formRef.current.subtitle !== original.subtitle) {
        setError("标题已修改，本次建议未覆盖你的修改；可重新获取建议。");
        return;
      }
      setForm(current => ({ ...current, slogan: suggestion.slogan, subtitle: suggestion.subtitle }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "文案建议生成失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function confirmCopy() {
    if (!jobId || !copyReview || !job?.copyDraft) return;
    setError(undefined);
    const document = job.copyDraft.document;
    setPendingAction("copy");
    try {
      if (fixtureMode) {
        await pauseFixture();
        setJob(createFixtureBaseVisualJobFromCopy({
          ...job,
          copyDraft: {
            ...job.copyDraft,
            document: {
              ...document,
              subtitle: copyReview.subtitle,
              summary: copyReview.summary,
              participationSteps: normalizeLines(splitDraftLines(copyReview.rules)),
              rules: copyReview.rules,
              prize: copyReview.prize
            }
          }
        }));
        return;
      }
      const { ok, payload } = await requestCopyConfirmation(jobId, {
        title: document.title,
        slogan: document.slogan,
        subtitle: copyReview.subtitle,
        summary: copyReview.summary,
        highlights: document.highlights,
        participationSteps: normalizeLines(splitDraftLines(copyReview.rules)),
        rules: copyReview.rules,
        prize: copyReview.prize
      }, createClientUuid());
      if (!ok) return setError(payload.error?.message ?? "确认文案失败");
      await refreshJob(jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function refineVisual() {
    if (working || pendingAction || actionLockRef.current) return;
    if (!jobId) return;
    const intent = visualDescription.trim() || "请根据已确认活动文案与当前画面变量生成主视觉描述。";
    if (visualDescription.trim().length > 420) return setError("视觉描述最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    actionLockRef.current = true;
    setPendingAction("refine");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "REFINING_VISUAL", currentStep: "正在优化画面描述" } : current);
        await pauseFixture();
        setJob((current) => current ? createFixtureVisualDraftJob(current, intent) : current);
        return;
      }
      const { ok, payload } = await requestVisualRefinement(
        jobId,
        intent,
        {
          themeColor: form.themeColor,
          peopleMode: form.peopleMode,
          visualType: form.visualType,
          visualTreatment: form.visualTreatment.trim()
        },
        createClientUuid(),
        { mode: visualDescription ? "regenerate" : "initial", sourceCopyCreatedAt: job?.copyDraft?.createdAt, sportType: form.sportType }
      );
      if (!ok) setError(payload.error?.message ?? "生成画面描述失败");
      else await refreshJob(jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function retryVisual(batchId: string, directionId: string) {
    if (!jobId || working || pendingAction || actionLockRef.current) return;
    actionLockRef.current = true;
    setPendingAction("visual");
    setError(undefined);
    try {
      const response = await fetch(`/api/jobs/${jobId}/visual-options/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId, directionId, idempotencyKey: createClientUuid() }) });
      if (!response.ok) throw new Error("重试失败，请稍后再试");
      await refreshJob(jobId);
    } catch (error) { setError(error instanceof Error ? error.message : "重试失败"); }
    finally { actionLockRef.current = false; setPendingAction(undefined); }
  }

  async function confirmVisual() {
    if (working || pendingAction || actionLockRef.current) return;
    if (descriptionStale) return setError("画面选项已变化，请重新生成描述");
    if (!jobId || !job?.visualDraft || visualDescription.trim().length < 10) return setError("请先核对并确认视觉描述");
    if (visualDescription.trim().length > 420) return setError("画面描述最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    actionLockRef.current = true;
    setPendingAction("visual");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "GENERATING_ASSET", currentStep: "正在生成主视觉" } : current);
        await pauseFixture();
        setJob((current) =>
          current
            ? { ...createFixtureVisualOptionJob(createFixtureVisualOptionJob(current, visualDescription.trim()), visualDescription.trim()), selectedVisualOptionId: undefined }
            : current
        );
        return;
      }
      const { ok, payload } = await requestVisualConfirmation(jobId, job.visualDraft.createdAt, visualDescription.trim(), createClientUuid(), visualPreferences(form));
      if (!ok) setError(payload.error?.message ?? "确认视觉描述失败");
      else await refreshJob(jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function selectVisualOption(optionId: string) {
    if (!jobId || job?.status !== "READY_FOR_VISUAL_REVIEW") return;
    setError(undefined);
    setPendingAction("selectVisual");
    try {
      if (fixtureMode) {
        setJob((current) =>
          current?.visualOptions?.some((option) => option.id === optionId)
            ? {
                ...current,
                selectedVisualOptionId: optionId,
                currentStep: "已选择主视觉方案"
              }
            : current
        );
        return;
      }
      setJob((current) =>
        current?.visualOptions?.some((option) => option.id === optionId)
          ? {
              ...current,
              selectedVisualOptionId: optionId,
              currentStep: "已选择主视觉方案，等待确认"
            }
          : current
      );
      const { ok, payload } = await requestVisualOptionSelection(jobId, optionId);
      if (!ok) {
        setError(payload.error?.message ?? "切换主视觉方案失败");
        await refreshJob(jobId);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function confirmSelectedVisual() {
    const optionId = job?.selectedVisualOptionId;
    if (!jobId || !optionId) return setError("请先选择一个主视觉方案");
    setError(undefined);
    setPendingAction("confirmAsset");
    try {
      if (fixtureMode) {
        setJob((current) =>
          current
            ? { ...current, status: "RENDERING", currentStep: "正在排版" }
            : current
        );
        await pauseFixture();
        setJob((current) =>
          current ? createFixtureReadyJob(current, optionId) : current
        );
        return;
      }
      const { ok, payload } = await requestVisualOptionConfirmation(
        jobId,
        optionId,
        createClientUuid()
      );
      if (!ok) setError(payload.error?.message ?? "确认主视觉失败");
      else await refreshJob(jobId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  async function replaceVisual() {
    if (!jobId) return;
    setPendingAction("replace");
    try {
      if (fixtureMode) {
        await pauseFixture();
        visualDescriptionRef.current = "";
        visualDraftCreatedAtRef.current = "";
        setVisualDescription("");
        setJob((current) => {
          if (!current?.visualDraft) return current;
          const createdAt = new Date().toISOString();
          const description =
            current.confirmedVisual?.description ??
            current.visualDraft.description;
          return {
            ...current,
            status: "READY_FOR_VISUAL_REVIEW",
            currentStep: "请重新核对视觉描述",
            visualInput: {
              originalIntent: description,
              sourceCopyCreatedAt: current.visualDraft.sourceCopyCreatedAt,
              createdAt
            },
            visualDraft: {
              ...current.visualDraft,
              description,
              provider: "saved-visual-description",
              createdAt
            },
            confirmedVisual: undefined
          };
        });
        setStage(2);
        return;
      }
      const { ok, payload } = await requestVisualReplacement(jobId, createClientUuid());
      if (!ok) setError(payload.error?.message ?? "返回视觉编辑失败");
      else {
        visualDescriptionRef.current = "";
        visualDraftCreatedAtRef.current = "";
        setVisualDescription("");
        setStage(2);
        await refreshJob(jobId);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      actionLockRef.current = false;
      setPendingAction(undefined);
    }
  }

  function startNewPoster() {
    if (working || pendingAction) return;
    refreshEpochRef.current += 1;
    qrUploadEpochRef.current += 1;
    manuallyEditedRef.current = false;
    setDescriptionStale(false);
    const query = new URLSearchParams(window.location.search);
    query.delete("job");
    window.history.replaceState(null, "", window.location.pathname + (query.size ? `?${query}` : ""));
    setJobId(undefined);
    setJob(undefined);
    setCopyReview(undefined);
    visualDescriptionRef.current = "";
    visualDraftCreatedAtRef.current = "";
    setVisualDescription("");
    setQrMode("none");
    setQrUploadPending(false);
    setError(undefined);
    setForm(fixtureMode ? structuredClone(fixtureForm) : newFormState());
    setStage(1);
  }

  return {
    form,
    stage,
    setStage: (next: Stage) => { if (!working && !pendingAction) setStage(next); },
    job,
    copyReview,
    setCopyReview,
    visualDescription,
    descriptionStale,
    qrMode,
    qrUploadPending,
    error,
    restoring,
    pendingAction,
    // A generated suggestion is not applied until the user explicitly
    // replaces both fields. Keep the form and portrait preview in sync.
    previewCopy: stage === 1 ? undefined : createPreviewCopy(job, copyReview),
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
    confirmCopy,
    refineVisual,
    confirmVisual,
    selectVisualOption,
    confirmSelectedVisual,
    replaceVisual,
    startNewPoster
  };
}

function pauseFixture() {
  return new Promise((resolve) => window.setTimeout(resolve, 350));
}
