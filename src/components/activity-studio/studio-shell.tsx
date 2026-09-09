"use client";

/* eslint-disable @next/next/no-img-element -- local brand assets are intentional. */
import type { ReactNode } from "react";
import { scenes, stages } from "./activity-studio-model";
import type { Stage, StudioIdentity } from "./types";

export function StudioShell({
  identity,
  stage,
  onStage,
  children,
  preview
}: {
  identity: StudioIdentity;
  stage: Stage;
  onStage: (stage: Stage) => void;
  children: ReactNode;
  preview: ReactNode;
}) {
  return <div id="employee-activity-demo" lang="zh-CN"><div className="ead-window">
    <header className="ead-topbar"><div className="ead-brand"><img className="ead-brandmark" src="/brand/administration-mark.svg" alt="" /><div><strong>AI 行政设计助手</strong><small>员工活动海报</small></div></div><nav className="ead-progress" aria-label="生成流程">{stages.map(([number, label]) => <button type="button" key={number} className={number === stage ? "is-current" : number < stage ? "is-done" : ""} onClick={() => number <= stage && onStage(number)} disabled={number > stage}><i>{number}</i>{label}</button>)}</nav></header>
    <div className={`ead-body ${stage === 3 ? "is-result" : ""}`}><aside className="ead-sidebar"><h2>选择业务场景</h2><div className="ead-scene-list">{scenes.map(([number, title, description]) => <button type="button" className={`ead-scene ${number === "01" ? "is-active" : ""}`} key={number} disabled={number !== "01"}><span className="ead-scene-number">{number}</span><span><b>{title}</b><small>{description}</small></span></button>)}</div><div className="ead-side-footer"><div className="ead-profile"><span className="ead-avatar">九</span><span><b>{identity.displayName}</b><small>九号公司 · {identity.provider === "feishu" ? "飞书账号" : "体验账号"}</small></span></div></div></aside>
      <main className="ead-workspace">{children}</main>
      {stage < 3 ? preview : null}
    </div>
  </div></div>;
}
