import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import { promisify } from "node:util";
import { app, BrowserWindow } from "electron";

import { CHANNELS } from "../channels";
import swapScript from "./update-swap.sh?raw";

const run = promisify(execFile);

const REPO = "widium/test-electron";
const ASSET_NAME = "TestElectron-darwin-arm64.dmg";
const BUNDLE_ID = "com.bidium.test-electron";
// GitHub refuses API requests without a User-Agent (403).
const API_HEADERS = { "User-Agent": "test-electron", Accept: "application/vnd.github+json" };

export type Release = {
  tag: string;
  version: string;
  publishedAt: string;
  url: string;
  size: number | null;
  relation: "current" | "newer" | "older";
};

export type ReleaseList =
  | { ok: true; current: string; releases: Release[]; canInstall: boolean; reason?: string }
  | { ok: false; error: string };

export type InstallResult = { ok: true } | { ok: false; error: string; url?: string };

export type InstallProgress =
  | { stage: "download"; received: number; total: number }
  | { stage: "verify" | "restart" };

export interface UpdatesEvents {
  onProgress: (callback: (progress: InstallProgress) => void) => () => void;
}

type GitHubAsset = {
  name: string;
  size: number;
  digest: string | null;
  browser_download_url: string;
};
type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
};

let installing = false;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// `.app/Contents/MacOS/<exe>`: the bundle is three levels up.
function bundlePath(): string {
  return path.resolve(app.getPath("exe"), "../../..");
}

// The swap replaces the bundle in place: it needs a writable folder and a real install location,
// not a mounted DMG or the read-only copy macOS runs a quarantined app from.
async function installBlocker(): Promise<string | null> {
  if (!app.isPackaged) return "Installing is disabled in dev: package the app first.";
  const bundle = bundlePath();
  if (bundle.startsWith("/Volumes/")) return "The app runs from a disk image.";
  if (bundle.includes("/AppTranslocation/")) return "macOS runs this app from a translocated copy.";
  try {
    await fsp.access(path.dirname(bundle), fs.constants.W_OK);
  } catch {
    return `${path.dirname(bundle)} is not writable.`;
  }
  return null;
}

async function fetchReleases(): Promise<GitHubRelease[]> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
    headers: API_HEADERS,
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
  const releases = (await response.json()) as GitHubRelease[];
  return releases.filter((release) => !release.draft && !release.prerelease);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendProgress(progress: InstallProgress): void {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.isDestroyed()) window.webContents.send(CHANNELS.progress, progress);
}

export async function listReleases(): Promise<ReleaseList> {
  const current = app.getVersion();
  try {
    const releases = (await fetchReleases())
      .map((release): Release => {
        const version = release.tag_name.replace(/^v/, "");
        const order = compareVersions(version, current);
        return {
          tag: release.tag_name,
          version,
          publishedAt: release.published_at,
          url: release.html_url,
          size: release.assets.find((asset) => asset.name === ASSET_NAME)?.size ?? null,
          relation: order === 0 ? "current" : order > 0 ? "newer" : "older",
        };
      })
      .sort((a, b) => compareVersions(b.version, a.version));
    const reason = await installBlocker();
    return {
      ok: true,
      current,
      releases,
      canInstall: reason === null,
      reason: reason ?? undefined,
    };
  } catch (error) {
    console.error("updates_list_failed", error);
    return { ok: false, error: `Could not reach GitHub: ${message(error)}` };
  }
}

async function download(asset: GitHubAsset, file: string): Promise<string> {
  const response = await fetch(asset.browser_download_url, { headers: API_HEADERS });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}).`);
  const total = Number(response.headers.get("content-length")) || asset.size;
  const hash = createHash("sha256");
  const out = fs.createWriteStream(file);
  let received = 0;
  let lastPercent = -1;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    received += chunk.length;
    if (!out.write(chunk)) await once(out, "drain");
    const percent = Math.floor((received / total) * 100);
    if (percent !== lastPercent) {
      lastPercent = percent;
      sendProgress({ stage: "download", received, total });
    }
  }
  out.end();
  await finished(out);
  return hash.digest("hex");
}

async function readPlist(bundle: string, key: string): Promise<string> {
  const { stdout } = await run("/usr/libexec/PlistBuddy", [
    "-c",
    `Print ${key}`,
    path.join(bundle, "Contents/Info.plist"),
  ]);
  return stdout.trim();
}

// Downloads the DMG of that exact release, checks it, stages the new bundle next to the
// download, and hands the swap to a script that outlives the app.
async function prepare(release: GitHubRelease, workDir: string): Promise<string> {
  const asset = release.assets.find((candidate) => candidate.name === ASSET_NAME);
  if (!asset) throw new Error(`The release has no ${ASSET_NAME}.`);
  if (!asset.digest?.startsWith("sha256:")) throw new Error("The release gives no SHA-256 digest.");

  const dmg = path.join(workDir, "update.dmg");
  const actual = await download(asset, dmg);
  sendProgress({ stage: "verify" });
  if (actual !== asset.digest.slice("sha256:".length))
    throw new Error("The download does not match the release's digest.");

  const mount = path.join(workDir, "mount");
  const staged = path.join(workDir, "stage", path.basename(bundlePath()));
  await run("hdiutil", ["attach", dmg, "-nobrowse", "-readonly", "-quiet", "-mountpoint", mount]);
  try {
    await run("ditto", [path.join(mount, path.basename(bundlePath())), staged]);
  } finally {
    await run("hdiutil", ["detach", mount, "-quiet"]).catch(() => {});
    await fsp.rm(dmg, { force: true });
  }

  const version = release.tag_name.replace(/^v/, "");
  if ((await readPlist(staged, "CFBundleIdentifier")) !== BUNDLE_ID)
    throw new Error("The new app has another bundle ID.");
  if ((await readPlist(staged, "CFBundleShortVersionString")) !== version)
    throw new Error(`The new app is not version ${version}.`);
  await run("codesign", ["--verify", "--deep", "--strict", staged]).catch(() => {
    throw new Error("The new app's signature is invalid.");
  });
  return staged;
}

// Only a tag the GitHub API lists can be installed: the page never passes a URL or a path.
export async function install(tag: string): Promise<InstallResult> {
  const blocker = await installBlocker();
  let release: GitHubRelease | undefined;
  try {
    release = (await fetchReleases()).find((candidate) => candidate.tag_name === tag);
  } catch (error) {
    return { ok: false, error: `Could not reach GitHub: ${message(error)}` };
  }
  if (!release) return { ok: false, error: `${tag} is not a published release.` };
  if (blocker) return { ok: false, error: blocker, url: release.html_url };
  if (installing) return { ok: false, error: "An update is already running." };
  installing = true;

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "test-electron-update-"));
  try {
    const staged = await prepare(release, workDir);
    const script = path.join(workDir, "swap.sh");
    await fsp.writeFile(script, swapScript, { mode: 0o755 });
    await fsp.mkdir(app.getPath("logs"), { recursive: true });
    const log = fs.openSync(path.join(app.getPath("logs"), "update.log"), "a");
    spawn("/bin/sh", [script, String(process.pid), staged, bundlePath(), workDir], {
      detached: true,
      stdio: ["ignore", log, log],
    }).unref();
    fs.closeSync(log);
    console.log("update_handed_to_swap", tag);
    sendProgress({ stage: "restart" });
    // The normal quit path, so the renderer flushes first; the script waits for this pid to exit.
    app.quit();
    return { ok: true };
  } catch (error) {
    console.error("update_failed", tag, error);
    installing = false;
    await fsp.rm(workDir, { recursive: true, force: true });
    return { ok: false, error: message(error), url: release.html_url };
  }
}
