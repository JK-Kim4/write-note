# B형 대시보드(작가 홈) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B형(`app/b`)에 작가 홈(대시보드)을 추가한다 — `/b`를 대시보드로, 작품 벽을 `/b/library`로 옮기고, 이어서쓰기·작품 미니카드·집필 리듬·곁쪽지·opt-in 목표 게이지를 B 스킨(Tailwind)으로 구현.

**Architecture:** 데이터 레이어(`lib/dashboardView.ts` 순수함수 + `useProjectCards`/`useWeeklyByDay`/`useInboxMemos` 훅 + `QuickCapture`)는 A형과 **그대로 공유**. 표시 컴포넌트만 B 전용 Tailwind로 신설(A형 컴포넌트는 `desktop-app.css`에 100% 결합돼 재사용 불가). 백엔드 변경 0 — 게이지는 기존 `ProjectCard.targetLength`(목표 분량, 단위 "자") ÷ `wordCount`로 프론트 계산, `targetLength`가 null이면 미표시(opt-in 자연 구현).

**Tech Stack:** Next.js 16 App Router(클라이언트 컴포넌트) · TypeScript · React Query · Zustand(preferences) · Tailwind · Vitest + @testing-library/react.

**설계 SoT:** `docs/superpowers/specs/2026-06-13-b-dashboard-design.md`

---

## ⚠️ 사전 확인 (첫 task 전 1회)

- [ ] **Next.js 16 App Router 가이드 확인** — `frontend/AGENTS.md`가 `node_modules/next/dist/docs/` 정독을 요구. **이 디렉토리는 존재함**(`01-app`/`02-pages`/`03-architecture`). 라우트 디렉토리 이동·신설 전 `node_modules/next/dist/docs/01-app/` 의 라우팅 섹션 1회 확인.
- [ ] **환경**: 테스트/빌드는 frontend에서 `node_modules/.bin/{vitest,tsc}` 또는 `corepack pnpm` 사용(02-progress 환경 메모 정합). 빌드/테스트는 **포어그라운드** 실행(CLAUDE.md HARD-GATE).
- [ ] **'use client' 의무**(typescript/code-quality HARD-GATE): 이벤트 핸들러·hook 쓰는 모든 컴포넌트 첫 줄 `"use client"`. 작성 직후 `pnpm build`로 RSC 경계 검출.

---

## File Structure

| 동작 | 파일 | 책임 |
|---|---|---|
| **이동** | `app/b/page.tsx` → `app/b/library/page.tsx` | 작품 벽(현행 그대로, 경로만 이동) |
| **신규** | `app/b/page.tsx` | B 대시보드 페이지(조립·라우팅·상태) |
| **신규** | `components/b/dashboard/BResumeCard.tsx` | 이어서쓰기 타일(Tailwind) |
| **신규** | `components/b/dashboard/BWorkMiniCard.tsx` | 작품 미니카드(Tailwind) |
| **신규** | `components/b/dashboard/BRhythmCard.tsx` | 집필 리듬 카드(Tailwind) |
| **신규** | `components/b/dashboard/GoalGauge.tsx` | opt-in 목표 게이지(targetLength÷wordCount) |
| **신규** | `lib/goalGauge.ts` | 게이지 계산 순수함수(테스트 단위) |
| **수정** | `app/b/layout.tsx` | NAV에 "홈"(`/b`) 추가, "작품"→`/b/library` |
| **수정** | `app/b/works/[id]/page.tsx` | 작품 복귀 링크 `/b`→`/b/library` (라인 117·190·377) |
| **재사용** | `lib/dashboardView.ts`, `lib/query/use*`, `lib/memoView`, `components/QuickCapture`, `lib/types/domain` | 무변경 import |

**재사용 시그니처(확정):**
- `selectDashboard(cards: ReadonlyArray<ProjectCard>) => { resume: ProjectCard | null; others: ProjectCard[] }`
- `weekDayRanges(now: Date) => Array<{ from: Date; to: Date; isToday: boolean }>`
- `barScale(values: ReadonlyArray<number>) => number[]`
- `ProjectCard`(`@/lib/types/domain`) = `{ id, title, genre, targetLength, toneNotes, synopsis, worldNotes, nextScene, paperSize, archivedAt, createdAt, updatedAt, lastSentenceSource, wordCount, docUpdatedAt, totalDurationMs }`
- `useProjectCards()` → `{ data?: ProjectCard[], isLoading, isError, refetch }`
- `useWeeklyByDay()` → `{ data?: { dayMs: number[7], totalMs }, isError }`
- `useInboxMemos()` → `{ data?: Memo[] }`
- `QuickCapture` props: `{ activeProjectId: number | null; onClose: () => void; onCaptured?: () => void }`

---

## Task 1: 작품 벽을 `/b/library`로 이동

**Files:**
- Move: `app/b/page.tsx` → `app/b/library/page.tsx`
- Modify: `app/b/library/page.tsx:69` (replaceState)
- Modify: `app/b/works/[id]/page.tsx` (라인 117·190·377)
- Test: `app/b/works/[id]/page.test.tsx` (복귀 링크 회귀)

- [ ] **Step 1: 디렉토리 생성 + 파일 이동(git mv)**

```bash
cd frontend
mkdir -p src/app/b/library
git mv src/app/b/page.tsx src/app/b/library/page.tsx
```

- [ ] **Step 2: 이동된 파일의 replaceState 경로 갱신**

`app/b/library/page.tsx` 라인 69 — `window.history.replaceState(null, "", "/b")` 를 `"/b/library"` 로:

```typescript
window.history.replaceState(null, "", "/b/library");
```

- [ ] **Step 3: 집필실 복귀 링크 3곳 갱신**

`app/b/works/[id]/page.tsx` 의 작품 벽 복귀 의도 `/b` 3곳 → `/b/library`:
- 라인 117: `router.push("/b")` → `router.push("/b/library")`
- 라인 190: `<Link href="/b" ...>` → `href="/b/library"`
- 라인 377: `href="/b"` → `href="/b/library"`

- [ ] **Step 4: 회귀 테스트 — 복귀 링크가 `/b/library`를 가리키는지**

`app/b/works/[id]/page.test.tsx` 가 있으면 기존 `/b` 기대를 `/b/library`로 갱신. 없으면 최소 1건 추가:

```typescript
it("문서 로드 실패 시 작품 목록(/b/library)으로 돌아가는 링크를 보여준다", () => {
    // 기존 에러 상태 렌더 패턴 재사용
    expect(screen.getByRole("link", { name: /돌아가기|작품/ })).toHaveAttribute("href", "/b/library");
});
```

- [ ] **Step 5: 라우트 동작 확인 — `/b/library`가 뜨고 `/b`는 404(아직 대시보드 미생성)**

Run(포어그라운드): `node_modules/.bin/vitest run src/app/b/works` 
Expected: 복귀 링크 테스트 PASS. (이 단계에서 `/b`는 비어 있음 — Task 3에서 채움)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(b): 작품 벽을 /b/library 로 이동 — 대시보드 자리 확보"
```

---

## Task 2: B형 네비에 "홈" 추가

**Files:**
- Modify: `app/b/layout.tsx:21-27` (NAV_ITEMS), `:81` (로고 링크)
- Test: `app/b/layout.test.tsx` (없으면 신규)

- [ ] **Step 1: 실패 테스트 — 네비에 "홈"(`/b`)과 "작품"(`/b/library`)이 있다**

`app/b/layout.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// next/navigation, preferences 등은 기존 layout 테스트 mock 패턴 따름

it("네비에 홈(/b)과 작품(/b/library) 항목이 있다", () => {
    // BLayout 렌더(children 더미)
    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/b");
    expect(screen.getByRole("link", { name: "작품" })).toHaveAttribute("href", "/b/library");
});
```

- [ ] **Step 2: 실패 확인**

Run: `node_modules/.bin/vitest run src/app/b/layout.test.tsx`
Expected: FAIL — "홈" 항목 없음 / "작품" href가 `/b`.

- [ ] **Step 3: NAV_ITEMS 수정**

`app/b/layout.tsx:21-27`:

```typescript
const NAV_ITEMS = [
    { href: "/b", label: "홈", exact: true },
    { href: "/b/library", label: "작품", exact: false },
    { href: "/b/memos", label: "메모", exact: false },
    { href: "/b/characters", label: "인물", exact: false },
    { href: "/b/logs", label: "기록", exact: false },
    { href: "/b/settings", label: "설정", exact: false },
] as const;
```

로고 링크(라인 81) `href="/b"`는 홈=대시보드라 그대로 유지(의도 일치).

- [ ] **Step 4: 통과 확인**

Run: `node_modules/.bin/vitest run src/app/b/layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(b): 네비에 홈 추가, 작품을 /b/library 로"
```

---

## Task 3: B 대시보드 골격 + 이어서쓰기 (핵심 먼저)

> §10(핵심 먼저): 양보 불가 핵심 = "재진입(이어서쓰기)". 첫 dogfoodable 산출물이 바로 이어서쓰기여야 한다.

**Files:**
- Create: `components/b/dashboard/BResumeCard.tsx`
- Create: `components/b/dashboard/BResumeCard.test.tsx`
- Create: `app/b/page.tsx` (대시보드)

- [ ] **Step 1: 실패 테스트 — BResumeCard가 제목·마지막 문장·다음 장면·[이어 쓰기]를 표시**

`components/b/dashboard/BResumeCard.test.tsx` (WorkMiniCard.test.tsx fixture 패턴 차용):

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { BResumeCard } from "./BResumeCard";

function card(over: Partial<ProjectCard> = {}): ProjectCard {
    return {
        id: 5, title: "달밤의 약속", genre: null, targetLength: null, toneNotes: null,
        synopsis: null, worldNotes: null, nextScene: "재회", paperSize: "A4",
        archivedAt: null, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
        lastSentenceSource: "그녀는 끝내 문을 열지 않았다.", wordCount: 38420,
        docUpdatedAt: "2026-06-12T00:00:00Z", totalDurationMs: 0, ...over,
    };
}

describe("BResumeCard", () => {
    it("제목·마지막 문장·다음 장면을 표시한다", () => {
        render(<BResumeCard card={card()} onOpen={() => {}} />);
        expect(screen.getByText("달밤의 약속")).toBeInTheDocument();
        expect(screen.getByText(/문을 열지 않았다\./)).toBeInTheDocument();
        expect(screen.getByText(/재회/)).toBeInTheDocument();
    });

    it("[이어 쓰기] 클릭 시 onOpen을 호출한다", async () => {
        const onOpen = vi.fn();
        render(<BResumeCard card={card()} onOpen={onOpen} />);
        await userEvent.click(screen.getByRole("button", { name: /이어 쓰기/ }));
        expect(onOpen).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node_modules/.bin/vitest run src/components/b/dashboard/BResumeCard.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: BResumeCard 구현 (Tailwind, A형 ResumeCard 구조를 B 스킨으로)**

`components/b/dashboard/BResumeCard.tsx` — 흰 시트·인디고 좌측 강조선. A형 `ResumeCard`와 동일 정보(제목·`lastSentence`·`nextScene`·저장시각·글자수·버튼), 스타일만 Tailwind:

```tsx
"use client";

import type { ProjectCard } from "@/lib/types/domain";
import { formatRelativeTime } from "@/lib/dashboardView";
import { lastSentence } from "@/lib/memoView"; // A형 ResumeCard가 쓰는 동일 유틸 확인 후 import (없으면 dashboardView/별도 위치 grep)

type Props = { card: ProjectCard; onOpen: () => void };

export function BResumeCard({ card, onOpen }: Props) {
    return (
        <div className="rounded-xl border border-l-4 border-gray-200 border-l-indigo-600 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">이어서 쓰기</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{card.title}</h2>
            <p className="mt-1 italic text-gray-700">&ldquo;{lastSentence(card.lastSentenceSource)}&rdquo;</p>
            <p className="mt-2 text-xs text-gray-500">
                {card.nextScene && `다음 장면: ${card.nextScene} · `}
                {formatRelativeTime(card.docUpdatedAt, new Date())} · {card.wordCount.toLocaleString()}자
            </p>
            <button
                type="button"
                onClick={onOpen}
                className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
                이어 쓰기 →
            </button>
        </div>
    );
}
```

> 구현 주의: `lastSentence`(마지막 문장 추출) 유틸의 실제 위치를 A형 `ResumeCard.tsx`의 import에서 확인해 동일하게 재사용. 없으면 `card.lastSentenceSource`를 그대로 표시.

- [ ] **Step 4: 통과 확인**

Run: `node_modules/.bin/vitest run src/components/b/dashboard/BResumeCard.test.tsx`
Expected: PASS

- [ ] **Step 5: B 대시보드 페이지 골격 — `app/b/page.tsx` (이어서쓰기만, 빈/로딩/에러 상태)**

A형 `page.tsx`(24-191) 구조를 B 셸(layout이 헤더 제공)에 맞춰 이식. 이 단계는 **이어서쓰기 + 빈/로딩/에러까지만**:

```tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useProjectCards } from "@/lib/query/useProjects";
import { selectDashboard } from "@/lib/dashboardView";
import { BResumeCard } from "@/components/b/dashboard/BResumeCard";

export default function BDashboardPage() {
    const router = useRouter();
    const cardsQuery = useProjectCards();
    const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
    const { resume } = selectDashboard(cardsQuery.data ?? []);

    const dateLabel = mounted
        ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())
        : "";

    return (
        <div className="mx-auto max-w-5xl px-4 py-6">
            <h1 className="text-xl font-bold text-gray-900">안녕하세요.</h1>
            <p className="mt-1 text-sm text-gray-500">{mounted ? `${dateLabel} — 오늘도 곁에 있을게요.` : " "}</p>

            {cardsQuery.data === undefined && !cardsQuery.isError ? (
                <p className="mt-6 text-sm text-gray-400">불러오는 중…</p>
            ) : cardsQuery.isError ? (
                <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                    작업실을 불러오지 못했습니다.
                    <button type="button" className="ml-2 underline" onClick={() => void cardsQuery.refetch()}>다시 시도</button>
                </div>
            ) : resume === null ? (
                <section className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
                    <h2 className="text-lg font-bold text-gray-900">작업실이 준비됐습니다</h2>
                    <p className="mt-2 text-sm text-gray-600">메모와 등장인물, 지난 세션의 마지막 한 줄까지 한자리에.</p>
                    <button type="button" className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => router.push("/b/library?new=1")}>
                        첫 작품 시작하기
                    </button>
                </section>
            ) : (
                <div className="mt-6">
                    <BResumeCard card={resume} onOpen={() => router.push(`/b/works/${resume.id}`)} />
                </div>
            )}
        </div>
    );
}
```

> 확인: `/b/library?new=1` 쿼리를 작품 벽이 처리하는지(A형 library는 `?new=1`로 생성 모달 자동 오픈). 미처리면 본 task에서 `/b/library`로 단순 이동하거나, 작품 벽에 `?new=1` 핸들링 추가(별도 step).

- [ ] **Step 6: `pnpm build`로 RSC 경계 검출 + 대시보드 렌더 확인**

Run(포어그라운드): `corepack pnpm build`
Expected: 빌드 GREEN(Event handler 경계 오류 0).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(b): 대시보드 골격 + 이어서쓰기(BResumeCard) — 핵심 먼저"
```

---

## Task 4: 작품 미니카드 + opt-in 목표 게이지

**Files:**
- Create: `lib/goalGauge.ts`, `lib/goalGauge.test.ts`
- Create: `components/b/dashboard/GoalGauge.tsx`
- Create: `components/b/dashboard/BWorkMiniCard.tsx`, `.test.tsx`
- Modify: `app/b/page.tsx` (미니카드 그리드 추가)

- [ ] **Step 1: 실패 테스트 — 게이지 계산 순수함수**

`lib/goalGauge.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { goalProgress } from "./goalGauge";

describe("goalProgress", () => {
    it("targetLength가 null이면 null(게이지 미표시)", () => {
        expect(goalProgress(1000, null)).toBeNull();
    });
    it("달성률(0~1)과 퍼센트를 반환한다", () => {
        expect(goalProgress(25000, 50000)).toEqual({ ratio: 0.5, percent: 50 });
    });
    it("100%를 초과해도 ratio는 1로 클램프한다", () => {
        expect(goalProgress(60000, 50000)).toEqual({ ratio: 1, percent: 120 });
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `node_modules/.bin/vitest run src/lib/goalGauge.test.ts` → FAIL.

- [ ] **Step 3: goalProgress 구현**

`lib/goalGauge.ts`:

```typescript
export type GoalProgress = { ratio: number; percent: number };

/** 목표 분량(자) 대비 글자수 달성. targetLength 미설정(null/0)이면 null = 게이지 숨김(opt-in). */
export function goalProgress(wordCount: number, targetLength: number | null): GoalProgress | null {
    if (targetLength === null || targetLength <= 0) return null;
    const percent = Math.round((wordCount / targetLength) * 100);
    return { ratio: Math.min(1, wordCount / targetLength), percent };
}
```

- [ ] **Step 4: 통과 확인** — Run: `node_modules/.bin/vitest run src/lib/goalGauge.test.ts` → PASS.

- [ ] **Step 5: 실패 테스트 — GoalGauge는 목표 설정 시만 바를 렌더**

`components/b/dashboard/BWorkMiniCard.test.tsx` 안에서 함께 검증(또는 GoalGauge.test.tsx):

```typescript
it("targetLength가 null이면 게이지를 렌더하지 않는다", () => {
    render(<BWorkMiniCard card={card({ targetLength: null })} onOpen={() => {}} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
});
it("targetLength가 있으면 달성률 게이지를 렌더한다", () => {
    render(<BWorkMiniCard card={card({ wordCount: 25000, targetLength: 50000 })} onOpen={() => {}} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
});
```

- [ ] **Step 6: 실패 확인** → FAIL(모듈 없음).

- [ ] **Step 7: GoalGauge + BWorkMiniCard 구현**

`components/b/dashboard/GoalGauge.tsx`:

```tsx
"use client";
import { goalProgress } from "@/lib/goalGauge";

export function GoalGauge({ wordCount, targetLength }: { wordCount: number; targetLength: number | null }) {
    const p = goalProgress(wordCount, targetLength);
    if (p === null) return null;
    return (
        <div role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}
             className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <span className="block h-full bg-indigo-600" style={{ width: `${p.ratio * 100}%` }} />
        </div>
    );
}
```

`components/b/dashboard/BWorkMiniCard.tsx` (A형 WorkMiniCard + 게이지):

```tsx
"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { lastSentence } from "@/lib/memoView"; // Task 3과 동일 위치 사용
import { GoalGauge } from "./GoalGauge";

type Props = { card: ProjectCard; onOpen: () => void };

export function BWorkMiniCard({ card, onOpen }: Props) {
    return (
        <button type="button" onClick={onOpen}
                className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md">
            <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{lastSentence(card.lastSentenceSource)}</p>
            <GoalGauge wordCount={card.wordCount} targetLength={card.targetLength} />
        </button>
    );
}
```

- [ ] **Step 8: 통과 확인** — Run: `node_modules/.bin/vitest run src/components/b/dashboard/BWorkMiniCard.test.tsx` → PASS.

- [ ] **Step 9: 대시보드에 미니카드 그리드 + 이어서쓰기 타일에도 게이지 연결**

`app/b/page.tsx` — `selectDashboard`의 `others`를 2열 그리드로, `BResumeCard`에도 `GoalGauge` 포함(BResumeCard에 `<GoalGauge wordCount targetLength/>` 추가). `others` 사용 위해 `const { resume, others } = selectDashboard(...)`.

```tsx
{others.length > 0 && (
    <div className="mt-4 grid grid-cols-2 gap-3">
        {others.map((c) => (
            <BWorkMiniCard key={c.id} card={c} onOpen={() => router.push(`/b/works/${c.id}`)} />
        ))}
    </div>
)}
```

- [ ] **Step 10: build + commit** — `corepack pnpm build` GREEN 후:

```bash
git add -A && git commit -m "feat(b): 작품 미니카드 + opt-in 목표 게이지(targetLength)"
```

---

## Task 5: 집필 리듬 카드

**Files:**
- Create: `components/b/dashboard/BRhythmCard.tsx`, `.test.tsx`
- Modify: `app/b/page.tsx` (2컬럼 레이아웃 — 좌 작품, 우 리듬)

- [ ] **Step 1: 실패 테스트 — 요일 막대 7개 + 오늘 강조**

`components/b/dashboard/BRhythmCard.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRhythmCard } from "./BRhythmCard";

it("요일 막대 7개를 렌더하고 오늘 인덱스를 강조한다", () => {
    render(<BRhythmCard dayMs={[0, 3600000, 0, 7200000, 1800000, 0, 0]} todayIndex={4} cards={[]} />);
    const bars = screen.getAllByTestId("rhythm-bar");
    expect(bars).toHaveLength(7);
    expect(bars[4]).toHaveAttribute("data-today", "true");
});
```

- [ ] **Step 2: 실패 확인** → FAIL.

- [ ] **Step 3: BRhythmCard 구현 (A형 RhythmCard 구조 + Tailwind, `barScale` 재사용)**

```tsx
"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { barScale } from "@/lib/dashboardView";

type Props = { dayMs: ReadonlyArray<number>; todayIndex: number; cards: ReadonlyArray<ProjectCard> };
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function BRhythmCard({ dayMs, todayIndex }: Props) {
    const scaled = barScale(dayMs);
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">집필 리듬 (이번 주)</p>
            <div className="mt-3 flex h-24 items-end gap-2">
                {scaled.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div data-testid="rhythm-bar" data-today={i === todayIndex}
                             className={`w-full rounded-sm ${i === todayIndex ? "bg-indigo-600" : "bg-indigo-200"}`}
                             style={{ height: `${Math.max(4, h * 100)}%` }} />
                        <span className="text-[10px] text-gray-400">{DAYS[i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

> §7 게이미피케이션 절제 가드: 목표선·달성 강조·streak 없음 — 막대 표시만.

- [ ] **Step 4: 통과 확인** → PASS.

- [ ] **Step 5: 대시보드 2컬럼 배치 (좌: 작품, 우: 리듬)**

`app/b/page.tsx` — `useWeeklyByDay` + `weekDayRanges`로 `todayIndex` 계산, 이어서쓰기 아래를 2컬럼으로:

```tsx
// 상단 import: import { weekDayRanges } from "@/lib/dashboardView"; import { useWeeklyByDay } from "@/lib/query/useSessions";
const weeklyQuery = useWeeklyByDay();
const todayIndex = weekDayRanges(new Date()).findIndex((r) => r.isToday);
// 레이아웃: 이어서쓰기(풀폭) 아래
<div className="mt-4 grid gap-4 min-[880px]:grid-cols-[1.4fr_1fr]">
    <div>{/* others 미니카드 그리드 */}</div>
    <BRhythmCard dayMs={weeklyQuery.data?.dayMs ?? [0,0,0,0,0,0,0]} todayIndex={todayIndex} cards={cardsQuery.data ?? []} />
</div>
```

- [ ] **Step 6: build + commit** — `corepack pnpm build` 후:

```bash
git add -A && git commit -m "feat(b): 집필 리듬 카드(표시만, 게이미피케이션 절제)"
```

---

## Task 6: 곁쪽지 패널(우측 상시) + 880px drawer + 빠른 메모

**Files:**
- Create: `components/b/dashboard/BMemoStrip.tsx`, `.test.tsx`
- Modify: `app/b/page.tsx` (우 컬럼에 곁쪽지 + drawer 토글, QuickCapture)

- [ ] **Step 1: 실패 테스트 — 최근 곁쪽지 N장 + "새 곁쪽지" 버튼**

`components/b/dashboard/BMemoStrip.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BMemoStrip } from "./BMemoStrip";

const memos = [
    { id: 1, body: "3장 복선 회수", dateLabel: "방금" },
    { id: 2, body: "주인공 말투 통일", dateLabel: "1시간 전" },
];

it("최근 곁쪽지를 표시하고 새 곁쪽지 버튼으로 onNew를 호출한다", async () => {
    const onNew = vi.fn();
    render(<BMemoStrip memos={memos} onNew={onNew} onOpenAll={() => {}} />);
    expect(screen.getByText("3장 복선 회수")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /새 곁쪽지/ }));
    expect(onNew).toHaveBeenCalledOnce();
});

it("곁쪽지가 없으면 빈 안내를 표시한다", () => {
    render(<BMemoStrip memos={[]} onNew={() => {}} onOpenAll={() => {}} />);
    expect(screen.getByText(/아직 곁쪽지가 없어요/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** → FAIL.

- [ ] **Step 3: BMemoStrip 구현 (props로 뷰모델 받음 — 데이터 조회는 page가)**

```tsx
"use client";
type MemoView = { id: number; body: string; dateLabel: string };
type Props = { memos: ReadonlyArray<MemoView>; onNew: () => void; onOpenAll: () => void };

export function BMemoStrip({ memos, onNew, onOpenAll }: Props) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">곁쪽지</p>
                <button type="button" onClick={onOpenAll} className="text-xs text-indigo-600 hover:underline">모두 보기 →</button>
            </div>
            {memos.length === 0 ? (
                <p className="mt-3 text-xs text-gray-400">아직 곁쪽지가 없어요</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {memos.map((m) => (
                        <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-gray-700">
                            {m.body}<span className="ml-1 text-gray-400">· {m.dateLabel}</span>
                        </li>
                    ))}
                </ul>
            )}
            <button type="button" onClick={onNew} className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-indigo-600">
                + 새 곁쪽지
            </button>
        </div>
    );
}
```

- [ ] **Step 4: 통과 확인** → PASS.

- [ ] **Step 5: 대시보드에 우 컬럼 곁쪽지 + 880px drawer + QuickCapture 연결**

`app/b/page.tsx` — `useInboxMemos` + `toInboxMemoView`로 최근 3장 뷰모델 생성. 880px 이상은 우 컬럼 상시(전체를 `min-[880px]:grid-cols-[1.4fr_1fr_320px]` 형태로 확장하거나 곁쪽지를 별도 우 컬럼으로), 880px 미만은 `app/b/works/[id]/page.tsx:265-410` 의 drawer 패턴 복제(`rightDrawerOpen` state + 토글 버튼 + `fixed inset-y-0 right-0 min-[880px]:hidden` 백드롭). `captureOpen` state로 `QuickCapture activeProjectId={null}` 모달:

```tsx
const memosQuery = useInboxMemos();
const [captureOpen, setCaptureOpen] = useState(false);
const [memoDrawerOpen, setMemoDrawerOpen] = useState(false);
const recentMemos = [...(memosQuery.data ?? [])]
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1)).slice(0, 3)
    .map((m) => { const v = toInboxMemoView(m, new Date()); return { id: v.id, body: v.body, dateLabel: v.dateLabel }; });
// ...
{captureOpen && <QuickCapture activeProjectId={null} onClose={() => setCaptureOpen(false)} onCaptured={() => void memosQuery.refetch()} />}
```

> drawer 패턴은 `app/b/works/[id]/page.tsx`의 `rightDrawer` 구현을 참조해 동일 Tailwind 유틸(`min-[880px]:hidden`, 백드롭 onClick 닫기, ESC)을 복제. 좌측 drawer는 불필요(대시보드는 우측만).

- [ ] **Step 6: build + commit** — `corepack pnpm build` 후:

```bash
git add -A && git commit -m "feat(b): 곁쪽지 패널 + 880px drawer + 빠른 메모"
```

---

## Task 7: 통합 — 빈/로딩/에러 정합 + 전체 게이트 + dogfooding 준비

**Files:**
- Modify: `app/b/page.tsx` (상태 정합 최종)
- Verify: 전체 게이트

- [ ] **Step 1: 페이지 통합 테스트 — 대시보드 핵심 흐름**

`app/b/page.test.tsx` — React Query·router mock 패턴(기존 `app/page.test.tsx` 참조)으로:
- 작품 있을 때 이어서쓰기 타일 표시 + 클릭 시 `/b/works/{id}` push
- 작품 0일 때 "작업실이 준비됐습니다" + "첫 작품 시작하기" → `/b/library?new=1`
- 에러일 때 alert + 다시 시도

```typescript
// 기존 src/app/page.test.tsx 의 mock 셋업(useProjectCards/useWeeklyByDay/useInboxMemos vi.mock) 복제
it("작품이 있으면 이어서쓰기 타일을 보여주고 클릭 시 집필실로 이동한다", async () => {
    // useProjectCards → resume 카드 1개 mock
    // userEvent.click(getByRole("button", { name: /이어 쓰기/ }))
    // expect(pushMock).toHaveBeenCalledWith("/b/works/5")
});
```

- [ ] **Step 2: 실패 → 구현 보정 → 통과**

Run: `node_modules/.bin/vitest run src/app/b/page.test.tsx` → 보정 후 PASS.

- [ ] **Step 3: 로그인 라우팅 회귀 확인**

`LoginForm.test.tsx`(:64)는 design=b → `/b` push 기대. `/b`가 이제 대시보드이므로 **의미만 바뀌고 기대값 `/b`는 유효**. 테스트 수정 불필요 — 단 실행해 GREEN 확인:

Run: `node_modules/.bin/vitest run src/components/auth/LoginForm.test.tsx` → PASS.

- [ ] **Step 4: 전체 프론트 게이트 (포어그라운드)**

```bash
cd frontend
corepack pnpm exec tsc --noEmit
corepack pnpm exec eslint .
node_modules/.bin/vitest run
corepack pnpm build
```
Expected: 전부 GREEN(typecheck·lint·vitest·build). 회귀 0.

- [ ] **Step 5: 백엔드 회귀 확인(변경 없음 보증)**

백엔드 코드 변경 0이지만 마이그레이션/엔티티 무변경 확인. Run: `cd backend && ./gradlew test`(포어그라운드) → GREEN.

- [ ] **Step 6: dogfooding 체크리스트(사용자 영역) 기록**

`docs/` 또는 PR 본문에 dogfooding 항목 명시:
1. 로그인(design=b) → `/b` 대시보드 진입, 깜빡임 0
2. 이어서쓰기 → 집필실 진입, 마지막 문장·다음 장면 정합
3. 네비 홈/작품 전환, `/b/library` 작품 벽 정상, 작품 생성/삭제
4. 곁쪽지 표시·빠른 메모 캡처, 880px 미만 drawer 토글
5. 목표 설정 작품만 게이지, 미설정은 글자수만
6. 한글 IME(곁쪽지 입력) 정상

- [ ] **Step 7: 최종 Commit**

```bash
git add -A && git commit -m "feat(b): 대시보드 통합 — 상태 정합 + 게이트 GREEN"
```

---

## Self-Review (작성자 체크 — 완료)

- **Spec 커버리지:** §2 정보위계(이어서쓰기 T3·미니카드/리듬 T4·5·곁쪽지 T6·게이지 T4) / §3 레이아웃 C형(T5 2컬럼·T6 우측 곁쪽지·drawer) / §4 라우팅(T1 이동·T2 네비) / §5 데이터 재사용·백엔드0(전 task) / §6 게이지 opt-in(T4) / §7 절제 가드(T5) / §10 검증기준(T7) — 전부 task 매핑됨.
- **Placeholder:** 코드/테스트/명령 실값. "확인" 위임 2곳(`lastSentence` 위치, `?new=1` 처리)은 구현 중 grep 1회로 해소되는 명시적 검증 — 모호 placeholder 아님.
- **타입 일관성:** `ProjectCard`(@/lib/types/domain), `goalProgress`/`GoalProgress`, props 이름(`card`/`onOpen`/`dayMs`/`todayIndex`/`memos`/`onNew`) 전 task 일치.

## 미해결(구현 중 grep 1회로 확정)

1. `lastSentence` 유틸 정확한 import 위치 — A형 `ResumeCard.tsx` import에서 확인(미존재 시 `lastSentenceSource` 직접).
2. `/b/library?new=1` 쿼리를 작품 벽이 처리하는지 — 미처리 시 작품 벽에 핸들링 추가 또는 단순 이동.
3. B 컴포넌트 디렉토리 관례(`components/b/` vs `app/b/_components/`) — 기존 `BWorkSidePanel` 위치 따라 정렬.
