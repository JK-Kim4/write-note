# Implementation Plan: 집필실 에디터 페이지 넘김 뷰

**Branch**: `develop` (전용 브랜치 미생성 — 사용자 지시) | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/029-editor-paged-view/spec.md`

## Summary

자체 `CustomEditor`를 **연속 세로 스크롤 → 한 화면에 한 페이지** 페이지 넘김 뷰로 완전 대체한다. 페이지 분할 결과(`view.pages: LaidOutPage[]`)는 그대로 두고 **표시 대상만 `currentPage` 한 장으로 좁힌다**. 좌/우 `< >` 오버레이 + PageUp/PageDown로 이동, 캐럿이 다른 페이지로 흘러가면 `caret.pageIndex`로 자동 전환(기존 scrollTop-follow effect 대체). 선택은 현재 페이지 내만(v1), 목차 점프는 페이지 전환으로. `layoutEngine`/`measure`/`model`/`geometry`/`printLayout`·백엔드·PDF export 무변경. 변경은 `CustomEditor.tsx`(+작은 순수 헬퍼)에 집중.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router)

**Primary Dependencies**: 자체 에디터 모듈(custom-editor). 신규 의존 0.

**Storage**: 없음 — `currentPage`는 저장 안 하는 일시 뷰 상태(useState).

**Testing**: Vitest + RTL. 페이지 이동 순수 로직(클램프·캐럿→페이지) 단위 테스트, `< >`/위치표시 RTL. **dogfooding 게이트(필수)** — 자동 테스트로 못 잡는 캐럿/선택/IME/모바일 정합.

**Target Platform**: Web. 데스크탑(`zoom`)·모바일(`transform:scale`) 양쪽 단일 페이지 렌더.

**Project Type**: Web frontend (단일 컴포넌트 집중 변경).

**Performance Goals**: 단일 페이지만 렌더 → DOM 노드 감소(긴 문서에서 오히려 가벼움). 리렌더는 캐럿/페이지 전환 시.

**Constraints**: 페이지 분할·줄 측정·문서 모델·PDF 결과 불변(FR-013/SC-005). 변경은 표시 계층(렌더 + 캐럿-페이지 동기 + 입력 핸들러 좌표)만.

**Scale/Scope**: `CustomEditor.tsx`(~1215줄) 내 렌더 블록·effect·핸들러 + 신규 순수 헬퍼 1파일. 백엔드 0.

## Constitution Check

`.specify/memory/constitution.md` 미작성 → 실질 규율은 `CLAUDE.md` + `.claude/rules/*`. 자가 점검:

- **추측 금지(HARD-GATE)**: 코드 정독으로 확정 — `LaidOutPage={index,fragments,usedHeight}`, `caretToScreen`→`pageIndex`/`screenToCaret(pageIndex,...)`는 **절대 페이지 인덱스** 기준(DOM 비의존)이라 단일 페이지 렌더에도 동작 보존. `selRects`는 이미 `pageIndex` 필터. 클릭은 `data-poc-page` 속성 기반. ✅
- **목표 상실 방지(§10)**: 핵심 = "한 화면에 한 페이지 + 자동 전환". 첫 dogfoodable 산출물이 그 핵심을 직접 실행(US1+US2). ✅
- **전면 교체 위 신기능 회귀(§15)**: 자체 에디터는 교체 진행 영역 → 캐럿/선택/IME/목차/모바일 회귀 위험. dogfooding 게이트로 검증, 028(홈)과 트랙 분리. ✅
- **TDD(§5)**: 페이지 이동 순수 로직(clamp/caret→page)·`< >` 활성/위치표시는 Red→Green. 캐럿-페이지 동기·IME 정합은 §5-5/관측(dogfooding). ✅
- **Surgical(§3)**: `CustomEditor.tsx` 렌더/effect/핸들러 최소 변경 + 헬퍼 추출. 인접 리팩토링·다른 모듈 무수정. ✅
- **deps 안정성(코드퀄리티)**: 신규 effect(캐럿→페이지)가 부모/자기 setState 호출 시 deps 안정성 점검(무한 렌더 회피). ✅

게이트 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/029-editor-paged-view/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 현 구조 사실 + 결정/대안
├── data-model.md        # Phase 1 — currentPage 뷰 상태 + 파생
├── quickstart.md        # Phase 1 — 구현 순서·dogfooding 게이트
├── contracts/
│   └── editor-paged-view.md  # 컴포넌트 동작 계약(렌더/네비/캐럿동기/선택/목차)
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
frontend/src/components/custom-editor/
├── CustomEditor.tsx          # [수정] 단일 페이지 렌더 + currentPage 상태 + < > 네비 + 캐럿→페이지 동기 + 목차 점프 전환
├── pagedView.ts              # [신규] 순수 헬퍼 — currentPage 클램프, 캐럿 pageIndex 동기 판정, 페이지 이동 계산
├── pagedView.test.ts         # [신규] 순수 헬퍼 단위 테스트
└── CustomEditor.test.tsx     # [수정/보강] < > 활성·위치표시·단일 페이지 렌더 RTL (가능 범위)
```

**Structure Decision**: 표시 로직만 바꾸므로 `layoutEngine`/`measure`/`model`/`geometry`/`printLayout`/`pmConvert`/`history`/`outline`/`input/*` **무수정**. 페이지 이동의 결정 로직은 테스트 가능한 순수 함수(`pagedView.ts`)로 빼고, `CustomEditor.tsx`는 그 결과로 렌더/상태만 조정.

## Complexity Tracking

> 게이트 위반 없음 — 비움.
