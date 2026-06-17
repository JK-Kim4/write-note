# Implementation Plan: 모바일 집필 지원 (iOS 입력 + 반응형)

**Branch**: `026-mobile-editor-support` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/026-mobile-editor-support/spec.md`

## Summary

iOS(WebKit, EditContext 미지원)에서 자체 에디터 입력을 가능하게 한다. 데스크탑 EditContext 경로는 그대로 유지(무회귀)하고, `CustomEditor.tsx`의 입력 결합부를 **입력 어댑터(InputAdapter) 인터페이스**로 추상화해 EditContext 어댑터(데스크탑)와 contenteditable 어댑터(iOS) 두 구현을 **기능 감지**(EditContext 지원 여부)로 분기 연결한다. 자체 엔진의 모델·측정·직접 렌더·페이지 분할은 재사용한다. 추가로 모바일 반응형(헤더 가로 overflow = 왼쪽 슬라이드) 버그를 수정한다. 양보불가 핵심(iOS 한글 입력)을 **PoC로 먼저 dogfood**한다(CLAUDE.md §10).

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Next.js 16.2 (App Router)

**Primary Dependencies**: 자체 엔진 모듈(model.ts/measure.ts/printLayout.tsx/layoutEngine.ts/geometry.ts/history.ts/pmConvert.ts) 재사용; 입력 API = EditContext(데스크탑·안드 Chrome) / contenteditable + composition events(iOS WebKit)

**Storage**: 없음(백엔드 0). 기존 자동저장 `useDocumentSession`(016) 재사용

**Testing**: Vitest(어댑터 단위·데스크탑 무회귀), iOS 한글 IME = 실기기 dogfooding(자동 불가)

**Target Platform**: 데스크탑 Chrome/Edge 121+(EditContext), 안드 Chrome(EditContext, 기존), iOS Safari/WebKit(contenteditable, 신규)

**Project Type**: web (frontend 단독, 백엔드 무변경)

**Performance Goals**: 입력 체감 지연 없음, IME 조합 정확(받침 재조합)

**Constraints**: 데스크탑 무회귀(기존 vitest GREEN 유지) MUST, 백엔드 0, iOS IME 실기기 검증

**Scale/Scope**: CustomEditor 1개 + 입력 어댑터 2종(EditContext/contenteditable) + 반응형 3곳(b/layout 헤더, BStudioShell, CustomEditor stage)

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재확인.*

`constitution.md`는 템플릿 미작성 → 프로젝트 CLAUDE.md 룰이 실질 gate:

- **TDD(RED-GREEN)**: 어댑터의 결정적 로직(이벤트→model 매핑)은 단위테스트. IME 조합 정확성은 dogfooding(자동 한계).
- **무회귀**: 데스크탑 EditContext 경로를 어댑터로 추출할 때 기존 동작 보존 — 기존 CustomEditor 관련 vitest GREEN 유지가 게이트.
- **추측 금지(§5·§6)**: 코드 위치는 실제 grep 확인. iOS IME 정확성은 실기기 검증.
- **단순성(§2)**: 어댑터 추상화는 "입력 소스 분기"라는 단일 목적. 기존 자산 무수정 재사용.
- **자동저장 idempotence(typescript/code-quality)**: 입력 경로 바뀌어도 dirty 판정/왕복 정규화 기존 규약 유지.

**판정**: PASS (정당한 추상화, 위반 없음).

## Project Structure

### Documentation (this feature)

```text
specs/026-mobile-editor-support/
├── plan.md              # 본 파일
├── research.md          # iOS contenteditable IME 처리 방식
├── data-model.md        # InputAdapter 인터페이스 + DocModel(재사용)
├── quickstart.md        # PoC 검증(iOS 실기기) 절차
└── tasks.md             # /speckit-tasks 산출 (아직 없음)
```

### Source Code (repository root)

```text
frontend/src/components/custom-editor/
├── CustomEditor.tsx          # 입력 결합부를 어댑터 사용으로 리팩토링(무회귀)
├── input/                    # 신규
│   ├── inputAdapter.ts       # InputAdapter 인터페이스 + 콜백 타입
│   ├── editContextAdapter.ts # 데스크탑 — 기존 EditContext 로직 이동(동작 보존)
│   └── contentEditableAdapter.ts # iOS — contenteditable + composition 신규
├── model.ts / measure.ts / printLayout.tsx / layoutEngine.ts
│   / geometry.ts / history.ts / pmConvert.ts   # 무수정 재사용
└── *.test.ts(x)              # 어댑터 단위테스트 추가, 기존 무회귀

frontend/src/app/b/layout.tsx        # 헤더 가로 overflow 반응형
frontend/src/components/b/BStudioShell.tsx  # 셸 모바일 반응형
frontend/src/app/layout.tsx          # (정리 단계) viewport minimum-scale 재검토
```

**Structure Decision**: 입력 결합부를 `custom-editor/input/`으로 분리. `CustomEditor`는 `InputAdapter` 인터페이스로만 입력을 받는다. 기존 EditContext 로직은 `editContextAdapter`로 **이동(동작 보존)**, iOS는 `contentEditableAdapter` 신규. 모델/측정/렌더/분할은 건드리지 않는다.

## 구현 순서 (Phase) — PoC 우선

**Phase A (PoC·양보불가 핵심)**: `InputAdapter` 인터페이스 정의 → 데스크탑 EditContext 로직을 `editContextAdapter`로 추출(무회귀 검증) → `contentEditableAdapter` 최소 구현(한글 타이핑→DocModel→자체 렌더, IME 4케이스) → 기능 감지 분기. **게이트: 사용자 iOS 실기기 한글 dogfooding.**

**Phase B (편집 이식, best-effort)**: contentEditableAdapter에 캐럿 이동·선택/드래그·편집키(Backspace/Delete/Enter/Shift+Enter)·마크·블록·undo/redo·복사/잘라내기/붙여넣기(PM JSON)·목차 점프·자동저장·페이지 분할. 데스크탑 어댑터와 동일 인터페이스로.

**Phase C (반응형)**: b/layout 헤더 가로 overflow 제거, BStudioShell·stage 모바일 레이아웃.

**Phase D (정리)**: iOS 안내 배너 제거, viewport minimum-scale 재검토(반응형이 핀치줌 깨짐을 근본 해결하면 제거 가능).

## Complexity Tracking

| 항목 | 왜 필요 | 기각한 단순 대안 |
|---|---|---|
| 입력 어댑터 추상화 | iOS/데스크탑 두 입력 소스(EditContext/contenteditable) 지원에 필수 | 단일 입력 소스 — iOS 불가 |
| 데스크탑 로직 추출 | 어댑터 분리 시 기존 EditContext 결합부 이동 불가피 | 분기 if문 산재 — 유지보수·무회귀 위험 |
