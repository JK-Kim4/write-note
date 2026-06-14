# 진짜 A4 페이지 모델 + 줄노트 정렬 재설계 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 집필 화면 페이지를 진짜 용지 치수(A4 297mm 등)로 통일하면서, 본문 영역을 줄높이 정수배(N줄)로 만들어 줄노트를 페이지마다 정렬한다(baseline grid 페이지 재시작 원리). 이후 023 export Phase 3 PDF를 이 모델 위에서 재개한다.

**Architecture:** 분할 메커니즘(CSS Multicol L2 `column-wrap`)·한국어 IME 가드·자동저장·세션은 **불변**. `pageLayout.ts`의 기하 상수만 "진짜 용지높이 sheet + N줄 본문 + 하단여백 흡수"로 재설계하고, 그에 의존하는 A형(`paper-editor.css`/`PaperEditor.tsx`)·B형(`b.css`/`BEditor.tsx`) CSS·파생을 정합시킨다. click-fill의 줄 계산(`globalLineAt`)은 보폭이 줄 정수배가 아니게 되므로 px 기반으로 재설계한다.

**Tech Stack:** Next.js 16 + TypeScript + React 19 + TipTap StarterKit, Vitest 단위 테스트.

---

## 기준 상수 (모든 task 공통 — 추측 금지, 이 값 사용)

- `LINE_PX = 34.56`(18px × 1.92), 불변.
- CSS px↔mm(96dpi): `PX_PER_MM = 96 / 25.4 = 3.779528`, `MM_PER_LINE = 34.56 / 3.779528 = 9.1440mm`.
- 상하 여백 각 **25mm**(좌우와 대칭). 상하 합 50mm.
- 용지별 본문 줄수 `N = floor((heightMm − 50) / 9.1440)`:

| 용지 | widthMm | heightMm | N(본문줄) |
|---|---|---|---|
| A4 | 210 | 297 | **27** |
| B4 | 257 | 364 | **34** |
| A3 | 297 | 420 | **40** |
| A2 | 420 | 594 | **59** |

- 검산: A4 (297−50)/9.1440 = 27.01 → 27. B4 34.34→34. A3 40.46→40. A2 59.49→59.

---

## 사전 확인 (구현 진입 직전)

- [ ] `frontend/src/components/editor/pageLayout.ts` 전체와 `pageLayout.test.ts` 정독 — 현 `PaperGeometry` 필드(`bodyLines/sheetLines/strideLines/pageHpx/sheetHpx/stridePx/colWidthMm/maxWidthMm`)와 테스트 패턴 확인.
- [ ] `git diff develop..HEAD --stat` 으로 023 export 산출물(Phase 0~2)이 본 변경 대상 파일과 겹치지 않음을 재확인(ExportDialog는 `PaperSize` 타입만 사용 → 안 깨짐).

---

## Task 1: pageLayout.ts 기하 재설계 — 진짜 용지높이 + N줄 본문

`PAPER_PRESETS`/`PaperGeometry`/`paperGeometry`를 "sheet=진짜 용지높이, 본문=N줄(정수배), 하단여백 흡수" 모델로 바꾼다. `sheetLines`/`strideLines`(줄 단위 sheet) 개념은 제거하고, 진짜 치수 px + `topPadPx`(본문 시작 전 상단 패딩)를 도입한다.

**Files:**
- Modify: `frontend/src/components/editor/pageLayout.ts`
- Test: `frontend/src/components/editor/pageLayout.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (새 기하 계약 고정 — 기존 26줄 회귀 테스트는 이 task에서 새 값으로 교체)

```ts
import { describe, it, expect } from "vitest";
import { LINE_PX, PAPER_PRESETS, paperGeometry } from "./pageLayout";

const PX_PER_MM = 96 / 25.4;

describe("PAPER_PRESETS — 진짜 용지 치수", () => {
    it("A4 = 210×297mm", () => expect(PAPER_PRESETS.A4).toMatchObject({ widthMm: 210, heightMm: 297 }));
    it("B4 = 257×364mm", () => expect(PAPER_PRESETS.B4).toMatchObject({ widthMm: 257, heightMm: 364 }));
    it("A3 = 297×420mm", () => expect(PAPER_PRESETS.A3).toMatchObject({ widthMm: 297, heightMm: 420 }));
    it("A2 = 420×594mm", () => expect(PAPER_PRESETS.A2).toMatchObject({ widthMm: 420, heightMm: 594 }));
});

describe("paperGeometry — 진짜 A4 모델", () => {
    it("A4 본문 27줄", () => expect(paperGeometry("A4").bodyLines).toBe(27));
    it("B4 본문 34줄", () => expect(paperGeometry("B4").bodyLines).toBe(34));
    it("A3 본문 40줄", () => expect(paperGeometry("A3").bodyLines).toBe(40));
    it("A2 본문 59줄", () => expect(paperGeometry("A2").bodyLines).toBe(59));

    it("A4 sheetHpx = 진짜 297mm 환산 px", () => {
        expect(paperGeometry("A4").sheetHpx).toBeCloseTo(297 * PX_PER_MM, 3);
    });
    it("A4 pageHpx(본문영역) = 27 × LINE_PX", () => {
        expect(paperGeometry("A4").pageHpx).toBeCloseTo(27 * LINE_PX, 8);
    });
    it("A4 topPadPx = 25mm 환산 px", () => {
        expect(paperGeometry("A4").topPadPx).toBeCloseTo(25 * PX_PER_MM, 3);
    });
    it("A4 colWidthMm = 160 (210 − 50)", () => expect(paperGeometry("A4").colWidthMm).toBe(160));
    it("본문영역 + 상단여백 ≤ sheetHpx (하단여백이 잔여 흡수)", () => {
        const g = paperGeometry("A4");
        expect(g.topPadPx + g.pageHpx).toBeLessThanOrEqual(g.sheetHpx);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && node_modules/.bin/vitest run src/components/editor/pageLayout.test.ts`
Expected: FAIL — 현재 A4 bodyLines=26, sheetHpx=28×LINE, `topPadPx` 없음

- [ ] **Step 3: 구현** (현 파일의 상단 상수/`PaperPreset`/`PaperGeometry`/`paperGeometry`를 아래로 교체. 하위호환 `PAGE_STRIDE_PX`/`SHEET_H_PX` deprecated 상수는 제거)

```ts
export const LINE_PX = 18 * 1.92; // 34.56 — 불변

/** CSS 96dpi: 1mm = 96/25.4 px */
const PX_PER_MM = 96 / 25.4;
/** 한 줄 높이(mm) = LINE_PX 환산 */
const MM_PER_LINE = LINE_PX / PX_PER_MM; // ≈ 9.1440
/** 상/하 본문 여백(mm) — 좌우(25)와 대칭 */
const VERTICAL_MARGIN_MM = 25;

export type PaperSize = "A4" | "A3" | "A2" | "B4";

/** 용지별 진짜 치수(mm). */
export const PAPER_PRESETS: Record<PaperSize, { widthMm: number; heightMm: number }> = {
    A4: { widthMm: 210, heightMm: 297 },
    B4: { widthMm: 257, heightMm: 364 },
    A3: { widthMm: 297, heightMm: 420 },
    A2: { widthMm: 420, heightMm: 594 },
};

/** 용지별 기하 파생값(순수). 진짜 용지높이 sheet + N줄 본문영역 + 여백. */
export type PaperGeometry = {
    bodyLines: number; // 본문 줄 수 N (줄높이 정수배 — 줄노트 정렬 기준)
    pageHpx: number; // 본문영역 높이(px) = bodyLines * LINE_PX (= CSS column-height)
    sheetHpx: number; // 종이 높이(px) = 진짜 용지높이 환산
    topPadPx: number; // 본문 시작 전 상단 여백(px) = 25mm 환산
    stridePx: number; // 장 보폭(px) = sheetHpx + 책상 gap
    colWidthMm: number; // 본문 열 너비(mm) = widthMm − 50 (좌우 25mm)
    maxWidthMm: number; // 용지 너비(mm)
};

/** 종이 사이 책상 간격(px) — 시각용. 현행 보폭(본문+4줄)의 여유분을 2줄로 유지. */
const DESK_GAP_PX = LINE_PX * 2;

export function paperGeometry(size: PaperSize): PaperGeometry {
    const { widthMm, heightMm } = PAPER_PRESETS[size];
    const bodyLines = Math.floor((heightMm - VERTICAL_MARGIN_MM * 2) / MM_PER_LINE);
    const sheetHpx = heightMm * PX_PER_MM;
    return {
        bodyLines,
        pageHpx: bodyLines * LINE_PX,
        sheetHpx,
        topPadPx: VERTICAL_MARGIN_MM * PX_PER_MM,
        stridePx: sheetHpx + DESK_GAP_PX,
        colWidthMm: widthMm - 50,
        maxWidthMm: widthMm,
    };
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && node_modules/.bin/vitest run src/components/editor/pageLayout.test.ts`
Expected: 일부 PASS — `globalLineAt`/`pageNumberTopsPx`/`pageCount` 관련 기존 테스트는 시그니처 변경 전이라 RED 가능. 그 테스트들은 Task 2에서 갱신. 본 task의 신규 기하 테스트는 GREEN 확인.

- [ ] **Step 5: 호출부 컴파일 깨짐 파악** (제거된 `sheetLines`/`strideLines`/`SHEET_H_PX`/`PAGE_STRIDE_PX` 참조)

Run: `cd frontend && node_modules/.bin/tsc --noEmit 2>&1 | head -30`
Expected: `PaperEditor.tsx`/`BEditor.tsx`/`pageLayout.test.ts` 등에서 제거 심볼 참조 에러 목록. **이 목록을 Task 2~4에서 정리** (여기선 기록만, 커밋은 다음 step).

- [ ] **Step 6: 커밋** (이 task는 pageLayout만 — 호출부 깨짐은 후속 task에서 GREEN. 부분 커밋 허용: 신규 기하 테스트 GREEN 확인 후)

```bash
git add frontend/src/components/editor/pageLayout.ts frontend/src/components/editor/pageLayout.test.ts
git commit -m "feat(023): pageLayout 진짜 용지높이+N줄 본문 기하 재설계"
```

---

## Task 2: globalLineAt px 기반 재설계 + pageNumberTopsPx 정합

보폭(`stridePx`)이 줄 정수배가 아니게 되므로, click-fill의 줄 계산을 줄 단위(`linesFromTop`)에서 **px 단위 + geometry**로 바꾼다. 순수 함수의 입출력 계약은 단위 테스트로 고정한다.

**Files:**
- Modify: `frontend/src/components/editor/pageLayout.ts`
- Test: `frontend/src/components/editor/pageLayout.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { paperGeometry, globalLineAt, pageNumberTopsPx, LINE_PX } from "./pageLayout";

describe("globalLineAt — px 기반(진짜 용지높이 보폭)", () => {
    const g = paperGeometry("A4"); // bodyLines 27

    it("본문 상단(0px) → 0줄", () => expect(globalLineAt(0, g)).toBe(0));
    it("음수 y → 0줄", () => expect(globalLineAt(-10, g)).toBe(0));
    it("1페이지 상단여백 직후 첫 줄 → 0줄", () => {
        expect(globalLineAt(g.topPadPx + 1, g)).toBe(0);
    });
    it("1페이지 3번째 줄 → 2", () => {
        expect(globalLineAt(g.topPadPx + 2 * LINE_PX + 1, g)).toBe(2);
    });
    it("1페이지 본문 끝 너머는 그 페이지 마지막 줄(26)로 스냅", () => {
        // 본문 27줄(0..26) → 마지막 = 26
        expect(globalLineAt(g.topPadPx + 100 * LINE_PX, g)).toBe(26);
    });
    it("2페이지 첫 줄 → 27 (page*bodyLines + 0)", () => {
        expect(globalLineAt(g.stridePx + g.topPadPx + 1, g)).toBe(27);
    });
});

describe("pageNumberTopsPx — 진짜 용지높이", () => {
    const g = paperGeometry("A4");
    it("각 장 쪽번호 top = i*stride + sheetHpx − 0.5줄", () => {
        expect(pageNumberTopsPx(2, g.stridePx, g.sheetHpx)).toEqual([
            g.sheetHpx - LINE_PX * 0.5,
            g.stridePx + g.sheetHpx - LINE_PX * 0.5,
        ]);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && node_modules/.bin/vitest run src/components/editor/pageLayout.test.ts -t globalLineAt`
Expected: FAIL — 현 `globalLineAt(linesFromTop, bodyLines, strideLines)` 시그니처 불일치

- [ ] **Step 3: 구현** (현 `globalLineAt` 교체. `pageNumberTopsPx`는 시그니처 유지 — 인자만 새 geometry 값)

```ts
/**
 * 본문 flow 상단 기준 y(px, 줌 제거)가 가리키는 전역 줄 번호(0-base).
 * 진짜 용지높이 보폭에서 페이지를 px로 가르고, 페이지 내 상단여백 이후를 줄 단위로 센다.
 * 본문영역(bodyLines)을 넘는 클릭은 그 페이지 마지막 줄로 스냅.
 *
 * @param yPx - (clientY − pmTop) / zoom  — 호출부에서 줌 제거 후 전달
 * @param g   - paperGeometry(size)
 */
export function globalLineAt(yPx: number, g: PaperGeometry): number {
    if (yPx <= 0) return 0;
    const page = Math.floor(yPx / g.stridePx);
    const yInPage = yPx - page * g.stridePx - g.topPadPx;
    const row = Math.min(g.bodyLines - 1, Math.max(0, Math.floor(yInPage / LINE_PX)));
    return page * g.bodyLines + row;
}
```

(`pageNumberTopsPx`는 현 구현 그대로 — `count, stridePx, sheetHpx` 시그니처 유지, 새 geometry 값이 흘러들면 자동 정합.)

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && node_modules/.bin/vitest run src/components/editor/pageLayout.test.ts`
Expected: pageLayout 테스트 전부 GREEN (Task 1 기하 + Task 2 파생). tsc 호출부(PaperEditor/BEditor)는 아직 RED — Task 3/4에서.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/editor/pageLayout.ts frontend/src/components/editor/pageLayout.test.ts
git commit -m "feat(023): globalLineAt px 기반 재설계 — 진짜 용지높이 보폭 click-fill"
```

---

## Task 3: A형 — paper-editor.css + PaperEditor.tsx 정합

A형은 **A4 고정**. CSS의 26줄 하드코딩을 새 A4 기하(본문 27줄, sheet 진짜 297mm)로, 줄노트를 본문영역에만 정렬. `PaperEditor.tsx`의 `A4_GEOMETRY`·`handlePaperMouseDown`을 새 시그니처에 맞춘다.

**Files:**
- Modify: `frontend/src/components/editor/paper-editor.css`
- Modify: `frontend/src/components/editor/PaperEditor.tsx`

> **작업 직전 의무:** 두 파일을 정독하고 현 `--page-h`/`--page-stride`/`.sheet`/`.sheet--lined`/`.prose .ProseMirror`(column-height/row-gap)·`handlePaperMouseDown`(globalLineAt 호출)을 확인 후 아래를 적용.

- [ ] **Step 1: paper-editor.css 기하 변수 교체**

`.paper-editor` 변수 블록:
```css
--page-line: 34.56px;
--page-h: calc(var(--page-line) * 27);   /* 본문영역 27줄(column-height) — A4 진짜 */
--sheet-h: calc(297mm);                    /* 종이 = 진짜 A4 높이 */
--top-pad: 25mm;                            /* 상단 여백(좌우와 대칭) */
--desk-gap: calc(var(--page-line) * 2);    /* 종이 사이 책상 간격 */
--page-stride: calc(var(--sheet-h) + var(--desk-gap));
```
- `.prose .ProseMirror`: `column-height: var(--page-h);` (27줄), `row-gap: calc(var(--page-stride) - var(--page-h));` 는 `calc(var(--page-stride) - var(--page-h))` 유지(보폭 − 본문영역). `column-width: 160mm` 불변.
- `.prose`: 상단 패딩을 `--top-pad`(25mm)로 — 본문이 25mm 아래에서 시작(현재 `var(--page-line)` → `var(--top-pad)`).
- `.sheet`: `height` 인라인(PaperEditor가 `sheetHpx` 주입) 또는 `var(--sheet-h)`. 현 PaperEditor는 `height: sheetHpx px` 인라인 — Step 2에서 새 값.
- `.sheet--lined`: 줄노트를 **본문영역에만** — `padding: var(--top-pad) 25mm 0;` + `repeating-linear-gradient` 를 본문 27줄 영역에 한정(content-box 패딩 = 상단 25mm). 그라디언트 높이가 27줄 정수배라 페이지마다 정렬.

- [ ] **Step 2: PaperEditor.tsx — A4_GEOMETRY 새 값 + handlePaperMouseDown 정합**

`A4_GEOMETRY = paperGeometry("A4")` 는 그대로(새 값 자동). `handlePaperMouseDown` 의 `globalLineAt` 호출을 새 px 시그니처로:
```tsx
const handlePaperMouseDown = (e: ReactMouseEvent<HTMLElement>) => {
    if (!editor) return;
    const pm = paperRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (!pm) return;
    const pmTop = pm.getBoundingClientRect().top;
    const targetLine = globalLineAt((e.clientY - pmTop) / zoom, A4_GEOMETRY);
    const endTop = editor.view.coordsAtPos(editor.state.doc.content.size).top;
    const lastLine = globalLineAt((endTop - pmTop) / zoom, A4_GEOMETRY);
    if (targetLine <= lastLine) return;
    e.preventDefault();
    const fill = Math.min(1000, targetLine - lastLine);
    editor.chain().focus("end").insertContent(Array.from({ length: fill }, () => ({ type: "paragraph" }))).run();
};
```
(`LINE_PX` import는 `globalLineAt` 내부로 들어가 호출부에서 불필요해지면 제거. `A4_GEOMETRY.strideLines`/`bodyLines` 직접 참조 제거.) `.sheet` 인라인 `height`/`top`은 `A4_GEOMETRY.sheetHpx`/`stridePx` 사용(이미 그러함 — 값만 새로워짐). `minHeight` 계산도 `(pages-1)*stridePx + sheetHpx` 유지.

- [ ] **Step 3: 빌드 + 단위 테스트**

Run: `cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run src/components/editor && pnpm build`
Expected: tsc 클린(A형 호출부 정합), 관련 테스트 GREEN, build GREEN

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/editor/paper-editor.css frontend/src/components/editor/PaperEditor.tsx
git commit -m "feat(023): A형 집필실 진짜 A4 + 줄노트 본문영역 정렬"
```

---

## Task 4: B형 — b.css + BEditor.tsx 정합

B형은 `paperGeometry` 인라인 주입이라 대부분 자동 반영. `b.css`의 fallback `calc` 26줄/30줄 하드코딩과 줄노트 정렬, `BEditor.tsx`의 `globalLineAt` 호출을 새 시그니처로 맞춘다.

**Files:**
- Modify: `frontend/src/app/b/b.css`
- Modify: `frontend/src/components/b/BEditor.tsx`

> **작업 직전 의무:** 두 파일 정독 — `--b-page-h`/`--b-page-stride` fallback calc, `.b-sheet`/줄노트 그라디언트, `BEditor` 인라인 주입(`--b-page-h`=`geometry.pageHpx`, `--b-page-stride`=`geometry.stridePx`)과 `handlePaperMouseDown`(globalLineAt 호출).

- [ ] **Step 1: BEditor.tsx — globalLineAt 호출 + 인라인 주입 정합**

`handlePaperMouseDown`의 `globalLineAt(linesFromTop, geometry.bodyLines, geometry.strideLines)` 를 새 px 시그니처로:
```tsx
const targetLine = globalLineAt((e.clientY - pmTop) / fitZoom, geometry);
const lastLine = globalLineAt((endTop - pmTop) / fitZoom, geometry);
```
(B형은 `fitZoom` 사용 — 줌 제거에 `fitZoom` 적용.) 인라인 style 주입에 **상단 패딩 변수 추가**: `"--b-top-pad": `${geometry.topPadPx}px`` (b.css가 본문 상단 패딩에 사용). `geometry.strideLines`/`bodyLines` 직접 참조 중 제거된 것 정리.

- [ ] **Step 2: b.css fallback + 줄노트 정렬**

```css
--b-page-line: 34.56px;
--b-page-h: calc(var(--b-page-line) * 27);   /* fallback — 실제는 BEditor 인라인 주입 */
--b-page-stride: calc(297mm + var(--b-page-line) * 2); /* fallback */
--b-top-pad: 25mm;                            /* fallback */
```
- 본문 상단 패딩을 `var(--b-top-pad)` 로, 줄노트 그라디언트를 본문영역(상단 25mm 이후, 27줄 정수배)에 한정 — A형 `.sheet--lined` 와 동일 원리.
- `.b-sheet` 높이는 인라인 주입(`geometry.sheetHpx`) 사용 — 진짜 용지높이.

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run && pnpm build`
Expected: tsc 클린, **전체 vitest GREEN**(회귀 0), build GREEN

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/app/b/b.css frontend/src/components/b/BEditor.tsx
git commit -m "feat(023): B형 집필실 진짜 A4 + 줄노트 정렬 정합"
```

---

## Task 5: dogfooding 게이트 (사용자)

자동 검증으로 안 잡히는 시각·입력 영역. **사용자 확인 필수**(Claude 검증 불가).

- [ ] A형(`/projects/[id]/write`)·B형(`/b/works/[id]`)에서 **줄노트 켰을 때 페이지마다 괘선이 같은 위치에 정렬**(경계 어긋남 0)
- [ ] 화면 종이가 진짜 A4 비율(세로 길어짐 체감)
- [ ] **한국어 IME 4케이스 회귀 0**(빠른타자·조합중 bold·한자변환·backspace 분해 — `docs/poc/0-1-tiptap-korean.md`)
- [ ] 자동저장/세션/거짓충돌 회귀 0(작성 후 챕터 전환·메뉴 이동)
- [ ] 빈 종이 아래 클릭 시 그 줄까지 빈 줄 채워짐(click-fill) — 페이지 경계 넘는 클릭 포함
- [ ] B형 용지 4종(A4/B4/A3/A2) 전환 시 각 진짜 치수 + 줄 정렬

> 통과 후 **023 export Phase 3 PDF 본구현 재개** — `docs/superpowers/plans/2026-06-14-export.md` Phase 3을 이 진짜 A4 모델 기준(방법 B 인쇄 재구성: `@page A4` + 페이지당 N줄 + `break-after:page`)으로 상세화.

---

## Self-Review 결과 (작성자 점검)

- **Spec 커버리지:** §2 모델=Task1·2 / §3 N줄=Task1(테스트 고정) / §4 변경범위 pageLayout=Task1·2·A형=Task3·B형=Task4 / §5 PDF연계=Task5 후속 / §7 검증=Task5 dogfooding(IME 4케이스 포함) / §8 CSS 3곳 동기=Task1(JS)·3(A css)·4(B css). 누락 없음.
- **불확실 영역 정직 처리:** `globalLineAt`의 런타임 좌표(yPx가 column-wrap에서 실제로 무엇인지)는 순수함수 계약은 단위테스트로 고정하되, 호출부(yPx 계산)·줄노트 그라디언트 픽셀 정렬은 Task5 dogfooding으로 검증 위임(추측 코드 방지). CSS 정확 픽셀은 implementer가 현 파일 정독 후.
- **타입 정합:** `PaperGeometry`에서 `sheetLines`/`strideLines` 제거 + `topPadPx` 추가 → 호출부(PaperEditor/BEditor) Task3·4에서 정리. `globalLineAt(yPx, g)` 새 시그니처를 A형(Task3)·B형(Task4) 호출부 모두 반영.
- **회귀 안전:** `column-wrap`·IME 가드·자동저장·세션 미접촉 명시. 전체 vitest GREEN(Task4 Step3)로 회귀 0 확인.
- **남은 위험:** B형 `b.css` 실제 클래스명(`.b-sheet` 등)은 추정 — Task4 작업 직전 정독 의무로 보완.
