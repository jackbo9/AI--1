"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { PosterViewport } from "../poster-viewport";
import type { RenderTargetId } from "@/contracts/brand";
import { LoadingCard } from "../fields";
import { LightweightT01Preview } from "../lightweight-t01-preview";
import {
  renderTargetOption,
  renderTargetOptions,
  selectedRenderTarget
} from "../render-target-options";
import type { ActivityJob } from "../types";

type OutputValidation = ActivityJob["versions"][number]["validation"];

type FormatOutput = {
  id: string;
  format: RenderTargetId;
  status: "PENDING" | "RENDERING" | "READY" | "FAILED";
  width: number;
  height?: number;
  visualFamilyId: string;
  previewUrl?: string;
  validation: OutputValidation;
  error?: { message: string };
};

export function StepFour({
  job,
  renderTargets,
  activeRenderTarget,
  onRenderTarget,
  onReplace,
  onRestart,
  pending,
  fixtureMode
}: {
  job?: ActivityJob;
  renderTargets: RenderTargetId[];
  activeRenderTarget: RenderTargetId;
  onRenderTarget: (target: RenderTargetId) => void;
  onReplace: () => void;
  onRestart: () => void;
  pending: boolean;
  fixtureMode: boolean;
}) {
  const [jpgPending, setJpgPending] = useState(false);
  const [jpgError, setJpgError] = useState("");
  const { outputs, family, error, retry } = useFormatOutputs(
    job?.id,
    renderTargets,
    fixtureMode,
    job?.status === "READY_FOR_REVIEW" ? job.previewUrl : undefined
  );

  if (!job?.previewUrl || (!fixtureMode && job.status !== "READY_FOR_REVIEW")) {
    return <LoadingCard title="正在排版导出" detail={job?.currentStep ?? "请稍候…"} />;
  }

  const target = selectedRenderTarget(renderTargets, activeRenderTarget);
  const targetMeta = renderTargetOption(target);
  const currentOutput = [...outputs].reverse().find(
    (output) =>
      output.format === target &&
      (!family || output.visualFamilyId === family)
  );
  const isPortrait = target === "portrait_1080x1920";
  const previewUrl = isPortrait ? job.previewUrl : currentOutput?.previewUrl;
  const validation = isPortrait
    ? job.versions.at(-1)?.validation
    : currentOutput?.validation;
  const selectedVisualOption = job.visualOptions?.find(
    (option) => option.id === job.confirmedVisualOptionId
  );
  const fixtureDocument = selectedVisualOption?.sourceDocument ?? job.copyDraft?.document;
  const fixturePreviewUrl = selectedVisualOption?.previewUrl;
  const showFixtureLayout = Boolean(
    fixtureMode && !isPortrait && fixtureDocument && fixturePreviewUrl
  );
  const ready = Boolean(previewUrl || showFixtureLayout);
  const downloadAllowed =
    ready && !showFixtureLayout && (fixtureMode || validation?.exportAllowed !== false);
  const status = currentOutput?.status;
  async function downloadJpg() {
    if (!previewUrl || jpgPending || !downloadAllowed) return;
    setJpgPending(true);
    setJpgError("");
    try {
      const response = await fetch(previewUrl + (previewUrl.includes("?") ? "&" : "?") + "format=jpg");
      if (!response.ok) throw new Error("JPG 转换失败，请重试或下载 PNG");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `employee-activity-t01-${target}.jpg`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setJpgError(error instanceof Error ? error.message : "下载失败，请重试");
    } finally { setJpgPending(false); }
  }

  return (
    <div className="ead-final-stage">
      <section className="ead-final-viewer">
        <header className="ead-final-viewer-head">
          <div className="ead-final-heading">
            <b>最终{targetMeta.label}海报</b>
            <small>{targetMeta.size} PNG</small>
          </div>
          <div className="ead-final-head-actions">
            <div className="ead-final-size-tabs" role="group" aria-label="切换最终物料尺寸">
              {renderTargetOptions
                .filter(({ id }) => renderTargets.includes(id))
                .map(({ id, label }) => (
                  <button
                    type="button"
                    key={id}
                    className={target === id ? "is-selected" : ""}
                    aria-pressed={target === id}
                    onClick={() => onRenderTarget(id)}
                  >
                    {label}
                  </button>
                ))}
            </div>

          </div>
        </header>
        <PosterViewport key={`${target}:${previewUrl}`} target={target}>
          {previewUrl ? (
            <img src={previewUrl} alt={`最终生成的${targetMeta.label}体育赛事海报`} />
          ) : showFixtureLayout && fixtureDocument && fixturePreviewUrl ? (
            <LightweightT01Preview
              document={fixtureDocument}
              imageUrl={fixturePreviewUrl}
              optionId={`${selectedVisualOption?.id ?? "fixture"}-final`}
              format={target}
            />
          ) : status === "FAILED" ? (
            <div className="ead-final-output-state is-error" role="alert">
              <b>{targetMeta.label}生成失败</b>
              <p>{currentOutput?.error?.message ?? "该尺寸暂未生成成功，其他已完成尺寸仍可使用。"}</p>
            </div>
          ) : (
            <div className="ead-final-output-state" role="status">
              <span className="ead-loading-dot" />
              <b>{targetMeta.label}正在排版和检查</b>
              <p>完成后会自动显示，请稍候。</p>
            </div>
          )}
        </PosterViewport>
      </section>
      <aside className="ead-final-sidebar">
        {status === "FAILED" && <button type="button" className="ead-secondary" onClick={() => retry(target)}>重试当前尺寸</button>}
        {error && (
          <p className="ead-final-format-error" role="alert">
            {error}

          </p>
        )}
        <StepFourQuality
          validation={validation}
          target={target}
          outputPending={!ready && status !== "FAILED"}
          onReplace={onReplace}
          onRestart={onRestart}
          pending={pending}
          fixtureMode={fixtureMode}
        />
        <section className="ead-final-download">
          {downloadAllowed && previewUrl ? (
            <a
              href={previewUrl}
              download={
                fixtureMode
                  ? "employee-activity-fixture.svg"
                  : `employee-activity-t01-${target}.png`
              }
            >
              {validation?.passed
                  ? "下载 PNG"
                  : "下载待确认结果"}
            </a>
          ) : (
            <span aria-disabled="true">
              {showFixtureLayout ? "当前尺寸正在准备" : "等待该尺寸完成"}
            </span>
          )}
          {!fixtureMode && downloadAllowed && <button type="button" className="ead-secondary" onClick={downloadJpg} disabled={jpgPending}>{jpgPending ? "正在准备 JPG…" : "下载 JPG"}</button>}
          {jpgError && <p role="alert" className="ead-error">{jpgError}</p>}
          <small>
            页面缩放不改变下载文件，当前尺寸始终为 {targetMeta.size}。
          </small>
        </section>
      </aside>
    </div>
  );
}

function useFormatOutputs(
  jobId: string | undefined,
  renderTargets: RenderTargetId[],
  fixtureMode: boolean,
  sourceKey: string | undefined
) {
  const [outputs, setOutputs] = useState<FormatOutput[]>([]);
  const [outputSource, setOutputSource] = useState<string>();
  const [family, setFamily] = useState<string>();
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const requestedFormats = useRef(new Set<string>());
  const targetKey = renderTargets.join(",");
  const expectedExtras = useMemo(
    () => renderTargets.filter((target) => target !== "portrait_1080x1920"),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetKey captures array contents.
    [targetKey]
  );

  useEffect(() => {
    if (!jobId || !sourceKey || fixtureMode || expectedExtras.length === 0) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh() {
      try {
        // Requesting an already-current format is idempotent. Doing so once
        // when the result screen opens also upgrades an existing job when a
        // template version changes, rather than continuing to show a cached
        // Artifact produced by an older template.
        await Promise.all(expectedExtras.map(async (format) => {
          const requestKey = `${jobId}:${sourceKey}:${format}`;
          if (requestedFormats.current.has(requestKey)) return;
          const response = await fetch(`/api/jobs/${jobId}/formats`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ format }),
            signal: controller.signal
          });
          if (!response.ok) {
            const data = await readJson<{ error?: { message?: string } }>(response);
            throw new Error(data.error?.message ?? "请求尺寸生成失败");
          }
          if (!disposed) requestedFormats.current.add(requestKey);
        }));
        const response = await fetch(`/api/jobs/${jobId}/formats`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await readJson<{
          outputs: FormatOutput[];
          currentVisualFamilyId?: string;
          error?: { message?: string };
        }>(response);
        if (!response.ok) throw new Error(data.error?.message ?? "读取尺寸失败");
        if (disposed) return;
        setOutputSource(sourceKey);
        setOutputs(data.outputs);
        setFamily(data.currentVisualFamilyId);
        setError("");
        const currentOutputs = data.outputs.filter(
          (output) => !data.currentVisualFamilyId || output.visualFamilyId === data.currentVisualFamilyId
        );
        const waiting = expectedExtras.some((target) => {
          const output = [...currentOutputs].reverse().find((item) => item.format === target);
          return !output || output.status === "PENDING" || output.status === "RENDERING";
        });
        if (waiting) timer = setTimeout(refresh, 1500);
      } catch (reason) {
        if (!disposed && !(reason instanceof DOMException && reason.name === "AbortError")) {
          setError("尺寸状态暂时未能读取，正在自动重试…");
          timer = setTimeout(refresh, 3000);
        }
      }
    }

    void refresh();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [expectedExtras, fixtureMode, jobId, reloadKey, sourceKey]);

  return {
    outputs: outputSource === sourceKey ? outputs : [],
    family: outputSource === sourceKey ? family : undefined,
    error: sourceKey ? error : "",
    retry: (format: RenderTargetId) => {
      requestedFormats.current.delete(`${jobId}:${sourceKey}:${format}`);
      setOutputs(items => items.map(item => item.format === format ? { ...item, status: "RENDERING" } : item));
      setReloadKey(value => value + 1);
    }
  };
}

function StepFourQuality({
  validation,
  target,
  outputPending,
  onReplace,
  onRestart,
  pending,
  fixtureMode
}: {
  validation?: OutputValidation;
  target: RenderTargetId;
  outputPending: boolean;
  onReplace: () => void;
  onRestart: () => void;
  pending: boolean;
  fixtureMode: boolean;
}) {
  const meta = renderTargetOption(target);
  const checks = [
    ["字体与双 Logo 资产", validation?.checks?.fontAndLogos],
    ["标题与正文没有溢出", validation?.checks?.capacity],
    ["图文对比度", validation?.readability?.passed],
    [`输出尺寸 ${meta.size}`, validation?.checks?.outputSize]
  ] as const;
  const trialWarning = validation && !validation.passed && validation.exportAllowed;
  const statusLabel = outputPending
    ? "生成中"
    : fixtureMode
      ? "已完成"
      : validation?.passed
        ? "通过"
        : trialWarning
          ? "警告"
          : "阻断";
  return <section className="ead-section ead-quality"><div className="ead-quality-head"><div><h3>{fixtureMode ? "海报检查" : `${meta.label}品牌质量校验`}</h3><p>{outputPending ? "该尺寸正在完成排版和输出检查" : fixtureMode ? "当前结果已准备好供查看" : trialWarning ? "当前结果需要确认：可下载查看，或重新选择主视觉" : validation?.passed ? "该尺寸全部检查通过" : "该尺寸存在阻断项，暂不可下载"}</p></div><div className={`ead-status-pill ${validation?.passed ? "is-pass" : trialWarning ? "is-warning" : "is-fail"}`}>{statusLabel}</div></div><div className="ead-check-grid">{checks.map(([label, passed]) => <div className={`ead-check-row ${passed === false ? "is-failed" : ""}`} key={label}><i>{passed === undefined ? "—" : passed ? "✓" : "!"}</i><span>{label}</span><small>{passed === undefined ? "未记录" : passed ? "通过" : label === "图文对比度" ? "文字与背景对比度待优化" : "未通过"}</small></div>)}</div>{trialWarning && !fixtureMode && <p className="ead-trial-note">当前结果保留原始主视觉。你可以下载查看，或选择“只换主视觉”。</p>}<div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onRestart}>开始新海报</button><button type="button" className="ead-secondary" onClick={onReplace} disabled={pending}>{pending ? "正在返回…" : "只换主视觉"}</button></div></section>;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error("服务返回空响应，请稍后重试");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("服务返回了无法解析的响应，请刷新后重试");
  }
}
