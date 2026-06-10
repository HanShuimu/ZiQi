import type { ReactNode } from "react";
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
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        className="ui-toggle-input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </Field>
  );
}
