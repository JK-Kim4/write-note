# Quickstart: 집필실 에디터 페이지 넘김 뷰 (029)

구현 순서·검증. 작업 브랜치 = `develop` 직접. 변경 집중 = `CustomEditor.tsx` + `pagedView.ts`(신규).

## 구현 순서

### 1단계 — 순수 헬퍼 (TDD)
- `pagedView.ts` + `pagedView.test.ts`: `clampPage`/`nextPage`/`prevPage`/`pageToFollowCaret` Red→Green.

### 2단계 — 단일 페이지 렌더
- `CustomEditor.tsx`: `currentPage` 상태 추가. 렌더(1178~1195)의 `view.pages.map(전체)` → `view.pages[clampPage(currentPage, view.pages.length)]` 한 장. 데스크탑/모바일 두 분기 동일. (이 시점에 이미 "한 화면 한 페이지" 확인 가능 = 핵심 조기 dogfood §10)

### 3단계 — 네비게이션
- 좌/우 `< >` 오버레이(활성 조건) + 하단 "n / N" + PageUp/PageDown 키 핸들러. 이동 = next/prevPage.

### 4단계 — 캐럿 ↔ 페이지 동기
- 스크롤-follow effect(472~482)를 페이지 동기로 대체: 캐럿 변경 시 `pageToFollowCaret(caretPos.pageIndex, currentPage)` 가 null 아니면 `setCurrentPage`. deps = `[caretPos?.pageIndex]` 중심으로 안정화(무한 렌더 회피). 줌인 시 페이지 내 scrollTop 캐럿 보정은 같은 페이지 한정 유지.

### 5단계 — 목차 점프
- 목차 점프(502~)를 `setCurrentPage(heading 페이지)` + 캐럿 이동으로.

### 6단계 — 게이트 + dogfooding
- `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN(포어그라운드, build=RSC 경계).
- **dogfooding(필수)**: 아래 게이트.

## dogfooding 게이트 (라이브 — 자동 테스트 한계 §14, 회귀 위험 §15)
- [ ] 한 페이지 이상 입력 → 화면 안 늘어나고 다음 페이지 자동 전환, 캐럿 보임 (US1, SC-001/003)
- [ ] `< >`/PageUp·Down 으로 앞뒤 이동, 첫/끝 비활성, "n/N" 정확 (US2, SC-002)
- [ ] `<>`로 다른 페이지 보다가 클릭 → 캐럿 이동, 입력 시 캐럿 페이지 복귀 (FR-006/007)
- [ ] 목차 클릭 → 해당 페이지 전환 + 캐럿 이동 (US3)
- [ ] 현재 페이지 내 드래그 선택 / ⌘A 전체선택 동작 (FR-008)
- [ ] **한글 IME 4케이스**(빠른타자/조합중 bold/한자/Backspace 분해) 무회귀 — `docs/poc/0-1-tiptap-korean.md` 기준 재사용
- [ ] 모바일(transform:scale)·데스크탑(zoom) 양쪽 단일 페이지·넘김 동작
- [ ] PDF 내보내기 결과·페이지 분할 위치 본 변경 전후 동일 (SC-005)

## 주의
- `layoutEngine`/`measure`/`model`/`geometry`/`printLayout` 등 무수정(표시 계층만).
- 028(홈)과 별도 트랙 — 028 미커밋 상태이므로, 커밋 시 028/029 변경을 분리하거나 028 먼저 마무리 권장(§3/§15).
- 커밋·merge는 사용자 요청 시에만.
