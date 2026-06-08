# Implementation Plan: 작업실 디자인 고도화 (작품 벽 · 서랍형 집필실 · 쪽지 책상)

**Branch**: `009-workshop-redesign` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-workshop-redesign/spec.md`

## Summary

세 핵심 화면을 "기능 모음"에서 "작업실"로 재구성한다: **작품 벽**(마지막 문장이 카드 얼굴) · **서랍형 집필실**(종이 우선 + 재진입 한 장 + 접힌 보기 메뉴) · **쪽지 책상**(통계/필터 제거, 붙이기 중심). 빠른 메모를 **잉크 한 방울** affordance + 모달 hardening(focus trap/restore/초안 보존)으로 올리고, 접근성(대비/focus)을 손본다.

범위 확장 2건(스키마 v5 한 마이그레이션):
1. **곁에 둘 쪽지 고정**(US6) — `memo_projects.pinned`. 재진입 한 장 선정(FR-023: 고정→최근연결→최근캡처)은 **backend use-case** `store.pickReentryMemo`.
2. **다음에 쓸 장면**(FR-002/FR-027) — `projects.next_scene`(작가 직접 입력, 작품 속성). 마지막 문장(본문 파생, 무저장)과 달리 저장값.

둘 다 repository/IPC/preload + backend 테스트를 포함한다.

## Technical Context

**Language/Version**: TypeScript 5.9 — Electron main(Node 24) + renderer(React 19)

**Primary Dependencies**: Electron, React 19, TipTap(에디터), node:sqlite(로컬 DB), Vite(빌드)

**Storage**: node:sqlite 로컬 파일 DB. 현재 스키마 v4. 본 작업에서 v5 = `memo_projects.pinned` + `projects.next_scene` 추가.

**Testing**: Vitest — renderer(jsdom, RTL) + main(node) 2 프로젝트. 기존 102 테스트 GREEN 유지.

**Target Platform**: Electron desktop(macOS 우선). 검증·빌드는 Node 24(`node:sqlite` 요구).

**Project Type**: desktop-app (Electron main + React renderer 단일 패키지 `desktop/`).

**Performance Goals**: 조작 즉각 반영(연결/고정은 optimistic, 체감 지연 0), 60fps 모션.

**Constraints**: 로컬 우선·오프라인, WCAG 2.1 AA(본문 ≥4.5:1), 한국어 IME 본문 입력 안정, 데이터 모델은 고정(`pinned`) 외 불변.

**Scale/Scope**: 단일 사용자 로컬. rail 4화면 중 3화면 재디자인 + 공용 컴포넌트(Rail/QuickCapture) + 토큰/접근성 + 고정 기능 backend.

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재확인.*

`.specify/memory/constitution.md` 는 미작성 템플릿(placeholder)이라 프로젝트 룰(`CLAUDE.md` + `.claude/rules/`)을 게이트로 적용한다.

| 게이트 | 상태 | 근거 |
|---|---|---|
| TDD(Red-Green-Refactor) | ✅ | 고정 backend 로직(repository/use-case)과 renderer 동작(재진입 선정·모달·붙이기)은 테스트 선행. 토큰/CSS·정적 외관은 §5-5 완화(설정/스타일) |
| 한국어 우선 | ✅ | UI 카피 한국어, 본문 IME 회귀 4케이스 재검 |
| Surgical changes | ✅ | 변경은 spec FR 추적. LogScreen/데이터모델(고정 외) 불변 |
| 외부 인프라 안전 | ✅ | 로컬 node:sqlite 파일 DB 자동 마이그레이션(외부 PostgreSQL/Supabase 아님 → external-infra-safety 비대상) |
| Annotation/Kotlin 룰 | N/A | 본 작업은 TS/React/Electron 한정 |

**Gate 결과: PASS** (위반 없음, Complexity Tracking 불요).

## Project Structure

### Documentation (this feature)

```text
specs/009-workshop-redesign/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 설계 결정(다음 장면 출처 / 마지막 문장 추출 / 고정 모델 / 토큰 / control / 모달 / 접근성)
├── data-model.md        # Phase 1 — memo_projects.pinned(v5) + 도메인/뷰 타입
├── contracts/           # Phase 1 — IPC 계약 변경(setPin / pickReentry / listByProject 확장)
│   └── ipc-contract.md
├── quickstart.md        # Phase 1 — 검증 절차(Node 24 / test·build / dogfooding 시나리오)
└── tasks.md             # Phase 2 — /speckit-tasks (본 명령 아님)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── db/
│   │   ├── schema.ts             # v5 마이그레이션 — memo_projects.pinned + projects.next_scene
│   │   ├── memoRepository.ts     # setPin / listByProject(pinned 포함) / pickReentry 쿼리
│   │   ├── projectRepository.ts  # next_scene — ProjectRow/toProject/Create·Update/SET 절
│   │   ├── store.ts              # pickReentryMemo use-case(고정→최근연결→최근캡처)
│   │   └── types.ts              # Project.nextScene + 작품별 pinned 표현(ProjectMemo)
│   ├── ipc/
│   │   ├── contract.ts           # ElectronAPI + CHANNELS — memos.setPin / pickReentry
│   │   └── registerHandlers.ts   # 핸들러 등록
│   └── preload.ts                # window.electronAPI.memos.* 노출
└── src/
    ├── screens/
    │   ├── ProjectsScreen.tsx       # 작업 벽형(마지막 문장 얼굴)
    │   ├── WriteStudioScreen.tsx    # 서랍형(종이 우선 + 재진입 한 장 + 접힌 보기 메뉴)
    │   └── MemoInboxScreen.tsx      # 쪽지 책상형(통계/필터 제거, 붙이기 중심, 고정 토글)
    ├── components/
    │   ├── Rail.tsx                 # 잉크 한 방울 affordance
    │   ├── QuickCapture.tsx         # 모달 hardening(focus trap/restore/초안)
    │   ├── MemoPanel.tsx            # 집필 서랍 안 연결 메모
    │   ├── Dock.tsx / ZoomControl.tsx / PanelToggle.tsx  # 접힌 "보기" 메뉴로 통합
    │   └── LinkPopover.tsx          # 작품 붙이기/고정 진입점 재사용
    ├── lib/
    │   ├── memoView.ts              # 뷰 매퍼(pinned 반영)
    │   └── lastSentence.ts          # (신규) plainText → 마지막 문장 파생
    └── styles/app.css               # --scrap 토큰 + 대비/focus-visible 조정
```

**Structure Decision**: 기존 `desktop/` 단일 패키지(Electron main + React renderer) 구조를 그대로 따른다. 신규 디렉토리 없음. 고정 기능만 electron/db·ipc·preload 에 닿고, 나머지는 src(renderer)·styles 한정.

## Complexity Tracking

> Constitution Check PASS — 위반 없음. 본 섹션 비움.
