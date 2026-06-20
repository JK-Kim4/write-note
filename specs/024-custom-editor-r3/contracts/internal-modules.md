# R3 Internal Module Contracts

자체 엔진은 외부 API가 아닌 내부 순수 모듈 경계로 계약을 정의한다(라이브러리형). 각 함수는 순수·무상태, 입력 모델 불변(새 객체 반환).

## model.ts

```ts
export const SOFT_BREAK = "\u2028";  // 블록 내 줄바꿈 마커

// 블록 타입 헬퍼
export function isAtomic(attr: BlockAttr): boolean;        // hr → true
export function listNumberAt(model: DocModel, blockIndex: number): number | null;
  // ordered listItem이면 파생 번호(1-based), 아니면 null

// 입력 연산 (기존 splitBlock/deleteRange/mergeWithPrev 확장)
export function insertSoftBreak(model: DocModel, offset: number): DocModel;
  // offset 위치에 U+2028 삽입. blockAttrs/markRuns 정합 유지.
export function splitBlock(model: DocModel, offset: number): DocModel;
  // 기존. 목록 항목이면 새 블록도 같은 listKind·depth. 빈 목록 항목에서 호출 시 paragraph 강등.
export function toggleBlockType(
  model: DocModel, blockIndex: number,
  next: "paragraph" | "blockquote" | { listKind: "bullet"|"ordered" }
): DocModel;                                               // 텍스트 보존 타입 전환
export function insertHr(model: DocModel, offset: number): DocModel;  // 원자 hr 블록 삽입
export function deleteAtomicAt(model: DocModel, blockIndex: number): DocModel; // hr 삭제+병합

// 캐럿 (hr 건너뜀)
export function nextCaretSkippingAtomic(model: DocModel, offset: number, dir: -1|1): number;
```

**불변식 보장**: 모든 반환 모델은 INV-1~7 만족 + `reconcile`로 run 정규형. 호출부(CustomEditor)가 검증 없이 신뢰 가능.

## measure.ts

```ts
// 블록 타입 인지 — content 폭 조정 + U+2028 강제 줄나눔
export function measureParagraphLines(
  text: string, marks: MarkRun[], contentWidthPx: number,
  lineHeightPx: number, fontSizePx: number, fontFamily: string,
  blockAttr: BlockAttr,            // 신규 인자 — 인용 들여쓰기/목록 마커폭/hr
): Array<{ start: number; end: number }>;
```

- 인용: `contentWidthPx -= QUOTE_INDENT_PX`
- 목록: `contentWidthPx -= MARKER_W_PX + depth * INDENT_STEP_PX`
- hr: 줄 1개(가로선 높이), 텍스트 0
- `U+2028`: 해당 offset에서 줄 강제 종료

**canvas 금지** — 오프스크린 styled-span + `Range.getClientRects()` 유지(R2 회귀 룰).

## pmConvert.ts

```ts
export function pmJsonToModel(bodyJson: string): DocModel;
export function modelToPmJson(model: DocModel): string;
```

**계약(HARD-GATE)**:
- 의미 보존: blockquote/bulletList/orderedList/listItem/horizontalRule/hardBreak ↔ 모델 무손실.
- **idempotence**: `modelToPmJson(pmJsonToModel(x))` 를 두 번 적용 → 바이트 동일.
- 무회귀: 마크/신규블록 없는 입력은 R1/R2 출력과 바이트 동일.
- 미지원 노드(table/image/codeBlock/link)는 현행대로 평문 평탄화(범위 밖).

## 테스트 계약 (Vitest)

- `model.test.ts`: insertSoftBreak/splitBlock(목록)/toggleBlockType/insertHr/deleteAtomicAt/캐럿 hr 건너뜀 + INV 검증.
- `measure.test.ts`: 인용 들여쓰기/목록 마커폭/U+2028 줄나눔 → 줄 경계 검증(JSDOM Range mock 또는 폭 상수 단위).
- `pmConvert.test.ts`: 각 노드 왕복 + 결정론 idempotence(2회 적용 동일) + 무회귀(R1/R2 바이트 동일).
