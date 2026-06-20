# Contracts: 집필실 에디터 페이지 넘김 뷰 (029)

외부 HTTP/IPC 계약 없음(순수 프론트 표시 변경). 본 문서는 `CustomEditor` 컴포넌트의 **동작 계약**을 박는다.

## 1. 렌더 계약
- stage 안에 **`view.pages[currentPage]` 단 한 장**의 PageBox만 렌더(데스크탑 `zoom` / 모바일 `transform:scale` 두 분기 동일).
- 페이지들이 세로로 이어 붙지 않는다(연속 스택 제거).
- 페이지가 화면 높이에 맞춰 보인다(기본). 줌인으로 페이지가 stage보다 크면 그 페이지 안에서만 스크롤(다음 페이지로 스크롤 전이 없음).

## 2. 네비게이션 계약
- 화면 좌/우 가장자리 `<` `>` 오버레이. `<`는 `currentPage>0`일 때만, `>`는 `currentPage<length-1`일 때만 활성.
- 키보드 PageUp = prevPage, PageDown = nextPage.
- 위치 표시 "{currentPage+1} / {length}" 가시.
- 이동은 `clampPage`로 범위 보장. 첫/끝 경계에서 더 안 넘어감.

## 3. 캐럿 ↔ 페이지 계약
- 입력/Enter/편집키로 캐럿이 다른 페이지로 이동하면 `currentPage`가 `caret.pageIndex`로 자동 전환(작성 위치가 항상 화면에 보임).
- `< >`/PageUp·Down은 **뷰만** 이동(캐럿 불변). 캐럿과 다른 페이지를 보는 상태에서 입력하면 캐럿 페이지로 자동 복귀.
- 보이는 페이지의 한 지점 클릭 시 캐럿이 그 위치로 이동(기존 onStageMouseDown, pageIndex=currentPage).

## 4. 선택 계약 (v1)
- 드래그 선택은 현재 페이지 내에서만. 페이지 경계 넘는 드래그 미지원.
- ⌘A 전체선택 유지. 선택 하이라이트는 보이는 페이지 부분만 표시(기존 selRects 페이지 필터).

## 5. 목차(아웃라인) 계약
- 목차 항목 클릭 → 해당 heading의 페이지로 `currentPage` 전환 + 캐럿을 그 heading으로 이동.

## 6. 무변경(회귀 금지) 계약
- 페이지 분할 위치·줄바꿈·문서 모델·PDF 내보내기 결과가 본 변경 전후 동일.
- `layoutEngine`/`measure`/`model`/`geometry`/`printLayout`/`pmConvert`/`history`/`outline`/`input/*` 무수정.
- 한글 IME 조합이 페이지 전환/캐럿 동기로 깨지지 않음.

## 7. 순수 헬퍼 계약 (pagedView.ts)
- `clampPage(i,total)`: total≤0 → 0, 그 외 [0,total-1].
- `nextPage/prevPage`: clamp 적용 ±1.
- `pageToFollowCaret(caretPageIndex, current)`: 다르면 caretPageIndex, 같으면 null.
