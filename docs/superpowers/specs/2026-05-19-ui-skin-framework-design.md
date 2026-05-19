# UI Skin Framework Design

## Status

Approved direction for design documentation. Implementation has not started.

## Goal

ZiQi needs a skin framework that can switch between a default workbench skin and an Animal Island skin based on `guokaigdg/animal-island-ui`. The framework must make future skins easy to add without making ordinary UI development more complex.

The first implementation should support:

- A default skin that preserves the current professional workbench appearance.
- An `animal-island` skin that uses `animal-island-ui` where it fits.
- Persistent user skin selection.
- A native menu entry under `File > Skins` for choosing the skin.

## Non-Goals

- Do not build a Preferences panel or Preferences window in the first version.
- Do not let skins change the workbench layout.
- Do not let business components import `animal-island-ui` directly.
- Do not replace core audio-analysis visuals with third-party decorative components.
- Do not build a broad user settings system beyond what skin persistence needs.

## Assumptions

- Skin choice is a user preference, not project data.
- Two users opening the same ZiQi project may choose different skins.
- The renderer should not read or write local settings files directly.
- The first skin framework should support medium-weight skins: shared layout and workflows, different visual language for common UI surfaces.

## Recommended Architecture

Use this layered model:

```text
User Settings
  settings.json
  uiSkin

Electron Menu
  File > Skins > Default / Animal Island
  checked state follows uiSkin

Renderer App
  loads user settings on startup
  handles set-skin menu commands
  persists selected skin

UiProvider
  receives skinId
  sets data-skin
  provides current adapter
  renders adapter.Background

UI Primitives
  Button, Panel, Tabs, ListItem
  no skin-specific names

Skins
  default adapter + tokens.css
  animalIsland adapter + tokens.css
```

This keeps skin-specific logic behind stable project UI primitives. Business UI should read as ordinary ZiQi UI code, not as skin plumbing.

## Skin IDs

The first supported skin IDs are:

```ts
type SkinId = "default" | "animal-island";
```

Use `default` for the current ZiQi workbench style.
Use `animal-island` for the Animal Island skin.

## Design Tokens

Each skin owns a token stylesheet. Tokens cover shared visual decisions such as:

- Static app background fallback
- Panel surfaces
- Text colors
- Accent colors
- Borders
- Panel radius
- Control radius
- Shadows
- Focus rings

Example token names:

```css
:root,
[data-skin="default"] {
  --skin-app-bg:
    radial-gradient(circle at top left, rgba(247, 231, 205, 0.9), transparent 30%),
    radial-gradient(circle at bottom right, rgba(231, 214, 195, 0.85), transparent 26%),
    #f3efe8;
  --skin-surface: rgba(255, 250, 243, 0.93);
  --skin-surface-strong: #fff7ef;
  --skin-text: #1f1a17;
  --skin-text-muted: #6e6256;
  --skin-accent: #b96a30;
  --skin-border: rgba(209, 185, 151, 0.9);
  --skin-radius-panel: 24px;
  --skin-radius-control: 999px;
  --skin-shadow-panel: 0 20px 40px rgba(94, 63, 31, 0.09);
}
```

`--skin-app-bg` is a CSS background value, not a color-only token. It may be a color, gradient, image, or layered background.

Current hard-coded values in `src/styles.css` should be migrated to tokens where they represent skin-level styling.

Core analysis visuals may use tokens for surrounding chrome, labels, cursor colors, and empty states. Spectrogram rendering itself should stay driven by audio visualization requirements, not skin styling.

## UI Primitives

The project should expose standard UI primitives from `src/ui`.

Recommended first primitives:

- `Button`
- `Panel`
- `Tabs`
- `ListItem`

Names should not include `Skin`. A developer using the UI layer should write:

```tsx
import { Button, Panel } from "../ui";

<Button variant="primary">Save</Button>
<Panel>...</Panel>
```

The primitive props should stay small and stable. They should not expose library-specific props from `animal-island-ui`.

Example:

```ts
interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

If a feature needs a special control, add it deliberately to the project primitive contract only when more than one skin can represent it cleanly.

## Skin Adapters

Each skin provides an adapter that satisfies the same project-level UI contract. The adapter represents skin rendering capability, including both app-level decorative layers and shared UI primitives.

```ts
interface UiAdapter {
  Background: ComponentType<BackgroundProps>;
  Button: ComponentType<ButtonProps>;
  Panel: ComponentType<PanelProps>;
  Tabs: ComponentType<TabsProps>;
  ListItem: ComponentType<ListItemProps>;
}
```

The UI primitive wrappers read the active adapter from context:

```tsx
export function Button(props: ButtonProps) {
  const adapter = useUiAdapter();
  return <adapter.Button {...props} />;
}
```

This prevents business components from branching on the active skin.

`Background` is part of the adapter so all skin-owned rendering differences are centralized. It is required, but it is not exported as a normal UI primitive. Only `UiProvider` or the app shell may render it.

Default skins can implement:

```tsx
function DefaultBackground() {
  return null;
}
```

Dynamic skins can implement their own decorative layer:

```tsx
function AnimalIslandBackground() {
  return <div className="animal-island-background" aria-hidden="true" />;
}
```

Background implementations must follow these rules:

- They must be decorative and must not carry business state.
- They must not affect layout size or document flow.
- They must not intercept pointer input.
- They must sit behind app content.
- They must respect `prefers-reduced-motion`.
- They must preserve contrast and readability for the workbench, especially around analysis visuals.

## Default Skin

The default skin is the baseline implementation. It should preserve the current ZiQi interface closely.

Default skin adapter behavior:

- Provide `Background` as a no-op component unless the default skin later needs a decorative layer.
- Render standard HTML elements.
- Use current semantic class names where practical.
- Consume design tokens for colors, radius, borders, and shadows.
- Avoid visual churn that is unrelated to the skin framework.

The first implementation should not redesign the default workbench. Its job is to make the current design tokenized and adapter-compatible.

## Animal Island Skin

The Animal Island skin should be implemented inside its own skin directory. `animal-island-ui` imports must stay isolated there.

Suggested location:

```text
src/skins/animalIsland/
  adapter.tsx
  tokens.css
```

Acceptable uses of `animal-island-ui`:

- Decorative app background through the skin adapter `Background`
- Common buttons
- Panel/card-like containers
- Basic tab or segmented controls if the library has a suitable primitive
- Empty-state or lightweight surface styling
- Simple list item chrome

Do not use `animal-island-ui` for:

- Spectrogram canvas
- Waveform overview rendering
- Piano pitch axis
- Playback timing logic
- Timeline navigator behavior
- Electron menu behavior
- Project or audio domain data structures

The Animal Island skin should make the surrounding workbench softer and more playful while keeping the central analysis area precise and readable.

If the Animal Island skin needs dynamic background motion, implement it in `animalIslandAdapter.Background`, not in business components and not as ad hoc page markup.

## Skin Registry

Skins should be registered in one place.

```ts
const skins = {
  default: {
    id: "default",
    label: "Default",
    adapter: defaultAdapter
  },
  "animal-island": {
    id: "animal-island",
    label: "Animal Island",
    adapter: animalIslandAdapter
  }
} satisfies Record<SkinId, SkinDefinition>;
```

The registry should be the source for menu labels, validation, and adapter lookup. It should not own app-level rendering hooks such as `Background`; those belong to the adapter.

## User Settings

Skin selection must persist as a user setting.

The first user settings shape is:

```ts
interface UserSettings {
  uiSkin: SkinId;
}
```

Settings should be stored by the Electron main process at:

```text
app.getPath("userData")/settings.json
```

Default settings:

```ts
const DEFAULT_USER_SETTINGS: UserSettings = {
  uiSkin: "default"
};
```

Renderer APIs exposed through preload:

```ts
window.ziqiApp.getUserSettings(): Promise<UserSettings>
window.ziqiApp.updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings>
```

Use patch updates instead of whole-file replacement so future settings can be added without callers overwriting each other.

Invalid or missing settings files should fall back to defaults. The first version may overwrite invalid skin values with `default`.

## Native Menu

Do not build Preferences UI in the first version. Add a `Skins` submenu under `File`.

Recommended menu shape:

```text
File
  Open Project
  Save Project
  Import Audio
  ----------------
  Skins
    Default
    Animal Island
```

The current skin should be reflected with checked menu items.

The existing menu command channel can remain string-based for the first version:

```ts
type MenuCommand =
  | "open-project"
  | "save-project"
  | "import-audio"
  | "set-skin-default"
  | "set-skin-animal-island";
```

This matches the current menu command style and keeps the change small. If menu commands become more complex later, they can be migrated to structured objects.

## Menu State Synchronization

The Electron main process should maintain the current settings in memory.

Startup flow:

1. Main process reads user settings from disk.
2. Main process builds the application menu with the active skin checked.
3. Renderer loads and calls `getUserSettings()`.
4. Renderer initializes `UiProvider` with the returned `uiSkin`.

Skin change flow:

1. User selects `File > Skins > Animal Island`.
2. Main process dispatches `set-skin-animal-island` to the focused renderer.
3. Renderer updates local skin state immediately.
4. Renderer calls `updateUserSettings({ uiSkin: "animal-island" })`.
5. Main process validates and saves settings.
6. Main process rebuilds the menu so the checked state follows the saved skin.

If saving fails, renderer should surface a small user-facing error and keep the current session's selected skin. The next launch will fall back to the last successfully saved skin.

## Data Flow

```text
settings.json
  -> Electron main user settings loader
  -> preload API
  -> App state
  -> UiProvider
  -> adapter + data-skin
  -> adapter.Background
  -> UI primitives and tokenized CSS
```

Menu selection uses the same settings API after sending the renderer command.

## Suggested File Layout

```text
electron/
  appMenu.ts
  userSettings.ts

src/
  domain/
    userSettings/
      types.ts
  skins/
    registry.ts
    default/
      adapter.tsx
      tokens.css
    animalIsland/
      adapter.tsx
      tokens.css
  ui/
    components/
      Button.tsx
      Panel.tsx
      Tabs.tsx
      ListItem.tsx
    provider/
      UiProvider.tsx
      UiAdapterContext.tsx
    types.ts
    index.ts
```

This structure keeps generic UI contracts separate from concrete skin implementations.

## Error Handling

- Missing settings file: use defaults.
- Invalid settings file JSON: use defaults and allow the next successful update to rewrite the file.
- Unknown `uiSkin`: use `default`.
- Failed settings save: keep current renderer state for the session and show a concise error.
- Missing adapter for a registered skin: treat as a development error and fail tests.

## Testing Strategy

Unit tests:

- `userSettings` returns defaults when no settings file exists.
- `userSettings` validates unknown skin values and falls back to `default`.
- `updateUserSettings` merges patches without dropping existing settings.
- `appMenu` includes `File > Skins` with checked state for the active skin.
- Menu clicks dispatch the expected skin commands.
- `UiProvider` selects the correct adapter for each skin.
- `UiProvider` renders the active adapter `Background`.
- UI primitives pass common props through to the active adapter.
- `App` initializes from `getUserSettings()`.
- `App` handles skin menu commands and persists selected skin.

Build verification:

- `npm test`
- `npm run build`

Runtime smoke test:

- Launch the Electron app.
- Confirm `window.ziqiApp` exists in the renderer.
- Confirm `File > Skins` appears.
- Switch between `Default` and `Animal Island`.
- Confirm the UI changes without blank screens or broken audio UI.
- Restart the app and confirm the last selected skin is restored.

## Future Extensions

The design intentionally leaves room for:

- A full Preferences panel when there are more settings.
- A dedicated Preferences window if desktop conventions become important.
- Additional skins through new adapter and token directories.
- Structured menu commands if string commands become unwieldy.
- More UI primitives as repeated UI patterns emerge.

These should be added only when there is a concrete use case.
