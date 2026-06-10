import type { ReactNode } from "react";
import { useId } from "react";
import { Field } from "./Field";

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
  inputClassName?: string;
  hint?: ReactNode;
  formatValue?: (value: number) => ReactNode;
  ariaValueText?: string;
  onChange(value: number): void;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  className,
  inputClassName,
  hint,
  formatValue,
  ariaValueText,
  onChange
}: SliderFieldProps) {
  const fieldId = useId();
  const inputId = `${fieldId}-input`;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <Field label={label} hint={hint} labelFor={inputId} hintId={hintId} className={className}>
      {formatValue ? (
        <span className="ui-slider-value" aria-hidden="true">
          {formatValue(value)}
        </span>
      ) : null}
      <input
        className={["ui-slider-input", inputClassName].filter(Boolean).join(" ")}
        id={inputId}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-describedby={hintId}
        aria-valuetext={ariaValueText}
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
