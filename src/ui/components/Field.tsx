import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  labelFor?: string;
  hintId?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, labelFor, hintId, className, children }: FieldProps) {
  if (labelFor) {
    return (
      <div className={["ui-field", className].filter(Boolean).join(" ")}>
        <label className="ui-field-label" htmlFor={labelFor}>
          {label}
        </label>
        {children}
        {hint ? (
          <span className="ui-field-hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <label className={["ui-field", className].filter(Boolean).join(" ")}>
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? (
        <span className="ui-field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
