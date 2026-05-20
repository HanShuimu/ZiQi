import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_USER_SETTINGS,
  createUserSettingsStore
} from "./userSettings.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ziqi-settings-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("user settings store", () => {
  it("returns defaults when settings file is missing", async () => {
    const store = createUserSettingsStore(tempDir);

    await expect(store.read()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it("falls back to defaults for invalid JSON", async () => {
    await writeFile(path.join(tempDir, "settings.json"), "{not-json", "utf8");
    const store = createUserSettingsStore(tempDir);

    await expect(store.read()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it("falls back to default skin for unknown skin values", async () => {
    await writeFile(
      path.join(tempDir, "settings.json"),
      JSON.stringify({ uiSkin: "unknown" }),
      "utf8"
    );
    const store = createUserSettingsStore(tempDir);

    await expect(store.read()).resolves.toEqual(DEFAULT_USER_SETTINGS);
  });

  it("merges patches and writes settings to disk", async () => {
    const store = createUserSettingsStore(tempDir);

    const settings = await store.update({ uiSkin: "animal-island" });

    expect(settings).toEqual({ uiSkin: "animal-island" });
    await expect(readFile(path.join(tempDir, "settings.json"), "utf8")).resolves.toBe(
      `${JSON.stringify({ uiSkin: "animal-island" }, null, 2)}\n`
    );
  });
});
