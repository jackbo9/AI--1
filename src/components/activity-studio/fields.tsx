"use client";

import { useId } from "react";
import { textCharacterCount } from "@/contracts/poster";

export function SectionHead({
  index,
  title,
  hint
}: {
  index: string;
  title: string;
  hint?: string;
}) {
  return <div className="ead-section-head"><div><span className="ead-index">{index}</span><h3>{title}</h3></div>{hint && <small>{hint}</small>}</div>;
}

export function Field({
  className = "",
  label,
  value,
  onChange,
  required = false,
  type = "text",
  maxLength,
  hint,
  multiline = false
}: {
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
  hint?: string;
  multiline?: boolean;
}) {
  const id = useId();
  const control = multiline
    ? <textarea id={id} rows={2} value={value} required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    : <input id={id} type={type} value={value} required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />;
  return <div className={`ead-field ${className}`}><label htmlFor={id}>{label} {required && <i>必填</i>}</label>{control}{(hint || maxLength) && <small className="ead-field-hint">{hint}{hint && maxLength ? " · " : ""}{maxLength ? `${textCharacterCount(value)} / ${maxLength}` : ""}</small>}</div>;
}

export function TextField({
  className = "",
  label,
  value,
  onChange,
  placeholder = "",
  maxLength
}: {
  className?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return <div className={`ead-field ${className}`}><label htmlFor={id}>{label}</label><textarea id={id} rows={3} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />{maxLength && <small className="ead-field-hint">{textCharacterCount(value)} / {maxLength}</small>}</div>;
}

export function LoadingCard({ title, detail }: { title: string; detail: string }) {
  return <section className="ead-section ead-loading"><span className="ead-loading-dot" /><h3>{title}</h3><p>{detail}</p></section>;
}
