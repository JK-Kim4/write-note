import { contextBridge } from "electron";

// renderer 는 Node/Electron API 에 직접 접근하지 않는다.
// 여기서 명시적으로 노출한 것만 window.electronAPI 로 보인다.
// Phase 1 은 IPC 가 거의 없어 플랫폼 정보만 read-only 로 노출한다.
// (로컬 persistence IPC 는 Phase 2 에서 추가)
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
