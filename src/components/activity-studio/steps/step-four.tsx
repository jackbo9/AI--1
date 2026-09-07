"use client";

import { T01OutputGallery } from "@/components/t01-output-gallery";
import { LoadingCard } from "../fields";
import type { ActivityJob } from "../types";

export function StepFour({ job, onReplace, onRestart, pending, fixtureMode }: { job?: ActivityJob; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  return <><StepFourQuality job={job} onReplace={onReplace} onRestart={onRestart} pending={pending} fixtureMode={fixtureMode} />{!fixtureMode && job?.id && job.previewUrl && <T01OutputGallery key={job.id} jobId={job.id} />}</>;
}

function StepFourQuality({ job, onReplace, onRestart, pending, fixtureMode }: { job?: ActivityJob; onReplace: () => void; onRestart: () => void; pending: boolean; fixtureMode: boolean }) {
  if (!job?.previewUrl) return <LoadingCard title="正在排版导出" detail={job?.currentStep ?? "请稍候…"} />;
  const validation = job.versions.at(-1)?.validation;
  const checks = [["字体与双 Logo 资产", validation?.checks?.fontAndLogos], ["标题与正文没有溢出", validation?.checks?.capacity], ["图文对比度", validation?.readability?.passed], ["输出尺寸 1080 × 1920", validation?.checks?.outputSize]] as const;
  const trialWarning = validation && !validation.passed && validation.exportAllowed;
  return <section className="ead-section ead-quality"><div className="ead-quality-head"><div><h3>{fixtureMode ? "Fixture 交互验收" : "品牌质量校验"}</h3><p>{fixtureMode ? "四步交互已跑通；未执行真实生成与品牌检查" : trialWarning ? "基础检查通过，可下载试用稿" : validation?.passed ? "全部实际检查通过" : "存在阻断项，暂不可下载"}</p></div><div className={`ead-status-pill ${validation?.passed ? "is-pass" : trialWarning ? "is-warning" : "is-fail"}`}>{fixtureMode ? "演练通过" : validation?.passed ? "通过" : trialWarning ? "警告" : "阻断"}</div></div><div className="ead-check-grid">{checks.map(([label, passed]) => <div className={`ead-check-row ${passed === false ? "is-failed" : ""}`} key={label}><i>{passed === undefined ? "—" : passed ? "✓" : "!"}</i><span>{label}</span><small>{fixtureMode ? "Fixture 模拟" : passed === undefined ? "未记录" : passed ? "通过" : label === "图文对比度" ? "文字与背景对比度待优化" : "未通过"}</small></div>)}</div>{trialWarning && !fixtureMode && <p className="ead-trial-note">当前使用试用策略：保留已生成背景，不替换为默认底图，也不添加背景遮罩；真实可读性警告不改写为通过。可下载试用稿。</p>}<div className="ead-stage-actions"><button type="button" className="ead-secondary" onClick={onRestart}>开始新海报</button><button type="button" className="ead-secondary" onClick={onReplace} disabled={pending}>{pending ? "正在返回…" : "只换主视觉"}</button></div></section>;
}
