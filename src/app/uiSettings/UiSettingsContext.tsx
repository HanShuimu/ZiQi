import { createContext } from "react";
import type { SkinId } from "../../core/userSettings/types";

export interface UiSettingsValue {
  uiSkin: SkinId;
  settingsError: string | null;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
}

export const UiSettingsContext = createContext<UiSettingsValue | null>(null);
