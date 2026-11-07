import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

import { stageBundle } from "./bundle";
import { downloadVerified } from "./download";
import { fetchReleases, type PublishedRelease } from "./github";
import installScript from "./install.sh?raw";
import { installBlocker, installedBundle } from "./location";

export type Release = {
  tag: string;
  version: string;
  publishedAt: string;
  // null: the release has no DMG that can be verified, so it cannot be installed.
  dmgSize: number | null;
  relation: "current" | "newer" | "older";
};

export type ReleaseCheck =
  | { ok: true; releases: Release[]; blocker: string | null }
  | { ok: false; error: string };

export type InstallProgress =
  | { stage: "download"; received: number; total: number }
  | { stage: "verify" | "restart" };

export type InstallResult = { ok: true } | { ok: false; error: string; releasePage: string | null };

type LoadedReleases = { ok: true; releases: PublishedRelease[] } | { ok: false; error: string };

const LIST_FAILURES = {
  rate_limited: "GitHub's request limit is reached for now. Try again within the hour.",
  unavailable: "Could not get the releases from GitHub. Check your connection, then try again.",
} as const;

const INSTALL_FAILURES: Record<InstallProgress["stage"], string> = {
  download: "The download failed or did not match the release. Nothing was changed.",
  verify: "The new version failed its checks. Nothing was changed.",
  restart: "The update could not start. Nothing was changed.",
};

// Passed by install.sh when it relaunches the old version after a failed replacement.
const UPDATE_FAILED_FLAG = "--update-failed";

let installing = false;

function updateLogPath(): string {
  return path.join(app.getPath("logs"), "update.log");
}

function describe(detail: unknown): string {
  return detail instanceof Error ? (detail.stack ?? detail.message) : String(detail);
}

// Console output is lost once the app is launched from the Finder: update.log keeps the trace.
async function logUpdate(event: string, ...details: unknown[]): Promise<void> {
  console.log(event, ...details);
  const line = [new Date().toISOString(), event, ...details.map(describe)].join(" ");
  try {
    await fs.mkdir(path.dirname(updateLogPath()), { recursive: true });
    await fs.appendFile(updateLogPath(), `${line}\n`);
  } catch (error) {
    console.error("update_log_write_failed", error);
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    const difference = (leftParts[i] ?? 0) - (rightParts[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function toRelease(release: PublishedRelease, installedVersion: string): Release {
  const order = compareVersions(release.version, installedVersion);
  return {
    tag: release.tag,
    version: release.version,
    publishedAt: release.publishedAt,
    dmgSize: release.dmg?.size ?? null,
    relation: order === 0 ? "current" : order > 0 ? "newer" : "older",
  };
}

async function loadReleases(): Promise<LoadedReleases> {
  const result = await fetchReleases();
  if (result.ok) return result;
  await logUpdate("versioning_list_failed", result.reason, result.error);
  return { ok: false, error: LIST_FAILURES[result.reason] };
}

export async function listReleases(): Promise<ReleaseCheck> {
  const loaded = await loadReleases();
  if (!loaded.ok) return loaded;
  const releases = loaded.releases
    .map((release) => toRelease(release, app.getVersion()))
    .sort((a, b) => compareVersions(b.version, a.version));
  return { ok: true, releases, blocker: await installBlocker() };
}

export function lastUpdateFailure(): string | null {
  if (!process.argv.includes(UPDATE_FAILED_FLAG)) return null;
  return `The last update could not be installed. You are still on version ${app.getVersion()}.`;
}

// The replacement runs after the app has exited, from outside its bundle: install.sh, detached.
async function handOff(newApp: string): Promise<void> {
  await fs.mkdir(path.dirname(updateLogPath()), { recursive: true });
  const log = await fs.open(updateLogPath(), "a");
  try {
    const args = [newApp, installedBundle(), String(process.pid)];
    const child = spawn("/bin/sh", ["-c", installScript, "install.sh", ...args], {
      detached: true,
      stdio: ["ignore", log.fd, log.fd],
    });
    child.once("error", (error) => void logUpdate("versioning_handoff_failed", error));
    child.unref();
  } finally {
    await log.close();
  }
}

// Never throws: every failure becomes a result, so the caller can always release the guard.
async function installTag(
  tag: string,
  onProgress: (progress: InstallProgress) => void,
): Promise<InstallResult> {
  const loaded = await loadReleases();
  if (!loaded.ok) return { ok: false, error: loaded.error, releasePage: null };
  const release = loaded.releases.find((candidate) => candidate.tag === tag);
  if (!release) {
    await logUpdate("versioning_unknown_tag", tag);
    return { ok: false, error: `${tag} is not a published release.`, releasePage: null };
  }
  const blocker = await installBlocker();
  if (blocker) return { ok: false, error: blocker, releasePage: release.pageUrl };
  const { dmg } = release;
  if (!dmg)
    return {
      ok: false,
      error: "This release has no verified download.",
      releasePage: release.pageUrl,
    };

  let stage: InstallProgress["stage"] = "download";
  let workDir: string | null = null;
  try {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), `${app.getName()} update-`));
    const dmgFile = path.join(workDir, "update.dmg");
    await downloadVerified(dmg, dmgFile, (received) =>
      onProgress({ stage: "download", received, total: dmg.size }),
    );
    stage = "verify";
    onProgress({ stage });
    const newApp = await stageBundle(dmgFile, workDir, release.version);
    stage = "restart";
    onProgress({ stage });
    await handOff(newApp);
    await logUpdate("versioning_handed_off", tag);
    return { ok: true };
  } catch (error) {
    await logUpdate("versioning_install_failed", tag, stage, error);
    if (workDir)
      await fs
        .rm(workDir, { recursive: true, force: true })
        .catch((cleanupError: unknown) => logUpdate("versioning_cleanup_failed", cleanupError));
    return { ok: false, error: INSTALL_FAILURES[stage], releasePage: release.pageUrl };
  }
}

// Only a tag the GitHub API lists can be installed: the page never passes a URL or a path.
export async function install(
  tag: string,
  onProgress: (progress: InstallProgress) => void,
): Promise<InstallResult> {
  if (installing) return { ok: false, error: "An update is already running.", releasePage: null };
  installing = true;
  const result = await installTag(tag, onProgress);
  installing = result.ok;
  // The normal quit path, so the renderer flushes first; install.sh waits for this pid to exit.
  if (result.ok) app.quit();
  return result;
}
