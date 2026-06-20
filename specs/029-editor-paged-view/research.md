# Research: 집필실 에디터 페이지 넘김 뷰 (029)

코드 정독으로 확정한 현 구조와 설계 결정. NEEDS CLARIFICATION 없음(브레인스토밍에서 3대 결정 확정).

## R1. 현재 렌더 구조 (사실 — CustomEditor.tsx)

- `relayout(model, geo)` → `View = { blocks, pages: LaidOutPage[] }`. `LaidOutPage = { index, fragments: PlacedFragment[], usedHeight }` (layoutEngine.ts:22). **페이지 분할은 이미 완료**된 이산 배열.
- 렌더(1178~1195): `stage`(overflow:auto, 배경 #eceae4) 안에서 `view.pages.map(pg => <PageBox .../>)` 로 **모든 페이지를 세로 flex 스택**(데스크탑 `zoom`, 모바일 `transform:scale` 두 분기). → "아래로 늘어남"의 원인.
- `PageBox`(232~): 페이지 한 장을 `boxShadow` 종이로, `data-poc-page={pg.index}`, 하단에 `page.index+1` 표시(337), `selRects` 는 `r.pageIndex === pg.index` 로 **이미 페이지별 필터**(1185/1192).

## R2. 캐럿·클릭·스크롤 좌표계 (사실)

- `caretToScreen(caret, blocks, pages, geo, affinity)` → `CaretPos { pageIndex, x, y, height }`. **`view.pages` 전체를 순회**해 캐럿의 절대 페이지 인덱스를 계산 — **DOM/렌더 여부와 무관**(65~).
- `screenToCaret(pageIndex, x, y, view, geo)` → `{offset, affinity}`. 페이지 인덱스를 인자로 받는다(110~).
- 클릭: `onStageMouseDown`(1001~) → 가장 가까운 `[data-poc-page]` 요소의 `data-poc-page` 속성으로 pageIndex 결정(997) → `screenToCaret`.
- 상/하 화살표: `caretToScreen`/`screenToCaret`를 절대 pageIndex로 사용(916~927).
- **스크롤-follow effect(472~482)**: 캐럿 DOM(`.poc-caret`)이 stage 밖이면 `stage.scrollTop` 보정 — **연속 스크롤 전제**의 로직. 페이지 넘김에서 대체 대상.

**결론**: 좌표계가 전부 **절대 페이지 인덱스** 기준이라, 화면에 `pages[currentPage]` 한 장만 렌더해도 캐럿/클릭/선택 계산은 그대로 유효하다. 이게 본 변경을 안전하게 만드는 핵심.

## R3. 결정 — 단일 페이지 렌더

**Decision**: `view.pages.map(전체)` → `view.pages[currentPage]` 한 장만 PageBox 렌더(데스크탑·모바일 두 분기 동일). `currentPage` = useState(0).

**Rationale**: 페이지가 이미 이산 배열 + 좌표계가 절대 인덱스라 표시만 좁히면 됨. DOM 노드 감소.

**Alternatives 기각**: CSS 스크롤 스냅(연속 스택 유지 + 스냅) — "아래로 안 늘어남"을 못 풂(여전히 전체 높이 차지) + 자동 전환/위치표시 구현 어려움.

## R4. 결정 — 캐럿 ↔ 페이지 자동 동기

**Decision**: 스크롤-follow effect(472~482)를 **페이지 동기**로 대체 — 캐럿 변경 시 `caretToScreen(...).pageIndex`가 `currentPage`와 다르면 `setCurrentPage(pageIndex)`. `< >`/PageUp·Down은 `currentPage`만 바꾸고 캐럿 불변(뷰 이동). 보이는 페이지 클릭 시 캐럿 이동(기존 onStageMouseDown 그대로, pageIndex가 currentPage).

**Rationale**: FR-002/007 — 입력이 다음 페이지로 흘러가면 작성분이 보여야 함. `caret.pageIndex`가 이미 정답을 주므로 그 값으로 전환.

**주의(코드퀄리티)**: 캐럿→페이지 동기 effect의 deps 안정성 — `caretPos.pageIndex`(원시값)·`currentPage`만 deps로, setState 무한루프 회피. 줌인 시 페이지 내 스크롤(scrollTop)은 **같은 페이지 안에서만** 캐럿 보정(페이지 경계 넘는 scroll 금지).

**Alternatives 기각**: `< >`가 캐럿까지 옮김 — 넘겨보기만 하려는데 캐럿이 끌려가 원치 않는 편집 위치 변경.

## R5. 결정 — 네비게이션 UI

**Decision**: stage 위 오버레이로 **좌/우 가장자리 큰 `<` `>`**(첫/끝 비활성) + 하단 "현재 / 전체" 표시. 키보드 **PageUp/PageDown**(←/→는 캐럿 이동이라 제외). 페이지 이동 = `clamp(currentPage ± 1, 0, pages.length-1)`.

**Rationale**: 사용자 결정(좌우 큰 화살표 + 키보드). 오버레이라 본문 레이아웃 영향 최소.

## R6. 결정 — 선택·목차

**선택(v1)**: 현재 페이지 내 드래그만. `screenToCaret`가 currentPage 기준이라 자연 한정. ⌘A 전체선택 유지(기존), 하이라이트는 `selRects` 페이지 필터로 보이는 페이지분만(기존 동작 그대로). 페이지 경계 넘는 드래그 = v1 제외.

**목차 점프**: 기존 scrollTop 점프(502~)를 **`setCurrentPage(heading 페이지)` + 캐럿 이동**으로. heading 페이지 = `caretToScreen(headingCaret).pageIndex`.

## R7. 무변경 보장 (FR-013/SC-005)

- `layoutEngine`/`measure`/`model`/`geometry`/`printLayout`/`pmConvert`/`history`/`outline`/`input/*` 무수정.
- PDF export(`PrintDocument`)는 자체적으로 `relayout` 후 전 페이지 렌더 → 화면 페이지 넘김과 무관, 결과 동일.
- 페이지 분할 위치·줄바꿈은 `relayout`/`layout` 산출 그대로 — 표시만 1장으로 좁힘.

## R8. 검증 전략

- **순수 단위(pagedView.ts)**: `clampPage(idx, total)`, `syncPageToCaret(caretPageIndex, current)`(다르면 새 값), `nextPage`/`prevPage` 계산 — Red→Green.
- **RTL(CustomEditor.test.tsx 보강)**: `< >` 활성/비활성, "n / N" 표시, 단일 페이지만 렌더(여러 PageBox 아님) — 가능 범위.
- **dogfooding 게이트(필수, 자동 테스트 한계 §14)**: 한글 IME 4케이스(빠른타자/조합중 mark/한자/Backspace 분해) + 캐럿 이동·페이지 자동전환·`< >`/PageUp·Down·목차 점프·현재페이지 내 선택·모바일 scale. 회귀 위험 영역(§15)이라 화면 검증 필수.
