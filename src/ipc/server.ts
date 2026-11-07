import { ipcMain } from "electron";

import { CHANNELS } from "./channels";
import * as system from "./handlers/system";
import * as versioning from "./handlers/versioning";

export function registerIPC(): void {
  ipcMain.handle(CHANNELS.getAppInfo, () => system.getAppInfo());
  ipcMain.handle(CHANNELS.isDarkTheme, () => system.isDarkTheme());
  ipcMain.handle(CHANNELS.listReleases, () => versioning.listReleases());
  ipcMain.handle(CHANNELS.lastUpdateFailure, () => versioning.lastUpdateFailure());
  ipcMain.handle(CHANNELS.install, (_event, tag: string) => versioning.install(tag));
}

export function onQuitAck(callback: () => void): void {
  ipcMain.once(CHANNELS.quitAck, callback);
}
