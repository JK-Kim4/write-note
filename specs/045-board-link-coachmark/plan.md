# Implementation Plan: 보드 "끌어서 잇기" 첫-진입 코치마크

**Branch**: `worktree-045-board-link-coachmark` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/045-board-link-coachmark/spec.md`

## Summary

보드 캔버스에서 **처음** 어느 카드든 연결점(React Flow `Handle`)에 커서를 올리면, 커서가 올라간 바로 그 연결점(top/right/bottom/left)에서 바깥으로 **"끌어서 잇기"** 텍스트가 1회 떠 잇기 제스처를 가르친다. 본 즉시 `localStorage` 단일 플래그에 기록 → 이후 재진입·다른 보드에서 안 뜸. 본 뒤로는 매 hover 에 연결점만(현행 보존).

기술 접근: 신규 순수 모듈 `boardCoachmark.ts`(seen 플래그) + 순수 헬퍼 `linkHintPlacement.ts`(앵커→방향/캐럿 클래스) + `CardNode.tsx` 결선(`hoveredHandle` 상태 + 각 `<Handle>` `onMouseEnter`/`onMouseLeave` + 라벨 렌더·1회성 마크). 순수 로직 TDD + 캔버스 시각/hover 는 dogfooding 게이트.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router)

**Primary Dependencies**: `@xyflow/react` 12.11.1 (React Flow), 기존 보드 컴포넌트(`CardNode`·`PlotBoardCanvas`·`boardActions`)

**Storage**: `localStorage` (클라이언트, 단일 boolean 플래그 `{ linkHint?: true }`). 서버·DB·React Query 무관.

**Testing**: Vitest(순수 단위 — `boardCoachmark`·`linkHintPlacement`) + dogfooding(시각·hover·캔버스 상호작용, jsdom 미검증 — 룰 14·25)

**Target Platform**: 웹(데스크탑 Chromium/Safari). 보드 `colorMode=light` 고정(다크 변형 불요).

**Project Type**: web frontend (`frontend/`)

**Performance Goals**: 코치마크는 커서가 연결점에 닿는 즉시 표시. 라벨 `pointer-events-none` 으로 잇기 드래그 무지연.

**Constraints**: **FE only** — 백엔드·마이그레이션·에러코드 0. 잇기 4경로·종류 칩·삭제·선택 인디케이터·드래그/뷰포트 **회귀 0**.

**Scale/Scope**: 카드 컴포넌트 1종(`CardNode`) 수정 + 신규 순수 모듈 2(seen 플래그·placement 헬퍼). 신규 화면/라우트 0.

## Constitution Check

*GATE: Phase 0 전 통과 필수. Phase 1 후 재확인.*

`.specify/memory/constitution.md` = 빈 템플릿 → **프로젝트 `CLAUDE.md` + `.claude/rules/` 준용**(이전 보드 spec 040~044 동일). 관련 게이트:

- **TDD(룰 5)**: 순수 로직(`boardCoachmark` seen 판정·마크·손상 화해 / `linkHintPlacement` 앵커→방향) Red-Green-Refactor. 캔버스 hover·시각은 §5-5 예외 + dogfooding 게이트.
- **TS 코드 품질**: named export, type-only import 분리, `'use client'`(CardNode 이미 client), RSC 경계는 `pnpm build` 검출. `any` 금지·리터럴 Tailwind 클래스(JIT 안전, `cardKinds.ts` 패턴).
- **빈 상태/오버레이 룰**: 본 기능은 빈 상태 아님. 코치마크는 **비차단 오버레이**(`pointer-events-none`)만 — 화면 takeover 아님.
- **추측 금지(HARD-GATE)**: RF `Handle` 이벤트 forward·드래그 무충돌 **실측 완료**(research.md). 추측 0.

→ **위반 없음. 게이트 통과.** (Complexity Tracking 생략)

## Project Structure

### Documentation (this feature)

```text
specs/045-board-link-coachmark/
├── spec.md              # 완료
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정·근거(RF Handle 실측·localStorage·custom)
├── data-model.md        # Phase 1 — localStorage 키·shape, seen 상태
├── quickstart.md        # Phase 1 — dogfooding 게이트 체크리스트
├── contracts/
│   └── coachmark-module.md   # 순수 모듈 API 계약(테스트 surface)
└── tasks.md             # Phase 2(/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/src/
├── lib/
│   ├── boardCoachmark.ts          # 신규: localStorage seen 플래그(순수) — lastViewedBoard.ts 패턴 미러
│   └── boardCoachmark.test.ts     # 신규: TDD(seen 판정·마크·손상 화해·저장소 부재)
└── components/board/
    ├── linkHintPlacement.ts       # 신규: 앵커(top/right/bottom/left)→방향·캐럿 클래스(순수)
    ├── linkHintPlacement.test.ts  # 신규: TDD(4 앵커 매핑)
    └── CardNode.tsx               # 수정: hoveredHandle 상태 + Handle onMouseEnter/Leave + "끌어서 잇기" 라벨·1회성 마크
```

**Structure Decision**: 기존 `frontend/` 구조 보존. 전역 영속 모듈은 `lib/`(`lastViewedBoard.ts` 인접), 보드 한정 시각 헬퍼는 `components/board/`. `CardNode.tsx`(현 215줄)에 hover 감지·라벨만 증분 — `PlotBoardCanvas`·`boardActions`·`cardKinds` 무변경.

## Complexity Tracking

위반 없음 — 생략.
