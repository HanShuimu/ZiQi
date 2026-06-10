import type { Dispatch, SetStateAction } from "react";
import type { SkinId } from "../../core/userSettings/types";
import type { AppRuntime } from "../runtime";

interface SkinCommandDependencies {
  runtime: AppRuntime;
  setUiSkin: Dispatch<SetStateAction<SkinId>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
}

export function createSkinCommands({ runtime, setUiSkin, setImportError }: SkinCommandDependencies) {
  return {
    async changeSkin(nextSkin: SkinId) {
      setUiSkin(nextSkin);
      try {
        const savedSettings = await runtime.updateUserSettings({ uiSkin: nextSkin });
        setUiSkin(savedSettings.uiSkin);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Failed to update user settings.");
      }
    }
  };
}
