"use client";
export function VisualOptionCard({ src, label, title, selected, disabled, onSelect }: { src?: string; label: string; title?: string; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return <button type="button" className={`ead-option-card ${selected ? "is-selected" : ""}`} onClick={onSelect} disabled={disabled} aria-pressed={selected}>
    <span className="ead-option-image">
      {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated images */}
      <img src={src} alt={label} /><b>{selected ? "已选中" : label}</b>
    </span>{title && <strong>{title}</strong>}
  </button>;
}
