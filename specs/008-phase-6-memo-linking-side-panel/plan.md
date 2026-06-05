# Implementation Plan: 메모↔작품 연결 + 집필 사이드 패널 (Desktop Phase 6)

**Branch**: `008-phase-6-memo-linking-side-panel` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-phase-6-memo-linking-side-panel/spec.md` + 작업 지시서 `docs/superpowers/specs/2026-06-05-desktop-phase6-memo-linking-design.ko.md`

## Summary

메모를 작품에 **다중 연결(many-to-many)** 하고, 집필 화면에서 **현재 작품에 연결된 메모만** 곁에서 보고 해제할 수 있게 한다. Phase 5 dogfooding 에서 더미라 혼란을 준 집필 화면 `MemoPanel` 을 실데이터로 결선하는 것이 핵심.

**기술 접근(research 확정):** 단일 연결(`memos.linked_project_id`)을 **연결 테이블 `memo_projects`(다대다)** 로 전환(스키마 v3→v4, 기존 단일 연결 보존 이관 + `linked_project_id` DROP — SQLite 3.51.2 / FK=ON DROP COLUMN 가용 실측). repository 에 `addLink`/`removeLink`/`listByProject` 신설 + `list` 의 `linkedProjectIds` 집계, store 에 `captureMemo` 트랜잭션. renderer 는 Inbox 연결 버튼 + `LinkPopover`(체크리스트) + 칩 ✕, `MemoPanel` 더미 제거 후 `listByProject` 실데이터 + 패널 내 해제, App 의 `memoRefresh` 브리지 재사용.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2 (renderer), Node 24.14.0 (Electron main / node:sqlite)

**Primary Dependencies**: Electron + vite-plugin-electron, React, `node:sqlite`(내장 DatabaseSync, SQLite 3.51.2). **신규 외부 의존성 0**

**Storage**: 로컬 SQLite(STRICT + FK). 신규 `memo_projects` 연결 테이블 + `memos.linked_project_id` 제거(스키마 v4)

**Testing**: Vitest + @testing-library/react(컴포넌트 행위), repository/스키마/store/매퍼 단위. 게이트는 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행

**Target Platform**: Electron 데스크탑 앱(macOS, 로컬 단일 사용자)

**Project Type**: desktop-app (Electron main `desktop/electron/` + Vite/React renderer `desktop/src/`)

**Performance Goals**: 로컬 단일 사용자 — 즉시 반응(연결/해제/패널 갱신 체감 지연 없음). 메모 수십~수백, 작품 수~수십 규모. `list` 집계·`listByProject` 조인은 단일 쿼리(N+1 회피)

**Constraints**: 오프라인·로컬 전용. renderer 는 DB 직접 접근 금지 — preload IPC 화이트리스트만. 마이그레이션은 로컬 `.db` 자체 수행(외부 스토어 아님)

**Scale/Scope**: 신설 1(`LinkPopover.tsx`) + 수정 ~10 파일. 신규 테이블 1

## Constitution Check

*GATE: constitution.md 는 미작성(플레이스홀더). 본 프로젝트는 `CLAUDE.md` + `.claude/rules/` 로 규율하므로 그 룰을 게이트로 적용한다(Phase 1~5 동일).*

| 게이트 | 적용 | 상태 |
|---|---|---|
| **TDD HARD-GATE** (CLAUDE.md §5) | 스키마 v4 마이그레이션 · repository(addLink 멱등/removeLink/listByProject/list 집계) · store(captureMemo 트랜잭션) · memoView 복수 매핑은 실패 테스트 먼저 | ✅ Phase 1 설계 반영 |
| **추측 금지** (CLAUDE.md 금지1) | 마이그레이션 DROP COLUMN 가용성을 **실측**(SQLite 3.51.2, FK=ON OK)으로 확정 — research R2 | ✅ |
| **TS 코드 퀄리티** (`rules/typescript`) | `any` 금지, named export, type-only import, props 직접 타입(React.FC 금지). renderer 라 RSC 경계 무관 | ✅ |
| **preload smoke** (`agent-workflow §8`) | 신규 IPC(`listByProject`/`addLink`/`removeLink`) renderer 첫 호출 전 존재 1회 확인 | ✅ quickstart 반영 |
| **외부 인프라 안전** (`rules/infra`) | 대상은 PostgreSQL/redis. 로컬 SQLite 마이그레이션 코드 작성은 범위 밖(쓰기 컨펌 불요). 적용은 앱 기동 시 자체 수행 | ✅ 해당 없음 |
| **빌드/테스트 포어그라운드** (CLAUDE.md) | vitest/tsc/vite 포어그라운드 | ✅ |
| **한국어 렌더 cadence** (`rules/typescript`) | `MemoPanel`·Inbox 한국어 본문 변경 → dogfooding 라이트/다크 확인 | ✅ quickstart 반영 |
| **surgical change** (글로벌 §3) | `linked_project_id` → 다대다 전환은 연쇄적이나 전부 spec 요구에 추적됨. 인접 무관 코드 변경 금지 | ✅ 위반 없음 |

위반 없음. Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/008-phase-6-memo-linking-side-panel/
├── plan.md              # This file
├── research.md          # Phase 0 — 결정 근거 + 마이그레이션 실측
├── data-model.md        # Phase 1 — Memo/연결 엔티티 + 스키마 v4 + view 타입
├── quickstart.md        # Phase 1 — 게이트 + dogfooding 시나리오
├── contracts/
│   ├── ipc-memos.md     # IPC 계약 (list/listByProject/create/addLink/removeLink/delete/restore)
│   └── ui-components.md # 컴포넌트 props 계약 (LinkPopover/MemoPanel/Inbox/App/QuickCapture)
├── checklists/
│   └── requirements.md  # (speckit-specify 산출)
└── tasks.md             # Phase 2 — /speckit-tasks 산출 (이 명령 아님)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── db/
│   │   ├── schema.ts                 # 수정: v3→v4, memo_projects 신설 + linked_project_id 이관·DROP
│   │   ├── schema.test.ts            # 수정: v4 마이그레이션(보존 이관) 테스트
│   │   ├── memoRepository.ts         # 수정: addLink/removeLink/listByProject + list 집계, link 제거
│   │   ├── memoRepository.test.ts    # 수정: 멱등/해제/조인/집계 테스트
│   │   ├── store.ts                  # 수정: captureMemo 트랜잭션
│   │   ├── store.test.ts             # 수정: captureMemo 원자성 테스트
│   │   └── types.ts                  # 수정: Memo.linkedProjectIds (linkedProjectId 제거)
│   ├── ipc/
│   │   ├── contract.ts               # 수정: listByProject/addLink/removeLink + create 입력, link 제거
│   │   └── registerHandlers.ts       # 수정: 신규 핸들러
│   └── preload.ts                    # 수정: 신규 채널 노출
└── src/
    ├── lib/
    │   ├── memoView.ts               # 수정: linkedProjects 복수 매핑
    │   └── memoView.test.ts          # 수정: 복수/사라진 작품 필터 테스트
    ├── components/
    │   ├── LinkPopover.tsx           # 신설: 작품 연결 체크리스트 팝오버
    │   ├── LinkPopover.test.tsx      # 신설: 토글 행위 테스트
    │   ├── MemoPanel.tsx             # 수정(전면): 더미 제거 → 실데이터 + 패널 내 해제
    │   ├── MemoPanel.test.tsx        # 신설: 실데이터/빈 상태/해제 테스트
    │   └── QuickCapture.tsx          # 수정(소폭): create 입력 키 linkProjectId
    ├── screens/
    │   ├── MemoInboxScreen.tsx       # 수정: 연결 버튼 + LinkPopover + 칩 복수/✕
    │   ├── MemoInboxScreen.test.tsx  # 수정: 연결/해제/복수 칩 테스트
    │   └── WriteStudioScreen.tsx     # 수정: MemoPanel 실데이터 props
    ├── App.tsx                       # 수정: listByProject 상태 + memoRefresh 트리거 + 패널 해제 핸들러
    └── types.ts                      # 수정: InboxMemo.linkedProjects (복수), 구 Memo 제거
```

**Structure Decision**: 기존 `desktop/` 단일 패키지(Electron main `electron/` + Vite/React renderer `src/`) 구조 유지. main 에 저장/IPC, renderer 에 UI/매퍼. 신규 디렉토리 없음.

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
