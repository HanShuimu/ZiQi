import fs from "node:fs/promises";
import path from "node:path";

export type SkinId = "default" | "animal-island";

export interface UserSettings {
  uiSkin: SkinId;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  uiSkin: "default"
};

export interface UserSettingsStore {
  read(): Promise<UserSettings>;
  update(patch: Partial<UserSettings>): Promise<UserSettings>;
}

export function createUserSettingsStore(userDataPath: string): UserSettingsStore {
  const settingsPath = path.join(userDataPath, "settings.json");

  return {
    async read() {
      return readSettings(settingsPath);
    },
    async update(patch) {
      const current = await readSettings(settingsPath);
      const next = normalizeUserSettings({
        ...current,
        ...patch
      });
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      return next;
    }
  };
}

async function readSettings(settingsPath: string): Promise<UserSettings> {
  try {
    const text = await fs.readFile(settingsPath, "utf8");
    return normalizeUserSettings(JSON.parse(text));
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function normalizeUserSettings(value: unknown): UserSettings {
  if (!isRecord(value)) {
    return DEFAULT_USER_SETTINGS;
  }

  return {
    uiSkin: isSkinId(value.uiSkin) ? value.uiSkin : DEFAULT_USER_SETTINGS.uiSkin
  };
}

function isSkinId(value: unknown): value is SkinId {
  return value === "default" || value === "animal-island";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
