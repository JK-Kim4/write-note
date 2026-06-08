# Desktop Phase 1 — Electron scaffold

- 일자: 2026-06-03
- 워크트리 / 브랜치: write-note / `feat/desktop-phase1-electron-scaffold`
- 관련 PR / 커밋: PR #27 (`34abcbf` scaffold / `44e7332` architecture / `e4c25da` docs)
- 작업 시간 (대략): develop pull ~ Phase 2 컨텍스트 수집까지 1 세션

## 1. 무엇을 했는가 (사실)

- **develop 분기 해소** — 로컬 3 docs 커밋이 원격 PR #26 에 흡수된 것을 트리 비교로 확인 후 `git reset --hard origin/develop` 로 동기화.
- **Electron 빌드도구·보안 공식문서 검증** — subagent 2개 병렬(빌드도구 비교 / Electron 보안 패턴). 결과를 `docs/phase/01-desktop-scaffold/README.md §기술 결정` 에 기록.
- **Phase 1 구현** — `vite-plugin-electron@0.29` 통합, `electron/main.ts`(BrowserWindow + dev/prod 로드 분기), `electron/preload.ts`(contextBridge 골격), `src/global.d.ts`, `base:'./'`, vitest+jsdom smoke 1건(`Rail.test.tsx`).
- **환경 블로커 해소** — Node 20.10.0 의 `require(ESM)` 미지원으로 electron 42 `install.js` 가 `ERR_REQUIRE_ESM` → Node **20.20.1** 핀(`.nvmrc`) + `pnpm.onlyBuiltDependencies:["electron"]`.
- **검증** — typecheck/build/test GREEN, `pnpm dev` Electron 기동 확인.
- **PR #27** 생성(base develop), `architecture.html`(이전 작업 산출물) 정합 확인 후 보존.
- **문서 갱신** — STATUS.md / phase/README.md / vault 02-PROGRESS 를 Phase 1 완료 + Phase 2 진입점으로.

## 2. 어떻게 했는가 (접근)

- **검증 우선** — 추측 영역(빌드도구 syntax / Electron 보안 / sandbox-ESM 호환)을 옵션 표 송출 전 공식문서 fetch·subagent 로 확정(agent-workflow §1·§2).
- **plan mode** — 구현 전 계획 파일 승인 받고 진입. 함정(`base:'./'`)·미확인 실측 항목을 계획에 미리 박음.
- **포어그라운드 빌드/테스트** — install/build/test/dev 모두 foreground 로 결과 직접 확인(CLAUDE.md 작업실행 지침).
- **사용자 결정 위임** — Node 버전·sandbox 값처럼 환경/보안 결정은 AskUserQuestion 으로.

## 3. 잘 된 점

1) **실측이 숨은 블로커를 잡았다** — 사전 문서검증만으론 못 잡았을 Node 20.10.0 `require(ESM)` 이슈를 `pnpm dev` 실행에서 발견. 계획에 "실측 #3 (pnpm + electron 설치)" 을 미리 박아둔 게 적중. 근거: dev 로그의 `ERR_REQUIRE_ESM`.
2) **추측 금지 준수** — sandbox ↔ ESM preload 호환을 추측하지 않고 Electron 공식 ESM 문서를 fetch 후 확정(`sandbox:true` 면 ESM preload 불가). 근거: agent-workflow §1.
3) **정직한 미확인 표기** — prod `file://` 폰트 동작은 검증 못 한 채로 두고 dogfooding 영역으로 명시. 단정하지 않음.
4) **트랜잭션 분기 보고** — dev 블로커 발견 시 "R1~R3 + 자동검증 GREEN / dev 실측 블로커" 로 트랙 상태 명시(agent-workflow §3).

## 4. 어긋난 점

- **사용자 멈춤 신호 1회 — sandbox 질문 거부.** 첫 sandbox 질문이 옵션(true/false)만 제시하고 `contextIsolation`/`nodeIntegration`/`sandbox` 각 설정의 의미를 안 풀어줬다 → 사용자가 질문을 거부하고 "각각 어떤 설정이고 무슨 효과인지 정확하게 설명해" 요구. **회피 가능 시점:** 첫 질문 작성 시 세 설정의 개념·효과를 옵션 description 또는 본문에 1줄씩 박았어야. 이미 프로젝트에 `user-interview-quality`(무지 가정 / 약어 풀어쓰기) HARD-GATE 가 있는데도 발생.
- **build 1회 실패 (경미).** `vite.config.ts` 에 `renderer: {}` 를 추측으로 넣음 → `vite-plugin-electron/simple` 이 별도 패키지(`vite-plugin-electron-renderer`)를 요구해 build fail → 제거 후 GREEN. 회피 가능: simple API 의 `renderer` 옵션이 별도 패키지를 요구하는 점을 subagent 검증이 거기까지 파지 않았고, 나도 추측으로 넣음.
- **환경 가정 미검증.** Node 20.10.0 이 electron 설치 불가인 것을 plan 시점에 몰랐다. README §2 에 "pnpm + electron 설치 실측" 으로 예고는 했으나 *근본 원인이 Node 버전*인 것은 dev 실행에서야 드러남(agent-workflow §5 — 환경 정합). `@types/node ^22` 를 처음 박았다가 실제 Node 20 과 어긋나 ^20 으로 정정한 것도 같은 갭. 단 실측으로 잡아 치명적이진 않음.
- **nvm/pnpm 혼란 (경미).** `nvm use` 직후 `node --version` 이 20.10.0 으로 나온 혼란 1회 — shell command hash 미갱신(`hash -r` 누락). 또 nvm 전환 시 pnpm 이 PATH 에서 사라짐.

전반적으로 재시도 폭주·30분+ 디버깅 루프는 없었다(build fail 1회, 환경 블로커는 원인규명 후 1회 해소). 멈춤 신호는 sandbox 질문 1회.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **Electron/네이티브 모듈 신규 도입 시 Node 버전 선확인** — electron N 의 `install.js` 가 `@electron/get`(ESM)을 `require` 하므로 Node `require(ESM)` 지원(20.19+ / 22+ / 24) 필수. Phase 2 `better-sqlite3` + `@electron/rebuild` 도 같은 환경 리스크 — 진입 즉시 `@electron/rebuild` 실측.
- **`vite-plugin-electron/simple` 의 `renderer` 옵션은 별도 패키지 요구** — renderer 가 Node 모듈을 직접 import 하지 않으면 생략.
- **nvm 전환 후 pnpm 은 corepack 으로** — `nvm use` → `corepack enable`.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 A — `user-interview-quality` / CLAUDE.md 사용자 인터뷰 지침 보강 (심각도: 중상)**
- (1) 대상: 프로젝트 `CLAUDE.md` §사용자 인터뷰 지침 (또는 글로벌 `user-interview-quality.md`)
- (2) 본문: "기술 *설정값*(boolean flag / mode / 옵션)을 선택지로 묻기 직전, 각 설정이 *무엇을 켜고 끄는지*와 *효과*를 옵션 description 또는 본문에 최소 1줄씩 박는다. 사용자가 설정의 의미를 모른 채 값만 고르게 두지 않는다."
- (3) 근거: 본 회고 §4 — sandbox 질문이 `contextIsolation`/`nodeIntegration`/`sandbox` 의미를 안 풀고 true/false 만 제시 → 사용자 거부 + 재설명 요구.

**후보 B — 프로젝트 룰: Electron/네이티브 모듈 환경 선확인 (심각도: 중)**
- (1) 대상: `.claude/rules/` 신규 또는 `agent-workflow-discipline.md` §환경 정합 보강
- (2) 본문: "Electron·네이티브 모듈(better-sqlite3 등) 도입/버전 변경 시 ① 시스템 Node 의 `require(ESM)` 지원 여부(20.19+) ② pnpm build script 승인(`onlyBuiltDependencies`) 을 *설치 전* 확인한다."
- (3) 근거: 본 회고 §4 — Node 20.10.0 electron 설치 블로커.
