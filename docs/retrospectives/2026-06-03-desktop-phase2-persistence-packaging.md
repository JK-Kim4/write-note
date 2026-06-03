# Desktop Phase 2 — Local persistence(node:sqlite) + 패키징 테스트

- 일자: 2026-06-03
- 워크트리 / 브랜치: write-note / `feat/desktop-phase2-persistence`(머지·삭제) → `develop`
- 관련 PR / 커밋: PR #28(머지) / 패키징 `e76ff55`(develop 직접)
- 작업 시간 (대략): Phase 2 계획 ~ 패키징 dmg 구동 확인까지 1 세션

## 1. 무엇을 했는가 (사실)

- **Phase 2 계획(plan mode)** — 패키징 범위(호환 설정까지) + DB 라이브러리 결정 포인트 확정.
- **DB 전략 전환** — better-sqlite3 의 ABI 충돌 + `@electron/rebuild` Node 요구를 subagent·npm registry 로 검증 → **`node:sqlite`(Node 24 내장) 채택**(설계 SoT 변경), 시스템 Node 20.20.1 → 24.14.0 상향.
- **persistence layer** — `db/connection`·`schema`(4테이블 STRICT+FK) + `Project`/`Document`/`Memo`/`Setting` repository + `Store`(트랜잭션 use-case). **TDD 24 tests**, vitest projects(node+jsdom) 분리.
- **IPC 경계** — `ipc/contract`(공유 타입/채널) + `registerHandlers` + preload 도메인 API + `global.d.ts`.
- **main 통합** — `app.whenReady` DB init + 핸들러 등록. dev 실측 시 실제 `.db`+WAL 생성.
- **문서/SoT 갱신** — STATUS·phase/README·설계 ko/en·phase02 README·vault 를 node:sqlite·Phase 2 완료로 일괄 정합.
- **패키징 테스트** — `electron-builder`(dmg, arm64) → arm64 미서명 문제 → ad-hoc 재서명 + dmg 재생성 → 실행 구동 확인(프로세스 + DB). `release/` gitignore + 패키징 설정 develop 직접 커밋.

## 2. 어떻게 했는가 (접근)

- **plan mode 로 결정 선확정** — DB 라이브러리·Node 버전·패키징 범위를 구현 전 사용자 컨펌(추측 진입 차단).
- **추측 영역 검증 위임** — ABI 충돌·@electron/rebuild Node 요구·node:sqlite 안정성을 subagent + WebFetch + npm registry 로 확정 후 옵션 제시(agent-workflow §1).
- **큰 리스크 선실측** — node:sqlite 가용성을 R1 초입에 시스템 Node + `ELECTRON_RUN_AS_NODE` 로 실측 → fallback 불필요 확정 후 진행.
- **TDD Red-Green** — repository 를 테스트 먼저 → 최소 구현. DB 는 시스템 경계라 `:memory:`/temp 로 실제 sqlite 상태 검증(mock 아님, Classist).
- **포어그라운드 빌드/테스트** — 결과 직접 확인.

## 3. 잘 된 점

1) **ABI 충돌을 plan 단계에서 잡아 함정을 통째로 회피.** better-sqlite3 였다면 씨름했을 `@electron/rebuild`·`asarUnpack`·ABI 충돌이 node:sqlite 채택으로 0 이 됐다. Phase 1 회고의 후보 B(환경 선확인)가 **실제로 작동**한 사례. 근거: subagent 검증에서 `@electron/rebuild@4.x`의 Node 22.12+ 요구 + ABI 상호배타 발견 → DB 전략 전환.
2) **node:sqlite 가용성 선실측.** 가장 큰 미확인(Electron 42 에서 node:sqlite 동작)을 R1 초입에 실측 → "안 되면 fallback" 리스크를 조기 제거. 근거: `ELECTRON_RUN_AS_NODE` 로 electron=42.3.2 node=24.15.0 동작 확인.
3) **설계 SoT 변경의 문서 정합.** ko/en 설계 + phase/02 README + vault 까지 일괄 갱신(사용자가 "일괄갱신" 요청 시 누락 2건 보완).
4) **TDD 매끄러움.** repository 24 tests Red-Green, 재시도 0. FK cascade·SET NULL·persistence 재오픈까지 행위 검증.
5) **패키징 서명 문제를 진단으로 규명.** `codesign --verify`/`spctl` 로 깨진 서명 확인 → ad-hoc 재서명 → dmg 재생성 → 실제 구동(PID + DB) 확인.

## 4. 어긋난 점

- **패키징 1차 실패 — `pnpm: command not found`(code 127).** electron-builder 의 node module collector 가 pnpm 을 child shell 로 호출하는데 PATH 에 없어 실패. **회피 가능 시점:** nvm 전환 환경에서 pnpm 이 PATH 에서 빠지는 건 **Phase 1 회고에서 이미 기록된 패턴**(`nvm use` 시 pnpm 사라짐) — 패키징 명령 전 PATH 에 pnpm 노출을 선제할 수 있었다.
- **패키징 서명 누락(arm64).** `electron-builder.yml` `identity: null` 로 미서명 빌드 → Apple Silicon 은 ad-hoc 서명조차 없으면 실행 거부(`codesign --verify` 실패). 1차 빌드 후 발견 → ad-hoc 재서명 + dmg 재생성 2단계 추가. **회피 가능 시점:** arm64 미서명 실행 불가는 알려진 제약 — `electron-builder.yml` 작성 시 서명 처리를 선반영할 수 있었다.
- **멈춤 신호:** 사용자 "이제 앱 패키지 가능한거야?" — 직접 거부는 아니나, 패키징 상태(미도입)를 더 일찍 명확히 했으면 좋았을 신호.
- 큰 재시도 루프/30분+ 디버깅 없음. 패키징 2단계 실패는 각 1회 진단·해소(차단).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **node:sqlite 가 네이티브 모듈 함정 제거 + 패키징 단순화를 입증** — Phase 3+ 및 향후 DB 작업에서 유지. better-sqlite3 회귀 금지.
- **Electron 패키징(electron-builder) 선반영 2종**: ① nvm 환경 pnpm PATH 노출 ② arm64 ad-hoc 재서명(빌드 후 `codesign --force --deep --sign -`) + dmg 재생성.
- **nvm 전환 후 도구 호출**: build/package 류는 child shell 이 PATH 의존 — `corepack enable` 또는 pnpm 경로 PATH 노출 선행.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 — `agent-workflow-discipline.md` §환경 선확인 신설 (Phase 1 후보 B + Phase 2 패키징 통합) (심각도: 중)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` 신규 섹션 또는 `.claude/rules/` desktop 전용 룰
- (2) 본문: "Electron·네이티브 모듈·패키징 도입/버전 변경 시 **설치·빌드 전** 환경 선확인: ① 시스템 Node 의 `require(ESM)`/내장 모듈(node:sqlite 등) 지원 버전 ② pnpm build script 승인(`onlyBuiltDependencies`) ③ **nvm 전환 시 pnpm PATH**(child shell 호출 도구가 pnpm 필요) ④ arm64 패키징은 **ad-hoc 서명 필수**(미서명 실행 거부)."
- (3) 근거: Phase 1 §4(Node 20.10.0 electron 설치 블로커) + Phase 2 §4(패키징 pnpm PATH + arm64 서명) — **동종 환경 함정이 2 세션 연속 재발**.
