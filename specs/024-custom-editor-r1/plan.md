# Implementation Plan: 자체 에디터 엔진 1라운드 — B형 집필실 수직 슬라이스(구조)

**Branch**: `024-custom-editor` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-custom-editor-r1/spec.md`

## Summary

PoC로 증명된 자체 EditContext 페이지 분할 엔진을 **실제 B형 집필실의 신규 전용 라우트에 꽂아**, 작가가 프레시 테스트 챕터에 문단·제목을 쓰고 → 자동저장 → 재로드되는 흐름을 처음으로 실환경에서 동작시킨다. 기술 접근:
- **경계 변환** — 디스크는 현행 ProseMirror JSON(`documents.bodyJson`) 유지. 자체 엔진은 메모리 내부모델(평문 버퍼 + 블록 속성)만 쓰고 로드/저장 경계에서 양방향 변환. 자동저장(016)·버전 토큰·localStorage draft·충돌 감지는 문자열 `body`를 그대로 받으므로 **무수정 재사용**.
- **PoC 자산 승격** — `geometry`/`layoutEngine`/`measure`(순수)는 거의 그대로, `PocEditorLive`의 입력·캐럿·선택을 정식 컴포넌트로 승격하며 **블록별 폰트(heading)** + **블록 속성 동기** + **undo/paste**로 확장.
- **신규 라우트 + 셸 재사용** — B형 3패널 셸·`ChapterList`·`BWorkSidePanel`을 재사용하고 에디터 코어만 자체 엔진으로 교체. TipTap 인스턴스 의존인 `useEditorOutline`은 엔진 모델 파생 아웃라인으로 재결선.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Next.js 16.2.6 (App Router)

**Primary Dependencies**: 브라우저 `EditContext` API(Chromium 121+), 기존 `useDocumentSession`(016), React Query, 기존 저장 API(`PUT /api/documents/{id}`). TipTap은 본 라운드에서 **변경 대상 아님**(기본 B형 라우트·`outline.ts` 타입만 재사용).

**Storage**: `documents.bodyJson` = ProseMirror JSON 문자열. 본 라운드는 백엔드/DB/마이그레이션 변경 **0**. 경계 변환만 프론트에 추가.

**Testing**: Vitest(레이아웃 엔진 순수 TDD + PM JSON↔모델 왕복 변환기 TDD), 헤드리스 CDP(클릭 캐럿·`caretRangeFromPoint` diff·선택·undo·paste 인터랙션), 사용자 dogfooding(IME 조합 — 헤드리스 불가).

**Target Platform**: Chromium(Chrome/Edge 121+) 전용 우선. Safari/Firefox는 후반 라운드.

**Project Type**: Web frontend (기존 모노레포 `frontend/` 내부). 백엔드 무변경.

**Performance Goals**: 규격/폰트 변경 리플로우 < 1초(SC-004). 매 입력 전체 재측정은 본 라운드 허용(증분 재측정·가상화는 후반). 캐럿 드리프트 0(SC-005).

**Constraints**: 백엔드 무변경 / 저장·버전·충돌 plumbing 무수정 재사용 / 데이터 안전 = 프레시 테스트 챕터 한정(변환기 lossy) / 기본 B형 무회귀(SC-007) / 023-export 미커밋 패치 비접촉.

**Scale/Scope**: 단일 챕터 편집(다페이지 문서). 신규 라우트 1개 + 승격 모듈 1개(`custom-editor/`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`는 미작성 템플릿(비준 헌장 없음). 대신 프로젝트 `CLAUDE.md` HARD-GATE를 사실상 게이트로 적용:

| 게이트 | 적용 | 상태 |
|---|---|---|
| **TDD(Red-Green-Refactor)** | 순수 로직(레이아웃 엔진 heading 케이스, PM JSON↔모델 변환기)은 실패 테스트 선작성 의무. 입력/캐럿/렌더는 CDP·dogfooding 검증(브라우저 측정 영역). | PASS — Phase 1 contracts에 변환기·엔진 테스트 우선 명시 |
| **추측 금지** | 통합·승격 대상 코드(PocEditorLive/geometry/page/BChapterEditor/useDocumentSession/pageLayout/outline)를 plan 작성 전 직접 정독 완료. | PASS |
| **Surgical / 기본 B형 무회귀** | 기존 B형 라우트·BEditor·useDocumentSession 무수정. 신규 라우트·신규 모듈로 격리. SC-007 회귀 가드. | PASS — 셸 재사용 전략(Phase 0)에서 무회귀 보장안 명시 |
| **Simplicity / YAGNI** | 마크·portable 백엔드·접근성·증분 성능 모두 비범위. 본 라운드는 구조(문단/제목)만. | PASS |
| **외부 인프라 안전** | 백엔드/DB 무변경. 마이그레이션 0. | PASS — N/A |

위반 없음 → Complexity Tracking 공란.

## Project Structure

### Documentation (this feature)

```text
specs/024-custom-editor-r1/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 설계 결정·대안
├── data-model.md        # Phase 1 — 내부모델·변환·기하 엔티티
├── quickstart.md        # Phase 1 — 실행·검증 절차
├── contracts/
│   └── internal-modules.md   # Phase 1 — 내부 모듈 인터페이스 계약
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(통과)
└── tasks.md             # /speckit-tasks 산출(본 명령 비생성)
```

### Source Code (repository root — `frontend/`)

```text
frontend/src/
├── components/
│   ├── poc-editor/                 # PoC — 동결 reference(라우트 /poc/editor 유지). 본 라운드 비수정.
│   │                               #   단, 순수 3파일은 custom-editor 로 이전(SoT 단일화) + import 재지정.
│   ├── custom-editor/              # ★ 신규 — 승격된 자체 엔진 모듈
│   │   ├── geometry.ts             # poc 이전 + A2 추가 + 블록별 폰트 파생(headingFont)
│   │   ├── layoutEngine.ts         # poc 이전(무변경) + heading 가변 줄높이 테스트
│   │   ├── layoutEngine.test.ts    # 기존 7 + heading 케이스
│   │   ├── measure.ts              # poc 이전 + 블록별 폰트 파라미터 일반화
│   │   ├── model.ts                # ★ 내부 문서모델(buffer + blockAttrs) + 편집 연산(split/merge/toggleHeading)
│   │   ├── model.test.ts           # ★ 편집 연산·블록 속성 동기 TDD
│   │   ├── pmConvert.ts            # ★ PM JSON ↔ 내부모델 양방향 변환기
│   │   ├── pmConvert.test.ts       # ★ 왕복 무손실 TDD
│   │   ├── outline.ts              # ★ 엔진 모델 → OutlineItem 파생 + 점프 좌표
│   │   ├── history.ts              # ★ undo/redo 스냅샷 스택
│   │   ├── CustomEditor.tsx        # ★ PocEditorLive 승격 — 입력/캐럿/선택/heading/undo/paste
│   │   └── BCustomChapterEditor.tsx# ★ useDocumentSession 결선 래퍼(BChapterEditor 대응)
│   ├── b/                          # BWorkSidePanel·BChapterEditor(무수정) — 재사용
│   └── editor/
│       ├── pageLayout.ts           # 무수정(자체 엔진은 미사용 — stylized 모델)
│       └── ChapterList.tsx         # 무수정 — 재사용
├── lib/editor/outline.ts           # OutlineItem 타입 재사용(무수정)
└── app/b/works/[id]/
    └── (신규 라우트)/page.tsx       # ★ 신규 — B형 셸 재사용 + 자체 엔진. 라우트 경로 Phase 0 확정.
```

**Structure Decision**: 기존 `frontend/` 단일 앱. 본 라운드는 (1) PoC 순수 3파일을 `custom-editor/`로 이전해 단일 SoT화(+PoC 라우트 import 재지정, surgical), (2) 신규 모듈 `custom-editor/`에 모델·변환·아웃라인·history·승격 컴포넌트 신설, (3) 신규 라우트 1개 신설. 기존 B형 라우트/BEditor/useDocumentSession은 무수정.

## Complexity Tracking

> Constitution Check 위반 없음 — 공란.
