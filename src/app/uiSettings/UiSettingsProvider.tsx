import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const settingsRequestRef = useRef(0);
  const [uiSkin, setUiSkin] = useState<SkinId>(DEFAULT_USER_SETTINGS.uiSkin);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const requestId = settingsRequestRef.current + 1;
    settingsRequestRef.current = requestId;

    void runtime.getUserSettings().then((settings) => {
      if (isActive && requestId === settingsRequestRef.current) {
        setUiSkin(settings.uiSkin);
        setSettingsError(null);
      }
    }, (error: unknown) => {
      if (isActive && requestId === settingsRequestRef.current) {
        setSettingsError(getSettingsErrorMessage(error, "Failed to load user settings."));
      }
    });

    return () => {
      isActive = false;
    };
  }, [runtime]);

  const changeSkin = useCallback(async (nextSkin: SkinId) => {
    const requestId = settingsRequestRef.current + 1;
    settingsRequestRef.current = requestId;
    setUiSkin(nextSkin);
    setSettingsError(null);

    try {
      const savedSettings = await runtime.updateUserSettings({ uiSkin: nextSkin });
      if (requestId === settingsRequestRef.current) {
        setUiSkin(savedSettings.uiSkin);
        setSettingsError(null);
      }
    } catch (error) {
      if (requestId === settingsRequestRef.current) {
        setSettingsError(getSettingsErrorMessage(error, "Failed to update user settings."));
      }
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

function getSettingsErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
}
