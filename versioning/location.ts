import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

// `<bundle>.app/Contents/MacOS/<executable>`: the bundle is three levels up.
export function installedBundle(): string {
  return path.resolve(app.getPath("exe"), "../../..");
}

// The installed bundle is replaced where it is: that needs a real, writable install location.
export async function installBlocker(): Promise<string | null> {
  if (!app.isPackaged) return "Updates install only in the packaged app.";
  const bundle = installedBundle();
  if (bundle.startsWith("/Volumes/"))
    return "The app runs from a disk image. Move it to Applications to update it.";
  if (bundle.includes("/AppTranslocation/"))
    return "macOS runs this app from a temporary copy. Move it to Applications, then open it again.";
  try {
    await fs.access(path.dirname(bundle), fs.constants.W_OK);
  } catch {
    return "The app's folder is not writable, so the app cannot update itself.";
  }
  return null;
}
