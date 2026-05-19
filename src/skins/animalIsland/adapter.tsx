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

function Button({ className, children, disabled, onClick, variant = "secondary" }: ButtonProps) {
  return (
    <AnimalButton
      className={joinClassNames("ui-button", `ui-button-${variant}`, className)}
      disabled={disabled}
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
