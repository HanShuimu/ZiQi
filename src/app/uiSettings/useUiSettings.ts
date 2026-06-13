import { useContext } from "react";
import { UiSettingsContext } from "./UiSettingsContext";

export function useUiSettings() {
  const settings = useContext(UiSettingsContext);
  if (!settings) {
    throw new Error("useUiSettings must be used inside UiSettingsProvider.");
  }
  return settings;
}
