import type { ReactNode } from "react";
import { useId } from "react";
import { Field } from "./Field";

export interface ToggleProps {
  label: string;
  checked: boolean;
  className?: string;
  disabled?: boolean;
  hint?: ReactNode;
  onChange(checked: boolean): void;
}

export function Toggle({ label, checked, className, disabled, hint, onChange }: ToggleProps) {
  const fieldId = useId();
  const inputId = `${fieldId}-input`;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <Field label={label} hint={hint} labelFor={inputId} hintId={hintId} className={className}>
      <input
        className="ui-toggle-input"
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </Field>
  );
}
