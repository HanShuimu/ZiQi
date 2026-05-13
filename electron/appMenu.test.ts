import { describe, expect, it, vi } from "vitest";
import {
  createApplicationMenuTemplate,
  MENU_COMMANDS,
  type MenuCommand
} from "./appMenu.js";

describe("app menu", () => {
  it("creates File menu items for project open, save, and audio import", () => {
    const dispatch = vi.fn();
    const template = createApplicationMenuTemplate({
      platform: "win32",
      dispatch
    });

    const fileMenu = template.find((item) => item.label === "File");

    expect(fileMenu?.submenu?.map((item) => item.label)).toEqual([
      "Open Project",
      "Save Project",
      "Import Audio"
    ]);
  });

  it("dispatches typed commands from File menu clicks", () => {
    const dispatch = vi.fn<(command: MenuCommand) => void>();
    const template = createApplicationMenuTemplate({
      platform: "win32",
      dispatch
    });
    const fileMenu = template.find((item) => item.label === "File");

    fileMenu?.submenu?.[0].click?.();
    fileMenu?.submenu?.[1].click?.();
    fileMenu?.submenu?.[2].click?.();

    expect(dispatch).toHaveBeenNthCalledWith(1, MENU_COMMANDS.OPEN_PROJECT);
    expect(dispatch).toHaveBeenNthCalledWith(2, MENU_COMMANDS.SAVE_PROJECT);
    expect(dispatch).toHaveBeenNthCalledWith(3, MENU_COMMANDS.IMPORT_AUDIO);
  });

  it("keeps a standard app menu before File on macOS", () => {
    const template = createApplicationMenuTemplate({
      platform: "darwin",
      dispatch: vi.fn()
    });

    expect(template[0].label).toBe("ZiQi");
    expect(template[1].label).toBe("File");
  });
});
