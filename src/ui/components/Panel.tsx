import type { PanelProps } from "../types";
import { useUiAdapter } from "../provider/UiAdapterContext";

export function Panel(props: PanelProps) {
  const adapter = useUiAdapter();
  return <adapter.Panel {...props} />;
}
