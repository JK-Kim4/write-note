# 집필 에디터 실시간 페이지 분할 — Phase 1 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PoC 0-4(안1)에서 검증된 CSS `column-wrap` 실시간 페이지 분할을 프로덕션 집필 에디터(`Editor.tsx` + `app.css`)에 통합해, 본문이 A4 장 단위로 실제 분할되고 장마다 쪽 번호가 뜨게 한다(저장 구조·IME·줄노트·줌 보존).

**Architecture:** 분할은 데이터가 아니라 **브라우저 레이아웃**으로 처리한다 — `.prose .ProseMirror` 에 `column-wrap: wrap` + `column-height`(줄 높이 정수배)를 줘서 한 장을 채우면 아래 장으로 흐르게 한다. 저장은 연속 ProseMirror JSON 1덩어리 불변(`documents.body_json`). 쪽 번호는 렌더 시 계산하는 파생 오버레이(저장 안 함). 페이지 높이·간격은 줄 높이(1.92em)의 정수배(한 장 26줄 + 간격 3줄)로 고정해야 줄노트가 페이지마다 정렬되고 경계가 줄 단위로 끊긴다.

**Tech Stack:** TipTap v3 (`@tiptap/react`, StarterKit) · React 19 · Electron 42(Chromium 148, `column-wrap` 지원) · vitest · node:sqlite(저장, 본 Phase 무변경) · CSS `zoom`/multi-column.

**검증 환경(모든 검증 명령 포어그라운드):**
```
cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v   # v24
# 단위테스트/타입/빌드:
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
# 실앱 dogfooding(Electron, column-wrap 실측): 
node_modules/.bin/vite  # 또는 앱 dev 스크립트로 Electron 기동
```

**가드레일(HARD-GATE):**
- 한글 IME 4케이스(빠른타자/조합중 ⌘B/한자/Backspace) — 페이지 경계 줄에서 깨지면 즉시 RED.
- 저장 포맷(`documents.body_json` = ProseMirror JSON)·DB 스키마 **불변**.
- 줄노트(`968b0e0`)·BubbleMenu·자동저장·재진입 카드 회귀 금지.
- 페이지 높이·간격 = 줄 높이 정수배 불변(깨지면 줄노트 어긋남).
- 레이아웃(분할·정렬·외관)은 **실앱 dogfooding 으로만** 최종 판정(단위테스트 불가 영역). 순수 계산만 TDD.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `desktop/src/components/pageLayout.ts` | 페이지 수·쪽 번호 Y위치 순수 계산(줌 보정 포함) | **신규** |
| `desktop/src/components/pageLayout.test.ts` | 위 순수함수 단위테스트(vitest) | **신규** |
| `desktop/src/components/Editor.tsx` | 단일 페이지수 측정 → 다중 페이지 측정 + 장별 쪽번호 오버레이. 저장·IME·BubbleMenu 보존 | 수정 |
| `desktop/src/styles/app.css` | `.paper`/`.prose .ProseMirror` 를 column-wrap 분할 + 종이/책상 띠 + 좌우 여백 + 장별 쪽번호 위치로 | 수정 |

분할 메커니즘·CSS 값의 SoT = PoC `desktop/src/poc/multicolumn/`(McApp.tsx·poc.css). 본 Phase 는 이를 프로덕션에 이식.

**핵심 상수(전 Task 공통, CSS·TS 일치 의무):**
- 본문 글꼴 18px, line-height 1.92 → **줄 높이 = 1.92em = 34.56px**.
- **한 장 = 26줄** → `column-height = calc(26 * 1.92em)` = 49.92em = 898.56px.
- **간격 = 3줄** → `row-gap = calc(3 * 1.92em)` = 103.68px.
- **보폭(stride) = 29줄** = 1002.24px(줌 1 기준). TS `PAGE_STRIDE_PX = 18 * 1.92 * 29`.
- 본문 폭(컬럼) = 160mm, 종이 폭 = 210mm(좌우 25mm 여백).

---

## Task 1: 페이지 수·쪽번호 위치 순수 계산 (pageLayout.ts) — TDD

분할/렌더는 브라우저가 하지만, "몇 장인가 / 각 쪽번호를 어느 Y에 둘까"는 순수 계산이라 TDD 한다. 줌은 CSS `zoom` 으로 측정 px 에 곱해져 있으므로, 측정 높이를 `stride * zoom` 으로 나눠 줌을 상쇄한다.

**Files:**
- Create: `desktop/src/components/pageLayout.ts`
- Test: `desktop/src/components/pageLayout.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — pageCount**

`desktop/src/components/pageLayout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pageCount, LINE_PX, PAGE_STRIDE_PX } from "./pageLayout";

describe("pageCount", () => {
  it("빈/짧은 본문은 최소 1장", () => {
    expect(pageCount(0, 1)).toBe(1);
    expect(pageCount(PAGE_STRIDE_PX * 0.3, 1)).toBe(1);
  });

  it("한 장 보폭을 살짝 넘으면 2장", () => {
    expect(pageCount(PAGE_STRIDE_PX * 1.2, 1)).toBe(2);
  });

  it("줌이 곱해진 측정 높이를 줌으로 상쇄해 장수를 낸다", () => {
    // 줌 1.5 에서 3장 분량이면 측정 높이는 stride*3*1.5
    expect(pageCount(PAGE_STRIDE_PX * 3 * 1.5, 1.5)).toBe(3);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node_modules/.bin/vitest run src/components/pageLayout.test.ts`
Expected: FAIL — `pageLayout` 모듈/`pageCount` 미존재.

- [ ] **Step 3: 최소 구현**

`desktop/src/components/pageLayout.ts`:
```ts
/** 본문 줄 높이(px) — CSS line-height(18px*1.92)와 일치. */
export const LINE_PX = 18 * 1.92;
/** 한 장(26줄) + 간격(3줄) = 다음 장까지 보폭(px, 줌 1 기준). CSS --page-stride 와 일치. */
export const PAGE_STRIDE_PX = LINE_PX * 29;

/**
 * 본문 flow 의 측정 높이(px, 줌 반영됨)와 현재 줌으로 장수를 계산한다.
 * 측정값은 stride*zoom 단위로 늘어나므로 그 단위로 나눠 줌을 상쇄한다.
 */
export function pageCount(flowHeightPx: number, zoom: number): number {
  const stride = PAGE_STRIDE_PX * zoom;
  if (stride <= 0) return 1;
  return Math.max(1, Math.round(flowHeightPx / stride));
}
```

- [ ] **Step 4: 통과 확인**

Run: `node_modules/.bin/vitest run src/components/pageLayout.test.ts`
Expected: PASS (3 케이스).

- [ ] **Step 5: 실패 테스트 추가 — pageNumberTopsEm (쪽번호 Y위치)**

쪽번호는 각 장 하단 여백 자리에 둔다. 장 k(1-base)의 번호 baseline 을 "장 시작 + (26 - 1.2)줄" 위치(em)로 둔다 — 마지막 줄 살짝 아래. 줌은 CSS `zoom` 이 오버레이에도 동일 적용되므로 em 단위(줌 무관 상대값)로 반환한다.

`pageLayout.test.ts` 에 추가:
```ts
import { pageNumberTopsEm } from "./pageLayout";

describe("pageNumberTopsEm", () => {
  it("장 수만큼, 보폭(29줄) 간격으로 위치를 낸다", () => {
    const tops = pageNumberTopsEm(3);
    expect(tops).toHaveLength(3);
    // 1장: (26-1.2)*1.92em, 이후 장마다 +29*1.92em
    expect(tops[0]).toBeCloseTo((26 - 1.2) * 1.92, 5);
    expect(tops[1]).toBeCloseTo((26 - 1.2 + 29) * 1.92, 5);
    expect(tops[2]).toBeCloseTo((26 - 1.2 + 58) * 1.92, 5);
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `node_modules/.bin/vitest run src/components/pageLayout.test.ts`
Expected: FAIL — `pageNumberTopsEm` 미존재.

- [ ] **Step 7: 구현**

`pageLayout.ts` 에 추가:
```ts
const PAGE_LINES = 26;
const STRIDE_LINES = 29;
/** 쪽번호 baseline 을 각 장 마지막 줄 살짝 아래로. */
const NUMBER_FROM_PAGE_TOP_LINES = PAGE_LINES - 1.2;
const LINE_EM = 1.92;

/** 장별 쪽번호의 top 위치(em, 본문 flow 상단 기준). 줌 무관 상대값. */
export function pageNumberTopsEm(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    (NUMBER_FROM_PAGE_TOP_LINES + i * STRIDE_LINES) * LINE_EM,
  );
}
```

- [ ] **Step 8: 통과 확인**

Run: `node_modules/.bin/vitest run src/components/pageLayout.test.ts`
Expected: PASS (전체).

- [ ] **Step 9: 커밋**

```bash
git add desktop/src/components/pageLayout.ts desktop/src/components/pageLayout.test.ts
git commit -m "feat(editor): 페이지 분할 쪽수·쪽번호 위치 순수 계산 + 테스트"
```

---

## Task 2: app.css — `.prose .ProseMirror` 를 column-wrap 다중 페이지로 (핵심·dogfoodable 1차)

PoC 의 핵심 CSS 를 프로덕션 종이에 이식한다. 이 Task 종료 시 **실앱에서 본문이 여러 A4 장으로 나뉘어 보여야** 한다(첫 dogfoodable 산출물). 좌우 여백·종이/책상 띠 포함. 쪽번호·제목 정밀화는 Task 3·4.

**Files:**
- Modify: `desktop/src/styles/app.css:299-342`(`.paper`, `.page-num`, `.paper--lined ...`), 신규 변수.

- [ ] **Step 1: 줄-격자 CSS 변수 추가**

`app.css` 의 `:root`(테마 변수 블록) 끝에 추가:
```css
  /* 페이지 분할 격자 — 페이지 높이·간격은 줄 높이(1.92em)의 정수배여야 줄노트가 페이지마다 정렬된다. */
  --page-lines: 26;     /* 한 장 본문 줄 수 */
  --gap-lines: 3;       /* 장 사이 책상 간격(줄) */
  --page-h: calc(var(--page-lines) * 1.92em);            /* column-height */
  --page-stride: calc((var(--page-lines) + var(--gap-lines)) * 1.92em);
```

- [ ] **Step 2: `.paper` 를 다중 페이지 컨테이너로 변경**

`app.css:299-310` 의 `.paper` 블록을 교체:
```css
.paper {
  zoom: var(--zoom, 1);                 /* 작업공간 축소/확대(종이+글자 비례, 줄격자 유지) */
  width: 100%; max-width: 210mm;        /* A4 폭 */
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-paper);
  padding: 0 25mm;                      /* 좌우 A4 여백만 — 위/아래는 페이지 띠가 처리(컬럼은 위/아래 여백 없음) */
  animation: rise var(--dur-enter) var(--ease-out) both;
  position: relative;                   /* 쪽번호 오버레이 기준 */
  /* 종이/책상 띠: 한 장(26줄) 종이색, 다음 간격(3줄) 책상색. 보폭=page-stride. */
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0, transparent var(--page-h),
      var(--desk) var(--page-h), var(--desk) var(--page-stride)
    ),
    var(--paper);
}
```
> 비고: 기존 `min-height: 297mm`·`display:flex` 제거 — 이제 본문 flow 높이가 종이 높이를 정한다. `--desk` 변수는 PoC 와 동일 의도(책상색); `app.css` 에 없으면 기존 책상 배경색 변수(예: `--bg`/스튜디오 배경)로 대체.

- [ ] **Step 3: `.prose .ProseMirror` 에 column-wrap 적용**

`app.css:354-359` 의 `.prose .ProseMirror` 블록에 분할 속성 추가(기존 font/line-height/color 유지, `flex` 제거):
```css
.prose .ProseMirror {
  font-family: var(--font-serif); font-size: 18px; font-weight: 400; line-height: 1.92;
  color: var(--ink); letter-spacing: 0.002em;
  outline: none; text-wrap: pretty;
  /* 페이지 분할 — 한 장(26줄)을 채우면 아래 장으로(세로로 쌓임). 분할=브라우저 레이아웃, 입력 중 transform 0. */
  column-width: 160mm;          /* 한 장 본문 폭 */
  column-height: var(--page-h); /* 26줄; 채우면 다음 장 */
  column-wrap: wrap;
  column-gap: 30mm;
  row-gap: calc(var(--gap-lines) * 1.92em);
}
```
> `.prose` wrapper(`app.css:353`)의 `flex` 도 제거(또는 무해): 본문이 flex 로 늘어나면 빈 줄이 끼므로 column-wrap 과 충돌. `.prose { max-width: none; }` 만 남긴다.

- [ ] **Step 4: 빌드·타입 회귀 없음 확인**

Run: `node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build`
Expected: 둘 다 성공(CSS 변경이라 주로 build).

- [ ] **Step 5: 실앱 dogfooding (1차 게이트)**

앱을 Electron 으로 띄워(`column-wrap` = Chromium 148 필요, 브라우저 미지원 시 Electron 필수) 집필 화면 진입. 긴 본문(또는 엔터 없이 긴 문단)을 넣고 확인:
- [ ] 본문이 **여러 A4 장으로 세로로 나뉘고**, 장 사이 책상색 간격이 있다.
- [ ] **한글 IME 4케이스**(빠른타자/조합중 ⌘B/한자/Backspace)가 장 경계 줄에서 안 깨진다.
- [ ] 좌우 25mm 여백(종이 폭 210mm)이 보인다.
- [ ] 줌(보기 메뉴) 변경 시 종이·글자가 비례 확대/축소되고 분할이 유지된다.

RED(IME 깨짐/분할 안 됨) → 멈추고 PoC 와 차이(폰트·wrapper·flex 잔존) 대조 후 재논의. GREEN 이면 Step 6.

- [ ] **Step 6: 커밋**

```bash
git add desktop/src/styles/app.css
git commit -m "feat(editor): 본문을 CSS column-wrap 로 A4 다중 페이지 분할(실시간)"
```

---

## Task 3: 줄노트 페이지 정렬 + 제목·서식 격자 정합 (app.css)

PoC 처럼 줄노트 줄선이 페이지마다 위상이 맞아야 하고, 제목(`doc-title`)·서식 블록이 줄 격자를 깨지 않아야 한다. 기존 `.paper--lined` 는 이미 h1/h2/목록/인용을 1.92em 격자에 스냅하므로(`app.css:337-342`), 본 Task 는 (a) 줄노트 그라디언트를 페이지 띠와 함께 3층으로 정렬, (b) `doc-title` 을 격자 배수로 스냅한다.

**Files:**
- Modify: `desktop/src/styles/app.css:324-347`(`.paper--lined ...`, `.doc-title`).

- [ ] **Step 1: 줄노트 그라디언트를 페이지 정렬형으로 교체**

`app.css:324-334` 의 `.paper--lined .prose .ProseMirror` 배경을 교체(줄선은 연속이되 보폭이 줄 정수배라 페이지마다 위상 일치; 책상 띠는 `.paper` 가 덮음):
```css
.paper--lined .prose .ProseMirror {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent calc(1.92em - 1px),
    var(--hairline) calc(1.92em - 1px),
    var(--hairline) 1.92em
  );
  background-position-y: 0em;
}
```
> 변경점: 기존과 거의 동일하나, 페이지가 줄 정수배(26줄)+간격(3줄)이므로 줄선이 자동으로 페이지마다 정렬된다. 간격(3줄) 구간의 줄선은 `.paper` 의 책상 띠(불투명 `--desk`)가 위에서 덮는다(`.paper` 배경이 `.prose` 보다 뒤이므로, 책상 띠가 줄선을 가리려면 책상 띠를 `.prose` 위 레이어로 둬야 함 — Step 2 참조).

- [ ] **Step 2: 간격 구간 줄선 가림 — 책상 띠를 본문 위 오버레이로**

`.paper` 배경의 책상 띠는 `.prose` 뒤라 줄선을 못 가린다. 간격 구간 줄선을 가리기 위해 `.paper` 에 `::after` 오버레이(책상 띠만, pointer-events none)를 추가.

**중요 — 제목 offset:** `doc-title` 은 컬럼 flow **위**에 있어 본문 컬럼은 종이 상단이 아니라 **제목 높이만큼 아래**에서 시작한다. 따라서 띠(종이 상단 기준)를 본문 컬럼의 간격에 맞추려면 **제목 높이만큼 `background-position-y` offset** 이 필요하다. Step 3 에서 제목을 2줄(=3.84em)로 스냅하므로 `--title-h: 3.84em`.
```css
.paper { --title-h: 3.84em; }   /* 제목(1줄)+아래여백(1줄) = 2줄. Step 3 doc-title 과 일치 */
.paper::after {
  content: "";
  position: absolute; inset: 0 0 0 0;     /* 종이 전체 폭(좌우 여백 포함) */
  pointer-events: none; z-index: 1;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0, transparent var(--page-h),
    var(--desk) var(--page-h), var(--desk) var(--page-stride)
  );
  background-position-y: var(--title-h);   /* 제목 높이만큼 띠를 내려 본문 컬럼 간격과 정렬 */
}
/* 본문·제목·쪽번호는 오버레이 위로. */
.paper > * { position: relative; z-index: 2; }
```
> 본문 줄선(간격 구간)은 책상 띠 `::after`(z-index 1) 아래, 본문 텍스트(z-index 2)는 그 위 — 간격엔 줄선이 가려지고 텍스트는 안 가려진다. `.paper` 본체 배경의 책상 띠 레이어는 종이색만 남겨도 됨: `.paper { background: var(--paper); }` 로 단순화(책상 띠는 `::after` 담당).
> **dogfooding 보정:** `--title-h` offset 과 쪽번호 `top`(Task 4)·`pageNumberTopsEm` 의 제목 offset 은 실앱에서 띠/줄선/쪽번호가 어긋나면 함께 보정한다(제목 아래에서 본문이 시작하므로 쪽번호 top 에도 `+var(--title-h)` 가 필요할 수 있음 — Task 4 Step 6 에서 실측).

- [ ] **Step 3: `doc-title` 을 줄 격자 배수로 스냅**

`app.css:344-347` 의 `.doc-title` 을 교체(제목이 페이지 1 상단에서 정수 줄을 차지하도록):
```css
.doc-title {
  font-family: var(--font-serif); font-size: 27px; font-weight: 700;
  line-height: 1.92em;            /* 줄 격자 1칸 (27px 글자도 격자 한 줄 안에) */
  letter-spacing: -0.01em; color: var(--ink);
  margin: 0 0 1.92em;             /* 아래 1줄 — 격자 배수 */
  text-wrap: balance;
}
```
> 제목이 1줄(+아래 1줄 여백)=2줄을 차지 → 본문이 3번째 줄부터 격자 정렬. 제목이 길어 2줄이 되면 격자가 1줄 밀리지만(드묾), v1 허용(dogfooding 확인). `.doc-title` 은 `.prose` 형제(컬럼 flow 밖)라 페이지 1 상단에만 위치 — column-wrap 영향 없음.

- [ ] **Step 4: 빌드 확인**

Run: `node_modules/.bin/vite build`
Expected: 성공.

- [ ] **Step 5: dogfooding (줄노트·서식 정렬)**

- [ ] 줄노트 ON 에서 줄선이 글자 줄 바로 아래에 붙고, **2장·3장으로 내려가도 안 어긋난다**.
- [ ] 간격(책상) 구간에 줄선이 안 보인다.
- [ ] 제목 아래 본문 첫 줄이 줄선에 맞는다.
- [ ] BubbleMenu 로 제목(H2)·목록·인용 적용 시 줄선 정렬이 유지된다(기존 lined 스냅).

- [ ] **Step 6: 커밋**

```bash
git add desktop/src/styles/app.css
git commit -m "feat(editor): 줄노트 페이지 정렬(3층 띠) + 제목 줄격자 스냅"
```

---

## Task 4: Editor.tsx — 장별 쪽번호 오버레이로 교체

기존 단일 `.page-num`(총 쪽수 1개)을 장마다 하단에 쪽번호가 뜨는 오버레이로 바꾼다. Task 1 의 `pageCount`·`pageNumberTopsEm` 사용. 측정 대상 = 본문 flow(`.prose .ProseMirror`)의 `scrollHeight`.

**Files:**
- Modify: `desktop/src/components/Editor.tsx:7-8,44-63,143`(상수·측정 effect·page-num 렌더)
- Modify: `desktop/src/styles/app.css:313-319`(`.page-num` → 다중 위치)

- [ ] **Step 1: import + 측정 대상 변경**

`Editor.tsx` 상단 import 에 추가, `A4_PAGE_PX` 상수(line 7-8) 제거:
```ts
import { pageCount, pageNumberTopsEm } from "./pageLayout";
```

- [ ] **Step 2: 측정 effect 를 본문 flow 기준 + 다중 페이지로 교체**

`Editor.tsx:44-63`(paperRef·pages state·measure effect)를 교체:
```ts
export function Editor({ title, initialBodyJson, onChange, lined, zoom = 1 }: EditorProps) {
  const proseRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);

  // 본문 flow(.ProseMirror) 의 측정 높이로 장수를 계산. CSS zoom 은 측정 px 에 곱해져 있어 pageCount 가 상쇄.
  useEffect(() => {
    const host = proseRef.current;
    const pm = host?.querySelector<HTMLElement>(".ProseMirror");
    if (!pm) return;
    const measure = () => setPages(pageCount(pm.scrollHeight, zoom));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pm);
    return () => ro.disconnect();
  }, [zoom]);
```
> `paperRef`(article) 대신 `proseRef`(.prose wrapper)에서 `.ProseMirror` 를 찾아 측정한다. `ro.observe(pm)` 가 내용 변화에 따른 높이 변화를 잡는다.

- [ ] **Step 3: EditorContent 에 ref + 장별 쪽번호 렌더**

`Editor.tsx:142-143`(EditorContent + 단일 page-num)을 교체:
```tsx
        <EditorContent editor={editor} className="prose" ref={proseRef} />
        {Array.from({ length: pages }, (_, i) => i + 1).map((n, idx) => (
          <div
            key={n}
            className="page-num"
            style={{ top: `${pageNumberTopsEm(pages)[idx]}em` }}
            aria-label={`${n}쪽`}
          >
            {n}
          </div>
        ))}
```
> `EditorContent` 는 ref 를 forward 한다(div wrapper). 쪽번호는 `.paper`(position relative) 기준 절대배치 — top 은 본문 flow 상단 기준 em. 본문 flow 는 제목 아래에서 시작하므로, 제목 높이만큼 추가 offset 이 필요하면 dogfooding 으로 보정(아래 Step 6).

- [ ] **Step 4: `.page-num` CSS 를 다중 위치형으로 변경**

`app.css:313-319` 의 `.page-num` 교체:
```css
/* 장마다 하단 여백 자리의 쪽번호(인쇄된 쪽번호처럼). top 은 인라인 스타일(장별). */
.page-num {
  position: absolute; left: 0; right: 0;
  text-align: center;
  font-family: var(--font-serif); font-size: 13px; color: var(--faint);
  font-variant-numeric: tabular-nums;
  user-select: none; pointer-events: none; z-index: 2;
}
```
> 변경점: `bottom: 12mm` 제거, `top` 인라인으로. `z-index: 2`(책상 띠 위).

- [ ] **Step 5: 타입·빌드 확인**

Run: `node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build`
Expected: 성공. (EditorContent ref 타입 불일치 시 `proseRef` 를 `useRef<HTMLDivElement>(null)` 로 두고 EditorContent 의 ref prop 타입 확인.)

- [ ] **Step 6: dogfooding (쪽번호)**

- [ ] 장마다 하단에 1·2·3… 쪽번호가 뜬다.
- [ ] 쪽번호가 각 장 하단 여백 자리(마지막 줄 아래)에 온다 — 어긋나면 `pageLayout.ts` 의 `NUMBER_FROM_PAGE_TOP_LINES` 또는 제목 offset 보정(브라우저에서 실측 조정 후 상수 반영).
- [ ] 본문 추가/삭제 시 쪽수·쪽번호가 실시간 갱신된다.
- [ ] 줌 변경에도 쪽번호가 제자리(em·zoom 비례).

- [ ] **Step 7: 커밋**

```bash
git add desktop/src/components/Editor.tsx desktop/src/styles/app.css
git commit -m "feat(editor): 단일 쪽수 → 장별 쪽번호 오버레이(파생 계산)"
```

---

## Task 5: 비-줄노트 모드 + 회귀 검증 마감

줄노트 OFF 모드에서 문단 여백(`1.32em`)이 격자 비배수라 페이지 경계가 줄에 안 맞을 수 있다(줄선이 없어 시각 영향은 작지만, 경계가 줄 중간을 자르지 않게 확인). 그리고 전체 회귀 게이트를 마감한다.

**Files:**
- Modify(필요 시): `desktop/src/styles/app.css:360`(비-lined 문단 여백) — dogfooding 결과에 따라.

- [ ] **Step 1: 비-줄노트 dogfooding**

줄노트 OFF 로 두고:
- [ ] 페이지가 여전히 줄 경계에서 깔끔히 끊긴다(줄 중간 잘림 없음 — line box 는 분할 안 되므로 기본 OK).
- [ ] 문단 사이 여백(1.32em)이 페이지 경계에 걸칠 때 어색하지 않다.

문단이 페이지 경계에서 어색하면(예: 여백이 다음 장 맨 위에 남음) `app.css:360` 의 `.prose .ProseMirror p { margin: 0 0 1.32em; }` 를 격자 배수 `0 0 1.92em` 로 통일하는 안을 dogfooding 으로 판단(변경 시 커밋, 아니면 skip).

- [ ] **Step 2: 한글 IME 4케이스 최종 회귀(HARD-GATE)**

집필 화면에서 줄노트 ON/OFF 각각:
- [ ] ① 빠른 타자(조합 중 다음 자모) — 자모 분리 없음.
- [ ] ② 조합 중 ⌘B 굵게 토글 — 조합 유지.
- [ ] ③ 한자 변환 — 정상.
- [ ] ④ Backspace 자모 분해 — 정상.
- [ ] ⑤ **페이지 경계 줄에서** 위 4케이스 재확인.

하나라도 RED → 즉시 멈추고 보고(저장 onUpdate 의 `view.composing` 가드 동작 확인).

- [ ] **Step 3: 저장·재진입·줌·기존 문서 회귀**

- [ ] 입력 → 자동저장 동작(저장 상태 라벨), 앱 재시작 후 본문 복원(저장 포맷 불변).
- [ ] 작품 전환(editorKey 변경) 시 새 본문으로 remount + 페이지 재계산.
- [ ] 재진입 카드·BubbleMenu·곁쪽지 서랍 정상.
- [ ] 줌 50%~200% 에서 분할·줄선·쪽번호 정합.
- [ ] 기존 문서(서식 섞인 본문) 열어 깨짐 없음.

- [ ] **Step 4: 전체 자동 게이트(포어그라운드)**

Run:
```
node_modules/.bin/vitest run && node_modules/.bin/tsc --noEmit && node_modules/.bin/vite build
```
Expected: 전부 GREEN(기존 + `pageLayout.test.ts`). RED 회귀 시 수정.

- [ ] **Step 5: 커밋(변경이 있었으면)**

```bash
git add -A desktop/src
git commit -m "fix(editor): 비-줄노트 페이지 경계 정합 + 회귀 마감"
```

---

## Task 6: 진척 동기화 (vault + PoC 문서)

CLAUDE.md vault HARD-GATE — Phase 완료 시 vault 갱신 의무.

- [ ] **Step 1: vault 02-PROGRESS 갱신**

`~/obsidian/write-note/02-PROGRESS.md` 에 "집필 에디터 실시간 페이지 분할 Phase 1 완료(PoC 0-4 안1 = CSS column-wrap 통합)" 요약 + 본 plan·`docs/poc/0-4-page-split-poc-plan.md` 링크 추가. 이슈 발견 시 `03-ISSUES.md`.

- [ ] **Step 2: 0-4 문서에 Phase 1 완료 표시**

`docs/poc/0-4-page-split-poc-plan.md` §10 스코프 표의 Phase 1 에 완료 표식.

- [ ] **Step 3: 커밋**

```bash
git add docs/poc/0-4-page-split-poc-plan.md
git commit -m "docs(poc): 페이지 분할 Phase 1 완료 동기화"
```

---

## 후속(별도 plan — 본 Phase 범위 밖)

- **Phase 2 — 쪽 네비게이션(#1):** "N / 총 M쪽" 표시, 쪽 이동. 본 Phase 의 `pageCount`·`pageNumberTopsEm` 재사용.
- **Phase 3 — 메모 문서 위치 앵커(#2):** 곁쪽지를 본문 위치(앵커)에 연결, 표시 시 파생 쪽. `memo_projects` 스키마 touch(사용자 컨펌).
- **#4 출력 쪽 번호:** export 기능 도입 시점.

---

## Self-Review

**Spec coverage(0-4 §9·§10):**
- §9 항상 실시간 분할 → Task 2(column-wrap, 토글 없음). ✓
- §9 제목·목록 줄 배수 스냅 → Task 3(doc-title 스냅) + 기존 `.paper--lined` h1/h2/목록/인용 스냅. ✓
- §9 각 장 하단 쪽번호 → Task 4. ✓
- §9 진짜 A4(210mm, 좌우 여백) → Task 2(width 210mm + padding 0 25mm). ✓
- §10 저장 불변 → 전 Task 가 `body_json`·스키마 미변경. ✓
- §10 #1·#2·#4 → 후속 Phase 로 분리 명시. ✓
- 가드레일(IME/줄노트/줌/저장) → Task 5 회귀 게이트. ✓

**Placeholder scan:** 레이아웃 정밀값(쪽번호 offset·제목 2줄·비-lined 여백)은 "dogfooding 실측 보정"으로 명시 — 이는 CSS 레이아웃의 본질(단위테스트 불가)이라 placeholder 가 아니라 검증 방식 지정. 순수 계산(Task 1)은 완전 코드+테스트. 그 외 TODO/TBD 없음.

**Type consistency:** `pageCount(flowHeightPx, zoom)`·`pageNumberTopsEm(count)`·`PAGE_STRIDE_PX`·`LINE_PX` 가 Task 1 정의 ↔ Task 4 사용에서 일치. CSS `--page-h`/`--page-stride`/`--page-lines`(26)/`--gap-lines`(3) ↔ TS `PAGE_STRIDE_PX = LINE_PX*29` 일치(26+3=29).
