"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  createFixtureBaseVisualJob,
  createFixtureBaseVisualJobFromCopy,
  createFixtureCopyJob,
  createFixtureReadyJob,
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
  requestVisualRefinement,
  requestVisualReplacement
} from "./activity-studio-api";
import {
  createCopyReview,
  createPreviewCopy,
  getStageForJob,
  getStatusLabel,
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

const T01_DRAFT_STORAGE_KEY = "activity-studio-t01-copy-draft-v1";

export function useActivityStudioController(fixtureMode: boolean) {
  const [form, setForm] = useState<FormState>(initialForm);
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
  const working = isJobWorking(job);

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
    if (!storedJobId) {
      const storedDraft = window.localStorage.getItem(T01_DRAFT_STORAGE_KEY);
      if (storedDraft) {
        try {
          const restored = JSON.parse(storedDraft) as Partial<FormState>;
          const renderTargets = restored.renderTargets?.length
            ? restored.renderTargets
            : initialForm.renderTargets;
          setForm({
            ...initialForm,
            ...restored,
            renderTargets,
            activeRenderTarget: renderTargets.includes(restored.activeRenderTarget ?? initialForm.activeRenderTarget)
              ? (restored.activeRenderTarget ?? initialForm.activeRenderTarget)
              : renderTargets[0]!
          });
        } catch { window.localStorage.removeItem(T01_DRAFT_STORAGE_KEY); }
      }
      return;
    }
    setRestoring(true);
    setJobId(storedJobId);
    void refreshJob(storedJobId).then((loaded) => {
      if (loaded) hydrateJob(loaded);
      setRestoring(false);
    });
  }, [fixtureMode]);

  useEffect(() => {
    window.localStorage.setItem(T01_DRAFT_STORAGE_KEY, JSON.stringify(form));
  }, [form]);

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
      visualDescriptionRef.current = job.visualDraft.description;
      setVisualDescription(job.visualDraft.description);
    }
  }, [job]);

  async function refreshJob(id: string) {
    if (refreshingRef.current) return undefined;
    refreshingRef.current = true;
    try {
      const result = await fetchActivityJob(id);
      if (!result.ok) {
        const payload = result.payload as { error?: { message?: string } };
        setError(payload.error?.message ?? "任务状态读取失败，请刷新重试");
        return undefined;
      }
      const loaded = result.payload as ActivityJob;
      setJob(loaded);
      return loaded;
    } catch {
      setError("本地预览连接中断，请确认开发服务仍在运行后重试");
      return undefined;
    } finally {
      refreshingRef.current = false;
    }
  }

  function hydrateJob(loaded: ActivityJob) {
    setForm((current) => hydrateForm(current, loaded));
    if (loaded.confirmedVisual) {
      visualDraftCreatedAtRef.current = loaded.confirmedVisual.sourceDraftCreatedAt;
      visualDescriptionRef.current = loaded.confirmedVisual.description;
      setVisualDescription(loaded.confirmedVisual.description);
    } else if (loaded.visualDraft) {
      visualDraftCreatedAtRef.current = loaded.visualDraft.createdAt;
      visualDescriptionRef.current = loaded.visualDraft.description;
      setVisualDescription(loaded.visualDraft.description);
    } else if (loaded.visualInput) {
      visualDescriptionRef.current = loaded.visualInput.originalIntent;
      setVisualDescription(loaded.visualInput.originalIntent);
    }
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
    setError(undefined);
    setQrUploadPending(true);
    try {
      const { ok, payload } = await requestQrUpload(file);
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
      setQrUploadPending(false);
    }
  }

  function changeVisualDescription(value: string) {
    visualDescriptionRef.current = value;
    setVisualDescription(value);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const validationError = validateForm(form);
    if (validationError) return setError(validationError);
    setPendingAction("submit");
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
      const { ok, payload } = await requestJobCreation(normalizeForm(form), createClientUuid(), true, form.renderTargets);
      if (!ok || !payload.jobId) return setError(payload.error?.message ?? "提交需求失败");
      setJobId(payload.jobId);
      window.history.replaceState(null, "", `?job=${payload.jobId}`);
      setJob({ id: payload.jobId, status: "READY_FOR_VISUAL_REVIEW", currentStep: "基础视觉描述已准备，等待确认", versions: [] });
      await refreshJob(payload.jobId);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function assistTitles() {
    if (job?.status === "READY_FOR_COPY_REVIEW" && job.copyDraft) {
      setForm((current) => ({
        ...current,
        slogan: job.copyDraft!.document.slogan,
        subtitle: job.copyDraft!.document.subtitle
      }));
      setCopyReview(undefined);
      setJob(undefined);
      setJobId(undefined);
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    const validationError = validateForm(form, false);
    if (validationError) return setError(validationError);
    setError(undefined);
    setPendingAction("submit");
    setCopyReview(undefined);
    try {
      if (fixtureMode) {
        setJobId(UI_FIXTURE_JOB_ID);
        window.history.replaceState(null, "", `?fixture=1&job=${UI_FIXTURE_JOB_ID}`);
        setJob({ id: UI_FIXTURE_JOB_ID, status: "GENERATING_COPY", currentStep: "Fixture 正在生成小标题", versions: [] });
        await pauseFixture();
        setJob(createFixtureCopyJob(normalizeForm({ ...form, slogan: "", subtitle: "" })));
        return;
      }
      const { ok, payload } = await requestJobCreation(
        normalizeForm({ ...form, slogan: "", subtitle: "" }),
        createClientUuid(), false, form.renderTargets
      );
      if (!ok || !payload.jobId) return setError(payload.error?.message ?? "AI 辅助生成失败");
      setJobId(payload.jobId);
      window.history.replaceState(null, "", `?job=${payload.jobId}`);
      setJob({ id: payload.jobId, status: "QUEUED", currentStep: "正在生成两个小标题", versions: [] });
    } finally {
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
    } finally {
      setPendingAction(undefined);
    }
  }

  async function refineVisual() {
    if (job?.status === "REFINING_VISUAL") return;
    if (!jobId || visualDescription.trim().length < 10) return setError("请至少保留 10 个字的视觉描述");
    if (visualDescription.trim().length > 420) return setError("视觉描述最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    setPendingAction("refine");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "REFINING_VISUAL", currentStep: "Fixture 正在优化画面描述" } : current);
        await pauseFixture();
        setJob((current) => current ? createFixtureVisualDraftJob(current, visualDescription.trim()) : current);
        return;
      }
      const { ok, payload } = await requestVisualRefinement(jobId, visualDescription.trim(), createClientUuid());
      if (!ok) setError(payload.error?.message ?? "优化画面描述失败");
      else await refreshJob(jobId);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function confirmVisual() {
    if (!jobId || !job?.visualDraft || visualDescription.trim().length < 10) return setError("请先核对并确认视觉描述");
    if (visualDescription.trim().length > 420) return setError("画面描述最多 420 字，请保留创意并精简后重试");
    setError(undefined);
    setPendingAction("visual");
    try {
      if (fixtureMode) {
        setJob((current) => current ? { ...current, status: "GENERATING_ASSET", currentStep: "Fixture 正在生成主视觉" } : current);
        await pauseFixture();
        setJob((current) => current ? { ...current, status: "RENDERING", currentStep: "Fixture 正在排版" } : current);
        await pauseFixture();
        setJob((current) => current?.visualDraft ? createFixtureReadyJob({
          ...current,
          confirmedVisual: {
            description: visualDescription.trim(),
            sourceDraftCreatedAt: current.visualDraft.createdAt,
            sourceCopyCreatedAt: current.visualDraft.sourceCopyCreatedAt,
            createdAt: new Date().toISOString()
          }
        }) : current);
        return;
      }
      const { ok, payload } = await requestVisualConfirmation(jobId, job.visualDraft.createdAt, visualDescription.trim(), createClientUuid());
      if (!ok) setError(payload.error?.message ?? "确认视觉描述失败");
      else await refreshJob(jobId);
    } finally {
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
        setStage(3);
        return;
      }
      const { ok, payload } = await requestVisualReplacement(jobId, createClientUuid());
      if (!ok) setError(payload.error?.message ?? "返回视觉编辑失败");
      else {
        visualDescriptionRef.current = "";
        visualDraftCreatedAtRef.current = "";
        setVisualDescription("");
        setStage(3);
        await refreshJob(jobId);
      }
    } finally {
      setPendingAction(undefined);
    }
  }

  function startNewPoster() {
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
    setForm(newFormState());
    setStage(1);
  }

  return {
    form,
    stage,
    setStage,
    job,
    copyReview,
    setCopyReview,
    visualDescription,
    qrMode,
    qrUploadPending,
    error,
    restoring,
    pendingAction,
    // A generated suggestion is not applied until the user explicitly
    // replaces both fields. Keep the form and portrait preview in sync.
    previewCopy: stage === 1 ? undefined : createPreviewCopy(job, copyReview),
    statusLabel: getStatusLabel(job),
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
    confirmCopy,
    refineVisual,
    confirmVisual,
    replaceVisual,
    startNewPoster
  };
}

function pauseFixture() {
  return new Promise((resolve) => window.setTimeout(resolve, 350));
}
