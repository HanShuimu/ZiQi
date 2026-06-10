import type { ReactNode } from "react";
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
  onChange
}: SliderFieldProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      {formatValue ? (
        <span className="ui-slider-value" aria-hidden="true">
          {formatValue(value)}
        </span>
      ) : null}
      <input
        className={["ui-slider-input", inputClassName].filter(Boolean).join(" ")}
        type="range"
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
