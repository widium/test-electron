import { BrowserWindow } from "electron";

import {
  install as installRelease,
  type InstallProgress,
  type InstallResult,
} from "../../../versioning/updater";
import { CHANNELS } from "../channels";

export { lastUpdateFailure, listReleases } from "../../../versioning/updater";

export interface VersioningEvents {
  onProgress: (callback: (progress: InstallProgress) => void) => () => void;
}

function sendProgress(progress: InstallProgress): void {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.isDestroyed()) window.webContents.send(CHANNELS.progress, progress);
}

export function install(tag: string): Promise<InstallResult> {
  return installRelease(tag, sendProgress);
}
