import { exposeIPC } from "./ipc/client";
import type { ElectronAPI } from "./ipc/types";

exposeIPC();

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
