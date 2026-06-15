# Phase 1 Contracts — 내부 모듈 인터페이스 (2라운드)

본 라운드는 외부 HTTP/DB 계약 변경 0. 계약 = **`custom-editor/` 내부 모듈의 일반화된 인터페이스**. 각 계약은 (시그니처 / 동작 / 하위호환 / 테스트)로 규정. 마크 없는(마스크 0) 입력은 항상 1라운드와 동일 결과여야 한다(무회귀 토대).

---

## C1. `model.ts` — 마크 모델 연산

```ts
const MARK = { bold: 1, italic: 2, underline: 4, strike: 8 } as const;
type Mask = number;
type MarkRun = { len: number; mask: Mask };               // len > 0
type DocModel = { buffer: string; blockAttrs: BlockAttr[]; markRuns: MarkRun[][] };

function toggleMark(model: DocModel, lo: number, hi: number, mark: Mask): DocModel;
function marksAt(model: DocModel, offset: number): Mask;
function blockRuns(model: DocModel, blockIdx: number): MarkRun[];
function insertText(model: DocModel, lo: number, hi: number, text: string, mask: Mask): DocModel;
function deleteRange(model: DocModel, lo: number, hi: number): DocModel;   // = insertText(..,"",0)
function reconcile(model: DocModel): DocModel;            // 1라운드 reconcileAttrs 확장(blockAttrs+markRuns)
// splitBlock/mergeWithPrev/mergeWithNext/toggleHeading: 1라운드 시그니처 유지 + markRuns 추종
```

**동작 계약**:
- `toggleMark`: `[lo,hi)` 글자 전부 `mark` 비트면 해제, 아니면 적용. 결과 markRuns는 정규형(INV-5).
- `marksAt`: 좌측 글자 mask. offset===0 또는 블록 시작 → 우측 글자 mask(없으면 0).
- `blockRuns`: 정규형 run-list(len 합 = 블록 글자 수). 빈 블록 → `[]`.
- `insertText`: buffer/blockAttrs 1라운드 동작 + markRuns 삽입분=`mask` run·삭제분 제거·경계 split/merge 후 정규화.
- **하위호환**: `mask=0` + 마크 없는 model → markRuns 전부 mask 0 → 1라운드와 동일 동작.

**테스트(`model.test.ts`, TDD 선작성)**: toggleMark 부분/전체/구간경계/여러 run 횡단·재토글 해제 / insertText·deleteRange 마크 추종(구간 늘어남·줄어듦·split·merge) / blockRuns 정규형(인접 동일 병합·0길이 제거) / split·merge 시 블록 run-list 분할·이어붙임 / reconcile fallback / INV-4·5 가드.

---

## C2. `measure.ts` — 혼합 스타일 측정

```ts
function measureParagraphLines(
  text: string, marks: MarkRun[],
  contentWidthPx: number, lineHeightPx: number, fontSizePx: number, fontFamily: string,
): MeasuredLine[];                                        // MeasuredLine = {height, start, end} (불변)

function measureLineXs(
  text: string, marks: MarkRun[], lineStart: number, lineEnd: number,
  contentWidthPx: number, lineHeightPx: number, fontSizePx: number, fontFamily: string,
): number[];
```

**동작 계약**:
- 오프스크린 div를 `marks` run마다 `<span>`(bold→`font-weight:700`, italic→`font-style:italic`, underline/strike→`text-decoration`)으로 구성. fontSize/lineHeight는 블록 단위(인자) 공통.
- 줄 분해: 글자별 `Range.getBoundingClientRect().top` 그룹핑(1라운드 동일). x: `Range(lineStart→i).width`(span 가로질러 누적).
- **canvas 금지**(1라운드 회귀룰). 밑줄/취소선은 폭 불변 → 측정 영향 없음.
- **하위호환**: `marks`=단일 mask-0 run(또는 빈)이면 1라운드 단일 텍스트노드 측정과 동일 결과.

**테스트(`measure.test.ts`)**: run 그룹핑·span 구성 로직(폭 mock — jsdom 글리프 0). 픽셀 정합은 CDP/dogfooding.

---

## C3. `pmConvert.ts` — 마크 무손실 왕복

```ts
function pmJsonToModel(bodyJson: string): DocModel;       // text node marks → markRuns(정규화)
function modelToPmJson(model: DocModel): string;          // blockRuns → text node[] with marks
```

**동작 계약**:
- `modelToPmJson`: 블록마다 `blockRuns`로 분할, run마다 text node 1개 + `marks: [{type}]`(mask 비트 → `bold`/`italic`/`underline`/`strike`). mask 0 run → marks 생략(1라운드 출력과 동일).
- `pmJsonToModel`: text node의 `marks`를 비트마스크로 환원, 인접 동일 마스크 병합(정규형). 미지원 마크 무시.
- **idempotence(HARD-GATE)**: `pmJsonToModel(modelToPmJson(m)) deep-equals m`(정규형 m에 대해). `modelToPmJson(pmJsonToModel(json))` 정규형 안정.
- **하위호환**: 마크 없는 모델 → 1라운드와 바이트 동일 출력(거짓 dirty 차단).

**테스트(`pmConvert.test.ts`)**: 4종 마크 각각·복합(bold+italic) 왕복 무손실 / 인접 동일 마스크 병합 / idempotent(2회 왕복 동일) / 미지원 마크 평탄화 / 마크 없는 모델 1라운드 출력 동일.

---

## C4. `CustomEditor.tsx` — 캐럿/선택/렌더 run+affinity 일반화 + 마크 UI

**일반화(내부 함수, 시그니처는 marks·affinity 인지로 확장)**:
- `relayout(model, geo)`: 블록별 `measureParagraphLines(seg, blockRuns(model,i), …)`.
- `caretToScreen(caret: Caret, …)`: `measureLineXs(text, runs, …)` + affinity로 wrap 경계 줄 선택(1라운드 `<=` 대체).
- `screenToCaret(…) → Caret`: hit-test + affinity 결정.
- `selectionRects(s, e, …)`: `measureLineXs(text, runs, …)`.
- `ParsedBlock`에 `marks: MarkRun[]` 슬라이스 추가(측정 호출 입력원).
- 렌더 `PageBox`: 블록을 run별 `<span>`으로(측정과 동일 스타일).

**마크 UI / 입력**:
- 툴바 마크 버튼(bold/italic/underline/strike) + 단축키 Cmd+B/I/U(strike는 버튼; 단축키는 선택). **`onKey` 최상단 composing 가드 아래**(`if (e.isComposing || composingRef.current) return` 다음) — EditContext IME 회귀룰.
- 선택 있음 → `toggleMark(model, lo, hi, mark)`. 선택 없음 → `pendingMarksRef` 토글(보류 마크).
- 입력 시 마스크 = `pendingMarksRef ?? marksAt(model, caret)`(좌측 상속). 입력 후 pending 소비. 캐럿 이동 시 pending 폐기.
- 툴바 버튼 활성 = `marksAt`(또는 pending) 반영.

**하위호환**: 마크 없는 챕터 → relayout/caret/render 모두 1라운드와 동일 픽셀·동작. 기존 page.test 7 + custom-editor 순수 테스트(115) GREEN 유지.

**테스트**: 순수 분리 가능한 affinity 좌표 산술은 Vitest. 캐럿/선택/렌더 픽셀·인터랙션은 CDP + dogfooding(혼합 스타일 드리프트·마크 토글·보류 마크·IME 중 단축키).

---

## C5. `history.ts`

```ts
type Snapshot = { buffer: string; blockAttrs: BlockAttr[]; markRuns: MarkRun[][]; selection: Selection };
```
- 스냅샷에 markRuns 포함(pendingMarks 제외). coalesce/경계 규칙 1라운드 동일. undo/redo 복원 시 markRuns·selection 동기.
**테스트**: 마크 적용 후 undo → 마크 사라짐, redo → 복원.
