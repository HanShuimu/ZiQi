import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_USER_SETTINGS } from "../../core/userSettings/types";
import type { SkinId } from "../../core/userSettings/types";
import { useAppRuntime } from "../runtime";
import { UiSettingsContext } from "./UiSettingsContext";
import type { UiSettingsValue } from "./UiSettingsContext";

interface UiSettingsProviderProps {
  children: ReactNode;
}

export function UiSettingsProvider({ children }: UiSettingsProviderProps) {
  const runtime = useAppRuntime();
  const [uiSkin, setUiSkin] = useState<SkinId>(DEFAULT_USER_SETTINGS.uiSkin);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void runtime.getUserSettings().then((settings) => {
      if (isActive) {
        setUiSkin(settings.uiSkin);
      }
    });

    return () => {
      isActive = false;
    };
  }, [runtime]);

  const changeSkin = useCallback(async (nextSkin: SkinId) => {
    setUiSkin(nextSkin);

    try {
      const savedSettings = await runtime.updateUserSettings({ uiSkin: nextSkin });
      setUiSkin(savedSettings.uiSkin);
      setSettingsError(null);
    } catch (error) {
      setSettingsError(error instanceof Error
        ? error.message
        : "Failed to update user settings.");
    }
  }, [runtime]);

  const value = useMemo<UiSettingsValue>(
    () => ({
      uiSkin,
      settingsError,
      changeSkin
    }),
    [uiSkin, settingsError, changeSkin]
  );

  return (
    <UiSettingsContext.Provider value={value}>
      {children}
    </UiSettingsContext.Provider>
  );
}
