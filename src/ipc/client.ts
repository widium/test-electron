import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";

import { CHANNELS } from "./channels";
import type { ElectronAPI } from "./types";

// Every push event returns its unsubscribe function: the consumer must call it, nothing cleans up for it.
function subscribe<A extends unknown[]>(
  channel: string,
  callback: (...args: A) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, ...args: A): void => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

export function exposeIPC(): void {
  const api: ElectronAPI = {
    system: {
      getAppInfo: () => ipcRenderer.invoke(CHANNELS.getAppInfo),
      isDarkTheme: () => ipcRenderer.invoke(CHANNELS.isDarkTheme),
      onThemeChange: (callback) => subscribe(CHANNELS.themeChange, callback),
    },
    updates: {
      listReleases: () => ipcRenderer.invoke(CHANNELS.listReleases),
      install: (tag) => ipcRenderer.invoke(CHANNELS.install, tag),
      onProgress: (callback) => subscribe(CHANNELS.progress, callback),
    },
    menu: {
      onCheckForUpdates: (callback) => subscribe(CHANNELS.checkForUpdates, callback),
    },
    app: {
      onBeforeQuit: (callback) => subscribe(CHANNELS.beforeQuit, callback),
      sendQuitAck: () => ipcRenderer.send(CHANNELS.quitAck),
    },
  };
  contextBridge.exposeInMainWorld("electronAPI", api);
}
