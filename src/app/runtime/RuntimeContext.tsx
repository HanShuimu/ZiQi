import { createContext, useContext } from "react";
import type { AppRuntime } from "./types";

export const RuntimeContext = createContext<AppRuntime | null>(null);

export function useAppRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("useAppRuntime must be used within RuntimeProvider.");
  }
  return runtime;
}
