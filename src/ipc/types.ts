import type * as system from "./handlers/system";
import type * as updates from "./handlers/updates";
import type { MenuEvents } from "./handlers/menu";
import type { SystemEvents } from "./handlers/system";
import type { UpdatesEvents } from "./handlers/updates";

// Over IPC every call is async. A generator streams through push events, so its call resolves to nothing.
type ApiFunction<T> = T extends (...args: infer Args) => AsyncGenerator<unknown, unknown, unknown>
  ? (...args: Args) => Promise<void>
  : T extends (...args: infer Args) => infer R
    ? (...args: Args) => Promise<Awaited<R>>
    : never;

type ApiModule<T, KOmit extends keyof T = never> = {
  [K in keyof Omit<T, KOmit>]: ApiFunction<T[K]>;
};

type ApiModuleWithEvents<T, E, KOmit extends keyof T = never> = ApiModule<T, KOmit> & E;

export interface AppEvents {
  onBeforeQuit: (callback: () => void) => () => void;
  sendQuitAck: () => void;
}

// What the main calls itself is omitted: the omission is what keeps it out of the renderer's reach.
export interface ElectronAPI {
  system: ApiModuleWithEvents<typeof system, SystemEvents, "createMainWindow" | "watchNativeTheme">;
  updates: ApiModuleWithEvents<typeof updates, UpdatesEvents>;
  menu: MenuEvents;
  app: AppEvents;
}
