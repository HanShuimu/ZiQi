import { useEffect, useRef } from "react";
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
  const commandsRef = useRef({
    importAudio,
    openProject,
    saveProject,
    changeSkin
  });
  // eslint-disable-next-line react-hooks/refs -- Native menu events can fire before passive effects run.
  commandsRef.current = {
    importAudio,
    openProject,
    saveProject,
    changeSkin
  };

  const ziqiApp = window.ziqiApp;

  useEffect(() => {
    if (typeof ziqiApp.onMenuCommand !== "function") {
      return;
    }
    return ziqiApp.onMenuCommand((command) => {
      const commands = commandsRef.current;
      if (command === "import-audio") {
        void commands.importAudio();
        return;
      }
      if (command === "open-project") {
        void commands.openProject();
        return;
      }
      if (command === "save-project") {
        void commands.saveProject();
        return;
      }
      if (command === "set-skin-default") {
        void commands.changeSkin("default");
        return;
      }
      if (command === "set-skin-animal-island") {
        void commands.changeSkin("animal-island");
      }
    });
  }, [ziqiApp]);
}
