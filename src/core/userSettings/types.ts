export type SkinId = "default" | "animal-island";

export interface UserSettings {
  uiSkin: SkinId;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  uiSkin: "default"
};

export function isSkinId(value: unknown): value is SkinId {
  return value === "default" || value === "animal-island";
}
