# 핸드오프 — Desktop MVP 패키징·배포 (런칭 준비)

> **용도:** 기능이 완료된 **로컬 우선 데스크탑 MVP**를 실제 **배포 가능한 산출물(.app/.dmg)**로 패키징하고 런칭 준비를 끝낸다. 다음 세션 첫 입력에 §9 kickoff 프롬프트를 붙여넣으면 된다.
>
> **작성일:** 2026-06-07
> **기준 브랜치:** `develop` (Phase 10 진짜 페이지 분할 merge `a89507d`, origin 동기). 기능 트랙은 여기서 마감.

---

## 0. 한 줄 요약

**기능(MVP 범위)은 완료**(작품·집필·실시간 페이지 분할·메모·연결, Phase 8 "사용 가능 prototype" + Phase 10). **남은 건 배포 트랙뿐** — `electron-builder`는 **설치만 돼 있고 설정이 0**이다. 패키징 설정 → 아이콘 → **macOS 코드 서명/공증** → dmg → 점검이 이 작업의 전부. `node:sqlite`가 **내장**이라 네이티브 모듈 리빌드는 불필요(better-sqlite3 함정 없음).

---

## 1. 현재 상태

- **기능:** 계획 phase 0~8 완료(Phase 8 review gate 판정 = 사용 가능 prototype YES, SC 8/8) + 추가 9'(줄노트)·10(페이지 분할 CSS column-wrap) 완료. 자동 게이트 vitest 179 + tsc + build GREEN. 한글 IME 4케이스 통과.
- **배포:** **미착수.** `desktop/package.json` 에 `electron-builder ^26.8.1` 의존성만 있고 **build(electron-builder) config 없음**. `build` 스크립트 = `tsc --noEmit && vite build`(= renderer + main/preload 빌드일 뿐, 앱 패키징 아님).
- **과거:** Phase 2 개발 중 ad-hoc 패키징을 **한 번** 시도 → pnpm PATH(code 127) + arm64 서명 거부 + dmg 재생성 겪고 임시 해소(vault 회귀 기록). **정식 배포 설정은 커밋된 게 없다.**

---

## 2. MVP 범위 (런칭에 무엇이 들어가고 빠지는가)

`PRODUCT.md` / `docs/phase/README.md` 명시 — **첫 MVP에서 구현하지 않는 것:** 원고지 모드, **모바일 캡처, 인증, 서버 동기화**, 태그, 이유 노트, 등장인물, 검색, **export**, AI.

→ **런칭 = 로컬 전용 단독 데스크탑 앱.** 백엔드(Render/Supabase)·인증·동기·모바일은 **범위 밖**(후속). 따라서 배포에 백엔드는 **불필요**.

---

## 3. 빌드 구조 (검증된 사실 — 2026-06-07 코드 확인)

| 항목 | 값 |
|---|---|
| 앱 name / version | `write-note-desktop` / **`0.0.0`** (버전 체계 필요) |
| Electron main 진입 | `package.json` `"main": "dist-electron/main.js"` |
| 빌드 도구 | `vite-plugin-electron/simple` — main/preload → `dist-electron/`, renderer → `dist/`. `base: "./"`(file:// 상대경로) |
| prod 렌더러 로드 | `electron/main.ts`: `win.loadFile(dist/index.html)`(file://). dev 는 `VITE_DEV_SERVER_URL` |
| 창/보안 | `sandbox: true` + contextIsolation, preload `dist-electron/preload.mjs`(CJS) |
| 로컬 DB | `app.getPath("userData")/write-note.db` = macOS `~/Library/Application Support/write-note-desktop/write-note.db` (+WAL) |
| DB 엔진 | **`node:sqlite` 내장**(Electron 42 = Chromium 148 의 Node). **네이티브 모듈 없음** → `@electron/rebuild`·asarUnpack 불필요 |
| 빌드 산출 | `pnpm build` → `dist/`(renderer) + `dist-electron/`(main.js·preload.mjs) |

**패키징이 포함해야 할 파일:** `dist/`, `dist-electron/`, `package.json`. (node_modules 네이티브 없음 — node:sqlite 내장.)

---

## 4. 사용자 결정 필요 (작업 전 확정)

1. **타깃 OS** — macOS만(1차 사용자=제작자 본인 + 한국어 작가)? Windows/Linux 포함?
2. **서명 수준** — (a) **정식 배포**(타인 기기 실행) = Apple Developer 계정($99/yr) + Developer ID 인증서 + 공증(notarization) 필요 / (b) **본인·지인 한정** = ad-hoc 서명(본인 기기만 실행).
3. **로컬 전용 유지** — MVP대로 로컬 전용 출시(권장, 백엔드 불필요)? 아니면 출시 전 동기/모바일까지(= backend 트랙 재개)?
4. **잔여 papercut** — 굵게(⌘B)-IME([[03-ISSUES]] ISSUE-022, 비차단) 출시 전 처리 여부.
5. **배포 채널** — GitHub Releases / 직접 웹 다운로드 / 기타.

> 기본 권장: **macOS arm64+x64 / 로컬 전용 / 서명 수준은 (2)에서 결정** — 가장 MVP 정합.

---

## 5. 작업 계획 (배포 트랙)

> ⚠️ electron-builder 설정 syntax·서명 옵션은 **electron-builder 26 공식 문서로 검증 후** 박을 것(추측 금지, `agent-workflow-discipline §1`). 아래는 출발점 골격.

### A. electron-builder 설정
- `package.json` 에 `"build"` 키(또는 `electron-builder.yml`): `appId`(예: `com.writenote.desktop`)·`productName`(예: "write-note")·`files`(`dist/**`, `dist-electron/**`, `package.json`)·`directories.output`(예: `release/`)·`mac.target`(dmg+zip)·`mac.arch`([arm64, x64] 또는 universal)·`icon`.
- `version` 0.0.0 → 0.1.0 등.
- `dist`/`package` 스크립트 추가: `pnpm build && electron-builder` (electron-builder 는 **이미 빌드된** dist/·dist-electron/ 을 패키징).

### B. macOS 코드 서명 + 공증 (결정 4-2에 따라)
- **정식:** Developer ID Application 인증서 + electron-builder `mac.hardenedRuntime`·`entitlements` + `afterSign` 공증(notarytool / `@electron/notarize`). Apple ID app-specific password 또는 API key.
- **ad-hoc:** 서명 생략 시 arm64 실행 거부 → 빌드 후 `codesign --force --deep --sign - <app>` 재서명 + dmg 재생성(`agent-workflow-discipline §8` 회귀 사례).

### C. 앱 아이콘·메타
- `.icns`(macOS) 아이콘 제작/배치. productName·category(`public.app-category.productivity`)·버전.

### D. DMG 빌드
- electron-builder dmg target. 배경/레이아웃은 기본으로 시작.

### E. (선택) 자동 업데이트
- `electron-updater` + 피드(GitHub Releases). MVP 1차엔 생략 가능.

### F. 출시 전 점검 (HARD-GATE)
- **깨끗한 상태**(또는 다른 계정)에서 .dmg 설치 → 첫 실행 시 DB 생성(`~/Library/Application Support/write-note-desktop/write-note.db`) 확인.
- **프로덕션 빌드에서 `node:sqlite` 동작 검증** — dev 에선 GREEN이나 패키징(asar) 후 내장 모듈이 동일하게 뜨는지 첫 실행 read/write 로 확인(experimental 내장 모듈 리스크).
- 한글 IME·페이지 분할·저장·재시작 복원 스모크 1회.
- DevTools/dev 전용 코드가 prod 빌드에서 꺼져 있는지.

---

## 6. 가드레일 (HARD-GATE — `agent-workflow-discipline §8`)

설치·빌드·패키징 명령 **실행 전** self-check:
1. **Node 버전** — Node 24.14.0(`node:sqlite`). 셸 기본 v20 → `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행.
2. **pnpm build script 승인** — `package.json` `pnpm.onlyBuiltDependencies` 에 `electron` 등록됨(확인). 네이티브 sqlite 없으니 추가 리빌드 불필요.
3. **nvm 전환 시 pnpm PATH** — electron-builder 가 child shell 에서 pnpm 호출 → `corepack enable` 또는 pnpm 경로 PATH 노출 선행(과거 code 127 회귀).
4. **arm64 서명** — ad-hoc 서명조차 없으면 Apple Silicon 실행 거부. 미서명 빌드 후 `codesign --force --deep --sign - <app>` 재서명 + dmg 재생성.
5. **preload sandbox 정합** — 현재 `sandbox:true` + preload CJS(.mjs) 정상. 패키징 후 renderer 첫 IPC(`window.electronAPI`) 스모크 1회.

---

## 7. 환경 / 명령

```
cd desktop
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v   # v24.14.0
# 빌드(렌더러+main):
node_modules/.bin/vite build         # 또는 pnpm build (tsc + vite build)
# 패키징(설정 추가 후):
node_modules/.bin/electron-builder    # dist/·dist-electron/ 을 패키징 → release/
# 게이트(회귀 없음 확인):
node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit
```

---

## 8. 참조

- 빌드 구조: `desktop/vite.config.ts`(vite-plugin-electron) · `desktop/electron/main.ts`(prod loadFile·DB path·sandbox) · `desktop/package.json`
- MVP 범위: `PRODUCT.md` · `docs/phase/README.md`(첫 MVP 제외 항목)
- 진척: vault `~/obsidian/write-note/02-PROGRESS.md`(Phase 10 ✅) · `docs/STATUS.md`
- 가드레일: `.claude/rules/shared/agent-workflow-discipline.md §8`(Electron 패키징 환경 함정)
- 페이지 분할(직전 작업): `docs/poc/0-4-page-split-poc-plan.md`
- 잔여 이슈: vault `03-ISSUES.md` ISSUE-022(굵게-IME papercut)

---

## 9. kickoff 프롬프트 (다음 세션 첫 입력으로 복사)

```
Desktop MVP(write-note-desktop)를 실제 배포 가능한 .app/.dmg 로 패키징한다. 기능은 완료(로컬 우선, Phase 10 페이지 분할까지 develop merge). 남은 건 배포 트랙뿐 — electron-builder 가 설치만 돼 있고 설정이 0. CLAUDE.md 와 .claude/rules 의 HARD-GATE 를 따른다(추측 금지·단정 금지, 한국어, 빌드/테스트 포어그라운드, Electron 패키징 §8 가드레일).

[0] 먼저 읽기:
- docs/handoff/2026-06-07-desktop-packaging-handoff.md  (본 작업 진입점 — 빌드구조·범위·작업계획·가드레일·결정사항)
- .claude/rules/shared/agent-workflow-discipline.md §8  (Node 버전·pnpm PATH·arm64 서명·node:sqlite·preload sandbox 함정)
- desktop/package.json · vite.config.ts · electron/main.ts  (빌드 구조 실제 재확인)

[1] 기준선: cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v(v24) → node_modules/.bin/{vitest run, tsc --noEmit, vite build} GREEN 확인.

[2] 검증된 사실(다시 파지 말 것): MVP=로컬 전용(백엔드/동기/모바일/인증/export 범위 밖). node:sqlite 내장 → 네이티브 리빌드 불필요. prod 는 dist/index.html file:// 로드, DB=userData/write-note.db. electron-builder 설정만 없음.

[3] 먼저 사용자 결정 확정(핸드오프 §4): ① 타깃 OS(macOS만?) ② 서명 수준(정식 Developer ID+공증 vs ad-hoc) ③ 로컬 전용 유지 ④ papercut ISSUE-022 처리 여부 ⑤ 배포 채널. 그다음 electron-builder 26 공식 문서로 설정 syntax·서명 옵션 검증 후 §5 작업계획(A~F)대로 진행. 출시 전 §5-F 점검(깨끗한 기기 설치·node:sqlite 패키징 동작·IME/분할 스모크) HARD-GATE.
```
