# Implementation Plan: 자체 에디터 엔진 2라운드 — 마크(부분 스타일) · 혼합폰트 줄 측정

**Branch**: `024-custom-editor` (R2 — 디렉토리 `024-custom-editor-r2`) | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-custom-editor-r2/spec.md`

## Summary

1라운드(구조: 문단·제목·저장·줄단위 분할·undo·클립보드)가 실제 집필실에서 dogfooding 통과한 위에, **문자 단위 인라인 마크(bold/italic/underline/strike)** 와 한 줄 안 **혼합 스타일 측정/캐럿/선택**을 더한다. 기술 접근:
- **데이터 구조 = 블록별 마크 run-list(정규형 비트마스크 run)** — 리서치(Lexical 비트마스크 per-run·ProseMirror 마크 가진 text node 시퀀스·Slate leaf·Quill Delta) 전부 run/span 리스트. EditContext offset API 정합을 위해 평문 `buffer`는 텍스트·offset SoT로 유지하고, 마크만 블록별 연속 run-list로 얹는다(정규형: 인접 동일 마스크 병합·0길이 run 제거 → idempotent).
- **측정 일반화 = 오프스크린 styled-DOM + Range** — 1라운드 `measure.ts`(단일 폰트 파라미터)를 run 인지로 일반화. 한 줄을 run마다 실제 weight/style 적용한 `<span>`으로 렌더해 `Range.getClientRects()`로 측정(canvas 금지 — CJK 커닝·CSS 셰이핑 오차, 1라운드 회귀룰).
- **캐럿 affinity = `(offset, affinity)` 튜플** — 1라운드 `caretToScreen`의 `< vs <=` 워크어라운드를 upstream/downstream(앞=줄끝, 뒤=줄시작) 정식 추적으로 대체(ProseMirror bias / CodeMirror assoc 모델).
- **경계 변환** — 디스크 PM JSON 무변경. `pmConvert`가 마크를 PM text node `marks`(`bold`/`italic`/`underline`/`strike`, TipTap v3 StarterKit 검증값)로 무손실 왕복. 자동저장(016)·버전 토큰·draft·충돌 감지 무수정 재사용. **백엔드 변경 0.**

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Next.js 16.2.6 (App Router)

**Primary Dependencies**: 브라우저 `EditContext` API(Chromium 121+), 1라운드 `custom-editor/` 모듈, 기존 `useDocumentSession`(016), 기존 저장 API. TipTap은 변경 대상 아님(마크 JSON 이름 정합 참조만 — `@tiptap/starter-kit@3.23.5` 검증 완료: bold/italic/underline/strike 4종 포함, mark `name` = 각각 `bold`/`italic`/`underline`/`strike`).

**Storage**: `documents.bodyJson` = ProseMirror JSON 문자열. 본 라운드도 백엔드/DB/마이그레이션 변경 **0**. text node `marks` 배열 왕복만 경계 변환에 추가.

**Testing**: Vitest(순수 — model 마크 연산·blockRuns 파생·pmConvert 마크 왕복 무손실·affinity 좌표 로직), 헤드리스 CDP(혼합 스타일 캐럿/선택/hit-test·마크 렌더), 사용자 dogfooding(IME 조합 중 마크 단축키 — 헤드리스 불가). **검증 한계**: jsdom 글리프 폭 0 → 혼합 advance 정합은 CDP/dogfooding 게이트(1라운드와 동일).

**Target Platform**: Chromium(Chrome/Edge 121+) 전용 우선. Safari/Firefox는 후반 라운드.

**Project Type**: Web frontend (모노레포 `frontend/` 내부). 백엔드 무변경.

**Performance Goals**: 매 입력 시 편집 블록 재측정 허용(1라운드 수준). 혼합 스타일 측정이 run 수만큼 span을 만들어도 한 블록 단위라 비용 제한적. 캐럿 드리프트 0(SC-001).

**Constraints**: 백엔드 무변경 / plumbing 무수정 재사용 / 프레시 테스트 챕터 한정(변환기 lossy) / 1라운드 기능 무회귀(SC-007) / 기본 B형 무회귀(SC-008) / 023-export 미커밋 패치 비접촉 / `layoutEngine.ts` 무수정.

**Scale/Scope**: 1라운드 모듈 4개(model·measure·pmConvert·CustomEditor) run 단위 일반화 + history 스냅샷에 marks 추가. 신규 파일 최소(geometry/layoutEngine/outline/BCustomChapterEditor 무영향).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`는 미작성 템플릿(비준 헌장 없음). 프로젝트 `CLAUDE.md` HARD-GATE를 사실상 게이트로 적용:

| 게이트 | 적용 | 상태 |
|---|---|---|
| **TDD(Red-Green-Refactor)** | 순수 로직(model 마크 토글·삽입/삭제 추종·blockRuns 정규형·pmConvert 마크 왕복·affinity 좌표 산술)은 실패 테스트 선작성 의무. 혼합 렌더/측정 픽셀 정합은 CDP·dogfooding. | PASS — contracts에 테스트 우선 명시 |
| **추측 금지** | 일반화 대상(measure/model/pmConvert/CustomEditor) plan 작성 전 정독 완료. TipTap 마크 이름·StarterKit underline 포함 grep 검증 완료. 데이터 구조·측정·affinity는 리서치 1차 출처 검증. | PASS |
| **Surgical / 무회귀** | 1라운드 모듈 일반화는 기존 시그니처를 run 인지로 확장하되 기존 동작(마크 없음=단일 run) 보존. 기본 B형·layoutEngine·geometry·outline 무수정. SC-007/008 회귀 가드. | PASS — contracts에 하위호환(빈 마크=1라운드 동작) 명시 |
| **Simplicity / YAGNI** | 마크 4종만. 임의 글꼴·색·링크·하이라이트 비범위. dense 배열·트리 모델 기각(run-list만). | PASS |
| **외부 인프라 안전** | 백엔드/DB 무변경. 마이그레이션 0. | PASS — N/A |

위반 없음 → Complexity Tracking 공란.

## Project Structure

### Documentation (this feature)

```text
specs/024-custom-editor-r2/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 설계 결정·대안(리서치 근거)
├── data-model.md        # Phase 1 — 마크 run-list 모델·변환·affinity
├── quickstart.md        # Phase 1 — 실행·dogfooding 절차
├── contracts/
│   └── internal-modules.md   # Phase 1 — 일반화된 모듈 인터페이스 계약
└── tasks.md             # /speckit-tasks 산출(본 명령 비생성)
```

### Source Code (repository root — `frontend/`)

```text
frontend/src/components/custom-editor/
├── model.ts             # ★ marks:number[] 추가 + toggleMark/marksAt/blockRuns + insert/delete marks 추종 + reconcile 확장
├── model.test.ts        # ★ 마크 토글(부분/전체/경계/횡단)·삽입삭제 추종·blockRuns 정규형 TDD
├── measure.ts           # ★ measureParagraphLines/measureLineXs 를 marks 인지(오프스크린 styled-span + Range) 일반화
├── measure.test.ts      # ★ run 그룹핑·줄분해 로직 TDD(폭 mock — 픽셀은 CDP)
├── pmConvert.ts         # ★ text node marks 무손실 왕복(run-list ↔ PM marks) + 정규형 idempotence
├── pmConvert.test.ts    # ★ 마크 왕복 무손실·idempotent·미지원 마크 평탄화 TDD
├── history.ts           # ★ Snapshot 에 marks 포함
├── CustomEditor.tsx     # ★ relayout/caretToScreen/screenToCaret/selectionRects run+affinity 일반화 + 렌더 run span + 마크 툴바 + Cmd+B/I/U(composing 가드) + pendingMarks ref
├── geometry.ts          # 무수정
├── layoutEngine.ts      # 무수정(줄별 height만 봄)
├── outline.ts·useCustomOutline.ts # 무수정
└── BCustomChapterEditor.tsx        # 무수정(경계 변환만 — body 문자열 그대로)
```

**Structure Decision**: 신규 파일 없음 — 1라운드 모듈 4개(model·measure·pmConvert·CustomEditor)와 history를 run 단위로 일반화한다. `marks`가 빈(마스크 0) 모델은 1라운드와 동일 동작이 되도록 하위호환 유지(무회귀 토대). geometry·layoutEngine·outline·BCustomChapterEditor·기본 B형 라우트는 무수정.

## Complexity Tracking

> Constitution Check 위반 없음 — 공란.
