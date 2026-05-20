import { useContext } from "react";
import { AppSessionContext } from "./AppSessionContext";

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error("useAppSession must be used within AppSessionProvider.");
  }
  return value;
}
