# Implementation Plan: 빠른 메모 캡처 + Inbox (Desktop Phase 5)

**Branch**: `007-phase-5-memo-capture-inbox` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-phase-5-memo-capture-inbox/spec.md` + 작업 지시서 `docs/superpowers/specs/2026-06-05-desktop-phase5-memo-capture-design.ko.md`

## Summary

떠오른 메모를 두 진입점(어느 화면에서든 열리는 빠른 메모 모달 + 메모 화면 상단 인라인 입력란)으로 본문만 입력해 캡처하고, inbox에서 캡처 최신순으로 모아 본다. 작업 중인 작품이 있으면 자동 연결, 없으면 미연결. 전체/미연결 필터. 삭제는 **soft delete**(데이터 보존) + 즉시 숨김 + 되돌리기 토스트.

**기술 접근(작업 지시서 §6 확정):** 메모 저장 경계(repository/Store/IPC)는 Phase 2에서 완성됨 — 본 Phase는 ① soft delete를 위한 `deleted_at` 컬럼 + `softDelete`/`restore` + `list` 필터 추가(스키마 v2→v3), ② IPC에 `memos.delete`/`memos.restore` 추가, ③ 더미 UI 3종 중 `QuickCapture`·`MemoInboxScreen` 실데이터 결선(+ `Toast`·`memoView` 신설), ④ App에 `memoRefresh` 브리지. `MemoPanel`(side panel)은 Phase 6이라 건드리지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2 (renderer), Node 24.14.0 (Electron main / node:sqlite)

**Primary Dependencies**: Electron + vite-plugin-electron, React, `node:sqlite`(내장 DatabaseSync). 신규 외부 의존성 없음

**Storage**: 로컬 SQLite 파일(STRICT 테이블 + FK). 기존 `memos` 테이블에 `deleted_at` 컬럼 추가(스키마 v3)

**Testing**: Vitest + @testing-library/react (renderer 컴포넌트 행위 테스트), repository/스키마/매퍼 단위 테스트. 게이트는 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행

**Target Platform**: Electron 데스크탑 앱(macOS 기준, 로컬 단일 사용자)

**Project Type**: desktop-app (Electron main `desktop/electron/` + Vite/React renderer `desktop/src/`)

**Performance Goals**: 로컬 단일 사용자 — 즉시 반응(캡처/필터/삭제는 사용자 체감 지연 없음). 메모 수십~수백 개 규모

**Constraints**: 오프라인·로컬 전용(서버/네트워크 없음). renderer는 DB에 직접 접근하지 않고 preload IPC 화이트리스트만 사용

**Scale/Scope**: 신설 2(`memoView.ts`, `Toast.tsx`) + 수정 7~8 파일. 단일 사용자 로컬 데이터

## Constitution Check

*GATE: constitution.md는 미작성(플레이스홀더). 본 프로젝트는 `CLAUDE.md` + `.claude/rules/`로 규율하므로 그 룰을 게이트로 적용한다.*

| 게이트 | 적용 | 상태 |
|---|---|---|
| **TDD HARD-GATE** (CLAUDE.md §5) | repository(`softDelete`/`restore`/`list` 필터) · 스키마 v3 마이그레이션 · `memoView` 매핑은 실패 테스트 먼저 | ✅ Phase 1 설계에 반영 |
| **TS 코드 퀄리티** (`rules/typescript/code-quality.md`) | `any` 금지, named export, type-only import, props 직접 타입(React.FC 금지). 이벤트 핸들러 컴포넌트는 이미 renderer(Electron, RSC 경계 무관) | ✅ |
| **preload smoke test** (`agent-workflow §8`) | 신규 IPC(`memos.delete`/`restore`) renderer 첫 호출 전 `window.electronAPI.memos.delete` 존재 1회 확인 | ✅ quickstart에 반영 |
| **외부 인프라 안전** (`rules/infra/external-infra-safety.md`) | 대상은 PostgreSQL/redis. 로컬 SQLite·마이그레이션 **코드 작성**은 범위 밖(쓰기 컨펌 불요). 단 마이그레이션 적용은 앱 기동 시 자체 수행 | ✅ 해당 없음 |
| **빌드/테스트 포어그라운드** (CLAUDE.md 작업 실행 지침) | vitest/tsc/vite 포어그라운드 실행 | ✅ |
| **surgical change** (글로벌 §3) | `MemoPanel`·`projectView` 등 인접 코드 불필요 변경 금지. 단 상대시간 공용화는 정당화(아래 Complexity) | ⚠️ 1건 정당화 |

위반 없음(공용 추출 1건은 Complexity Tracking에 정당화).

## Project Structure

### Documentation (this feature)

```text
specs/007-phase-5-memo-capture-inbox/
├── plan.md              # This file
├── research.md          # Phase 0 — 설계 결정 정리
├── data-model.md        # Phase 1 — Memo 엔티티 + 스키마 v3 + view 타입
├── quickstart.md        # Phase 1 — 검증/dogfooding 시나리오 + 게이트
├── contracts/
│   ├── ipc-memos.md     # IPC 계약 (memos.create/list/link + delete/restore)
│   └── ui-components.md  # 컴포넌트 props 계약
├── checklists/
│   └── requirements.md  # (speckit-specify 산출)
└── tasks.md             # Phase 2 — /speckit-tasks 산출 (이 명령 아님)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── db/
│   │   ├── schema.ts                 # 수정: v2→v3, memos.deleted_at ADD COLUMN
│   │   ├── schema.test.ts            # 수정: v3 마이그레이션 테스트
│   │   ├── memoRepository.ts         # 수정: list 필터 + softDelete + restore
│   │   ├── memoRepository.test.ts    # 수정: soft delete/restore/정렬 테스트
│   │   └── types.ts                  # 수정: Memo 에 deletedAt 추가
│   └── ipc/
│       ├── contract.ts               # 수정: memos.delete/restore + 채널
│       ├── registerHandlers.ts       # 수정: delete/restore 핸들러
│       └── (preload.ts)              # 수정: memos.delete/restore 노출
├── electron/preload.ts               # 수정
└── src/
    ├── lib/
    │   ├── memoView.ts               # 신설: 도메인 Memo → inbox view
    │   ├── memoView.test.ts          # 신설
    │   ├── relativeDate.ts           # 신설: formatRelativeDay 공용 추출
    │   ├── relativeDate.test.ts      # 신설
    │   ├── projectView.ts            # 수정(최소): relativeDate 사용으로 교체
    │   └── projectView.test.ts       # (회귀 확인 — 행위 동일)
    ├── components/
    │   ├── QuickCapture.tsx          # 수정: textarea 제어 + memos.create 결선
    │   └── Toast.tsx                 # 신설: 되돌리기 토스트
    ├── screens/
    │   ├── MemoInboxScreen.tsx       # 수정: 실데이터 결선 + 필터 + 삭제/복구
    │   └── MemoInboxScreen.test.tsx  # 신설: 행위 테스트
    ├── App.tsx                       # 수정: memoRefresh 브리지 + 모달 props
    └── types.ts                      # 수정: InboxMemo view 타입
```

**Structure Decision**: 기존 `desktop/` 단일 패키지(Electron main + Vite/React renderer) 구조를 그대로 따른다. main(`electron/`)에 저장/IPC, renderer(`src/`)에 UI/매퍼. 신규 디렉토리 없음.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `projectView`의 상대시간 로직을 `lib/relativeDate.ts`로 추출(기존 Phase 4 코드 소폭 수정) | 메모 inbox도 동일한 "오늘/어제/N일 전" 일단위 상대 라벨이 필요 — 두 곳에 같은 로직을 복제하면 향후 표시 규칙 변경 시 양쪽 디버깅 | memoView에 복제: surgical하지만 동일 로직 2벌 → 표시 규칙 단일 출처 상실. 추출은 `projectView.test.ts`가 행위(오늘/어제/주 경계)를 그대로 보호하므로 회귀 위험 낮음 |
