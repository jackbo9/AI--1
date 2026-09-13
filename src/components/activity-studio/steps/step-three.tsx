"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, SectionHead } from "../fields";
import type { ActivityJob, FormState } from "../types";

type Props = {
  job?: ActivityJob;
  error?: string;
  form: FormState;
  onField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  visualDescription: string;
  onDescription: (value: string) => void;
  onRefine: () => void;
  onRetry: (batchId: string, directionId: string) => void;
  descriptionStale: boolean;
  onBack: () => void;
  onGenerate: () => void;
  onSelect: (optionId: string) => void;
  onConfirmVisual: () => void;
  pendingRefine: boolean;
  pendingGenerate: boolean;
  pendingSelect: boolean;
  pendingConfirmVisual: boolean;
};

export function StepThree({
  job,
  error,
  form,
  onField,
  visualDescription,
  onDescription,
  onRefine,
  onRetry,
  descriptionStale,
  onGenerate,
  onSelect,
  onConfirmVisual,
  pendingRefine,
  pendingGenerate,
  pendingSelect,
  pendingConfirmVisual
}: Props) {
  const promptId = useId();
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const optionSection = useRef<HTMLDivElement>(null);
  const hasDescription = Boolean(job?.visualDraft && job.visualDraft.provider !== "t01-base-description") || Boolean(job?.confirmedVisual);
  const names = { tennis: "网球", badminton: "羽毛球", basketball: "篮球", football: "足球", volleyball: "排球", table_tennis: "乒乓球", tug_of_war: "拔河", running: "跑步 / 田径", other: "其他体育赛事" };
  const source = [form.activityName, form.slogan, form.subtitle, form.rules].join(" ");
  const inferred = /羽毛球|羽球/.test(source) ? "羽毛球" : /乒乓/.test(source) ? "乒乓球" : /网球/.test(source) ? "网球" : /篮球/.test(source) ? "篮球" : /足球/.test(source) ? "足球" : /排球/.test(source) ? "排球" : /拔河/.test(source) ? "拔河" : /跑步|田径|马拉松/.test(source) ? "跑步 / 田径" : "";
  const sport = form.sportType === "auto" ? inferred : names[form.sportType];
  const options = job?.visualOptions ?? [];
  const selectedOption = options.find(
    (option) => option.id === job?.selectedVisualOptionId
  );
  const isGenerating = job?.status === "GENERATING_ASSET";
  const isRendering =
    job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT";
  const busy = isGenerating || isRendering || job?.status === "REFINING_VISUAL" || pendingRefine || pendingGenerate || pendingConfirmVisual;
  const descriptionReady =
    Boolean(job?.visualDraft) &&
    visualDescription.trim().length >= 10 &&
    !busy && !descriptionStale;

  const showOptions = options.length > 0 || Boolean(job?.visualBatches?.length) || isGenerating || pendingGenerate;
  const showSettings = !hasDescription || editingSettings;
  const showDescription = hasDescription && (!showOptions || editingDescription || descriptionStale);
  useEffect(() => {
    setEditingSettings(false);
  }, [job?.visualDraft?.createdAt]);
  useEffect(() => {
    if (isGenerating || pendingGenerate) {
      setEditingDescription(false);
      optionSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isGenerating, pendingGenerate]);
  return (
    <section className="ead-visual-workbench">
      <div className="ead-visual-block">
        <SectionHead index="02" title="生成主视觉" />
        <div className="ead-visual-context" aria-label="来自第一步的活动信息">
          <span><b>活动主题</b>{form.activityName}</span>
          <span><b>宣言</b>{form.slogan}</span><span><b>副标题</b>{form.subtitle}</span>
          <span><b>赛事类型</b>{sport || "未识别，请选择赛事类型"}</span>
          {(!inferred || form.sportType !== "auto") && <label>赛事类型<select aria-label="赛事类型" value={form.sportType} disabled={busy} onChange={event => onField("sportType", event.target.value as FormState["sportType"])}><option value="auto">请选择</option>{Object.entries(names).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        </div>
        {job?.previousJobId && <p><a href={`?job=${job.previousJobId}`} target="_blank" rel="noreferrer">查看修改文案前的描述与图片</a></p>}
        <div className="ead-phase-heading"><h3>1 设置画面</h3>{hasDescription && <button type="button" className="ead-text-action" disabled={busy} onClick={() => setEditingSettings(!editingSettings)}>{showSettings ? "收起设置" : "修改画面设置"}</button>}</div>
        {!showSettings && <p className="ead-phase-summary">画面设置已保存，可展开修改。</p>}
        {showSettings && <fieldset disabled={busy} className="ead-visual-preferences ead-step-two-preferences">
          <div className="ead-session-heading"><div><small>选择画面方向，AI 将结合活动信息生成描述。</small></div></div>
          <div className="ead-grid ead-direction-grid">
            <label className="ead-select"><span>主题色</span><select aria-label="主题色" value={form.themeColor} onChange={(event) => onField("themeColor", event.target.value as FormState["themeColor"])}><option value="auto">自动</option><option value="blue">蓝色</option><option value="green">绿色</option><option value="red">红色</option><option value="yellow">黄色</option><option value="purple">紫色</option><option value="orange">橙色</option><option value="neutral">黑白中性色</option></select></label>
            <label className="ead-select"><span>人物</span><select aria-label="人物" value={form.peopleMode} onChange={(event) => onField("peopleMode", event.target.value as FormState["peopleMode"])}><option value="auto">自动</option><option value="forbid">不出现人物</option><option value="allow">允许人物局部</option></select></label>
            <label className="ead-select"><span>视觉类型</span><select aria-label="视觉类型" value={form.visualType} onChange={(event) => onField("visualType", event.target.value as FormState["visualType"])}><option value="auto">自动</option><option value="action">动作瞬间</option><option value="equipment">器材特写</option><option value="venue">场地空间</option></select></label>
            <Field className="ead-span-2" label="视觉表现（选填）" value={form.visualTreatment} maxLength={80} hint="如：极低机位、强透视、运动模糊、场地空间" onChange={(value) => onField("visualTreatment", value)} />
          </div>
        </fieldset>}
        {error && <p role="alert" className="ead-error">{error}</p>}
        {descriptionStale && <p className="ead-error" role="status">画面选项已变化，已保留你的文字。请重新生成描述后再生图。</p>}
        {!hasDescription && <button type="button" className="ead-primary" onClick={onRefine} disabled={busy || !sport}>{busy ? "正在生成描述…" : "生成主视觉描述"}</button>}
        {hasDescription && <div className="ead-phase-heading"><h3>2 检查描述</h3>{showOptions && <button type="button" className="ead-text-action" disabled={busy} onClick={() => setEditingDescription(!editingDescription)}>{showDescription ? "收起描述" : "查看或修改描述"}</button>}</div>}
        {hasDescription && !showDescription && <p className="ead-phase-summary">已使用确认描述生成方案。</p>}
        {showDescription && <div className="ead-prompt-editor"><label className="ead-visual-label" htmlFor={promptId}>
          主视觉描述
        </label>
        <textarea
          id={promptId}
          className="ead-visual-prompt"
          rows={10}
          maxLength={420}
          value={visualDescription}
          disabled={busy}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="描述已清空，可自行填写或点击 AI 重新生成描述。"
        />
        <div className="ead-generate-row">
          <button
            type="button"
            className="ead-secondary ead-prompt-refine"
            onClick={onRefine}
            disabled={busy || !sport}
          >
            {pendingRefine || job?.status === "REFINING_VISUAL" ? "正在生成描述…" : "AI 重新生成描述"}
          </button>
        </div>
        </div>}

        <div className="ead-stage-actions ead-description-actions">
          {showDescription && <button
            type="button"
            className="ead-primary"
            onClick={onGenerate}
            disabled={!descriptionReady || pendingGenerate}
          >
            {isGenerating || pendingGenerate
              ? "正在生成方案…"
              : options.length
                ? "重新生成两张主视觉"
                : "生成两张主视觉"}
          </button>}
        </div>
      </div>

      {showOptions && <><div className="ead-visual-divider" />

      <div ref={optionSection} className="ead-visual-block ead-option-section">
        <div className="ead-visual-confirm-head">
          <h3>3 比较图片</h3><p className="ead-phase-summary">选择一张主视觉，自动裁切排版为所有已选尺寸。</p>
        </div>
        {isGenerating && (
          <div className="ead-visual-progress">
            <i />
<span>正在生成主视觉方案</span><GenerationWait />
          </div>
        )}
{job?.visualBatches?.map(batch => <div className="ead-generation-placeholders" key={batch.id}>{batch.directions.map((direction, index) => direction.status === "READY" ? null : <div className="ead-generation-placeholder" key={direction.id} role="status"><b>方案 {index + 1}</b>{direction.status === "FAILED" ? <><p>{direction.error || "生成失败，请重试"}</p><button type="button" disabled={busy} onClick={() => onRetry(batch.id, direction.id)}>重试该方案</button></> : <><span className="ead-loading-dot" /><p>{direction.status === "PENDING" ? "等待生成" : "正在生成图片…"}</p></>}</div>)}</div>)}
        {options.length ? (
          <>
            <div className="ead-option-grid">
              {options.map((option, index) => {
                const selected = option.id === job?.selectedVisualOptionId;
                return (
                  <button
                    type="button"
                    className={`ead-option-card ${selected ? "is-selected" : ""}`}
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    disabled={busy || pendingSelect || option.sourceCopyCreatedAt !== job?.copyDraft?.createdAt}
                    aria-pressed={selected}
                  >
                    <span className="ead-option-image">
                      {/* Candidate files are private authenticated routes, so Next Image cannot prefetch them. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.previewUrl}
                        alt={`主视觉方案 ${index + 1}`}
                      />
                      <b>{selected ? "已选中" : `方案 ${index + 1}`}</b>
                    </span>
                    <strong>{option.sourceDocument.title}</strong>

                  </button>
                );
              })}
            </div>

          </>
        ) : (
          <div className="ead-option-empty">
            确认上方描述并生成后，方案会保留在这里供切换和选择。
          </div>
        )}
        <div className="ead-stage-actions ead-visual-actions">
          <button
            type="button"
            className="ead-primary"
            onClick={onConfirmVisual}
            disabled={
              !selectedOption ||
              busy ||
              pendingSelect ||
              pendingConfirmVisual
            }
          >
            {isRendering || pendingConfirmVisual
              ? "正在排版…"
              : "使用所选方案并排版 →"}
          </button>
        </div>
      </div></>}
    </section>
  );
}
function GenerationWait() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <small>本次页面已等待 {Math.floor(seconds / 60)} 分 {seconds % 60} 秒</small>;
}
