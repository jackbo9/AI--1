"use client";

/* eslint-disable @next/next/no-img-element -- generated files use an authenticated local route. */
import { useEffect, useState } from "react";
import type { JobHistoryItem, JobHistoryResponse } from "@/contracts/history";

const copy = { copy_review: ["待确认文案", "继续编辑"], visual_review: ["待生成画面", "继续制作"], processing: ["生成中", "查看进度"], completed: ["已完成", "查看与下载"], failed: ["未完成", "修改后继续"] } as const;
const formatTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function JobHistory({ localDemo, onOpen, onNew }: { localDemo: boolean; onOpen: (id: string) => void; onNew: (scene: "01" | "02") => void }) {
  const [items, setItems] = useState<JobHistoryItem[]>([]), [cursor, setCursor] = useState<string>(), [loading, setLoading] = useState(true), [error, setError] = useState<string>();
  async function load(next?: string) {
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(`/api/jobs?limit=12${next ? `&cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as JobHistoryResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "读取历史记录失败");
      setItems(current => next ? [...current, ...payload.items] : payload.items); setCursor(payload.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "读取历史记录失败"); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section className="ead-history-page">
    <header><div><em>我的海报</em><h1>继续之前的制作</h1><p>按最近更新时间排列，修改版本收在同一作品中。</p></div>{localDemo && <span className="ead-history-local">本地演示记录</span>}</header>
    {loading && !items.length && <div className="ead-history-loading" aria-label="正在读取历史记录">{[1,2,3].map(n => <i key={n} />)}</div>}
    {error && !items.length && <div className="ead-history-state"><b>暂时无法读取记录</b><p>{error}</p><button type="button" onClick={() => void load()}>重试</button></div>}
    {!loading && !error && !items.length && <div className="ead-history-state"><b>还没有制作记录</b><p>从一张海报开始，之后可以在这里继续编辑和下载。</p><div><button type="button" onClick={() => onNew("01")}>制作体育赛事海报</button><button type="button" onClick={() => onNew("02")}>制作下午茶海报</button></div></div>}
    {items.length > 0 && <div className="ead-history-grid">{items.map(item => { const [status, action] = copy[item.status]; return <button type="button" className="ead-history-card" key={item.workId} onClick={() => onOpen(item.latestJobId)}><span className="ead-history-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" /> : <i>暂无成品预览</i>}<small className={`is-${item.status}`}>{status}</small></span><span className="ead-history-meta"><small>{item.scene === "employee-afternoon-tea" ? "员工福利 · 下午茶" : "员工活动 · 体育赛事"}</small><b>{item.title}</b>{item.subtitle && <span>{item.subtitle}</span>}<footer><time>{formatTime(item.updatedAt)}</time>{item.versionCount > 1 && <i>{item.versionCount} 个版本</i>}</footer><strong>{action} →</strong></span></button>; })}</div>}
    {items.length > 0 && cursor && <button className="ead-history-more" type="button" disabled={loading} onClick={() => void load(cursor)}>{loading ? "读取中…" : "加载更多"}</button>}
    {items.length > 0 && error && <p className="ead-history-inline-error">{error} <button type="button" onClick={() => void load(cursor)}>重试</button></p>}
  </section>;
}
