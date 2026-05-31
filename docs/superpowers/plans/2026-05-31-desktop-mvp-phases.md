# Desktop MVP Phase Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 WEB 개발을 잠시 멈추고, `desktop/`에서 실제 글쓰기 세션에 사용할 수 있는 Electron 데스크탑 MVP 프로토타입을 만든다.

**Architecture:** `frontend/`와 `backend/`는 보존하고, 새 `desktop/` 앱을 독립 트랙으로 추가한다. 데스크탑 MVP는 로컬 우선 저장을 사용하며, UI는 Focus Studio 방향으로 새로 설계한다. 첫 MVP는 일반 에디터, 프로젝트, 메모 캡처/연결만 포함하고 원고지 모드와 서버 동기화는 후속 phase로 미룬다.

**Tech Stack:** Electron, Vite, React, TypeScript, TipTap, local SQLite 계열 저장소, pnpm.

---

## 기준 문서

- 설계 원문: `docs/superpowers/specs/2026-05-31-desktop-mvp-design.md`
- 설계 한글본: `docs/superpowers/specs/2026-05-31-desktop-mvp-design.ko.md`

## Phase 운용 원칙

- 각 phase는 하나의 큰 목표를 가진다.
- 각 phase가 끝나면 최소 하나의 검증 가능한 산출물이 있어야 한다.
- 각 phase는 독립 커밋 단위로 남긴다.
- 기존 `frontend/`와 `backend/`는 기능 수정하지 않는다. 필요한 경우 WEB 일시 중단 상태 문서만 갱신한다.
- 첫 MVP에서는 원고지 모드, 모바일 캡처, 인증, 서버 동기화, 태그, 이유 노트, 등장인물, 검색, export, AI를 구현하지 않는다.

## 예상 최종 구조

```text
desktop/
  package.json
  tsconfig.json
  vite.config.ts
  electron/
    main.ts
    preload.ts
  src/
    app/
      App.tsx
      routes.ts
    features/
      projects/
      documents/
      memos/
      capture/
      studio/
    shared/
      db/
      ipc/
      ui/
      utils/
  tests/

docs/
  superpowers/
    plans/
      2026-05-31-desktop-mvp-phases.md
```

구현 중 실제 scaffold 도구가 생성하는 구조가 다르면, 위 구조를 기준으로 책임 경계만 유지한다.

## Phase 0: WEB 일시 중단 선언 + Desktop 트랙 기준선

**목표:** 기존 WEB 개발이 잠시 중단되었고, 앞으로의 우선순위가 `desktop/` MVP임을 문서와 repository 상태에 명확히 남긴다.

**포함 작업:**

- `docs/plan` 또는 별도 status 문서에 WEB 개발 blocked/paused 상태를 기록한다.
- desktop MVP 설계/phase plan을 다음 작업의 기준 문서로 연결한다.
- 기존 `frontend/`, `backend`, `specs/00x-*`는 수정하지 않는다.

**완료 기준:**

- repository를 처음 보는 사람이 “현재는 WEB이 아니라 desktop MVP가 active track”임을 문서에서 확인할 수 있다.
- 기존 WEB 작업물은 삭제/이동되지 않는다.
- `git status`에서 phase 문서 변경만 의도적으로 남는다.

**검증:**

- `git diff --name-only`로 변경 파일이 문서 범위에 한정되는지 확인한다.

**권장 커밋:**

```bash
git commit -m "docs: pause web track for desktop MVP"
```

## Phase 1: Electron/Vite Desktop App Scaffold

**목표:** `desktop/` 앱이 독립적으로 설치, 실행, 빌드되는 최소 Electron shell을 만든다.

**포함 작업:**

- `desktop/` package 생성.
- Electron main/preload/renderer 기본 연결.
- Vite React TypeScript 환경 구성.
- 기본 window title과 빈 Focus Studio shell 화면 추가.
- lint/typecheck/test script의 최소 기준을 정의한다.

**완료 기준:**

- `desktop/`에서 개발 서버 또는 Electron 앱을 실행하면 빈 desktop window가 뜬다.
- `frontend/` dev server나 `backend` 실행 없이 동작한다.
- renderer와 main process가 분리되어 있고, renderer가 Node API에 직접 접근하지 않는다.

**검증:**

```bash
cd desktop
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

**권장 커밋:**

```bash
git commit -m "feat(desktop): scaffold Electron app"
```

## Phase 2: Local Data Boundary + Persistence Spike

**목표:** desktop MVP의 로컬 데이터 저장 경계를 확정하고, Project/Document/Memo를 저장/조회할 수 있는 최소 persistence layer를 만든다.

**포함 작업:**

- Electron에서 사용할 로컬 DB library를 확정한다.
- `Project`, `Document`, `Memo`, `AppSetting` schema를 만든다.
- sync-friendly ID 생성 방식을 확정한다.
- main process에 DB 접근 모듈을 둔다.
- renderer는 IPC 또는 명시적 bridge API로만 데이터를 요청한다.
- persistence layer 단위 테스트를 추가한다.

**완료 기준:**

- project 생성 시 document가 함께 생성된다.
- memo 생성/조회가 로컬 저장소에서 동작한다.
- 앱 재시작 후에도 저장된 데이터가 남는다.
- renderer가 DB 파일 또는 Node DB client에 직접 접근하지 않는다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
```

가능하면 수동 검증:

- 앱 실행
- project 1개 생성
- 앱 종료 후 재실행
- project가 유지되는지 확인

**권장 커밋:**

```bash
git commit -m "feat(desktop): add local persistence"
```

## Phase 3: Projects Workspace

**목표:** 사용자가 프로젝트를 만들고, 선택하고, writing studio로 진입할 수 있게 한다.

**포함 작업:**

- Projects 화면 구현.
- 새 프로젝트 생성 flow 구현.
- 프로젝트 목록 recent-first 표시.
- 활성 프로젝트 선택 상태 관리.
- project 생성 시 기본 document를 자동 생성한다.
- 빈 상태와 최소 오류 상태를 구현한다.

**완료 기준:**

- 앱 첫 실행 시 빈 프로젝트 화면이 보인다.
- 프로젝트를 만들 수 있다.
- 만든 프로젝트가 목록에 나타난다.
- 프로젝트를 클릭하면 Write Studio로 진입한다.
- 앱 재시작 후 프로젝트 목록이 유지된다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 검증:

- 새 프로젝트 생성
- 목록 표시 확인
- 프로젝트 열기
- 앱 재시작 후 목록 유지 확인

**권장 커밋:**

```bash
git commit -m "feat(desktop): add project workspace"
```

## Phase 4: Write Studio + General Editor Autosave

**목표:** 프로젝트 문서를 일반 에디터에서 작성하고, 로컬 자동 저장으로 복원할 수 있게 한다.

**포함 작업:**

- Focus Studio 레이아웃의 Write Studio 구현.
- TipTap 일반 에디터 연결.
- document body를 TipTap/ProseMirror JSON으로 저장한다.
- plain text와 word count를 함께 계산/저장한다.
- debounce 기반 로컬 autosave 구현.
- 저장 상태 표시를 구현한다.

**완료 기준:**

- 프로젝트를 열면 중앙 에디터가 보인다.
- 본문을 입력할 수 있다.
- 입력 후 자동 저장 상태가 갱신된다.
- 앱을 종료하고 다시 열면 마지막 본문이 복원된다.
- plain text와 word count가 저장된다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 검증:

- 프로젝트 생성
- 본문 입력
- 저장 상태 확인
- 앱 종료
- 앱 재실행
- 본문 복원 확인

**권장 커밋:**

```bash
git commit -m "feat(desktop): add editor autosave"
```

## Phase 5: Quick Memo Capture + Inbox

**목표:** 사용자가 떠오른 메모를 빠르게 캡처하고, inbox에서 확인할 수 있게 한다.

**포함 작업:**

- 앱 내부 quick capture modal 또는 panel 구현.
- active project가 있으면 memo의 기본 연결 project로 기록한다.
- active project가 없으면 unlinked memo로 저장한다.
- Memo Inbox 화면 구현.
- 전체 memo와 unlinked memo를 볼 수 있는 최소 필터를 구현한다.
- memo 생성/조회/삭제 또는 최소 숨김 정책 중 하나를 결정한다.

**완료 기준:**

- 앱 UI에서 quick capture를 열 수 있다.
- body만 입력하고 memo를 저장할 수 있다.
- 저장된 memo가 inbox에 최신순으로 보인다.
- active project에서 캡처한 memo는 해당 project에 연결된다.
- active project 없이 캡처한 memo는 미연결 상태로 남는다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 검증:

- project 없이 memo 캡처
- inbox에서 미연결 memo 확인
- project를 연 상태에서 memo 캡처
- inbox에서 project 연결 상태 확인

**권장 커밋:**

```bash
git commit -m "feat(desktop): add memo capture inbox"
```

## Phase 6: Project Memo Linking + Studio Side Panel

**목표:** memo를 project에 연결/해제하고, 작성 화면에서 현재 project memo를 볼 수 있게 한다.

**포함 작업:**

- Inbox에서 memo의 project 연결/해제 UI 구현.
- project 목록 기반 연결 selector 구현.
- Write Studio의 얇은 side panel 구현.
- 현재 project에 연결된 memo 목록 표시.
- side panel이 글쓰기 canvas를 압도하지 않도록 Focus Studio 방향 유지.

**완료 기준:**

- 기존 unlinked memo를 특정 project에 연결할 수 있다.
- memo 연결을 해제할 수 있다.
- Write Studio에서 현재 project에 연결된 memo만 보인다.
- 메모가 많지 않은 초기 상태에서 UI가 무겁게 느껴지지 않는다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 검증:

- memo 2개 생성
- 하나는 project A에 연결, 하나는 미연결로 유지
- project A Write Studio에서 연결 memo만 표시되는지 확인
- 연결 해제 후 side panel에서 사라지는지 확인

**권장 커밋:**

```bash
git commit -m "feat(desktop): link memos to projects"
```

## Phase 7: Prototype Usability Pass

**목표:** 프로토타입을 실제 글쓰기 세션에 사용할 수 있을 정도로 정리한다.

**포함 작업:**

- Focus Studio visual pass.
- empty/loading/error 상태 정리.
- keyboard focus와 기본 단축키 정리.
- data loss 가능성이 있는 흐름 점검.
- 앱 재시작/창 닫기/저장 중 종료 상황 확인.
- README 또는 quickstart 문서 작성.

**완료 기준:**

- 처음 실행한 사용자가 프로젝트 생성부터 글 작성, 메모 캡처, 메모 연결까지 막히지 않는다.
- 앱 재시작 후 프로젝트, 본문, 메모가 모두 복원된다.
- 저장 실패나 DB 초기화 실패 시 화면이 완전히 깨지지 않는다.
- 최소 quickstart 문서만 보고 앱을 실행할 수 있다.

**검증:**

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm build
```

수동 dogfooding:

- 실제 프로젝트 하나 생성
- 10분 이상 본문 작성
- 중간에 memo 3개 캡처
- memo 1개 이상 project에 연결
- 앱 종료 후 재실행
- 모든 데이터 복원 확인

**권장 커밋:**

```bash
git commit -m "chore(desktop): prepare usable prototype"
```

## Phase 8: Desktop MVP Review Gate

**목표:** 첫 desktop MVP가 다음 개발 단계로 넘어갈 준비가 되었는지 판단한다.

**포함 작업:**

- MVP 성공 기준 체크리스트 작성.
- 실제 사용 중 마찰을 기록한다.
- Phase 2 우선순위를 결정한다: 원고지 모드 vs richer memo curation.
- WEB track 재개 조건을 다시 판단한다.

**완료 기준:**

- 사용 가능한 prototype 상태인지 명확히 판정한다.
- 다음 phase 1순위가 문서로 남는다.
- 발견된 이슈가 추측이 아니라 실제 사용 기록 기반으로 정리된다.

**검증:**

- `docs/retrospectives/` 또는 별도 desktop review 문서에 결과 기록.
- blocker / non-blocker 이슈를 분리.

**권장 커밋:**

```bash
git commit -m "docs: review desktop MVP prototype"
```

## Prototype 완료 정의

Phase 7까지 완료되면 “사용 가능한 데스크탑 앱 프로토타입”으로 본다.

완료 조건:

- WEB backend 없이 실행 가능.
- 프로젝트 생성 가능.
- 일반 에디터에서 본문 작성 가능.
- 자동 저장과 앱 재시작 복원 가능.
- 빠른 메모 캡처 가능.
- 메모 inbox 확인 가능.
- 메모를 프로젝트에 연결 가능.
- 작성 화면에서 현재 프로젝트 메모 확인 가능.

Phase 8은 구현 완료 후 의사결정 gate다. 프로토타입 사용 가능 여부 자체는 Phase 7에서 판정한다.
