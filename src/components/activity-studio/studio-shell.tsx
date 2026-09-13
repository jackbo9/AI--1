"use client";

/* eslint-disable @next/next/no-img-element -- local brand assets are intentional. */
import { Fragment, type ReactNode, useState } from "react";
import { scenes, stages } from "./activity-studio-model";
import type { Stage, StudioIdentity } from "./types";

const activitySubscenes = ["节日", "安全", "差旅", "体育赛事", "员工俱乐部"] as const;
const sceneTone: Record<string, string> = {
  "01": "activity",
  "02": "welfare",
  "03": "notice",
  "04": "survey"
};

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
  const [selectedScene, setSelectedScene] = useState("01");
  const activeScene = scenes.find(([number]) => number === selectedScene) ?? scenes[0];
  const activitySelected = selectedScene === "01";

  return <div className="ead-theme-b"><div id="employee-activity-demo" data-text-size="large" lang="zh-CN"><div className="ead-window">
    <header className="ead-topbar" data-review-id="E01">
      <div className="ead-brand"><img className="ead-brandmark" src="/brand/administration-mark.svg" alt="" /><div><strong>行政智绘引擎</strong><small>员工活动海报生成</small></div></div>
      <nav className={`ead-progress ${activitySelected ? "" : "is-unavailable"}`} aria-label="生成流程" aria-hidden={!activitySelected}>{stages.map(([number, label]) => <button type="button" key={number} className={number === stage ? "is-current" : number < stage ? "is-done" : ""} onClick={() => number <= stage && onStage(number)} disabled={!activitySelected || number > stage}><i>{number}</i>{label}</button>)}</nav>
    </header>
    <div className={`ead-body ${stage === 3 ? "is-result" : ""}`}>
      <aside className="ead-sidebar" data-review-id="E02">
        <h2>选择业务场景</h2>
        <div className="ead-scene-list">{scenes.map(([number, title, description]) => <Fragment key={number}>
          <button type="button" className={`ead-scene is-${sceneTone[number]} ${number === selectedScene ? "is-active" : ""}`} onClick={() => setSelectedScene(number)}><span className="ead-scene-number">{number}</span><span><b>{title}</b><small>{description}</small></span></button>
          {number === "01" && selectedScene === "01" && <div className="ead-subscene-list" aria-label="员工活动子场景">{activitySubscenes.map((label) => <button type="button" key={label} className={label === "体育赛事" ? "is-active" : ""} disabled={label !== "体育赛事"}>{label}{label !== "体育赛事" && <small>待开发</small>}</button>)}</div>}
        </Fragment>)}</div>
        <div className="ead-side-footer" data-review-id="E03"><div className="ead-profile"><span className="ead-avatar">九</span><span><b>{identity.displayName}</b><small>九号公司 · {identity.provider === "feishu" ? "飞书账号" : "本地演示"}</small></span></div></div>
      </aside>
      <main className="ead-workspace">{activitySelected ? children : <section className="ead-coming-soon"><em className={`is-${sceneTone[selectedScene]}`}>{activeScene[1]}</em><h1>{activeScene[1]}</h1><p>{activeScene[2]}</p><div><span>待开发</span><b>该业务场景正在设计中</b><small>当前可使用“员工活动 › 体育赛事”完成海报生成。</small></div></section>}</main>
      {activitySelected && stage < 3 ? preview : !activitySelected ? <aside className="ead-preview ead-coming-preview"><div><span>待开发</span><p>该场景的模板预览将在功能开放后显示。</p></div></aside> : null}
    </div>
  </div></div></div>;
}
