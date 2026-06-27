# 043 — 집필 중 보드 참조 (분할/슬라이드 뷰)

| 항목 | 내용 |
|------|------|
| 상태 | 구현 (야간 자동 진행 2026-06-26) |
| 트랙 | 보드 C-2 ② (PRD §5.4 ③ 집필 참조 / §9 / UX TASK-5) |
| 설계 SoT | `docs/board/board-track-c2-design.md` §2 |
| 범위 | BE(reference-boards) + FE(슬라이드오버·last-viewed) |
| 배포 | BE 선행 → FE 후행. 보드 미배포라 prod 위험 0 |

## 1. 문제 / 의도
집필 화면에서 작가가 **원고를 쓰며 보드를 곁눈질로 참조**할 길이 없다. PRD §9: "그 작품의 보드 + 상위 시리즈 보드를 오가며 원고와 나란히 본다 + 마지막 본 보드를 기억."

## 2. 사용자 시나리오
1. 작가가 집필 화면에서 "보드 참조"를 켠다 → 우측에 슬라이드오버로 보드가 뜬다.
2. 참조 후보 = 그 작품 보드 + 상위 시리즈 보드. 여러 개면 전환(드롭다운), 1개면 바로.
3. 마지막에 본 보드를 기억했다가 다음에 기본으로 연다.
4. 닫으면 전폭 집필로 복귀.

## 3. 요구사항 (FR)
- **FR-1** BE: `GET /api/boards/reference?projectId={id}` → 그 작품 보드 + 상위 시리즈(project.categoryId) 보드, 최근순 `BoardSummary[]`. 본인 작품 아니면 404.
- **FR-2** 미분류 작품(상위 시리즈 없음)이면 그 작품 보드만 반환.
- **FR-3** FE: 집필 화면 "보드 참조" 토글 → 우측 슬라이드오버(overlay)로 보드 표시. 집필 3패널 레이아웃 무변경.
- **FR-4** 후보가 여럿이면 전환 UI, 하나면 생략. 후보 0이면 안내 + 보드 만들기 진입(→/boards).
- **FR-5** 보드 캔버스는 dynamic import(ssr:false)로 격리(집필 번들 무영향).
- **FR-6** 마지막 본 보드를 작품별로 기억(localStorage `writenote.board.lastViewed.v1`), 재진입 시 기본 선택.

## 4. 비범위
- 참조 패널 안에서의 카드 편집 흐름 최적화(읽기 중심, 캔버스 재사용).
- 분할 뷰의 동시 양면 리사이즈(overlay 우선).

## 5. 완료 기준
- BE: ktlint·checkstyle·test(서비스 단위 3 + IT 2)·build GREEN.
- FE: typecheck·lint(0err)·test·build GREEN.
- authed 분할뷰 동작(보드 표시·전환·last-viewed)은 로그인 불가 → 보고서 dogfooding 체크리스트.
