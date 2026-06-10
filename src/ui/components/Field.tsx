import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")}>
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
    </label>
  );
}
