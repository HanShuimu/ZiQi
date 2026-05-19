import type { TabsProps } from "../types";
import { useUiAdapter } from "../provider/UiAdapterContext";

export function Tabs(props: TabsProps) {
  const adapter = useUiAdapter();
  return <adapter.Tabs {...props} />;
}
