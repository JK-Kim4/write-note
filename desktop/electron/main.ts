import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./db/connection";
import { Store } from "./db/store";
import { registerHandlers } from "./ipc/registerHandlers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vite-plugin-electron 은 main/preload 를 dist-electron/ 에, renderer 를 dist/ 에 빌드한다.
const RENDERER_DIST = path.join(__dirname, "../dist");

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    title: "소설비",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      // renderer(웹 페이지)의 Node 직접 접근 차단 + preload 컨텍스트 격리 + OS 샌드박스.
      // sandbox:true — vite-plugin-electron 의 preload 는 CJS(.mjs) 빌드이고, sandboxed preload 는
      // 확장자 무관 CommonJS 로 로드된다(Electron 공식). contextBridge/ipcRenderer 는 sandbox 에서도 가용.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // dev 는 Vite dev server, prod 는 빌드된 index.html(file://) 을 로드한다.
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.whenReady().then(() => {
  // 로컬 DB(node:sqlite) 초기화 + IPC 핸들러 등록 — renderer 는 IPC 로만 접근한다.
  const dbPath = path.join(app.getPath("userData"), "write-note.db");
  const store = new Store(createDb(dbPath));

  // 비정상 종료로 남은 열린 세션을 폐기 (앱 재시작 시 과대 합산 방지).
  store.closeDangling();

  registerHandlers(store);

  createWindow();

  // macOS: dock 아이콘 클릭 시 창이 없으면 재생성한다.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // 앱 종료 전 모든 열린 세션을 종료한다(renderer before-unload 는 신뢰 불가).
  app.on("before-quit", () => {
    store.endAllOpenSessions(new Date().toISOString());
  });
});

// macOS 를 제외하면 모든 창이 닫힐 때 앱을 종료한다.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
