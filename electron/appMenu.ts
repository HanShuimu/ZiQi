export const MENU_COMMANDS = {
  OPEN_PROJECT: "open-project",
  SAVE_PROJECT: "save-project",
  IMPORT_AUDIO: "import-audio",
  SET_SKIN_DEFAULT: "set-skin-default",
  SET_SKIN_ANIMAL_ISLAND: "set-skin-animal-island"
} as const;

export type MenuCommand = (typeof MENU_COMMANDS)[keyof typeof MENU_COMMANDS];
export type MenuSkinId = "default" | "animal-island";

export interface AppMenuTemplateItem {
  label?: string;
  role?: string;
  type?: "normal" | "separator" | "checkbox" | "radio";
  checked?: boolean;
  submenu?: AppMenuTemplateItem[];
  accelerator?: string;
  click?: () => void;
}

interface CreateApplicationMenuTemplateRequest {
  activeSkin: MenuSkinId;
  platform: NodeJS.Platform;
  dispatch(command: MenuCommand): void;
}

export function createApplicationMenuTemplate({
  activeSkin,
  platform,
  dispatch
}: CreateApplicationMenuTemplateRequest): AppMenuTemplateItem[] {
  const fileMenu: AppMenuTemplateItem = {
    label: "File",
    submenu: [
      {
        label: "Open Project",
        accelerator: "CmdOrCtrl+O",
        click: () => dispatch(MENU_COMMANDS.OPEN_PROJECT)
      },
      {
        label: "Save Project",
        accelerator: "CmdOrCtrl+S",
        click: () => dispatch(MENU_COMMANDS.SAVE_PROJECT)
      },
      {
        label: "Import Audio",
        accelerator: "CmdOrCtrl+I",
        click: () => dispatch(MENU_COMMANDS.IMPORT_AUDIO)
      },
      {
        type: "separator"
      },
      {
        label: "Skins",
        submenu: [
          {
            label: "Default",
            type: "radio",
            checked: activeSkin === "default",
            click: () => dispatch(MENU_COMMANDS.SET_SKIN_DEFAULT)
          },
          {
            label: "Animal Island",
            type: "radio",
            checked: activeSkin === "animal-island",
            click: () => dispatch(MENU_COMMANDS.SET_SKIN_ANIMAL_ISLAND)
          }
        ]
      }
    ]
  };

  if (platform === "darwin") {
    return [
      {
        label: "ZiQi",
        submenu: [{ role: "about" }, { role: "hide" }, { role: "quit" }]
      },
      fileMenu
    ];
  }

  return [fileMenu];
}
