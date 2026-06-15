# Phase 1 Contracts — 내부 모듈 인터페이스

본 라운드는 신규 **백엔드 API 없음**(기존 `PUT /api/documents/{id}` 무변경 재사용). 따라서 계약 대상은 자체 엔진의 **내부 모듈 인터페이스**다. 각 모듈은 독립 테스트 가능(순수 로직은 Vitest, 브라우저 측정은 CDP/dogfooding). TDD 대상은 ★ 표시.

## C1. `pmConvert.ts` ★ (순수 — Vitest)

```ts
export function pmJsonToModel(bodyJson: string): DocModel
export function modelToPmJson(model: DocModel): string
```
**계약**:
- `pmJsonToModel`: 유효 PM JSON → `DocModel`. `paragraph`→paragraph 블록, `heading{level}`→heading 블록, 그 외→평문 평탄화(paragraph). 파싱 실패/빈 doc → `{ buffer:'', blockAttrs:[{type:'paragraph'}] }`.
- `modelToPmJson`: `DocModel` → `{type:'doc', content}` 문자열. 빈 블록 → content 없는 노드. 이미지 블록 → 빈 paragraph(상호운용).
- **불변식(★ 테스트)**: paragraph·heading(1~3)만으로 된 모델 `m`에 대해 `pmJsonToModel(modelToPmJson(m))` ≡ `m`(buffer·blockAttrs 동일). = SC-003 왕복 무손실.
- **테스트 케이스**: 단일 문단 / 다문단 / heading 1·2·3 혼합 / 빈 문서 / 빈 블록 포함 / list·blockquote 평탄화(lossy 확인) / 잘못된 JSON.

## C2. `model.ts` ★ (순수 — Vitest)

```ts
export type BlockAttr = { type: 'paragraph' } | { type: 'heading'; level: 1 | 2 | 3 }
export type DocModel = { buffer: string; blockAttrs: BlockAttr[] }
export type Selection = { anchor: number; focus: number }

export function blockIndexAt(model: DocModel, offset: number): number
export function splitBlock(model: DocModel, caret: number): DocModel
export function mergeWithPrev(model: DocModel, blockIdx: number): DocModel
export function mergeWithNext(model: DocModel, blockIdx: number): DocModel
export function deleteRange(model: DocModel, lo: number, hi: number): DocModel
export function insertText(model: DocModel, lo: number, hi: number, text: string): DocModel
export function toggleHeading(model: DocModel, blockIdx: number, level: 1 | 2 | 3): DocModel
export function reconcileAttrs(model: DocModel): DocModel  // INV-1 fallback 보정
```
**계약**:
- 모든 연산 **순수**(새 `DocModel`). 연산 후 **INV-1**(`blockAttrs.length === buffer.split('\n').length`)·**INV-2**(heading level 1~3) 성립.
- `splitBlock`: 캐럿 위치 `\n` 삽입 + index+1에 paragraph attr 삽입, 앞 블록 attr 유지.
- `mergeWithPrev`/`mergeWithNext`: 경계 `\n` 제거 + 유지 블록 attr 보존, 제거 블록 attr 삭제.
- `toggleHeading`: buffer 불변, 해당 블록 attr 토글(현재 heading 동일 level이면 paragraph로).
- `reconcileAttrs`: blockAttrs 길이를 블록 수에 맞춤(부족분 paragraph, 초과분 절단) — 미가로챈 자동 편집 graceful 보정.
- **테스트 케이스(★)**: 본문 중 Enter 분할 / heading 중 Enter→다음 paragraph / 블록시작 Backspace 병합(attr 보존) / 블록끝 Delete 병합 / 다블록 선택삭제 / heading 토글·해제 / 각 후 INV-1·INV-2.

## C3. `geometry.ts` (순수 — Vitest, 기존 + 확장)

```ts
export type PaperSize = 'A5' | 'A4' | 'B4' | 'A3' | 'A2'   // A2 추가
export function pageGeometry(size: PaperSize, fontSizePx: number, lineHeightRatio?: number): PageGeometry
export function blockFont(attr: BlockAttr, base: PageGeometry): { fontSizePx: number; lineHeightPx: number }  // 신규
```
**계약**: `pageGeometry`는 실제 mm 비율 px(기존). `blockFont`는 paragraph=base, heading=배율 적용(H1 1.8×/H2 1.5×/H3 1.25×). 순수.

## C4. `layoutEngine.ts` ★ (순수 — Vitest, 기존 무변경 + 케이스 추가)

```ts
export function layout(blocks: MeasuredBlock[], contentHeightPx: number): LaidOutPage[]
```
**계약**: 기존 그대로(줄단위 분할·이미지 push). **추가 테스트(★)**: 블록마다 `MeasuredLine.height`가 다른(heading 큰 줄높이) 입력에서 경계 분할이 정확(SC-001·FR-008).

## C5. `measure.ts` (브라우저 — CDP/dogfooding, 기존 + 일반화)

```ts
export function measureParagraphLines(text, contentWidthPx, lineHeightPx, fontSizePx, fontFamily): MeasuredLine[]
export function measureLineXs(text, lineStart, lineEnd, contentWidthPx, lineHeightPx, fontSizePx, fontFamily): number[]
```
**계약**: 시그니처 유지(이미 블록 폰트 파라미터를 받음). 호출부(`relayout`·caret·selection)가 **블록별 폰트로 호출**하도록 일반화. canvas 측정 금지(DOM Range 통일 — 캐럿 드리프트 방지, SC-005).

## C6. `outline.ts` (순수+좌표 — Vitest 일부)

```ts
export function outlineFromModel(model: DocModel): OutlineItem[]
export function headingLayoutCoord(model, pages, index): { pageIndex: number; offsetY: number } | null
```
**계약**: `outlineFromModel`은 heading 블록 등장순 `OutlineItem[]`(타입은 `lib/editor/outline.ts` 재사용). `headingLayoutCoord`는 index번째 heading의 레이아웃 좌표(점프용).

## C7. `history.ts` (순수 — Vitest 일부)

```ts
export type Snapshot = { buffer: string; blockAttrs: BlockAttr[]; selection: Selection }
export function pushSnapshot(history, snapshot, opts: { coalesce: boolean }): History
export function undo(history): { history: History; snapshot: Snapshot | null }
export function redo(history): { history: History; snapshot: Snapshot | null }
```
**계약**: coalesce=true면 직전 스냅샷 교체(연속 타이핑), false면 새 경계. undo/redo는 스냅샷 반환(호출부가 EditContext 동기). redo 스택은 새 편집 시 폐기.

## C8. `CustomEditor.tsx` / `BCustomChapterEditor.tsx` (컴포넌트 — CDP/dogfooding)

- **`CustomEditor`**: `{ model, onModelChange, paperSize, fontSize, outlineRef? }` 등 props로 EditContext 입력·캐럿·선택·heading·undo·paste를 구동. PoC `PocEditorLive` 승격. 렌더는 모델 기반(블록 폰트 적용).
- **`BCustomChapterEditor`**: `BChapterEditor`와 동일 props 계약(`documentId, projectId, paperSize, chapterTitle?, onChapterRename?, onSyncStatus, onConflict` + 아웃라인 소스 노출). 내부에서 `useDocumentSession`에 **문자열 body**(modelToPmJson) 결선. `onEditorReady`(TipTap Editor) 대신 **아웃라인 소스**(`{items, selectItem, activeIndex}`)를 셸로 노출.

## C9. 셸 계약 (`BStudioShell` — 추출)

- `BStudioShell`은 챕터 관리·세션·3패널·모달을 보유하고, 주입받는다:
  - `renderEditor(args) → ReactNode` — 에디터 슬롯(TipTap 또는 자체 엔진).
  - `outline: { items: OutlineItem[]; selectItem(item): void; activeIndex: number }` — 아웃라인 소스(TipTap `useEditorOutline` 또는 엔진 파생).
- **무회귀 계약(SC-007)**: 기존 B형 라우트를 `BStudioShell` 래퍼로 전환 후 동작 동일(기존 테스트 GREEN·dogfooding 무변화).
