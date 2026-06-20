# Data Model: 집필실 에디터 페이지 넘김 뷰 (029)

저장 데이터·신규 엔티티 없음. 일시적 뷰 상태 1개 + 기존 파생값 재사용.

## 1. 현재 페이지 — `currentPage` (뷰 상태, 비영속)

| 속성 | 값 |
|---|---|
| 타입 | `number` (0-기반 페이지 인덱스) |
| 보관 | `useState` (저장/서버 동기 없음 — 새로고침 시 0 또는 캐럿 페이지) |
| 초기값 | 0 |
| 범위 | `[0, view.pages.length - 1]` 로 항상 clamp (FR-011) |
| 변경 트리거 | (a) 캐럿이 다른 페이지로 흘러감 → `caret.pageIndex` (b) `< >`/PageUp·Down (c) 목차 점프 |

**불변식**:
- `view.pages.length === 0` 은 발생 안 함(빈 문서도 최소 1페이지). 그래도 clamp가 0 보장.
- 페이지 수 감소(삭제)로 `currentPage > last` 가 되면 렌더 직전 `clampPage`로 last 보정(빈 화면 금지).
- `< >`로 캐럿과 다른 페이지를 봐도 `currentPage`만 바뀌고 캐럿(sel)은 불변. 입력 발생 시 캐럿 페이지로 재동기.

## 2. 페이지 목록 — `view.pages` (기존, 무변경)

`relayout(model, geo).pages: LaidOutPage[]` — `{ index, fragments, usedHeight }`. 본 기능은 **이 배열을 새로 만들지 않고** 표시 대상만 `pages[currentPage]` 로 좁힌다.

## 3. 파생값 (계산, 저장 안 함)

| 표시/동작 | 출처 | 계산 |
|---|---|---|
| 보이는 페이지 | `view.pages[clampPage(currentPage, total)]` | 단일 PageBox 렌더 |
| 위치 표시 | `currentPage`, `view.pages.length` | "{currentPage+1} / {length}" |
| `<` 활성 | `currentPage` | `currentPage > 0` |
| `>` 활성 | `currentPage`, length | `currentPage < length - 1` |
| 캐럿 페이지 | `caretToScreen(caret, …).pageIndex` | 변경 시 currentPage 동기 판정 |
| 보이는 선택 | 기존 `selRects.filter(r => r.pageIndex === pageIndex)` | 무변경 |

## 4. 순수 헬퍼 시그니처 (pagedView.ts, 신규)

```ts
clampPage(index: number, total: number): number          // [0, total-1] clamp, total<=0 → 0
nextPage(current: number, total: number): number          // clampPage(current+1, total)
prevPage(current: number, total: number): number          // clampPage(current-1, total)
// 캐럿이 보이는 페이지와 다르면 새 페이지 인덱스, 같으면 null(전환 불필요)
pageToFollowCaret(caretPageIndex: number, current: number): number | null
```

모두 시계·DOM 비의존 순수함수 → 단위 테스트로 행위 고정.
