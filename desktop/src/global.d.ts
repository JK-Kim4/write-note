import type { ElectronAPI } from "../electron/ipc/contract";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
