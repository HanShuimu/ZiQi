import { createContext, useContext } from "react";
import type { UiAdapter } from "../types";

export const UiAdapterContext = createContext<UiAdapter | null>(null);

export function useUiAdapter() {
  const adapter = useContext(UiAdapterContext);

  if (!adapter) {
    throw new Error("UI primitives must be rendered inside UiProvider.");
  }

  return adapter;
}
