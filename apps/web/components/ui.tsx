import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-border bg-bg/80 px-3 py-2 text-sm placeholder:text-muted";
export const primaryButton = "btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white";
export const subtleButton =
  "rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:border-[#3a4152] hover:bg-raised hover:text-text";

export function PageHeader(props: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7">
      <h1 className="text-[1.7rem] font-semibold leading-tight tracking-tight">{props.title}</h1>
      <div
        className="mt-2 h-0.5 w-10 rounded-full"
        style={{ background: "var(--brand-gradient)" }}
      />
      {props.subtitle && <p className="mt-2 text-sm text-muted">{props.subtitle}</p>}
    </header>
  );
}

export function Flash(props: { error?: string; message?: string }) {
  if (props.error)
    return (
      <p
        role="alert"
        className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {props.error}
      </p>
    );
  if (props.message)
    return (
      <p
        role="status"
        className="mb-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      >
        {props.message}
      </p>
    );
  return null;
}

export function Card(props: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`surface rounded-xl p-5 ${props.className ?? ""}`}>
      {props.title && (
        <h2 className="mb-3 text-[0.95rem] font-semibold tracking-tight">{props.title}</h2>
      )}
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
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${percent}%`, background: "var(--brand-gradient)" }}
      />
    </div>
  );
}
