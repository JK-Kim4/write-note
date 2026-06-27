# 보드 "끌어서 잇기" 첫-진입 코치마크 — 설계 (트랙 2, ISSUE-051 잔여)

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-27 |
| 상태 | ✅ 결정 확정(brainstorming, 사용자 승인) — speckit `045` 진입 대기 |
| 상위 SoT | `board-ux-worksheet.md` TASK-2·TASK-7·§5 COPY, `board-prd.md` |
| 추적 | **ISSUE-051 잔여** (TASK-1은 044로 완료) |
| 목업 | `docs/research/2026-06-27-board-coachmark-placement-mockup.html` (사용자 "자연스러움" 승인) |

## 0. 한 줄

보드에서 처음 카드 연결점에 마우스를 올리면 **그 점에서 "끌어서 잇기"가 1회** 떠 잇기 제스처를 가르치는 가벼운 상황형 코치마크. 이후 영영 안 뜸(localStorage). **FE only**(백엔드·마이그레이션·에러코드 0).

## 1. 배경 / 범위 결정

- ISSUE-051 잔여 = `board-ux-worksheet.md` **TASK-2 hover 힌트 + TASK-7 첫 진입 코치마크**. TASK-1(빈 보드 안내·빈 곳 더블클릭 생성)은 044로 완료.
- **문서 모순 화해(룰 28)**: worksheet은 "끌어서 잇기"를 **TASK-7 첫-진입 1회 코치마크**("처음 카드 hover 시 1회 후 사라짐")로, 핸드오프는 **TASK-2 매-hover 지속 힌트**로 기술 → **사용자 결정 = 첫 진입 1회만**. 매 hover는 현행대로 연결점(`Handle`)만. 따라서 TASK-2·TASK-7이 하나의 첫-진입 코치마크로 통합.
- **TASK-7 두 번째 항목 "처음 카드 선택 시 '이건 뭔가요?' 1회" → 사용자 결정으로 제거**(worksheet 대비 의도적 축소). 종류 칩 트레이 자동노출(트랙 D)로 충분하다는 판단.
- **결과**: 트랙 2 = "끌어서 잇기" 코치마크 **1개**.

## 2. 확정 결정 (brainstorming 2026-06-27, 사용자 승인)

| # | 결정 | 값 |
|---|---|---|
| D1 | 노출 시점 | **첫 진입 1회만** (이후 hover 는 연결점만, 글자 없음) |
| D2 | 위치 | **커서가 올라간 그 연결점에서 바깥으로** (위/오른쪽/아래/왼쪽 방향별) |
| D3 | 메커니즘 | **자체(custom) 코치마크** — driver.js 아님(튜토리얼 벽 회피·동적 트리거·body-append 다크함정 회피) |
| D4 | 영속 | **localStorage 단일 플래그** — 서버 키 아님(FE only 유지, `SettingsService.ALLOWED` 값 화이트리스트 회피, 043 `lastViewedBoard` 선례) |
| D5 | 범위 | 공유 캔버스라 **`/boards/[id]` + 집필 참조 패널 공통**. 홈 온보딩(driver.js)과 **독립**(게이팅 없음) |
| D6 | "이건 뭔가요?" | **제거** |

## 3. 기술 검증 (실측 — 추측 금지)

`@xyflow/react@12.11.1`:
```ts
type HandleProps = HandlePropsSystem & Omit<HTMLAttributes<HTMLDivElement>, 'id'> & { onConnect?: OnConnect }
```
→ `Handle` 이 `id` 만 빼고 표준 div 속성 전부 forward → 각 `<Handle>` 에 `onMouseEnter`/`onMouseLeave` 직접 부착으로 **커서가 올라간 연결점 감지 가능**. 연결 드래그(pointerdown 기반)와 무충돌. 라벨은 `pointer-events-none` 이라 드래그/클릭 방해 0.

## 4. 구현 스케치 (FE only)

- **신규 `lib/boardCoachmark.ts`** (순수, localStorage — `lastViewedBoard.ts` 패턴 미러): key `writenote.board.coachmark.v1`, JSON `{ linkHint?: true }`. `hasSeenLinkHint()` / `markLinkHintSeen()`. 손상값은 빈 객체로 화해(throw 금지).
- **순수 헬퍼 `linkHintPlacement(handleId)`** (CardNode 내부 또는 별 모듈): 앵커(top/right/bottom/left) → 라벨 방향·캐럿 클래스 매핑. TDD.
- **`CardNode.tsx` 수정**: `hoveredHandle` 상태(top/right/bottom/left/null) + 각 `<Handle onMouseEnter/onMouseLeave>`. `!hasSeenLinkHint() && hoveredHandle != null` 이면 그 연결점 바깥에 **"끌어서 잇기"** 라벨(다크 툴팁 + 캐럿, 고정색 — 보드 `colorMode=light` 고정) 렌더 + 첫 노출 시 `markLinkHintSeen()`. 라벨 `pointer-events-none`.
- COPY: `link.hoverHint = '끌어서 잇기'` (worksheet §5).

## 5. 안 건드림 / 회귀 가드

연결점 group-hover 노출·잇기 4경로(드래그 유효 drop·빈 곳 drop·클릭-클릭·중복 무시)·종류 칩 트레이·삭제 버튼·선택 인디케이터·드래그/뷰포트 **무변경**. BE·마이그레이션·에러코드 **0**.

## 6. 테스트

- **TDD 순수**: `boardCoachmark`(seen 판정·마크·손상 화해), `linkHintPlacement`(앵커→방향 매핑).
- **dogfooding 게이트**(jsdom 미검증, 룰 14·25): 첫 연결점 hover 시 그 점에서 "끌어서 잇기" 1회 → 재진입·다른 보드에서 안 뜸 / 매 hover 연결점만 / 네 방향 자연 / 잇기·종류·삭제 무회귀 / 집필 참조 패널에서도 동일.

## 7. speckit / 번호

- spec = **`045-board-link-coachmark`** (트랙 2 먼저 진행 → 045, 트랙 1 가져오기 = 046). 핸드오프/로드맵의 "045=가져오기" 잠정 가정과 **뒤바뀜** → 로드맵 §0·§5·§7 갱신 동반.
- 브랜치 = develop 기반 새 브랜치(워크트리 격리, base 검증 룰 26).
- FE only → 배포 순서 무관.
