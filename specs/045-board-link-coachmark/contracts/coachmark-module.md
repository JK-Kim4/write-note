# Contract: 순수 모듈 API (테스트 surface)

본 기능의 "계약" = 두 순수 모듈의 공개 API. 캔버스 시각·hover 는 dogfooding 게이트(jsdom 미검증).

## `lib/boardCoachmark.ts`

```ts
/** "끌어서 잇기" 코치마크를 본 적 있는가(전역 1회성, 기기 단위). */
export function hasSeenLinkHint(): boolean;

/** "끌어서 잇기" 코치마크를 봤다고 기록(멱등). */
export function markLinkHintSeen(): void;
```

**동작 계약**:
- `hasSeenLinkHint()`:
  - 초기(미설정) → `false`
  - `markLinkHintSeen()` 후 → `true`
  - 저장값 손상(`JSON.parse` 실패)·`linkHint` 부재 → `false`(화해, throw 금지)
  - `localStorage` 부재(`typeof localStorage === "undefined"`) → `false`
- `markLinkHintSeen()`:
  - 호출 후 `hasSeenLinkHint() === true`
  - 2회 이상 호출해도 안전(멱등)
  - `localStorage` 부재 → no-op(throw 금지)
  - 기존 다른 키 보존(객체 병합 — 향후 확장 대비)

## `components/board/linkHintPlacement.ts`

```ts
export type HandleAnchor = "top" | "right" | "bottom" | "left";

export interface LinkHintPlacement {
  /** 캐럿 방향 식별자 */
  caret: "up" | "down" | "left" | "right";
  /** 라벨 컨테이너 위치 Tailwind 클래스(리터럴) */
  positionClass: string;
}

export function linkHintPlacement(anchor: HandleAnchor): LinkHintPlacement;
```

**동작 계약**(앵커→방향):
- `top` → `caret: "down"`(라벨이 위, 캐럿 아래로 카드 지목)
- `right` → `caret: "left"`
- `bottom` → `caret: "up"`
- `left` → `caret: "right"`
- 각 앵커마다 `positionClass` 는 정해진 리터럴 문자열(테스트로 고정).

## CardNode 결선 계약(행위 — dogfooding 검증)

- 첫 연결점 `onMouseEnter` 시 `!hasSeenLinkHint()` 이면 그 앵커 `linkHintPlacement` 위치에 "끌어서 잇기" 라벨 + `markLinkHintSeen()`.
- 라벨 `pointer-events-none`. 본 뒤(seen=true) 라벨 미렌더(연결점만).
- 연결 드래그·종류 칩·삭제·선택 인디케이터 무변경.
