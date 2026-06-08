# Phase 1: Electron/Vite Desktop App Scaffold

## 목표

`desktop/` 앱이 독립적으로 설치, 실행, 빌드되는 최소 Electron shell을 만든다.

## 범위

- `desktop/` package 생성.
- Electron main/preload/renderer 기본 연결.
- Vite React TypeScript 환경 구성.
- 기본 window title과 빈 Focus Studio shell 화면 추가.
- `dev`, `build`, `typecheck`, `test` script의 최소 기준 정의.

## 제외

- 로컬 DB 구현.
- 프로젝트/문서/메모 기능 구현.
- 기존 `frontend/` 또는 `backend` 재사용 결선.
- 기존 WEB 디자인 이식.

## 작업 지침

1. `desktop/`을 독립 앱으로 생성한다.
2. Electron main process와 renderer process의 책임을 분리한다.
3. preload를 통해 필요한 API만 노출할 수 있는 구조를 만든다.
4. renderer에서 Node API에 직접 접근하지 않도록 한다.
5. 첫 화면은 Focus Studio 방향의 빈 shell만 둔다.
6. 테스트가 아직 적더라도 `pnpm test`가 실행 가능한 상태를 만든다.

## 완료 기준

- `desktop/`에서 Electron window가 뜬다.
- `frontend/` dev server나 `backend` 실행 없이 동작한다.
- renderer와 main process가 분리되어 있다.
- renderer가 Node API에 직접 접근하지 않는다.

## 검증

```bash
cd desktop
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

## 권장 커밋

```bash
git commit -m "feat(desktop): scaffold Electron app"
```

---

## 기술 결정 (2026-06-03 공식 문서 검증)

렌더러 부분(Vite + React 19 + TipTap)은 완료된 상태이며, 남은 작업은 **Electron 패키징**이다. 아래는 빌드 도구·보안·구조에 대한 공식 문서 기반 검증 결과다. 추측이 아닌 항목과 **실측이 필요한 미확인 항목**을 구분해 박는다.

### 1. 빌드 도구 — `vite-plugin-electron` (0.x 라인, `^0.29`)

| 항목 | 결정 |
|---|---|
| 선택 | `vite-plugin-electron@^0.29` — 기존 `vite.config.ts` `plugins` 배열에 플러그인 1개만 추가, **디렉토리 재배치 0**. 렌더러는 현재 `src/` + 루트 `index.html` 그대로 유지 |
| 대안 기각 | `electron-vite`(alex8088, v5) — 규약상 렌더러를 `src/renderer/` 로 옮기고 `index.html` 도 재배치해야 함. 마이그레이션 변경량 과다 |
| 버전 핀 근거 | 현재 환경은 **Vite 5**. `vite-plugin-electron` v1.0.0(2026-05-31)은 Vite 7/8 대상이라 Vite 5 호환이 릴리스 노트에 명시되지 않음 → **0.x 라인 핀 고정** |

### 2. Electron 버전 / pnpm 설치

- Electron 최신 stable **v42.x** (Node.js 24.x 번들 / Chromium 148). devDependency `electron@^42`.
- pnpm 은 Electron postinstall 바이너리 다운로드 + flat node_modules 가 필요 → 신규 `desktop/.npmrc` 에 **`node-linker=hoisted`**. (단 이 권장은 pnpm/forge 측 근거이며 Electron 공식 설치 문서에는 pnpm 전용 가이드 없음.)
- **Node ≥ 20.19 필수 (구현 시 실측 발견).** electron 42 의 `install.js` 가 `@electron/get`(ESM)을 `require` 하는데, `require(ESM)` 은 **Node 20.19.0 부터 기본 활성** — Node 20.10.0 에서는 `ERR_REQUIRE_ESM` 으로 바이너리 설치가 실패한다. `desktop/.nvmrc` 에 **`20.20.1`**(lts/iron) 핀. 또한 pnpm 8 은 build script 를 차단하므로 `package.json` `pnpm.onlyBuiltDependencies: ["electron"]` 로 postinstall 을 승인한다.

### 3. 보안 webPreferences — 기본값이 곧 권장값

Electron 공식 Security 문서 기준, 아래 3개는 **현재 Electron 기본값 자체가 권장값**이라 명시 설정 없이도 Phase 1 완료 기준("renderer 가 Node API 직접 접근 안 함")을 충족한다. 방어적으로 명시한다면 같은 값으로 박는다.

| 옵션 | 권장값 | 기본화 시점 |
|---|---|---|
| `contextIsolation` | `true` | Electron 12+ |
| `nodeIntegration` | `false` | Electron 5+ |
| `sandbox` | `true` | Electron 20+ |

> **구현 결정(2026-06-03):** `sandbox` 는 **`false`** 로 채택. `sandbox:true` 는 ESM preload(`.mjs`)를 막아(공식 ESM 문서: sandbox 환경 preload 는 CommonJS 만) `vite-plugin-electron` 표준 출력(`preload.mjs`)과 충돌하고 Phase 2 로컬 persistence IPC 작성을 제약한다. write-note 는 원격 콘텐츠를 띄우지 않는 **로컬 전용 앱**이라 OS 샌드박스 생략의 위험 표면이 작다. renderer 격리는 `contextIsolation:true` + `nodeIntegration:false` 로 유지되어 완료기준("renderer 가 Node API 직접 접근 안 함")을 충족한다. (출처: https://www.electronjs.org/docs/latest/tutorial/esm)

### 4. preload + contextBridge 패턴

renderer 가 Node/Electron API 에 직접 접근하지 않고 필요한 기능만 노출한다. (Phase 1 은 IPC 가 거의 없으므로 preload 는 최소 골격만.)

```js
// electron/preload.ts
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
  // 예: doThing: () => ipcRenderer.invoke('do-a-thing'),
})
```

- 노출 값은 copy + frozen. raw `ipcRenderer` 통째 노출 금지(29.0.0+ 차단).
- TS 타입: `electron` 패키지에 타입 **내장**(별도 `@types` 불필요). renderer 측은 `global.d.ts` 에 `declare global { interface Window { electronAPI: IElectronAPI } }` 로 전역 확장.

### 5. main 의 dev/prod 로드 분기 — 프로젝트 결정 영역

> ⚠️ Electron 공식 튜토리얼에는 Vite dev server URL(`loadURL`) vs 빌드 파일(`loadFile`) 분기 **권장 패턴이 없다**. `vite-plugin-electron` 이 dev 시 `VITE_DEV_SERVER_URL` 환경변수를 주입하므로 이를 기준으로 분기한다.

```ts
// electron/main.ts (개념)
if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL)
else win.loadFile(path.join(__dirname, '../dist/index.html'))
```

### 6. 폰트 (CDN → 로컬 번들)

- 현재 `index.html` 은 Google Fonts CDN(`fonts.googleapis.com`)을 로드한다(개발용, 주석에 명시됨).
- Electron 보안 문서는 CDN vs 로컬을 직접 비교·권장하지 않으나, CSP 를 `default-src 'self'` 로 좁게 유지하려면 외부 origin 허용이 보안 표면을 넓힌다 → **로컬 woff2 subset 번들이 유리**(DESIGN.md 주석의 기존 방침과 정합).
- `file://` 로딩 환경에서 CDN 폰트 동작 여부는 공식 문서에서 **확인 못함** → 아래 실측 항목.

### 7. 신규 / 변경 파일 (최소 통합)

| 파일 | 작업 |
|---|---|
| `desktop/electron/main.ts` | 신규 — `BrowserWindow` 생성 + dev/prod 로드 분기 |
| `desktop/electron/preload.ts` | 신규 — contextBridge 최소 골격 |
| `desktop/vite.config.ts` | 변경 — `base:'./'` + `electron({ main, preload })` 플러그인 추가 (`renderer` 옵션은 불필요해 제거) |
| `desktop/package.json` | 변경 — `electron@^42` + `vite-plugin-electron@^0.29` + `vitest`/`jsdom`/`@testing-library/*` devDep, `main` 필드, `typecheck`/`test` 스크립트, `pnpm.onlyBuiltDependencies` |
| `desktop/.npmrc` | 신규 — `node-linker=hoisted` |
| `desktop/.nvmrc` | 신규 — `20.20.1` (Node 핀, require(ESM) 백포트) |
| `desktop/src/global.d.ts` | 신규 — `Window.electronAPI` 타입 선언 |
| `desktop/vitest.config.ts` · `src/test-setup.ts` · `src/components/Rail.test.tsx` | 신규 — 테스트 최소 기준(jsdom + smoke 1건) |

### 실측 결과 (2026-06-03 Phase 1 구현 시 해소)

1. **`vite-plugin-electron@0.29` + Vite 5** — ✅ 정상. `pnpm build`/`pnpm dev` 로 main(`dist-electron/main.js`)·preload(`dist-electron/preload.mjs`) 빌드 + Electron 기동 확인. 단 `simple` API 의 `renderer: {}` 옵션은 별도 패키지(`vite-plugin-electron-renderer`)를 요구하므로 **제거**(renderer 가 Node 모듈을 직접 import 하지 않아 불필요).
2. **`file://` 환경 CDN 폰트 동작** — ⏳ 미해소. dev(http)에서는 정상이나 prod `file://` 빌드 로딩은 미검증 → 육안 dogfooding 영역. 안 되면 로컬 woff2 번들로 별도 트랙.
3. **pnpm + electron 바이너리 설치** — ✅ 해소. `node-linker=hoisted` 만으로는 부족 — **Node 20.10.0 의 `require(ESM)` 미지원이 진짜 블로커**였다(§2 갱신). Node **20.20.1** 상향 + `pnpm.onlyBuiltDependencies:["electron"]` 로 electron 42.3.2 설치 성공.

### 출처 (공식 문서·저장소)

- vite-plugin-electron: https://github.com/electron-vite/vite-plugin-electron
- electron-vite(alex8088): https://electron-vite.org/guide/
- Electron stable 릴리스/Node 번들: https://releases.electronjs.org/releases/stable
- Electron Security: https://electronjs.org/docs/latest/tutorial/security
- Process Model: https://electronjs.org/docs/latest/tutorial/process-model
- contextBridge: https://electronjs.org/docs/latest/api/context-bridge
- Context Isolation: https://electronjs.org/docs/latest/tutorial/context-isolation
- Installation: https://electronjs.org/docs/latest/tutorial/installation
- pnpm node-linker: https://pnpm.io/settings
