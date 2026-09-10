"use client";

import { useId } from "react";
import { Field, SectionHead } from "../fields";
import type { ActivityJob, FormState } from "../types";

type Props = {
  job?: ActivityJob;
  form: FormState;
  onField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  visualDescription: string;
  onDescription: (value: string) => void;
  onRefine: () => void;
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
  form,
  onField,
  visualDescription,
  onDescription,
  onRefine,
  onBack,
  onGenerate,
  onSelect,
  onConfirmVisual,
  pendingRefine,
  pendingGenerate,
  pendingSelect,
  pendingConfirmVisual
}: Props) {
  const promptId = useId();
  const options = job?.visualOptions ?? [];
  const selectedOption = options.find(
    (option) => option.id === job?.selectedVisualOptionId
  );
  const isGenerating = job?.status === "GENERATING_ASSET";
  const isRendering =
    job?.status === "RENDERING" || job?.status === "VALIDATING_OUTPUT";
  const descriptionReady =
    Boolean(job?.visualDraft) &&
    visualDescription.trim().length >= 10 &&
    !isGenerating &&
    !isRendering;

  return (
    <section className="ead-visual-workbench">
      <div className="ead-visual-block">
        <SectionHead index="02" title="确认描述并生成方案" />
        <div className="ead-visual-context" aria-label="来自第一步的活动信息">
          <span><b>活动主题</b>{form.activityName}</span>
          <span><b>赛事类型</b>{form.sportType === "auto" ? "根据第一步内容自动识别" : form.sportType === "table_tennis" ? "乒乓球" : form.sportType === "tug_of_war" ? "拔河" : form.sportType === "running" ? "跑步 / 田径" : ({ tennis: "网球", badminton: "羽毛球", basketball: "篮球", football: "足球", volleyball: "排球", other: "其他体育赛事" }[form.sportType])}</span>
        </div>
        <div className="ead-visual-preferences ead-step-two-preferences">
          <div className="ead-session-heading"><div><b>调整画面方向</b><small>这些选择会用于重新生成下方的主视觉描述。</small></div></div>
          <div className="ead-grid">
            <label className="ead-select"><span>主题色</span><select value={form.themeColor} onChange={(event) => onField("themeColor", event.target.value as FormState["themeColor"])}><option value="auto">自动</option><option value="blue">蓝色</option><option value="green">绿色</option><option value="red">红色</option><option value="yellow">黄色</option><option value="purple">紫色</option><option value="orange">橙色</option><option value="neutral">黑白中性色</option></select></label>
            <label className="ead-select"><span>人物</span><select value={form.peopleMode} onChange={(event) => onField("peopleMode", event.target.value as FormState["peopleMode"])}><option value="auto">自动</option><option value="forbid">不出现人物</option><option value="allow">允许人物局部</option></select></label>
            <label className="ead-select ead-span-2"><span>视觉类型</span><select value={form.visualType} onChange={(event) => onField("visualType", event.target.value as FormState["visualType"])}><option value="auto">自动</option><option value="action">动作瞬间</option><option value="equipment">器材特写</option><option value="venue">场地空间</option></select></label>
            <Field className="ead-span-2" label="视觉表现（选填）" value={form.visualTreatment} maxLength={80} hint="如：极低机位、强透视、运动模糊、场地空间" onChange={(value) => onField("visualTreatment", value)} />
          </div>
        </div>
        <label className="ead-visual-label" htmlFor={promptId}>
          主视觉生成描述
        </label>
        <textarea
          id={promptId}
          className="ead-visual-prompt"
          rows={10}
          maxLength={420}
          value={visualDescription}
          disabled={isGenerating || isRendering}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="基础描述加载中；可先调整上方变量，再重新生成描述。"
        />
        <div className="ead-generate-row">
          <button
            type="button"
            className="ead-secondary"
            onClick={onRefine}
            disabled={!descriptionReady || pendingRefine}
          >
            {pendingRefine ? "正在生成描述…" : "重新生成描述"}
          </button>
        </div>
        <div className="ead-stage-actions ead-description-actions">
          <button
            type="button"
            className="ead-secondary"
            onClick={onBack}
            disabled={isGenerating || isRendering}
          >
            返回文案
          </button>
          <button
            type="button"
            className="ead-primary"
            onClick={onGenerate}
            disabled={!descriptionReady || pendingGenerate}
          >
            {isGenerating || pendingGenerate
              ? "正在生成方案…"
              : options.length
                ? "确认描述并生成新方案"
                : "确认描述并生成方案"}
          </button>
        </div>
      </div>

      <div className="ead-visual-divider" />

      <div className="ead-visual-block ead-option-section">
        <div className="ead-visual-confirm-head">
          <h3>选择并确认主视觉</h3>
        </div>
        {isGenerating && (
          <div className="ead-visual-progress">
            <i />
            <span>{job?.currentStep ?? "正在生成主视觉方案"}</span>
          </div>
        )}
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
                    disabled={isGenerating || isRendering || pendingSelect}
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
                    <small>{option.description}</small>
                  </button>
                );
              })}
            </div>
            {selectedOption && (
              <div className="ead-selected-option">
                <b>当前选择</b>
                <span>{selectedOption.sourceDocument.title}</span>
                <p>{selectedOption.description}</p>
              </div>
            )}
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
              isGenerating ||
              isRendering ||
              pendingConfirmVisual
            }
          >
            {isRendering || pendingConfirmVisual
              ? "正在排版…"
              : "确认主视觉并进入排版 →"}
          </button>
        </div>
      </div>
    </section>
  );
}
