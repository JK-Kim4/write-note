# Data Model: 보드 "끌어서 잇기" 첫-진입 코치마크

서버·DB 무관(FE only). 클라이언트 영속 상태 1개 + 파생 UI 상태.

## 영속 상태 (localStorage)

| 항목 | 값 |
|---|---|
| key | `writenote.board.coachmark.v1` |
| value | JSON 객체 `{ linkHint?: true }` (확장 여지 위해 객체. 현재 키 1개) |
| 의미 | `linkHint === true` = 사용자가 "끌어서 잇기" 코치마크를 본 적 있음(전역 1회성) |
| 미설정/손상 | "아직 안 봄"으로 화해(빈 객체). `JSON.parse` 실패·`localStorage` 부재 시 throw 금지 |
| 쓰기 시점 | 첫 연결점 hover 시 `markLinkHintSeen()` 1회 |

> `lastViewedBoard.ts`(키 `writenote.board.lastViewed.v1`) 패턴 미러 — read 시 손상값 빈 객체 화해, write 시 `localStorage` 부재 가드.

## 파생/일시 상태 (CardNode 내부, 비영속)

| 상태 | 타입 | 의미 |
|---|---|---|
| `hoveredHandle` | `"top" \| "right" \| "bottom" \| "left" \| null` | 현재 커서가 올라간 연결점(없으면 null). `Handle` `onMouseEnter`/`onMouseLeave` 로 갱신 |
| `showLinkHint`(파생) | `boolean` | `!hasSeenLinkHint()` 일 때만 라벨 후보. 첫 노출 시 `markLinkHintSeen()` 후 false 화 |

## placement (순수 파생)

`linkHintPlacement(anchor)` — 앵커 → 라벨 방향/캐럿:

| anchor | 라벨 위치 | 캐럿 방향 |
|---|---|---|
| `top` | 카드 위(연결점 위) | 아래쪽(↓, `down`) |
| `right` | 카드 오른쪽 | 왼쪽(←, `left`) |
| `bottom` | 카드 아래 | 위쪽(↑, `up`) |
| `left` | 카드 왼쪽 | 오른쪽(→, `right`) |

반환 = 위치/캐럿에 대응하는 **리터럴 Tailwind 클래스 문자열**(JIT 안전, 동적 보간 금지 — `cardKinds.ts` 패턴). 목업 `docs/research/2026-06-27-board-coachmark-placement-mockup.html` 시각 기준.
