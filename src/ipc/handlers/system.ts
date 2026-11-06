import path from "node:path";
import { app, BrowserWindow, nativeTheme, shell } from "electron";

import { CHANNELS } from "../channels";

// Height of the custom title bar, in the renderer too (`h-[30px]`).
const TITLE_BAR_HEIGHT = 30;

export interface SystemEvents {
  onThemeChange: (callback: (isDark: boolean) => void) => () => void;
}

export function getAppInfo(): { name: string; version: string } {
  return { name: app.getName(), version: app.getVersion() };
}

export function isDarkTheme(): boolean {
  return nativeTheme.shouldUseDarkColors;
}

export function watchNativeTheme(): void {
  nativeTheme.on("updated", () => {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.isDestroyed())
        window.webContents.send(CHANNELS.themeChange, nativeTheme.shouldUseDarkColors);
  });
}

function openInBrowser(url: string): void {
  if (new URL(url).protocol === "https:") void shell.openExternal(url);
}

// The preload runs in every page this window loads: it must never leave the app's own page.
// A navigation to the current URL is a reload (Vite's included), and stays allowed.
function lockNavigation(window: BrowserWindow): void {
  window.webContents.on("will-navigate", (event) => {
    if (event.url === window.webContents.getURL()) return;
    event.preventDefault();
    openInBrowser(event.url);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: "deny" };
  });
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    titleBarStyle: "hidden",
    titleBarOverlay: { height: TITLE_BAR_HEIGHT },
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  lockNavigation(window);
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    window.webContents.openDevTools();
  } else {
    await window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  return window;
}
