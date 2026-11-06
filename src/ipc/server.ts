import { ipcMain } from "electron";

import { CHANNELS } from "./channels";
import * as system from "./handlers/system";
import * as updates from "./handlers/updates";

export function registerIPC(): void {
  ipcMain.handle(CHANNELS.getAppInfo, () => system.getAppInfo());
  ipcMain.handle(CHANNELS.isDarkTheme, () => system.isDarkTheme());
  ipcMain.handle(CHANNELS.listReleases, () => updates.listReleases());
  ipcMain.handle(CHANNELS.install, (_event, tag: string) => updates.install(tag));
}

export function onQuitAck(callback: () => void): void {
  ipcMain.once(CHANNELS.quitAck, callback);
}
