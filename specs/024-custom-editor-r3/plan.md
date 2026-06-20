# Implementation Plan: 자체 에디터 R3 — 블록 패리티 + 소프트 줄바꿈

**Branch**: `023-export` | **Date**: 2026-06-16 | **Spec**: `specs/024-custom-editor-r3/spec.md`

**Input**: Feature specification from `specs/024-custom-editor-r3/spec.md`
**상위 설계**: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`

## Summary

자체 EditContext 엔진을 TipTap의 손실 0 대체재로 만들기 위해, 인용·글머리표/번호목록·구분선 블록과 소프트 줄바꿈(hardBreak)을 1급 기능으로 추가한다. 평면 블록 모델(`buffer` + `blockAttrs[]` + `markRuns[][]`)을 유지하면서 `BlockAttr` 유니온만 확장하고, `buffer`에 블록 내 줄바꿈 마커 `U+2028`을 도입한다. measure는 R2의 오프스크린 styled-DOM+Range 방식을 일반화(인용 들여쓰기·목록 마커 폭·`U+2028` 강제 줄나눔)하며 canvas는 쓰지 않는다. pmConvert는 신규 노드(blockquote/list/listItem/hr/hardBreak) 무손실·idempotent 왕복을 보장해 R4의 기존 데이터 교체를 안전하게 만든다. layoutEngine·geometry는 무수정(블록별 줄 리스트 분할 재사용). 백엔드 변경 0.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16.2.6 (App Router)
**Primary Dependencies**: 자체 custom-editor 모듈(model/measure/pmConvert/CustomEditor/history/outline), EditContext API. 신규 외부 의존 0.
**Storage**: 디스크 포맷 = ProseMirror JSON(`documents.bodyJson`) — 경계 변환만, 백엔드/스키마 무변경.
**Testing**: Vitest (단위 — model/measure/pmConvert 순수 함수 TDD), 수동 dogfooding(브라우저, IME).
**Target Platform**: Chromium 121+ (Chrome/Edge) — EditContext.
**Project Type**: web (frontend 단독 변경).
**Performance Goals**: 타이핑 지연 체감 0, 페이지 분할 실시간(R1/R2 수준 유지).
**Constraints**: canvas 측정 금지(CJK kerning drift), 직렬화 왕복 idempotence(HARD-GATE), 공동집필 충돌감지 보존, IME 가드는 compositionstart/end.
**Scale/Scope**: 단일 사용자 dogfooding. 변경 파일 = custom-editor/ 내부 + 툴바. 신규 블록 타입 3 + 소프트 줄바꿈 1.

## Constitution Check

*GATE: constitution.md는 미작성 템플릿 → 프로젝트 CLAUDE.md HARD-GATE를 게이트로 적용.*

- **추측 금지 / 단정 금지**: 신규 노드 동작은 pmConvert/measure 실측 + 결정론 왕복 테스트로 확정. ✅ 설계 단계서 코드 검증 완료(hardBreak 드롭·Enter shiftKey 미구분).
- **TDD 규율(§5)**: model/measure/pmConvert 순수 함수는 Red-Green-Refactor. ✅ 적용.
- **직렬화 왕복 idempotence(code-quality HARD-GATE)**: SC-002 결정론 테스트로 강제. ✅ 게이트화.
- **§10 핵심 먼저**: R3의 dogfoodable 게이트 = 5종 블록+소프트 줄바꿈 무손실 왕복(핵심 직접). ✅.
- **§12 1:N 세션 키 추종**: R3는 단일 챕터 엔진 레이어 — 세션 결선 무변경(R4 영역). ✅ 비해당.
- **백엔드 0 / 공동집필 충돌감지 보존**: 본 라운드 백엔드·세션 무변경. ✅.

게이트 위반 없음 → Phase 0 진입 가능.

## Project Structure

### Documentation (this feature)

```text
specs/024-custom-editor-r3/
├── plan.md              # 본 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── internal-modules.md   # Phase 1 — 순수 모듈 계약
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/src/components/custom-editor/
├── model.ts          # BlockAttr 유니온 확장 + U+2028 + splitBlock/소프트줄바꿈/hr 캐럿 + 번호 파생 헬퍼
├── measure.ts        # 인용 들여쓰기·목록 마커 폭·U+2028 강제 줄나눔(run 일반화 유지)
├── pmConvert.ts      # blockquote/list/listItem/hr/hardBreak 무손실 idempotent 왕복
├── history.ts        # Snapshot 무변경(이미 markRuns 포함, blockAttrs 확장만 따라감)
├── CustomEditor.tsx  # Shift+Enter 라우팅 + hr 캐럿 + 신규 블록 렌더 + 툴바 버튼
└── (테스트) model.test.ts / measure.test.ts / pmConvert.test.ts

# 무수정: layoutEngine.ts, geometry.ts, useCustomOutline.ts, BCustomChapterEditor.tsx
```

**Structure Decision**: 자체 엔진 단일 모듈 내부 확장. 페이지 레이아웃 엔진(layoutEngine/geometry)과 셸 결선(BCustomChapterEditor/BStudioShell)은 본 라운드 무수정 — 블록은 줄 리스트로 측정되어 기존 분할 로직에 그대로 태워진다.

## Complexity Tracking

위반 없음 — 평면 모델 유지로 신규 추상화 없음. 트리 모델 회피가 곧 단순화.
