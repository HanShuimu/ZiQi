import type { ComponentType, ReactNode } from "react";

export interface BackgroundProps {}

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}

export interface PanelProps {
  className?: string;
  children: ReactNode;
}

export interface TabsProps {
  className?: string;
  children: ReactNode;
}

export interface ListItemProps {
  className?: string;
  children: ReactNode;
}

export interface UiAdapter {
  Background: ComponentType<BackgroundProps>;
  Button: ComponentType<ButtonProps>;
  Panel: ComponentType<PanelProps>;
  Tabs: ComponentType<TabsProps>;
  ListItem: ComponentType<ListItemProps>;
}
