# Implementation Plan: Desktop 기록(Log) — 작품별 진척·작업 시간·기록 메모

**Branch**: `012-desktop-log-record` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-desktop-log-record/spec.md` · 설계 brief `docs/superpowers/specs/2026-06-08-desktop-log-record-design.ko.md`

## Summary

비어 있던 기록(Log) 화면을 실데이터로 채운다. 기록 화면(읽기 전용 작품 카드 리스트)에 작품별로 진척%(목표 글자수 대비 현재 글자수)·최근 수정일·본문 마지막 문장·최신 기록 메모(+아코디언 누적)·총 작업 시간을 표시한다. 신규 로컬 테이블 2개(`project_logs` 누적 기록 메모 / `work_sessions` 작업 시간)를 스키마 v5→v6 으로 추가하고, 작업 세션은 집필 화면 진입=시작·이탈/전환/앱닫힘=자동 종료·"작업 종료" 버튼=명시 종료(기록 메모 모달, 세션종료+로그추가 트랜잭션)로 추적한다. 30초 미만 세션 폐기·비정상 종료 dangling 정리로 총 작업 시간 신뢰도를 지킨다.

기존 자산 재사용: 진척%는 `documents.word_count`(공백 제외 글자수, `Editor.tsx:59`) + `projects.target_length`, 최근 수정일은 `projects.updated_at`(본문 저장 시 `Store.updateDocument` 가 touch), 마지막 문장은 `src/lib/lastSentence.ts`(작품 벽 카드와 동일).

## Technical Context

**Language/Version**: TypeScript 5.x (renderer + electron main), React 19, Node 24(node:sqlite 내장)

**Primary Dependencies**: Electron, React, TipTap(기존 에디터), node:sqlite — 신규 의존성 **없음**

**Storage**: 로컬 SQLite(`node:sqlite`), repository/Store/IPC 레이어 기존 패턴 재사용. 스키마 v5→v6.

**Testing**: Vitest(`node_modules/.bin/vitest` 직접 실행, Node 24 PATH 선행), tsc, vite build. TDD HARD-GATE(Red-Green-Refactor).

**Target Platform**: Desktop (Electron, macOS arm64 우선)

**Project Type**: desktop-app (Electron main + React renderer)

**Performance Goals**: 로컬 단일 사용자. 작품·로그·세션 수 수십~수백 규모. 기록 화면 조회 즉시(<100ms 체감).

**Constraints**: 로컬 우선·오프라인·단일 기기·단일 사용자. 외부 네트워크 의존 없음.

**Scale/Scope**: 작품 수십 개, 작품당 기록 메모 수십·세션 수백 수준. 화면 1개(LogScreen) 실데이터화 + 집필 화면 "작업 종료" 추가 + 신규 테이블 2개.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 **미비준 템플릿(플레이스홀더)** 이라 강제 게이트가 없다. 본 프로젝트의 실제 품질 게이트는 `CLAUDE.md` + `.claude/rules/*` 다. 본 작업에 적용되는 게이트:

- **TDD HARD-GATE** (`CLAUDE.md §5`, global testing-strategy) — repository/Store/파생 로직은 Red-Green-Refactor. Mock 은 시스템 경계(DB)만, 내부 collaborator mock 금지.
- **외부 인프라 안전** (`.claude/rules/infra/external-infra-safety.md`) — 본 작업은 **로컬 SQLite** 만 다룸(앱 런타임이 마이그레이션 수행). 외부 DB(Supabase Postgres) 쓰기 아님 → 컨펌 게이트 비해당.
- **TS 코드 퀄리티** (`.claude/rules/typescript/code-quality.md`) — `any` 금지, named export, type-only import 분리. RSC 경계는 Electron renderer 라 무관(전부 client).
- **표시값 출처 명시** (`agent-workflow-discipline §9`) — spec §Key Entities + 본 plan data-model 에 표시값 출처 박음(저장 입력/파생 분류). ✅ 충족.
- **양보 불가 핵심 첫 dogfoodable 증명** (`§10`) — US1(P1)이 신규 데이터 없이 즉시 dogfoodable 슬라이스. ✅ 분해 정합.

**판정: PASS** (강제 위반 없음, Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/012-desktop-log-record/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 열린 결정 해소
├── data-model.md        # Phase 1 — 엔티티·스키마·집계·마이그레이션
├── quickstart.md        # Phase 1 — dev/test/dogfooding 절차
├── contracts/
│   └── ipc.md           # Phase 1 — logs.* / sessions.* IPC 계약
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # Phase 2 — /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── main.ts                        # [수정] whenReady 에 store.closeDangling() + app.on("before-quit") 열린 세션 종료
│   ├── db/
│   │   ├── schema.ts                  # [수정] v5→v6: project_logs/work_sessions CREATE + 인덱스
│   │   ├── types.ts                   # [수정] ProjectLog/WorkSession/LogCard 타입 추가
│   │   ├── projectLogRepository.ts    # [신규] + .test.ts
│   │   ├── workSessionRepository.ts   # [신규] + .test.ts
│   │   └── store.ts                   # [수정] addProjectLog/endSessionWithLog/listLogCards/closeDangling/endAllOpenSessions + .test.ts
│   ├── ipc/
│   │   ├── contract.ts                # [수정] logs.*/sessions.* 계약 + CHANNELS
│   │   └── registerHandlers.ts        # [수정] 핸들러 결선
│   └── preload.ts                     # [수정] electronAPI.logs/sessions 노출
├── src/
│   ├── global.d.ts                    # [수정] ElectronAPI 타입 동기(contract.ts 인용)
│   ├── App.tsx                        # [수정] 세션 자동 시작/종료 결선(screen/activeProject effect)
│   ├── screens/
│   │   ├── LogScreen.tsx              # [수정] placeholder 제거 → 카드 리스트 + .test.tsx
│   │   └── WriteStudioScreen.tsx      # [수정] "작업 종료" 버튼 + 기록 메모 모달
│   ├── components/
│   │   └── LogCard.tsx                # [신규] 작품 기록 카드 + 아코디언 + .test.tsx
│   └── lib/
│       └── progress.ts                # [신규] 진척% 파생 + duration 포맷 + .test.ts
```

**Structure Decision**: 기존 Electron 레이어드 구조(repository → Store → IPC → preload → renderer) 그대로. 신규 repository 2개는 `MemoRepository`/`DocumentRepository` 패턴 복제. Store 에 use-case 메서드 추가. IPC 는 `CHANNELS`/`contract.ts` 컨벤션 따라 네임스페이스(`logs`/`sessions`) 추가. 앱 생명주기 훅(`main.ts` 의 `before-quit` 세션 종료 + `whenReady` 의 `closeDangling`)으로 자동 종료·dangling 정리.

## Complexity Tracking

> Constitution Check PASS — 위반 없음. 본 섹션 해당 없음.
