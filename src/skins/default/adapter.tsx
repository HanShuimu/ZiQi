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
  return null;
}

function Button({ className, variant = "secondary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={joinClassNames("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)}
    />
  );
}

function Panel({ className, ...props }: PanelProps) {
  return <div {...props} className={joinClassNames("panel", className)} />;
}

function Tabs({ className, ...props }: TabsProps) {
  return <div {...props} className={joinClassNames("dock-tabs", className)} />;
}

function ListItem({ className, ...props }: ListItemProps) {
  return <div {...props} className={joinClassNames("list-item", className)} />;
}

export const defaultAdapter: UiAdapter = {
  Background,
  Button,
  Panel,
  Tabs,
  ListItem
};
