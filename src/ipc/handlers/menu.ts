import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";

import { CHANNELS } from "../channels";

export interface MenuEvents {
  onCheckForUpdates: (callback: () => void) => () => void;
}

// Menu items act on the window the user is looking at, through a push event.
function sendToFocused(channel: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel);
}

// Replaces Electron's default menu entirely: the Edit roles must be listed again, or copy and
// paste stop working in every text field.
export function setupApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { label: "Check for Updates…", click: () => sendToFocused(CHANNELS.checkForUpdates) },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
