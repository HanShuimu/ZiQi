import { Button as AnimalButton, Card as AnimalCard, Footer } from "animal-island-ui";
import "animal-island-ui/style";
import type {
  BackgroundProps,
  ButtonProps,
  ListItemProps,
  PanelProps,
  TabsProps,
  UiAdapter
} from "../../ui";

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function Background(_props: BackgroundProps) {
  return (
    <div className="animal-island-background" aria-hidden="true">
      <Footer type="sea" />
      <Footer type="tree" />
    </div>
  );
}

function Button({
  className,
  children,
  disabled,
  activating,
  onClick,
  size: _size,
  type,
  variant = "secondary",
  ...buttonProps
}: ButtonProps) {
  return (
    <AnimalButton
      {...buttonProps}
      className={joinClassNames(`ui-button-${variant}`, activating ? "anim-btn-activating" : "", className)}
      disabled={disabled}
      htmlType={type}
      onClick={onClick}
    >
      {children}
    </AnimalButton>
  );
}

function Panel({ className, children }: PanelProps) {
  return (
    <AnimalCard className={joinClassNames("panel", className)}>
      {children}
    </AnimalCard>
  );
}

function Tabs({ className, ...props }: TabsProps) {
  return <div {...props} className={joinClassNames("dock-tabs", "animal-tabs", className)} />;
}

function ListItem({ className, ...props }: ListItemProps) {
  return <div {...props} className={joinClassNames("list-item", "animal-list-item", className)} />;
}

export const animalIslandAdapter: UiAdapter = {
  Background,
  Button,
  Panel,
  Tabs,
  ListItem
};
