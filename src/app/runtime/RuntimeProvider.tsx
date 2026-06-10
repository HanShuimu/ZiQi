import { useMemo } from "react";
import type { ReactNode } from "react";
import { createDevRuntime } from "./devRuntime";
import { createElectronRuntime } from "./electronRuntime";
import { RuntimeContext } from "./RuntimeContext";

interface RuntimeProviderProps {
  children: ReactNode;
}

export function RuntimeProvider({ children }: RuntimeProviderProps) {
  const runtime = useMemo(() => {
    const ziqiApp = typeof window === "undefined"
      ? undefined
      : window.ziqiApp;

    return ziqiApp ? createElectronRuntime(ziqiApp) : createDevRuntime();
  }, []);

  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
