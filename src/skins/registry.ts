import type { SkinId } from "../domain/userSettings/types";
import type { UiAdapter } from "../ui";
import { animalIslandAdapter } from "./animalIsland/adapter";
import { defaultAdapter } from "./default/adapter";

export interface SkinDefinition {
  id: SkinId;
  label: string;
  adapter: UiAdapter;
}

export const skinDefinitions: SkinDefinition[] = [
  {
    id: "default",
    label: "Default",
    adapter: defaultAdapter
  },
  {
    id: "animal-island",
    label: "Animal Island",
    adapter: animalIslandAdapter
  }
];

export function getSkinDefinition(skinId: unknown): SkinDefinition {
  return skinDefinitions.find((skin) => skin.id === skinId) ?? skinDefinitions[0];
}
