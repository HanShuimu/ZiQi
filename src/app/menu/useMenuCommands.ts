import { useEffect } from "react";
import type { SkinId } from "../../core/userSettings/types";

interface UseMenuCommandsOptions {
  importAudio: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
}

export function useMenuCommands({
  importAudio,
  openProject,
  saveProject,
  changeSkin
}: UseMenuCommandsOptions) {
  useEffect(() => {
    if (typeof window.ziqiApp.onMenuCommand !== "function") {
      return;
    }
    return window.ziqiApp.onMenuCommand((command) => {
      if (command === "import-audio") {
        void importAudio();
        return;
      }
      if (command === "open-project") {
        void openProject();
        return;
      }
      if (command === "save-project") {
        void saveProject();
        return;
      }
      if (command === "set-skin-default") {
        void changeSkin("default");
        return;
      }
      if (command === "set-skin-animal-island") {
        void changeSkin("animal-island");
      }
    });
  }, [changeSkin, importAudio, openProject, saveProject]);
}
