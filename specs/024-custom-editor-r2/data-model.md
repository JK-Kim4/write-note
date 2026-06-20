# Phase 1 Data Model — 자체 에디터 엔진 2라운드 (마크·혼합폰트)

본 라운드는 **백엔드/DB 변경 0**. 1라운드 메모리 내부모델(`DocModel = {buffer, blockAttrs}`)에 **마크 차원**을 더하고, 측정/캐럿을 run·affinity 인지로 일반화한다. 영속 스키마는 기존과 동일(`documents.bodyJson` 문자열).

## 1. 디스크 표현 (영속 — 기존, 무변경)

- **`documents.bodyJson`**: ProseMirror JSON 문자열. text node 형태: `{ type:'text', text, marks?: [{type}] }`.
- 본 라운드가 왕복하는 **마크 `type`**: `bold` · `italic` · `underline` · `strike` (TipTap v3 StarterKit 검증값).
- 미지원 마크(`link`·`highlight` 등) + 미지원 노드 → 1라운드처럼 평탄화(lossy). 프레시 테스트 챕터 전제.
- **버전 토큰 `version`**: 무변경·무력화 금지.

## 2. 메모리 내부모델 (휘발 — 마크 차원 추가)

### 2.1 마크 마스크 (비트마스크 — Lexical 방식)
```
MARK = { bold: 1, italic: 2, underline: 4, strike: 8 } as const
Mask = number   // 위 비트의 OR. 0 = 평문.
```

### 2.2 `MarkRun` / 블록 run-list
```
MarkRun = { len: number; mask: Mask }   // len = 글자 수(>0)
// 한 블록의 텍스트를 빈틈없이 덮는 연속 run 분할.
// 정규형 불변식: 인접 run의 mask 가 서로 다름 + 모든 len > 0.
```

### 2.3 `DocModel` (확장)
```
DocModel = {
  buffer: string             // 1라운드 동일 — 텍스트·offset SoT('\n'=블록)
  blockAttrs: BlockAttr[]    // 1라운드 동일 — 블록 1:1
  markRuns: MarkRun[][]      // ★ 신규 — 블록별 run-list. 길이 = 블록 수.
}
```
- `markRuns[i]`의 run.len 합 = i번째 블록의 글자 수(개행 제외). 빈 블록 → `[]`(빈 배열).
- 마스크 0만으로 덮인 블록 → 정규형상 `[{len: 블록길이, mask: 0}]` 또는 `[]`(빈 블록). 둘 다 "마크 없음" = 1라운드 동일 렌더(하위호환).

### 2.4 `Caret` / `Selection` (affinity 추가)
```
Affinity = -1 | 1            // -1 = upstream(앞 줄 끝), +1 = downstream(다음 줄 시작)
Caret = { offset: number; affinity: Affinity }
Selection = { anchor: number; focus: number; affinity: Affinity }  // affinity = focus 쪽
```
- 1라운드 `Selection = {anchor, focus}`(buffer offset)에 affinity 1개 추가(focus 캐럿용). 기본값 +1(downstream).

### 2.5 보류 마크 (모델 밖 — 전이 상태)
```
pendingMarksRef: Mask | null   // CustomEditor ref. null = 없음.
```
- 선택 없이 토글 시 설정. 다음 입력이 소비 → null. 캐럿 이동 시 null. **history·직렬화 비대상**(selection/composing 과 같은 계열).

### 2.6 불변식 (TDD 보호 — `model.test.ts`)
- **INV-1/2/3**: 1라운드 동일(blockAttrs 정렬·heading level·빈 모델).
- **INV-4 run 정렬**: `markRuns.length === blockAttrs.length`(블록 수 일치). 각 블록 run.len 합 === 블록 글자 수.
- **INV-5 정규형**: 모든 블록 run-list가 정규형(인접 동일 mask 없음, len>0). 모든 편집·변환 후 성립.

## 3. 모델 연산 (`model.ts` — buffer/blockAttrs/markRuns 동기)

| 연산 | 입력 | 효과 |
|---|---|---|
| `toggleMark(model, lo, hi, mark)` | 선택·마크 | `[lo,hi)` 전부 그 마크면 비트 해제, 아니면 적용. 영향 블록 run-list 재구성 + 정규화. 순수 반환. |
| `marksAt(model, offset)` → Mask | offset | 좌측 글자 mask(offset 0 또는 블록 시작이면 우측/0). 툴바 활성·입력 상속 입력원. |
| `blockRuns(model, blockIdx)` → MarkRun[] | 블록 | 파생 — 그 블록 정규형 run-list(저장값 그대로 또는 재계산). measure/render/pmConvert 공통. |
| `insertText(model, lo, hi, text, mask)` | 치환·삽입 마스크 | 1라운드 buffer/blockAttrs 동기 + markRuns: 삽입분 = `mask` run, 삭제분 제거, 경계 run split/merge 후 정규화. |
| `deleteRange(model, lo, hi)` | 범위 | insertText(…, "", 0) — markRuns 삭제 추종 + 정규화. |
| `splitBlock`/`mergeWithPrev`/`mergeWithNext`/`toggleHeading` | (1라운드) | 1라운드 동작 + markRuns 블록 분할/병합 추종(병합 시 두 블록 run-list 이어붙임 후 정규화). |
| `reconcile(model)` | — | 1라운드 reconcileAttrs 확장 — blockAttrs(블록 수)·markRuns(블록 수·run.len 합) 둘 다 보정. fallback. |

- 모든 연산 **순수**(새 `DocModel`), 호출부가 EditContext 동기.
- **하위호환**: `mask=0` 입력·마크 없는 모델은 1라운드와 동일 결과(markRuns가 전부 mask 0).

## 4. 측정/렌더 파생 (휘발 — `measure.ts` run 일반화)

### 4.1 `measureParagraphLines` (run 인지)
```
measureParagraphLines(text, marks: MarkRun[], contentWidthPx, lineHeightPx, fontSizePx, fontFamily) → MeasuredLine[]
```
- run마다 `<span style="font-weight/font-style/text-decoration">`로 오프스크린 div 구성. 글자별 Range.top 그룹핑(1라운드 동일). `MeasuredLine = {height, start, end}` 불변(height=블록 lineHeightPx).

### 4.2 `measureLineXs` (run 인지)
```
measureLineXs(text, marks: MarkRun[], lineStart, lineEnd, contentWidthPx, lineHeightPx, fontSizePx, fontFamily) → number[]
```
- 동일 styled-span div에 `Range(lineStart→i).getBoundingClientRect().width`(여러 span 가로질러 누적). 캐럿 x·hit-test.

### 4.3 렌더 (CustomEditor `PageBox`)
- 블록 div를 단일 텍스트 대신 **run마다 `<span>`**(weight/style/decoration)으로 렌더. 측정 div와 동일 스타일 → 픽셀 일치.

### 4.4 `layoutEngine.ts` / `geometry.ts`
- **무수정**. `layout()`은 줄 height만 보고, blockFont(heading)는 블록 단위라 마크 무관.

## 5. 캐럿 affinity 파생 (`CustomEditor.tsx`)

- `caretToScreen(caret: Caret, …)`: wrap 경계 offset에서 affinity로 줄 선택(-1=앞 줄 끝, +1=다음 줄 머리). 1라운드 `< vs <=` 분기 대체.
- `screenToCaret(…)` → `Caret`: 클릭 시 가까운 줄·방향으로 affinity 결정.
- 이동: 좌/우 화살표·End/Home·클릭이 affinity를 방향과 일관 갱신.

## 6. 히스토리 (휘발 — `history.ts`)
```
Snapshot = { buffer, blockAttrs, markRuns, selection }   // ★ markRuns 추가
```
- pendingMarks 비포함(전이 상태). undo/redo 복원 시 markRuns·selection 함께 복원.

## 7. 저장 경계 흐름 (1라운드 동일 — 마크만 추가)
```
[로드]  bodyJson ──pmJsonToModel(marks 환원·정규화)──▶ DocModel ──relayout──▶ 화면
[입력]  키/IME/마우스 ──model 연산(markRuns 동기)──▶ DocModel ──relayout──▶ 화면 + EditContext 동기
[저장]  DocModel ──modelToPmJson(run→text node marks)──▶ bodyJson ──useDocumentSession(body 문자열)──▶ PUT
```
- `useDocumentSession` plumbing 무수정(body=문자열). 왕복 idempotence(정규형) 유지 → 거짓 dirty 차단.
