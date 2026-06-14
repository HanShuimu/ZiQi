import { describe, expect, it, vi } from "vitest";
import {
  createApplicationMenuTemplate,
  MENU_COMMANDS,
  type MenuCommand
} from "./applicationMenu.js";

describe("app menu", () => {
  it("creates File and Debug menus on Windows", () => {
    const template = createApplicationMenuTemplate({
      activeSkin: "default",
      platform: "win32",
      dispatch: vi.fn()
    });
    const debugMenu = template.find((item) => item.label === "Debug");

    expect(template.map((item) => item.label)).toEqual(["File", "Debug"]);
    expect(debugMenu?.submenu?.map((item) => item.label)).toEqual([
      "Describe Selected Range for LLM"
    ]);
  });

  it("creates File menu items for project actions and skins", () => {
    const template = createApplicationMenuTemplate({
      activeSkin: "default",
      platform: "win32",
      dispatch: vi.fn()
    });

    const fileMenu = template.find((item) => item.label === "File");

    expect(fileMenu?.submenu?.map((item) => item.label ?? item.type)).toEqual([
      "Open Project",
      "Save Project",
      "Import Audio",
      "separator",
      "Skins"
    ]);
  });

  it("checks the active skin menu item", () => {
    const template = createApplicationMenuTemplate({
      activeSkin: "animal-island",
      platform: "win32",
      dispatch: vi.fn()
    });

    const skinsMenu = template
      .find((item) => item.label === "File")
      ?.submenu?.find((item) => item.label === "Skins");

    expect(skinsMenu?.submenu?.map((item) => [item.label, item.checked])).toEqual([
      ["Default", false],
      ["Animal Island", true]
    ]);
  });

  it("dispatches typed commands from File menu clicks", () => {
    const dispatch = vi.fn<(command: MenuCommand) => void>();
    const template = createApplicationMenuTemplate({
      activeSkin: "default",
      platform: "win32",
      dispatch
    });
    const fileMenu = template.find((item) => item.label === "File");
    const skinsMenu = fileMenu?.submenu?.find((item) => item.label === "Skins");

    fileMenu?.submenu?.[0].click?.();
    fileMenu?.submenu?.[1].click?.();
    fileMenu?.submenu?.[2].click?.();
    skinsMenu?.submenu?.[0].click?.();
    skinsMenu?.submenu?.[1].click?.();

    expect(dispatch).toHaveBeenNthCalledWith(1, MENU_COMMANDS.OPEN_PROJECT);
    expect(dispatch).toHaveBeenNthCalledWith(2, MENU_COMMANDS.SAVE_PROJECT);
    expect(dispatch).toHaveBeenNthCalledWith(3, MENU_COMMANDS.IMPORT_AUDIO);
    expect(dispatch).toHaveBeenNthCalledWith(4, MENU_COMMANDS.SET_SKIN_DEFAULT);
    expect(dispatch).toHaveBeenNthCalledWith(5, MENU_COMMANDS.SET_SKIN_ANIMAL_ISLAND);
  });

  it("dispatches the selected range debug command from the Debug menu", () => {
    const dispatch = vi.fn<(command: MenuCommand) => void>();
    const template = createApplicationMenuTemplate({
      activeSkin: "default",
      platform: "win32",
      dispatch
    });
    const debugMenu = template.find((item) => item.label === "Debug");

    debugMenu?.submenu?.[0].click?.();

    expect(dispatch).toHaveBeenCalledWith(
      MENU_COMMANDS.DESCRIBE_SELECTED_RANGE_FOR_LLM
    );
  });

  it("keeps a standard app menu before File on macOS", () => {
    const template = createApplicationMenuTemplate({
      activeSkin: "default",
      platform: "darwin",
      dispatch: vi.fn()
    });

    expect(template.map((item) => item.label)).toEqual(["ZiQi", "File", "Debug"]);
  });
});
