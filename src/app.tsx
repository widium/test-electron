import { type ReactElement, useCallback, useEffect, useState } from "react";

import { WindowTitleBar } from "@/components/layouts/window-title-bar";
import { Button } from "@/components/ui/button";

type ReleaseList = Awaited<ReturnType<typeof window.electronAPI.updates.listReleases>>;
type Release = Extract<ReleaseList, { ok: true }>["releases"][number];
type Progress = Parameters<Parameters<typeof window.electronAPI.updates.onProgress>[0]>[0];

// Change this line at every release: the visible proof that the update took.
const WHATS_NEW = "First version with the in-app updater.";

// Each version gets its own color, derived from its number, so a new version is seen at a glance.
function versionHue(version: string): number {
  let hash = 0;
  for (const char of version) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function progressLabel(progress: Progress): string {
  if (progress.stage === "download")
    return `downloading ${megabytes(progress.received)} / ${megabytes(progress.total)}`;
  if (progress.stage === "verify") return "checking the download…";
  return "restarting…";
}

function progressPercent(progress: Progress | null): number {
  if (!progress) return 0;
  if (progress.stage === "download") return (progress.received / progress.total) * 100;
  return 100;
}

export function App(): ReactElement {
  const [version, setVersion] = useState<string | null>(null);
  const [list, setList] = useState<ReleaseList | null>(null);
  const [checking, setChecking] = useState(false);
  const [installingTag, setInstallingTag] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<{ text: string; url?: string } | null>(null);

  const check = useCallback(async (): Promise<void> => {
    setChecking(true);
    setList(await window.electronAPI.updates.listReleases());
    setChecking(false);
  }, []);

  // When the app cannot replace itself, the error carries the release page to open instead.
  const install = async (release: Release): Promise<void> => {
    setError(null);
    setProgress(null);
    setInstallingTag(release.tag);
    const result = await window.electronAPI.updates.install(release.tag);
    if (!result.ok) {
      setInstallingTag(null);
      setError({ text: result.error, url: result.url });
    }
  };

  useEffect(() => {
    void window.electronAPI.system.getAppInfo().then((info) => setVersion(info.version));
    void check();
  }, [check]);

  useEffect(() => window.electronAPI.menu.onCheckForUpdates(() => void check()), [check]);
  useEffect(() => window.electronAPI.updates.onProgress(setProgress), []);
  // Nothing is ever pending: acknowledge at once.
  useEffect(
    () => window.electronAPI.app.onBeforeQuit(() => window.electronAPI.app.sendQuitAck()),
    [],
  );

  const releases = list?.ok ? list.releases : [];
  const latest = releases[0];
  const hue = version ? versionHue(version) : 0;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <WindowTitleBar />
      <main className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        <section
          className="flex items-center gap-4 rounded-xl p-5 text-white"
          style={{ backgroundColor: `oklch(0.55 0.18 ${hue})` }}
        >
          <span className="text-4xl font-bold">v{version ?? "…"}</span>
          <span className="text-sm opacity-90">{WHATS_NEW}</span>
        </section>

        {latest?.relation === "newer" && !installingTag && (
          <section className="flex items-center justify-between rounded-xl border p-4">
            <span>Version {latest.version} is available.</span>
            <Button onClick={() => void install(latest)}>Update now</Button>
          </section>
        )}

        {installingTag && (
          <section className="flex flex-col gap-2 rounded-xl border p-4">
            <span>
              Installing {installingTag}: {progress ? progressLabel(progress) : "starting…"}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent(progress)}%` }}
              />
            </div>
          </section>
        )}

        {error && (
          <section className="flex items-center justify-between gap-4 rounded-xl border border-destructive p-4 text-destructive">
            <span>{error.text}</span>
            {error.url && (
              <Button variant="outline" onClick={() => window.open(error.url)}>
                Open the release page
              </Button>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void check()} disabled={checking}>
              {checking ? "Checking…" : "Check for updates"}
            </Button>
            {list?.ok && latest?.relation !== "newer" && !checking && (
              <span className="text-sm text-muted-foreground">You are up to date.</span>
            )}
            {list && !list.ok && <span className="text-sm text-destructive">{list.error}</span>}
          </div>
          {list?.ok && !list.canInstall && (
            <span className="text-sm text-muted-foreground">{list.reason}</span>
          )}
          <ul className="flex flex-col divide-y rounded-xl border">
            {releases.map((release) => (
              <li key={release.tag} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {release.tag}
                    {release.relation === "current" && (
                      <span className="ml-2 text-xs text-muted-foreground">installed</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(release.publishedAt).toLocaleString()}
                    {release.size !== null && ` · ${megabytes(release.size)}`}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={release.relation === "newer" ? "default" : "outline"}
                  disabled={release.relation === "current" || installingTag !== null}
                  onClick={() => void install(release)}
                >
                  {release.relation === "older" ? "Downgrade" : "Install"}
                </Button>
              </li>
            ))}
            {list?.ok && releases.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">No release published yet.</li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
