import type { ReactNode } from "react";

export interface PanelSectionProps {
  label?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function PanelSection({ label, title, className, children }: PanelSectionProps) {
  return (
    <section className={["ui-panel-section", className].filter(Boolean).join(" ")} aria-label={label ?? title}>
      {label ? <div className="ui-panel-section-label">{label}</div> : null}
      {title ? <h3 className="ui-panel-section-title">{title}</h3> : null}
      {children}
    </section>
  );
}
