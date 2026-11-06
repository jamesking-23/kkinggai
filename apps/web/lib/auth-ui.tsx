import type { ReactNode } from "react";
import { colors } from "@kkingg/design-tokens";

export const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  background: colors.bg,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  fontSize: 14,
} as const;

export const buttonStyle = {
  width: "100%",
  padding: "10px 12px",
  background: colors.primary,
  color: "#fff",
  border: 0,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
} as const;

export function AuthCard(props: {
  title: string;
  error?: string;
  message?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 24,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 14,
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>{props.title}</h1>
        {props.error && (
          <p role="alert" style={{ color: colors.danger, fontSize: 14 }}>
            {props.error}
          </p>
        )}
        {props.message && (
          <p role="status" style={{ color: colors.success, fontSize: 14 }}>
            {props.message}
          </p>
        )}
        {props.children}
        {props.footer && (
          <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 0 }}>{props.footer}</p>
        )}
      </div>
    </main>
  );
}

export function Field(props: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
      {props.label}
      <input
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required
        style={{ ...inputStyle, marginTop: 4 }}
      />
    </label>
  );
}

export type SearchParams = Promise<{ error?: string; message?: string }>;
