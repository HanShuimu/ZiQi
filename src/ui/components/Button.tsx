import type { ButtonProps } from "../types";
import { useUiAdapter } from "../provider/UiAdapterContext";

export function Button(props: ButtonProps) {
  const adapter = useUiAdapter();
  return <adapter.Button {...props} />;
}
