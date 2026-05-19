import type { ReactNode } from "react";
import type { SkinId } from "../../domain/userSettings/types";
import type { UiAdapter } from "../types";
import { UiAdapterContext } from "./UiAdapterContext";

interface UiProviderProps {
  skinId: SkinId;
  adapter: UiAdapter;
  children: ReactNode;
}

export function UiProvider({ skinId, adapter, children }: UiProviderProps) {
  return (
    <UiAdapterContext.Provider value={adapter}>
      <div className="app-root" data-skin={skinId}>
        <adapter.Background />
        <div className="app-content">{children}</div>
      </div>
    </UiAdapterContext.Provider>
  );
}
