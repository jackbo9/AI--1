"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function PosterViewport({ children, target }: { children: ReactNode; target: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = viewport.current, surface = layer.current;
    if (!node || !surface) return;
    let scale = 1, x = 0, y = 0;
    let drag: { id: number; x: number; y: number } | undefined;
    const paint = () => {
      surface.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      node.dataset.zoom = String(scale);
    };
    const reset = () => { scale = 1; x = y = 0; paint(); };
    const zoom = (factor: number, px: number, py: number) => {
      const next = Math.max(0.25, Math.min(8, scale * factor));
      x = px - (px - x) * next / scale;
      y = py - (py - y) * next / scale;
      scale = next; paint();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1);
      zoom(Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002), event.clientX - rect.left, event.clientY - rect.top);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      node.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      node.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      x += event.clientX - drag.x; y += event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY; paint();
    };
    const up = () => { drag = undefined; };
    const key = (event: KeyboardEvent) => {
      if (["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      if (event.key === "0") reset();
      if (event.key === "+" || event.key === "=") zoom(1.15, node.clientWidth / 2, node.clientHeight / 2);
      if (event.key === "-") zoom(1 / 1.15, node.clientWidth / 2, node.clientHeight / 2);
      if (event.key.startsWith("Arrow")) {
        x += event.key === "ArrowLeft" ? 30 : event.key === "ArrowRight" ? -30 : 0;
        y += event.key === "ArrowUp" ? 30 : event.key === "ArrowDown" ? -30 : 0;
        paint();
      }
    };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("dblclick", reset);
    node.addEventListener("keydown", key);
    const observer = new ResizeObserver(reset);
    observer.observe(node);
    paint();
    return () => {
      observer.disconnect();
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("dblclick", reset);
      node.removeEventListener("keydown", key);
    };
  }, []);
  return <div ref={viewport} className={`ead-final-canvas ead-continuous-canvas is-${target}`} tabIndex={0} role="region" aria-label="海报缩放预览：滚轮缩放，拖动移动，双击或按 0 复位，加减键缩放">
    <div ref={layer} className="ead-zoom-layer">{children}</div>
    <small className="ead-canvas-hint">滚轮或触控板缩放 · 拖动查看 · 双击复位</small>
  </div>;
}
