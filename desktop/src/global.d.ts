// preload(electron/preload.ts)의 contextBridge.exposeInMainWorld 가 renderer 에 노출하는 API 의 타입.
export type ElectronAPI = {
  readonly platform: NodeJS.Platform;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
