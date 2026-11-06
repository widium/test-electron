import { app, BrowserWindow, dialog } from "electron";

import { CHANNELS } from "./ipc/channels";
import { setupApplicationMenu } from "./ipc/handlers/menu";
import { createMainWindow, watchNativeTheme } from "./ipc/handlers/system";
import { onQuitAck, registerIPC } from "./ipc/server";

// The renderer gets this long to save before the app quits anyway (crash, freeze).
const QUIT_FLUSH_TIMEOUT_MS = 5000;

let quitting = false;

async function start(): Promise<void> {
  registerIPC();
  watchNativeTheme();
  setupApplicationMenu();
  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}

// Without a window the app would sit in the Dock with nothing to see: say why, then quit.
app
  .whenReady()
  .then(start)
  .catch((error) => {
    console.error("startup_failed", error);
    dialog.showErrorBox(
      `${app.getName()} could not start`,
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// The renderer may hold writes not yet saved: ask it to flush, then quit on its answer.
app.on("before-quit", (event) => {
  const window = BrowserWindow.getAllWindows()[0];
  if (quitting || !window || window.isDestroyed()) return;
  quitting = true;
  event.preventDefault();
  const fallback = setTimeout(() => {
    console.error("quit_flush_timeout");
    app.quit();
  }, QUIT_FLUSH_TIMEOUT_MS);
  onQuitAck(() => {
    clearTimeout(fallback);
    console.log("quit_ack_received");
    app.quit();
  });
  window.webContents.send(CHANNELS.beforeQuit);
});

process.on("SIGINT", () => app.quit());
process.on("SIGTERM", () => app.quit());
