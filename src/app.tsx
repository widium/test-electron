import { type ReactElement, useEffect, useState } from "react";

import { WindowTitleBar } from "@/components/layouts/window-title-bar";
import { VersioningPanel } from "@/components/versioning/versioning-panel";

// Change this line at every release: the visible proof that the update took.
const WHATS_NEW = "Seventh version: versioning rebuilt clean.";

// Each version gets its own color, derived from its number, so a new version is seen at a glance.
function versionHue(version: string): number {
  let hash = 0;
  for (const char of version) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function App(): ReactElement {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.electronAPI.system.getAppInfo().then((info) => setVersion(info.version));
  }, []);

  // Nothing is ever pending: acknowledge at once.
  useEffect(
    () => window.electronAPI.app.onBeforeQuit(() => window.electronAPI.app.sendQuitAck()),
    [],
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <WindowTitleBar />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        <section
          className="flex items-center gap-4 rounded-xl p-5 text-white"
          style={{ backgroundColor: `oklch(0.55 0.18 ${version ? versionHue(version) : 0})` }}
        >
          <span className="text-4xl font-bold">v{version ?? "…"}</span>
          <span className="text-sm opacity-90">{WHATS_NEW}</span>
        </section>
        <VersioningPanel />
      </main>
    </div>
  );
}
