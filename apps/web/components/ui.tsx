import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm placeholder:text-muted";
export const primaryButton =
  "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90";
export const subtleButton =
  "rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-raised hover:text-text";

export function PageHeader(props: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold">{props.title}</h1>
      {props.subtitle && <p className="mt-1 text-sm text-muted">{props.subtitle}</p>}
    </header>
  );
}

export function Flash(props: { error?: string; message?: string }) {
  if (props.error)
    return (
      <p
        role="alert"
        className="mb-4 rounded-md border border-danger/40 px-3 py-2 text-sm text-danger"
      >
        {props.error}
      </p>
    );
  if (props.message)
    return (
      <p
        role="status"
        className="mb-4 rounded-md border border-success/40 px-3 py-2 text-sm text-success"
      >
        {props.message}
      </p>
    );
  return null;
}

export function Card(props: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${props.className ?? ""}`}>
      {props.title && <h2 className="mb-3 font-medium">{props.title}</h2>}
      {props.children}
    </section>
  );
}

export function Empty(props: { children: ReactNode }) {
  return <p className="text-sm text-muted">{props.children}</p>;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-raised"
    >
      <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
