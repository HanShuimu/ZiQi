import { createContext } from "react";
import type { AppSessionValue } from "./types";

export const AppSessionContext = createContext<AppSessionValue | null>(null);
