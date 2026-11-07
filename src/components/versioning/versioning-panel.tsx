import { type ReactElement, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { InstallProgress, ReleaseCheck } from "../../../versioning/updater";
import { InstallProgressBar } from "./install-progress-bar";
import { ReleaseRow } from "./release-row";

type InstallError = { message: string; releasePage: string | null };

export function VersioningPanel(): ReactElement {
  const [check, setCheck] = useState<ReleaseCheck | null>(null);
  const [pendingChecks, setPendingChecks] = useState(0);
  const [installingTag, setInstallingTag] = useState<string | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState<InstallError | null>(null);

  // The launch check stays silent when it fails (offline, rate limit); a manual check always answers.
  const runCheck = useCallback(async (manual: boolean): Promise<void> => {
    setPendingChecks((count) => count + 1);
    const result = await window.electronAPI.versioning.listReleases();
    setPendingChecks((count) => count - 1);
    if (result.ok && manual) setInstallError(null);
    if (result.ok || manual) setCheck(result);
  }, []);

  const install = async (tag: string): Promise<void> => {
    setInstallError(null);
    setProgress(null);
    setInstallingTag(tag);
    const result = await window.electronAPI.versioning.install(tag);
    if (result.ok) return;
    setInstallingTag(null);
    setInstallError({ message: result.error, releasePage: result.releasePage });
  };

  useEffect(() => {
    void window.electronAPI.versioning.lastUpdateFailure().then((message) => {
      if (message) setInstallError({ message, releasePage: null });
    });
    void runCheck(false);
  }, [runCheck]);
  useEffect(() => window.electronAPI.menu.onCheckForUpdates(() => void runCheck(true)), [runCheck]);
  useEffect(() => window.electronAPI.versioning.onProgress(setProgress), []);

  const releases = check?.ok ? check.releases : [];
  const latest = releases[0];
  const updateAvailable = latest?.relation === "newer" && latest.dmgSize !== null;
  const releasePage = installError?.releasePage ?? null;
  // The launch check and a manual one can overlap: the button waits for both.
  const checking = pendingChecks > 0;

  return (
    <>
      {updateAvailable && !installingTag && (
        <section className="flex items-center justify-between rounded-xl border p-4">
          <span>Version {latest.version} is available.</span>
          <Button onClick={() => void install(latest.tag)}>Update now</Button>
        </section>
      )}

      {installingTag && <InstallProgressBar tag={installingTag} progress={progress} />}

      {installError && (
        <section className="flex items-center justify-between gap-4 rounded-xl border border-destructive p-4 text-destructive">
          <span>{installError.message}</span>
          {releasePage && (
            <Button variant="outline" onClick={() => window.open(releasePage)}>
              Open the release page
            </Button>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => void runCheck(true)} disabled={checking}>
            {checking ? "Checking…" : "Check for updates"}
          </Button>
          {check?.ok && latest?.relation !== "newer" && !checking && (
            <span className="text-sm text-muted-foreground">You are up to date.</span>
          )}
          {check && !check.ok && <span className="text-sm text-destructive">{check.error}</span>}
        </div>
        {check?.ok && check.blocker && check.blocker !== installError?.message && (
          <span className="text-sm text-muted-foreground">{check.blocker}</span>
        )}
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">
          {releases.map((release) => (
            <ReleaseRow
              key={release.tag}
              release={release}
              busy={installingTag !== null}
              onInstall={(tag) => void install(tag)}
            />
          ))}
          {check?.ok && releases.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">No release published yet.</li>
          )}
        </ul>
      </section>
    </>
  );
}
