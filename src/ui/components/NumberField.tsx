import type { ReactNode } from "react";
import { Field } from "./Field";

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputClassName?: string;
  hint?: ReactNode;
  onChange(value: number): void;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  className,
  inputClassName,
  hint,
  onChange
}: NumberFieldProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        className={["ui-number-input", inputClassName].filter(Boolean).join(" ")}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;

          if (Number.isFinite(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </Field>
  );
}
