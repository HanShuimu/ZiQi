import type { ReactNode } from "react";
import { useId } from "react";
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
  onChange?(value: number): void;
  onRawChange?(rawValue: string): void;
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
  onChange,
  onRawChange
}: NumberFieldProps) {
  const fieldId = useId();
  const inputId = `${fieldId}-input`;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <Field label={label} hint={hint} labelFor={inputId} hintId={hintId} className={className}>
      <input
        className={["ui-number-input", inputClassName].filter(Boolean).join(" ")}
        id={inputId}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-describedby={hintId}
        onChange={(event) => {
          onRawChange?.(event.currentTarget.value);

          const nextValue = event.currentTarget.valueAsNumber;

          if (Number.isFinite(nextValue)) {
            onChange?.(nextValue);
          }
        }}
      />
    </Field>
  );
}
