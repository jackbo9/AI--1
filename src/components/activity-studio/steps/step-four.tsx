"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { LoadingCard } from "../fields";
import type { ActivityJob } from "../types";

export function StepFour({ job, onReplace, onRestart, pending, fixtureMode }: { job?: ActivityJob; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  const [viewMode, setViewMode] = useState<"fit" | "zoom">("fit");
  if (!job?.previewUrl) {
    return <LoadingCard title="正在排版导出" detail={job?.currentStep ?? "请稍候…"} />;
  }
  const validation = job.versions.at(-1)?.validation;
  const downloadAllowed =
    fixtureMode || validation?.exportAllowed !== false;
  return (
    <div className="ead-final-stage">
      <section className="ead-final-viewer">
        <header className="ead-final-viewer-head">
          <div>
            <b>最终竖版海报</b>
            <small>1080 × 1920 PNG</small>
          </div>
          <div className="ead-final-view-controls" role="group" aria-label="预览缩放">
            <button
              type="button"
              className={viewMode === "fit" ? "is-selected" : ""}
              onClick={() => setViewMode("fit")}
            >
              适合屏幕
            </button>
            <button
              type="button"
              className={viewMode === "zoom" ? "is-selected" : ""}
              onClick={() => setViewMode("zoom")}
            >
              放大查看
            </button>
          </div>
        </header>
        <div className={`ead-final-canvas is-${viewMode}`}>
          <img src={job.previewUrl} alt="最终生成的 T01 竖版员工活动海报" />
        </div>
      </section>
      <aside className="ead-final-sidebar">
        <StepFourQuality
          job={job}
          onReplace={onReplace}
          onRestart={onRestart}
          pending={pending}
          fixtureMode={fixtureMode}
        />
        <section className="ead-final-download">
          {downloadAllowed ? (
            <a
              href={job.previewUrl}
              download={
                fixtureMode
                  ? "employee-activity-fixture.svg"
                  : "employee-activity-t01.png"
              }
            >
              {fixtureMode
                ? "下载演练稿"
                : validation?.passed
                  ? "下载 PNG"
                  : "下载风险结果"}
            </a>
          ) : (
            <span aria-disabled="true">下载不可用</span>
          )}
          <small>
            页面预览缩放不会改变下载尺寸，文件始终为 1080 × 1920。
          </small>
        </section>
      </aside>
    </div>
  );
}

function StepFourQuality({ job, onReplace, onRestart, pending, fixtureMode }: { job: ActivityJob; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  const validation = job.versions.at(-1)?.validation;
  const checks = [["字体与双 Logo 资产", validation?.checks?.fontAndLogos], ["标题与正文没有溢出", validation?.checks?.capacity], ["图文对比度", validation?.readability?.passed], ["输出尺寸 1080 × 1920", validation?.checks?.outputSize]] as const;
  const trialWarning = validation && !validation.passed && validation.exportAllowed;
  return <section className="ead-section ead-quality"><div className="ead-quality-head"><div><h3>{fixtureMode ? "Fixture 交互验收" : "品牌质量校验"}</h3><p>{fixtureMode ? "三步交互已跑通；未执行真实生成与品牌检查" : trialWarning ? "已生成风险结果：可下载查看，或重新生成主视觉" : validation?.passed ? "全部实际检查通过" : "存在阻断项，暂不可下载"}</p></div><div className={`ead-status-pill ${validation?.passed ? "is-pass" : trialWarning ? "is-warning" : "is-fail"}`}>{fixtureMode ? "演练通过" : validation?.passed ? "通过" : trialWarning ? "警告" : "阻断"}</div></div><div className="ead-check-grid">{checks.map(([label, passed]) => <div className={`ead-check-row ${passed === false ? "is-failed" : ""}`} key={label}><i>{passed === undefined ? "—" : passed ? "✓" : "!"}</i><span>{label}</span><small>{fixtureMode ? "Fixture 模拟" : passed === undefined ? "未记录" : passed ? "通过" : label === "图文对比度" ? "文字与背景对比度待优化" : "未通过"}</small></div>)}</div>{trialWarning && !fixtureMode && <p className="ead-trial-note">当前风险结果保留原始主视觉，不添加遮罩或替换底图。你可以下载查看，或选择“只换主视觉”。</p>}<div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onRestart}>开始新海报</button><button type="button" className="ead-secondary" onClick={onReplace} disabled={pending}>{pending ? "正在返回…" : "只换主视觉"}</button></div></section>;
}
