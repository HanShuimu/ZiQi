import { useEffect, useRef } from "react";
import type { SkinId } from "../../core/userSettings/types";
import type { AppRuntime } from "../runtime";

interface UseMenuCommandsOptions {
  runtime: AppRuntime;
  importAudio: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  changeSkin: (nextSkin: SkinId) => Promise<void>;
  describeSelectedRangeForLlm: () => void;
}

export function useMenuCommands({
  runtime,
  importAudio,
  openProject,
  saveProject,
  changeSkin,
  describeSelectedRangeForLlm
}: UseMenuCommandsOptions) {
  const commandsRef = useRef({
    importAudio,
    openProject,
    saveProject,
    changeSkin,
    describeSelectedRangeForLlm
  });
  // eslint-disable-next-line react-hooks/refs -- Native menu events can fire before passive effects run.
  commandsRef.current = {
    importAudio,
    openProject,
    saveProject,
    changeSkin,
    describeSelectedRangeForLlm
  };

  useEffect(() => {
    return runtime.onMenuCommand((command) => {
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
        return;
      }
      if (command === "describe-selected-range-for-llm") {
        commands.describeSelectedRangeForLlm();
      }
    });
  }, [runtime]);
}
