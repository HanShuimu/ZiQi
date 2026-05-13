export const MENU_COMMANDS = {
  OPEN_PROJECT: "open-project",
  SAVE_PROJECT: "save-project",
  IMPORT_AUDIO: "import-audio"
} as const;

export type MenuCommand = (typeof MENU_COMMANDS)[keyof typeof MENU_COMMANDS];

export interface AppMenuTemplateItem {
  label?: string;
  role?: string;
  submenu?: AppMenuTemplateItem[];
  accelerator?: string;
  click?: () => void;
}

interface CreateApplicationMenuTemplateRequest {
  platform: NodeJS.Platform;
  dispatch(command: MenuCommand): void;
}

export function createApplicationMenuTemplate({
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
