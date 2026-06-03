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
    title: "write-note",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      // renderer(웹 페이지)의 Node 직접 접근 차단 + preload 컨텍스트 격리.
      // sandbox 는 false — ESM preload 사용 + 로컬 전용 앱이라 OS 샌드박스 생략 (DESIGN 결정).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
  registerHandlers(new Store(createDb(dbPath)));

  createWindow();

  // macOS: dock 아이콘 클릭 시 창이 없으면 재생성한다.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS 를 제외하면 모든 창이 닫힐 때 앱을 종료한다.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
