export interface SegmentedControlOption<TValue extends string | number> {
  label: string;
  value: TValue;
  disabled?: boolean;
}

export interface SegmentedControlProps<TValue extends string | number> {
  ariaLabel: string;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
  className?: string;
  onChange(value: TValue): void;
}

export function SegmentedControl<TValue extends string | number>({
  ariaLabel,
  options,
  value,
  className,
  onChange
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={["ui-segmented-control", className].filter(Boolean).join(" ")}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            className={[
              "ui-segmented-control-option",
              selected ? "ui-segmented-control-option-selected" : undefined
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
