import type { ListItemProps } from "../types";
import { useUiAdapter } from "../provider/UiAdapterContext";

export function ListItem(props: ListItemProps) {
  const adapter = useUiAdapter();
  return <adapter.ListItem {...props} />;
}
