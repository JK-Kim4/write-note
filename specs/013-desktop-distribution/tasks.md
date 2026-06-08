---
description: "Task list — 013 Desktop 앱 공개 배포 (Windows + macOS)"
---

# Tasks: Desktop 앱 공개 배포 (Windows + macOS)

**Input**: Design documents from `specs/013-desktop-distribution/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-pipeline.md, quickstart.md

**Tests**: 본 기능은 빌드·배포 인프라(워크플로 YAML, electron-builder 설정) 중심. CLAUDE.md TDD HARD-GATE의 "설정 파일" 예외에 해당. 단, `/download` 페이지의 OS 감지 분기는 behavior 테스트 1건(T011, 선택). 검증의 본질은 quickstart 게이트 G1~G5(실제 설치 dogfooding).

**Organization**: 사용자 스토리별 phase. US1·US2는 모두 P1이나 US1(파이프라인)이 산출물의 토대.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 + 선행 의존 없음 → 병렬 가능
- **[human]**: 사람(릴리스 담당/사용자)의 실제 설치·확인이 필요한 dogfooding 게이트

## Path Conventions

- 워크플로: repo 루트 `.github/workflows/`
- 빌드 설정: `desktop/`
- 다운로드 페이지: `frontend/src/app/download/`

---

## Phase 1: Setup

- [ ] T001 로컬 빌드 기준선 확인 — `cd desktop && pnpm install && pnpm build`가 GREEN인지 확인(배포 변경 전 회귀 기준선). 실패 시 먼저 해소.

---

## Phase 2: Foundational (모든 스토리의 blocking 선행)

**목적**: 산출물 계약(고정 파일명·타깃·서명)을 확정. US1(빌드)·US2(링크)·US3(링크 불변)이 모두 의존.

- [ ] T002 `desktop/electron-builder.yml` 확장 — `contracts/release-pipeline.md` §B대로:
  - `artifactName` 고정(공백 회피, 하이픈): mac `Narae-Note.${ext}`, win NSIS 산출물명을 `Narae-Note-Setup.exe`로
  - `mac`: `arch: [universal]`, `identity: "-"`(null→ad-hoc), `hardenedRuntime: false`
  - `win`: `target: nsis`, `icon: assets/icon.png`
  - `nsis`: `oneClick: true`, `perMachine: false`
- [ ] T003 [human] 로컬 macOS 빌드 1회로 설정 검증 — `cd desktop && pnpm build && pnpm exec electron-builder --mac`. 확인: `desktop/release/Narae-Note.dmg` 생성 / universal(`lipo -archs`) / ad-hoc 서명(`codesign -dv` 결과에 `Signature=adhoc`). (Windows 산출물은 로컬 빌드 불가 → CI에서만)

**Checkpoint**: electron-builder.yml이 양 OS 산출물 계약을 만족 → US1·US2 진입 가능.

---

## Phase 3: User Story 1 — 자동 릴리스 파이프라인 (Priority: P1)

**Goal**: `v*` 태그 push → 양 OS 설치파일 자동 빌드 + Releases 게시. 산출물이 실제로 실행/설치됨.

**Independent Test**: 테스트 태그 push 시 사람 개입 없이 양 OS 자산이 Release에 나타나고, 각 자산이 실제 기기에서 설치·실행된다.

- [ ] T004 [US1] `.github/workflows/release.yml` 작성 — `contracts/release-pipeline.md` §A대로: `on.push.tags: ['v*']` / `permissions: contents: write` / matrix(macos-latest `--mac`, windows-latest `--win`) `fail-fast: false` / `working-directory: desktop` / Node는 `desktop/.nvmrc`(24.14.0) / `corepack enable`(pnpm 8) / `pnpm install` / `pnpm build` / `pnpm exec electron-builder ${{matrix.target}} --publish always` (`GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`)
- [ ] T005 [US1] [human] 파이프라인 검증(G1) — 테스트 태그(예: `v0.0.1-test`) push → Actions 양 OS job GREEN + Release에 `Narae-Note.dmg` + `Narae-Note-Setup.exe` 자동 업로드(수동 0회). 한쪽 job 실패 주입 시 다른 자산 정상 게시(`fail-fast:false`) 확인.
- [ ] T006 [US1] [human] ⚠️ macOS 실제 실행 검증(G2, 최대 리스크) — **빌드한 Mac이 아닌 다른 Mac**(또는 `xattr -w com.apple.quarantine`)에서 dmg 다운로드 → 응용 프로그램 드래그 → 시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기" → 실행 성공. Apple Silicon + (가능 시) Intel. **실패 시**: ad-hoc 배포 불가 결론 → macOS 서명+공증($99) fallback을 별도 트랙으로 surfacing(03-ISSUES).
- [ ] T007 [US1] [human] Windows 실제 설치 검증(G3) — `Narae-Note-Setup.exe` → SmartScreen "추가 정보 → 실행" → 관리자 권한 프롬프트 없이 설치 + 앱 실행.
- [ ] T008 [US1] [human] 기능 회귀 검증(G4) — 설치 앱에서 집필실·메모·기록 동작 + 로컬 `node:sqlite` DB 생성·읽기·쓰기 확인(양 OS).

**Checkpoint**: 태그 한 번으로 양 OS 설치파일이 게시되고 실기기에서 실행됨 = 배포 가능 상태(MVP 핵심).

---

## Phase 4: User Story 2 — 비개발자 다운로드·설치 경험 (Priority: P1)

**Goal**: 다운로드 페이지에서 OS 자동 감지로 설치파일을 받고, 한국어 안내문으로 보안 경고를 통과.

**Independent Test**: 비개발자에게 `/download` 링크만 주고, 페이지 안내문만으로 설치·실행 완료.

- [ ] T009 [P] [US2] `/download` 페이지 작성 — `frontend/src/app/download/page.tsx` + 필요한 client 컴포넌트(`'use client'`): `navigator.userAgent`/`platform`로 OS 감지 → 방문 OS 버튼 강조, Windows/Mac 버튼 2개 항상 노출. 링크는 `contracts/release-pipeline.md` §C 고정 URL(`releases/latest/download/Narae-Note-Setup.exe` / `Narae-Note.dmg`).
- [ ] T010 [P] [US2] 설치 안내문 섹션 — `frontend/src/app/download/` 내: Windows(SmartScreen 추가정보→실행) + macOS(시스템 설정→개인정보 보호 및 보안→확인 없이 열기) 한국어 단계. 한국어 우선(DESIGN.md 전제 #5).
- [ ] T011 [P] [US2] (선택) behavior 테스트 — `frontend/src/app/download/page.test.tsx`: OS 감지 분기로 강조 버튼 전환 + 양 버튼 `href`가 고정 latest/download 링크인지(RTL `getByRole`, 시스템 경계 navigator만 mock).
- [ ] T012 [US2] `pnpm build`(frontend) — RSC server/client 경계 검출(HARD-GATE, lint 만으로 미검출). T009/T010 직후.
- [ ] T013 [US2] [human] 페이지 dogfooding(G5) — 배포된 `/download` 접속: 방문 OS 강조 + 양 버튼 다운로드 동작 + 안내문 표시. (실제 다운로드는 T005의 릴리스 게시 후 가능)

**Checkpoint**: 사용자 진입점 완성 — 비개발자가 페이지만으로 설치 도달.

---

## Phase 5: User Story 3 — 버전 갱신 (Priority: P2)

**Goal**: 새 버전 게시 후에도 동일 링크가 항상 최신을 가리킴.

**Independent Test**: 두 번 연속 버전 게시 후 동일 다운로드 링크가 두 번째(최신) 자산을 내려줌.

- [ ] T014 [US3] [human] 링크 불변 검증 — 2번째 버전 태그 게시 후, `/download`의 링크를 바꾸지 않아도 새 버전이 받아지는지(고정 `artifactName` + `latest/download` 동작) 확인.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T015 [P] 릴리스 절차 문서화(FR-010) — `quickstart.md` 절차를 `desktop/README.md`에 반영(버전 상향 → 태그 push → 자동 게시 + 검증 게이트 요약).
- [ ] T016 [P] vault 동기 — `~/obsidian/write-note/02-PROGRESS.md`(013 Phase 진척 + 다음 진입점) + `03-ISSUES.md`(무서명 macOS 타기기 실행 리스크 / 서명 fallback 트랙 / SmartScreen 한계).
- [ ] T017 회고 후보 surfacing — 룰 #8(Electron 패키징 환경 선확인)이 CI로 실제 작동했는지 + G2 결과를 회고 입력으로.

---

## Dependencies

- **Setup → Foundational**: T001 → T002 → T003
- **Foundational → US1**: T002 → T004 → T005 → (T006, T007, T008)
- **Foundational → US2**: T002(고정 링크명) → (T009 ∥ T010) → T011 → T012 → T013(추가로 T005 게시 의존)
- **US1·US2 병렬**: 워크플로(T004~)와 다운로드 페이지(T009~)는 서로 독립 → 동시 진행 가능
- **US3**: T004 + 2회 게시 → T014
- **Polish**: 본 작업들 이후(T015~T017)

## Parallel Execution Examples

- Foundational 직후: **US1 트랙(T004)** 과 **US2 트랙(T009 [P] + T010 [P])** 을 동시에.
- US2 내부: T009, T010, (T011) 은 서로 다른 파일 → [P].
- Polish: T015 [P], T016 [P] 동시.

## Implementation Strategy

- **MVP = US1 (Phase 1~3)**: 태그 push로 양 OS 설치파일이 자동 게시·실행되면 그 자체로 배포 가능. ⚠️ T006(G2)이 통과해야 macOS 무서명 배포가 성립 — 실패 시 즉시 서명 fallback 결정.
- **이어서 US2**: 비개발자 진입점(다운로드 페이지+안내문)으로 "간단 설치" 목표 완성.
- **US3**: 링크 불변은 대부분 US1/US2 구성으로 충족 — 2회 게시 확인만.
- 룰 #10 정합: 첫 게이트(T003/T005/T006)가 핵심(실제 설치 성공)을 직접 친다 — 주변만 쌓고 미루지 않음.
