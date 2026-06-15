# R3 Data Model — 블록 패리티 + 소프트 줄바꿈

자체 엔진 내부 모델(`custom-editor/model.ts`)의 R3 확장. 디스크 포맷(PM JSON)은 변환 경계에서만 다룬다(스키마 무변경).

## 1. BlockAttr (확장)

```ts
export type BlockAttr =
  | { type: "paragraph" }
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "blockquote" }                                           // 신규
  | { type: "listItem"; listKind: "bullet" | "ordered"; depth: number } // 신규 (depth ≥ 0)
  | { type: "hr" };                                                  // 신규
```

- `listItem.depth`: 0 = 최상위. 중첩 한 단계마다 +1. (PM `bulletList>listItem>bulletList>listItem` → depth 1)
- `hr`: 부속 필드 없음. 대응 buffer 세그먼트는 항상 `""`, markRuns는 `[]`.

## 2. DocModel (구조 불변, 의미 확장)

```ts
export type DocModel = {
  buffer: string;            // 블록은 '\n' 분리. 블록 내 소프트 줄바꿈은 U+2028.
  blockAttrs: BlockAttr[];   // 길이 = '\n' 기준 세그먼트 수
  markRuns: MarkRun[][];     // 블록별 run-list. run.len 합 = 블록 글자 수(U+2028 포함, '\n' 제외)
};
```

### 소프트 줄바꿈 마커

- 상수: `export const SOFT_BREAK = "\u2028";`
- `buffer` 내 `U+2028` 1개 = 블록 내부 강제 줄바꿈. 블록 경계 아님.
- `blockRanges(buffer)`: `\n`에서만 분리(현행 유지). `U+2028`은 블록 내부 문자로 남음.
- markRuns 길이 계산: `U+2028`도 1글자로 카운트(INV-4).

## 3. 불변식 (Invariants)

- **INV-1** `blockAttrs.length === buffer.split('\n').length`
- **INV-2** heading이면 level ∈ {1,2,3}
- **INV-3** 빈 모델 = `{ buffer:'', blockAttrs:[{type:'paragraph'}], markRuns:[[]] }`
- **INV-4** `markRuns.length === blockAttrs.length`, 각 블록 run.len 합 === 블록 글자 수(개행 제외, `U+2028` 포함)
- **INV-5** run-list 정규형(인접 동일 mask 없음, len>0)
- **INV-6 (신규)** `hr` 블록은 buffer 세그먼트 `""` + markRuns `[]`
- **INV-7 (신규)** `listItem.depth ≥ 0` 정수

## 4. 파생값 (저장 안 함)

- **목록 번호**: 렌더 시 파생. 블록 i가 `listItem{ordered, depth d}`면, 위로 연속된 같은 `(ordered, d)` 블록 수 + 1. 중간에 다른 타입/listKind/depth가 끼면 0부터 재시작.
- **시각 줄(lines)**: measure가 블록 텍스트+marks+blockType(들여쓰기/마커폭)에서 `{start,end}[]` 산출. `U+2028`은 강제 줄 경계.

## 5. 상태 전이 (입력 → 모델 연산)

| 입력 | 연산 | 결과 |
|---|---|---|
| Enter (목록 항목 끝) | splitBlock | 다음 블록 = 같은 listKind·depth listItem(새 번호) |
| Enter (빈 목록 항목) | listItem → paragraph 강등 | 목록 종료 |
| Shift+Enter | insert `U+2028` (같은 블록) | 같은 블록·번호, 줄만 추가 |
| 툴바 인용 토글 | blockAttr type ↔ blockquote | 텍스트 보존 |
| 툴바 목록 토글 | blockAttr type ↔ listItem | 텍스트 보존, depth 0 |
| 툴바 구분선 | 현재 위치에 hr 블록 삽입 | 빈 원자 블록 |
| hr 인접 Backspace/Delete | hr 블록 삭제 | 인접 블록 병합 |
| 화살표(hr 통과) | 캐럿이 hr 건너뜀 | hr 진입 안 함 |

## 6. PM JSON 매핑 (pmConvert)

| 모델 | PM JSON |
|---|---|
| `{type:"blockquote"}` 블록 | `{type:"blockquote", content:[{type:"paragraph", content:[textNodes]}]}` |
| 연속 `listItem{bullet,d}` | `{type:"bulletList", content:[{type:"listItem", content:[paragraph]}...]}` (depth 중첩) |
| 연속 `listItem{ordered,d}` | `{type:"orderedList", ...}` |
| `{type:"hr"}` 블록 | `{type:"horizontalRule"}` |
| `U+2028` (블록 내) | `{type:"hardBreak"}` (텍스트 노드 사이) |
| paragraph/heading/마크 | R1/R2 동일(무회귀) |

idempotence: `modelToPmJson(pmJsonToModel(x))` 2회 적용 결과 바이트 동일(SC-002).
