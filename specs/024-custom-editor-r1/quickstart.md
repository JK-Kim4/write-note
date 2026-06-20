# Quickstart — 자체 에디터 엔진 1라운드 검증

워크트리: `/Users/jongwan-air/Desktop/workspaces/write-note-024-custom-editor` · 브랜치 `024-custom-editor`.

## 실행

```bash
cd frontend
pnpm dev                 # Chrome/Edge 121+ 로 접속 (EditContext 전용)
```
- **PoC 참조(동결)**: `http://localhost:3000/poc/editor`
- **본 라운드 신규 라우트**: `http://localhost:3000/b/works/<projectId>/custom` (경로는 구현 시 확정)
  - ⚠️ **프레시 테스트 챕터로만** 진입(변환기 lossy 평탄화 — 기존 마크/리스트 챕터 열기 금지).

## 게이트(순수 로직 — CI 가능)

```bash
cd frontend
pnpm exec vitest run src/components/custom-editor   # 엔진·모델·변환기·아웃라인·history 단위테스트
pnpm exec tsc --noEmit                              # 타입 게이트
pnpm build                                          # RSC 경계 검출(신규 라우트 'use client' 확인)
```
기대: 레이아웃 엔진(기존 7 + heading 케이스) / `pmConvert` 왕복 무손실 / `model` 블록 동기 불변식 / `history` coalesce 전부 GREEN.

## 게이트(인터랙션 — 헤드리스 CDP)

PoC가 쓴 CDP 패턴 재사용(로컬 스크립트). 검증 항목:
- 클릭 → 캐럿 위치, `caretRangeFromPoint`와 diff 0(SC-005)
- 페이지 높이 초과 입력 → 초과 문단 **줄 단위** 다음 페이지 이어짐(SC-001, 통째 점프 0)
- 제목 토글 → 큰 글자 렌더 + 즉시 재분할(FR-008)
- 드래그/Shift·Cmd·Option+화살표 선택, 선택 위 입력=교체
- Cmd+Z/Cmd+Shift+Z undo/redo(FR-004)
- 평문 붙여넣기 → 서식 제거 삽입(FR-005)
- 입력 멈춤 → ~1.5초 후 `PUT /api/documents/{id}` 관찰(SC-002)
- 새로고침 → 본문·분할·제목 손실 0 복원(SC-002·SC-003)
- 좌측 목차 = 본문 제목 순서 일치 + 클릭 점프(SC-006)

## 게이트(사용자 dogfooding — 헤드리스 불가)

IME 조합 4케이스(`code-quality.md` 한국어 검증):
1. 빠른 타자(조합 중 다음 자모) 2. 조합 중 페이지 경계 3. 한자 변환 4. Backspace 자모 분해
+ 실제 집필 체감(쓰기→저장→재로드).

## 무회귀 확인(SC-007)

- 기본 B형 라우트 `http://localhost:3000/b/works/<id>` 가 본 라운드 전과 동일 동작(셸 추출 후 회귀 0).
- 기존 프론트 테스트 GREEN 유지.

## 데이터 안전

- 신규 라우트는 프레시 테스트 챕터에서만. 백엔드/DB/마이그레이션 변경 0(읽기·쓰기 모두 기존 `documents` API).
- 023-export 미커밋 패치(`BEditor.tsx`·`paper-editor.css`·`pageLayout.ts`·`b.css`·`write/page.tsx`) 비접촉.
