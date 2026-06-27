# 집필 화면 인라인 보드 편집 — 오버레이 열고/닫기 다듬기 (트랙 A, spec 046)

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-27 |
| 상태 | ✅ 확정(목업 승인) — 구현 진입 |
| 상위 SoT | `board-ux-worksheet.md` TASK-5(집필 중 보드 참조)·PRD §5.4 ③ |
| 목업 | `docs/research/2026-06-27-writing-board-overlay-open-close-mockup.html`(인터랙티브, **사용자 승인**) + `2026-06-27-writing-screen-board-edit-mockup.html`(A/B/C 비교, A안 선택) |
| 작업방식 | 디자인이 인터랙티브 목업으로 잠금 → 경량 설계문서 + 구현 + dogfooding(트랙 D 선례, 무거운 speckit 생략) |

## 0. 한 줄

집필 화면에서 보드를 보고·수정할 때 **보드 페이지로 완전 이탈**하던 동작을, 이미 있는 **인라인 참조 패널(편집 가능 캔버스)**로 통일하고 **열고/닫기 UX를 다듬는다**. FE only(BE·마이그레이션·에러코드 0).

## 1. 배경 / 문제

- 집필 화면 우측 보드 목록(`BWorkSidePanel` → `InlineBoardList`)의 "열기"가 `router.push('/boards/[id]')` = **완전 이탈** → 집필로 돌아오려면 집필 메뉴→작품 재진입.
- 인라인 편집 패널(`BoardReferencePanel`, 043)은 이미 `PlotBoardCanvas`(보드 페이지와 **동일한 편집 가능 캔버스**)를 우측 슬라이드오버로 렌더한다. 그러나 (a) 사이드 목록이 그쪽으로 안 가고 보드 페이지로 튕기며, (b) 열고/닫기 UX가 거칠다(슬라이드 없음·바깥클릭 안 닫힘·토글/상태표시 없음).

## 2. 확정 결정 (목업 승인 2026-06-27)

- **A안 = 인라인 오버레이 재사용**(분할 B·별 화면 아님).
- **진입 통일·인라인**: 사이드 보드 목록 클릭 → 완전 이탈 대신 **그 보드를 인라인 오버레이로**(preselect). 툴바 "보드 참조" 버튼도 같은 오버레이.
- **토글 + active 상태**: 버튼 열림이면 강조, 재클릭/ESC/✕/바깥클릭으로 닫힘.
- **슬라이드 인/아웃**(우측, ~0.28s).
- **닫기 3경로**: ✕ · ESC · **원고(바깥) 클릭**. 바깥클릭은 **투명 캐처**(원고 안 어두워짐 — 곁눈질 유지).
- **보조 액션**: **⤢ 넓게**(오버레이 폭 토글) · **↗ 전체 화면**(보드 페이지로 진짜 이동, `router.push`).

## 3. 변경 범위 (FE only, BE 0)

- **`InlineBoardList`**: optional `onOpenBoard?(boardId)` 추가 — 있으면 열기·생성성공에 사용, 없으면 기존 `router.push` 유지. (LibraryBoard 시리즈 보드 섹션은 미전달 → `router.push` 보존.)
- **`BWorkSidePanel`**: optional `onOpenBoard` prop → `InlineBoardList` 로 전달.
- **`BStudioShell`**: `boardRefInitialId` 상태 + "보드 참조" 버튼 토글·active·z-raise + `BWorkSidePanel`(inline·drawer 두 인스턴스) `onOpenBoard={(id)=>{ setBoardRefInitialId(id); setBoardRefOpen(true); }}` + `initialBoardId` 전달.
- **`BoardReferencePanel`**: `initialBoardId` preselect + 슬라이드 transition(always-mount aside + 콘텐츠 mounted-delay) + 투명 캐처(바깥클릭 닫기) + ⤢ 넓게(폭 토글) + ↗ 전체 화면(`router.push`).

## 4. 회귀 가드 (무변경)

- **LibraryBoard 시리즈 보드 섹션**: `onOpenBoard` 미전달 → `router.push` 유지(집필 화면만 인라인).
- 집필 3패널 flex 레이아웃 무변경(오버레이는 `fixed`). `PlotBoardCanvas`·종류 칩·잇기·삭제·**045 코치마크** 무변경.
- 보드 데이터 fetch(`useReferenceBoards`/`useBoardDetail`)는 **open 시에만**(닫혀 있으면 비용 0).

## 5. 검증

- **dogfooding 게이트**(인터랙션·시각·애니메이션 jsdom 미검증, 룰 14·25): 사이드 보드 클릭→인라인 오버레이(그 보드)·즉시 편집 / 토글·active / 슬라이드 / ✕·ESC·**원고 클릭** 닫기 / ⤢ 넓게·↗ 전체화면 / **시리즈 보드(라이브러리)는 여전히 보드 페이지로** / 045 코치마크 무회귀.
- **자동 게이트**: `pnpm typecheck && lint && test && build` GREEN(기존 테스트 유지).
- FE only → 배포순서 무관. 045와 파일 무중첩(coachmark=CardNode·pure / 본 트랙=BStudioShell·BoardReferencePanel·BWorkSidePanel·InlineBoardList).
