import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { VERSIONING } from "./config";

const run = promisify(execFile);

async function readInfoPlist(bundle: string, key: string): Promise<string> {
  const { stdout } = await run("/usr/libexec/PlistBuddy", [
    "-c",
    `Print ${key}`,
    path.join(bundle, "Contents/Info.plist"),
  ]);
  return stdout.trim();
}

// The DMG is detached and deleted whatever happens: only the copied app stays in the work folder.
async function copyAppFromDmg(dmgFile: string, workDir: string): Promise<string> {
  const mount = path.join(workDir, "mount");
  await run("hdiutil", [
    "attach",
    dmgFile,
    "-nobrowse",
    "-readonly",
    "-quiet",
    "-mountpoint",
    mount,
  ]);
  try {
    const appName = (await fs.readdir(mount)).find((entry) => entry.endsWith(".app"));
    if (!appName) throw new Error("bundle_missing_in_dmg");
    const staged = path.join(workDir, appName);
    await run("ditto", [path.join(mount, appName), staged]);
    return staged;
  } finally {
    await run("hdiutil", ["detach", mount, "-quiet"]).catch((error: unknown) =>
      console.error("dmg_detach_failed", error),
    );
    await fs.rm(dmgFile, { force: true });
  }
}

// Nothing replaces the installed app unless the new one is ours, at that version, validly signed.
export async function stageBundle(
  dmgFile: string,
  workDir: string,
  version: string,
): Promise<string> {
  const staged = await copyAppFromDmg(dmgFile, workDir);
  const bundleId = await readInfoPlist(staged, "CFBundleIdentifier");
  if (bundleId !== VERSIONING.bundleId) throw new Error(`bundle_wrong_id ${bundleId}`);
  const bundleVersion = await readInfoPlist(staged, "CFBundleShortVersionString");
  if (bundleVersion !== version) throw new Error(`bundle_wrong_version ${bundleVersion}`);
  await run("codesign", ["--verify", "--deep", "--strict", staged]);
  return staged;
}
