"use client";

import { useId } from "react";
import { SectionHead } from "../fields";
import type { ActivityJob } from "../types";

type Props = {
  job?: ActivityJob;
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
          placeholder="基础描述加载中，可直接编辑赛事类型、主题色和视觉表现。"
        />
        <div className="ead-generate-row">
          <button
            type="button"
            className="ead-secondary"
            onClick={onRefine}
            disabled={!descriptionReady || pendingRefine}
          >
            {pendingRefine ? "正在优化…" : "AI 优化"}
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
