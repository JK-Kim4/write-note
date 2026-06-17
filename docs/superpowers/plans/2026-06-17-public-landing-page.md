# 공개 소개 페이지(랜딩) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비로그인 방문자가 루트 `/`에서 소설빙 소개를 보고 가입/로그인으로 진입하게 한다(기존 A형 대시보드는 `/home`으로 이전).

**Architecture:** `/` = 정적 서버 컴포넌트 랜딩(헤더·히어로·제품 미리보기·기능 3카드·푸터) + 작은 client `LandingAuthRedirect`(로그인 상태면 `DESIGN_HOME[design]`로 이동). A형 대시보드 page를 `/home`으로 옮기고 `DESIGN_HOME.default`를 `/home`으로 갱신. 백엔드 변경 0.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, vitest + Testing Library + msw, 기존 `next/font`(Nanum Myeongjo) 재사용.

## Global Constraints

- 백엔드 변경 **0** (Kakao redirect `/`는 `LandingAuthRedirect` 자동이동으로 흡수).
- 랜딩 비주얼은 **고정 웜 팔레트**(크림 `#F4EFE5`/`#FBF8F1`, 잉크 `#2B2722`, 테라코타 `#C06A41`/hover `#A4552F`, 세이지 `#8C9A6A`, 경계 `#E7DFD0`, 다크 푸터 `#2B2722`) — 앱 전역 토큰/`.dark` 테마와 무관하게 항상 동일(공개 페이지 브랜드 일관). 앱 전역 잉크블루 토큰 **미변경**.
- 헤드라인 폰트 = `var(--font-nanum-myeongjo)`(layout이 이미 로드), 본문 = system sans. **신규 폰트 의존 추가 금지**(Pretendard 미도입).
- 로고는 `<img>` 대신 **CSS `background-image` + `role="img"`/`aria-label`** (기존 `BrandBlock`/`rail__logo` 패턴, `@next/next/no-img-element` 회피).
- 표시 컴포넌트는 서버 컴포넌트, `LandingAuthRedirect`만 `"use client"`. 이벤트 핸들러 prop 없음(네비게이션은 `next/link`).
- 에셋 재사용: `/soseolbing-logo.png`(투명 와이드), `/soseolbing-mark.png`(투명 정사각) — 이미 `frontend/public/`에 존재.
- 게이트: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 GREEN.

---

### Task 1: A형 대시보드 `/home` 이전 + `DESIGN_HOME` 갱신

**Files:**
- Move: `frontend/src/app/page.tsx` → `frontend/src/app/home/page.tsx`
- Move: `frontend/src/app/page.test.tsx` → `frontend/src/app/home/page.test.tsx`
- Modify: `frontend/src/stores/preferences.ts:39-42` (DESIGN_HOME)
- Modify: `frontend/src/components/auth/LoginForm.test.tsx` (default 기대값)

**Interfaces:**
- Produces: 라우트 `/home` = 기존 A형 대시보드(`DashboardPage` default export 그대로). `DESIGN_HOME = { default: "/home", b: "/b" }`.

- [ ] **Step 1: 대시보드 page와 테스트를 `/home`으로 이동(git mv)**

```bash
cd frontend
mkdir -p src/app/home
git mv src/app/page.tsx src/app/home/page.tsx
git mv src/app/page.test.tsx src/app/home/page.test.tsx
```

`@/...` 절대 임포트라 이동 후에도 해석됨. `DashboardPage`(default export)·design=b→`/b` redirect 로직 그대로 유지.

- [ ] **Step 2: 이동한 테스트의 `usePathname` mock을 `/home`으로 수정**

`src/app/home/page.test.tsx`에서:

```ts
    usePathname: () => "/home",
```

(기존 `usePathname: () => "/",` 한 줄을 위로 교체. import `from "./page"`는 두 파일이 함께 이동했으므로 그대로 유효.)

- [ ] **Step 3: `DESIGN_HOME.default`를 `/home`으로 변경**

`src/stores/preferences.ts`:

```ts
export const DESIGN_HOME: Record<DesignVariant, string> = {
    default: "/home",
    b: "/b",
};
```

- [ ] **Step 4: `LoginForm.test.tsx`의 default 디자인 기대값을 `/home`으로 갱신**

`src/components/auth/LoginForm.test.tsx`에서 default(=A) 디자인 로그인 성공 시 이동 경로 단언을 `"/"` → `"/home"`으로 교체. (예: `expect(pushMock).toHaveBeenCalledWith("/home")`. B형 `/b` 단언은 그대로 둔다.)

- [ ] **Step 5: `"/"`를 A홈 목적지로 단언하는 다른 테스트가 있는지 확인**

```bash
cd frontend
grep -rn 'toHaveBeenCalledWith("/")\|push("/")\|replace("/")' src
```

발견되면 그 단언이 "A홈으로 이동" 의미인 경우만 `"/home"`으로 갱신(로그인/설정 전환 흐름). 랜딩/로그아웃 등 의미가 다른 `"/"`는 두 번째 검토 후 유지.

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- src/app/home/page.test.tsx src/components/auth/LoginForm.test.tsx`
Expected: PASS (대시보드 행위 테스트 + 로그인 default→/home, b→/b)

- [ ] **Step 7: 커밋**

```bash
cd frontend && git add -A
git commit -m "refactor(landing): A형 대시보드 / → /home 이전 + DESIGN_HOME 갱신"
```

> 이 시점에 `/`는 일시적으로 라우트 없음(다음 Task에서 랜딩 추가). 연속 실행하므로 무방.

---

### Task 2: `LandingAuthRedirect` — 로그인 시 홈 자동 이동 (client, TDD)

**Files:**
- Create: `frontend/src/components/landing/LandingAuthRedirect.tsx`
- Test: `frontend/src/components/landing/LandingAuthRedirect.test.tsx`

**Interfaces:**
- Consumes: `fetchMe`(`@/lib/api/auth`), `usePreferences`/`useIsPreferencesHydrated`/`DESIGN_HOME`(`@/stores/preferences`).
- Produces: `export function LandingAuthRedirect(): null` — 마운트 시 인증+수화 완료면 `router.replace(DESIGN_HOME[design])`, 비로그인이면 아무것도 안 함.

- [ ] **Step 1: 실패 테스트 작성**

`frontend/src/components/landing/LandingAuthRedirect.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { usePreferences } from "@/stores/preferences";
import { LandingAuthRedirect } from "./LandingAuthRedirect";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
}));
vi.mock("@/stores/preferences", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/stores/preferences")>();
    return { ...actual, useIsPreferencesHydrated: () => true };
});

function wrap(node: ReactNode) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("LandingAuthRedirect", () => {
    beforeEach(() => {
        replaceMock.mockClear();
        usePreferences.setState({ design: "default" });
    });

    it("로그인(A 디자인) 상태면 /home 으로 replace 한다", async () => {
        server.use(http.get("*/api/auth/me", () => HttpResponse.json({ userId: "u1", email: "a@b.c" })));
        usePreferences.setState({ design: "default" });
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
    });

    it("로그인(B 디자인) 상태면 /b 로 replace 한다", async () => {
        server.use(http.get("*/api/auth/me", () => HttpResponse.json({ userId: "u1", email: "a@b.c" })));
        usePreferences.setState({ design: "b" });
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/b"));
    });

    it("비로그인(401) 이면 replace 하지 않는다", async () => {
        server.use(http.get("*/api/auth/me", () => new HttpResponse(null, { status: 401 })));
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => {});
        expect(replaceMock).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test -- src/components/landing/LandingAuthRedirect.test.tsx`
Expected: FAIL (`LandingAuthRedirect` 모듈 없음)

- [ ] **Step 3: 최소 구현**

`frontend/src/components/landing/LandingAuthRedirect.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { usePreferences, useIsPreferencesHydrated, DESIGN_HOME } from "@/stores/preferences";

/**
 * 공개 랜딩(`/`)에 마운트 — 이미 로그인한 사용자는 자신의 작업실 홈으로 보낸다.
 * 인증 판단원 = React Query `['auth','me']`(guard.ts와 동일 key). 비로그인이면 no-op(소개 노출).
 * design 은 수화 완료 후에만 신뢰(미수화 시 기본값 'b' 오판 방지).
 */
export function LandingAuthRedirect(): null {
    const router = useRouter();
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();
    const { data, isError, isLoading } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: fetchMe,
        retry: false,
    });
    const isAuthed = data !== undefined && !isError;

    useEffect(() => {
        if (isLoading || !hydrated) return;
        if (isAuthed) router.replace(DESIGN_HOME[design]);
    }, [isAuthed, isLoading, hydrated, design, router]);

    return null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test -- src/components/landing/LandingAuthRedirect.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd frontend && git add src/components/landing/LandingAuthRedirect.tsx src/components/landing/LandingAuthRedirect.test.tsx
git commit -m "feat(landing): LandingAuthRedirect — 로그인 시 홈 자동 이동"
```

---

### Task 3: 랜딩 표시 컴포넌트 + 페이지 + CSS

**Files:**
- Create: `frontend/src/components/landing/LandingHeader.tsx`
- Create: `frontend/src/components/landing/LandingHero.tsx`
- Create: `frontend/src/components/landing/LandingPreview.tsx`
- Create: `frontend/src/components/landing/LandingFeatures.tsx`
- Create: `frontend/src/components/landing/LandingFooter.tsx`
- Create: `frontend/src/styles/landing.css`
- Create: `frontend/src/app/page.tsx` (랜딩 루트)

**Interfaces:**
- Consumes: `LandingAuthRedirect`(Task 2).
- Produces: 라우트 `/` = 랜딩. 각 컴포넌트는 인자 없는 서버 컴포넌트(`export function LandingX()`).

- [ ] **Step 1: 랜딩 CSS 작성**

`frontend/src/styles/landing.css`:

```css
/* 소설빙 공개 랜딩 — 고정 웜 팔레트(앱 .dark 테마와 무관). */
.landing {
  --lp-cream: #F4EFE5; --lp-cream2: #FBF8F1; --lp-paper: #FFFFFF;
  --lp-ink: #2B2722; --lp-muted: #736A5C; --lp-faint: #9A9082;
  --lp-terra: #C06A41; --lp-terra-d: #A4552F; --lp-sage-d: #6f7d4f;
  --lp-line: #E7DFD0;
  background: var(--lp-cream); color: var(--lp-ink);
  font-family: system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif;
  line-height: 1.6; min-height: 100vh;
}
.landing-wrap { max-width: 1040px; margin: 0 auto; padding: 0 28px; }
.landing a { color: inherit; text-decoration: none; }

/* header */
.landing-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(10px);
  background: rgba(244,239,229,.82); border-bottom: 1px solid rgba(231,223,208,.7); }
.landing-nav { display: flex; align-items: center; justify-content: space-between; height: 66px; }
.landing-logo { width: 132px; height: 40px; background: url('/soseolbing-logo.png') left center / contain no-repeat; }
.landing-nav-right { display: flex; align-items: center; gap: 20px; }
.landing-navlink { font-size: 14.5px; color: var(--lp-muted); font-weight: 500; }
.landing-btn { display: inline-flex; align-items: center; justify-content: center; font-weight: 600;
  border-radius: 10px; cursor: pointer; border: none; transition: background .15s; }
.landing-btn--primary { background: var(--lp-terra); color: #fff; padding: 11px 20px; font-size: 14.5px; }
.landing-btn--primary:hover { background: var(--lp-terra-d); }
.landing-btn--ghost { background: transparent; color: var(--lp-ink); border: 1px solid var(--lp-line); padding: 11px 20px; font-size: 14.5px; }
.landing-btn--lg { padding: 15px 30px; font-size: 16px; border-radius: 12px; }

/* hero */
.landing-hero { text-align: center; padding: 80px 0 52px; }
.landing-eyebrow { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: .04em;
  color: var(--lp-terra-d); background: #F0E2D6; padding: 6px 14px; border-radius: 999px; margin-bottom: 24px; }
.landing-hero h1 { font-family: var(--font-nanum-myeongjo), serif; font-weight: 800; font-size: 54px;
  line-height: 1.24; letter-spacing: -.01em; }
.landing-hero h1 .lp-accent { color: var(--lp-terra); }
.landing-hero .landing-sub { font-size: 17.5px; color: var(--lp-muted); margin: 22px auto 0; max-width: 28em; line-height: 1.8; }
.landing-cta { display: flex; gap: 12px; justify-content: center; margin-top: 34px; }

/* product preview */
.landing-preview { margin: 58px auto 0; max-width: 900px; }
.landing-browser { background: var(--lp-paper); border: 1px solid var(--lp-line); border-radius: 16px;
  box-shadow: 0 30px 60px -30px rgba(60,45,30,.35); overflow: hidden; }
.landing-browserbar { display: flex; gap: 7px; padding: 13px 16px; border-bottom: 1px solid var(--lp-line); background: var(--lp-cream2); }
.landing-dot { width: 11px; height: 11px; border-radius: 50%; }
.landing-studio { display: grid; grid-template-columns: 160px 1fr 190px; min-height: 300px; }
.landing-st-rail { border-right: 1px solid var(--lp-line); padding: 16px 13px; background: var(--lp-cream2); }
.landing-st-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--lp-faint); text-transform: uppercase; margin-bottom: 11px; }
.landing-chap { font-size: 13px; color: var(--lp-muted); padding: 7px 10px; border-radius: 7px; margin-bottom: 4px; }
.landing-chap--on { background: #F0E2D6; color: var(--lp-terra-d); font-weight: 600; }
.landing-st-paper { padding: 30px 36px; font-family: var(--font-nanum-myeongjo), serif; }
.landing-st-paper h4 { font-size: 16px; margin-bottom: 14px; }
.landing-ln { height: 11px; border-radius: 4px; background: #EDE7DB; margin: 10px 0; }
.landing-st-side { border-left: 1px solid var(--lp-line); padding: 16px 13px; background: var(--lp-cream2); }
.landing-memo { background: #FBF3D9; border: 1px solid #EBDFB4; border-radius: 8px; padding: 9px 11px;
  font-size: 11.5px; color: #6b5f3a; margin-bottom: 9px; line-height: 1.5; }

/* features */
.landing-features { padding: 24px 0 86px; }
.landing-fgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.landing-fcard { background: var(--lp-paper); border: 1px solid var(--lp-line); border-radius: 14px; padding: 28px 24px; }
.landing-ficon { width: 42px; height: 42px; border-radius: 11px; background: #F0E2D6;
  display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
.landing-fcard h3 { font-family: var(--font-nanum-myeongjo), serif; font-weight: 700; font-size: 19px; margin-bottom: 9px; }
.landing-fcard p { font-size: 14.5px; color: var(--lp-muted); line-height: 1.7; }

/* footer */
.landing-footer { padding: 48px 0 38px; background: #2B2722; color: #C9C0B2; }
.landing-ftop { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 22px; }
.landing-fmark { width: 110px; height: 30px; background: url('/soseolbing-mark.png') left center / contain no-repeat; margin-bottom: 10px; }
.landing-ftag { font-family: var(--font-nanum-myeongjo), serif; font-size: 14px; color: #9a9081; }
.landing-flinks { display: flex; gap: 26px; font-size: 14px; }
.landing-flinks a:hover { color: #fff; }
.landing-notice { font-size: 13.5px; color: #a89e8d; margin-top: 20px; line-height: 1.7; }
.landing-notice .landing-ask { color: #E0A074; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.landing-fcopy { font-size: 12.5px; color: #8a8276; border-top: 1px solid #3d382f; padding-top: 16px; margin-top: 22px; }

@media (max-width: 820px) {
  .landing-hero h1 { font-size: 38px; }
  .landing-studio { grid-template-columns: 1fr; }
  .landing-st-rail, .landing-st-side { display: none; }
  .landing-fgrid { grid-template-columns: 1fr; gap: 14px; }
  .landing-ftop { flex-direction: column; }
}
```

- [ ] **Step 2: 헤더 컴포넌트**

`frontend/src/components/landing/LandingHeader.tsx`:

```tsx
import Link from "next/link";

export function LandingHeader() {
    return (
        <header className="landing-header">
            <div className="landing-wrap landing-nav">
                <span className="landing-logo" role="img" aria-label="소설빙" />
                <div className="landing-nav-right">
                    <Link className="landing-navlink" href="/auth/login">로그인</Link>
                    <Link className="landing-btn landing-btn--primary" href="/auth/signup">무료로 시작하기</Link>
                </div>
            </div>
        </header>
    );
}
```

- [ ] **Step 3: 히어로 컴포넌트**

`frontend/src/components/landing/LandingHero.tsx`:

```tsx
import Link from "next/link";

export function LandingHero() {
    return (
        <section className="landing-wrap landing-hero">
            <span className="landing-eyebrow">작가를 위한 집필 작업실</span>
            <h1>
                쉬었다 와도,
                <br />
                <span className="lp-accent">이야기는 그 자리에.</span>
            </h1>
            <p className="landing-sub">
                메모도, 등장인물도, 마지막으로 쓴 한 줄도 한자리에. 며칠 만에 다시 열어도 작품의 맥락이 그대로 남습니다.
            </p>
            <div className="landing-cta">
                <Link className="landing-btn landing-btn--primary landing-btn--lg" href="/auth/signup">무료로 시작하기</Link>
                <Link className="landing-btn landing-btn--ghost landing-btn--lg" href="/auth/login">로그인</Link>
            </div>
        </section>
    );
}
```

- [ ] **Step 4: 제품 미리보기 컴포넌트**

`frontend/src/components/landing/LandingPreview.tsx`:

```tsx
export function LandingPreview() {
    return (
        <div className="landing-wrap landing-preview">
            <div className="landing-browser">
                <div className="landing-browserbar">
                    <span className="landing-dot" style={{ background: "#e6928a" }} />
                    <span className="landing-dot" style={{ background: "#e6c98a" }} />
                    <span className="landing-dot" style={{ background: "#a7c08a" }} />
                </div>
                <div className="landing-studio">
                    <div className="landing-st-rail">
                        <div className="landing-st-label">챕터</div>
                        <div className="landing-chap landing-chap--on">1. 첫 만남</div>
                        <div className="landing-chap">2. 균열</div>
                        <div className="landing-chap">3. 떠나는 날</div>
                    </div>
                    <div className="landing-st-paper">
                        <h4>1. 첫 만남</h4>
                        <div className="landing-ln" style={{ width: "96%" }} />
                        <div className="landing-ln" style={{ width: "88%" }} />
                        <div className="landing-ln" style={{ width: "92%" }} />
                        <div className="landing-ln" style={{ width: "70%" }} />
                        <div className="landing-ln" style={{ width: "90%" }} />
                    </div>
                    <div className="landing-st-side">
                        <div className="landing-st-label">곁쪽지</div>
                        <div className="landing-memo">주인공은 비 오는 날을 싫어함 — 3장 복선</div>
                        <div className="landing-memo">카페 이름 정하기</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: 기능 카드 컴포넌트**

`frontend/src/components/landing/LandingFeatures.tsx`:

```tsx
const FEATURES = [
    {
        icon: "🪶",
        title: "맥락이 죽지 않아요",
        body: "세션이 끊겨도 메모·등장인물·마지막 한 줄·다음 장면이 그대로. 다시 열면 어디서 멈췄는지 한눈에 보입니다.",
    },
    {
        icon: "🗂️",
        title: "메모와 집필이 한곳에",
        body: "곁쪽지(메모)와 집필 에디터가 같은 시스템에. 떠오른 설정·복선을 잃지 않고 집필 중 바로 곁에 둡니다.",
    },
    {
        icon: "📤",
        title: "챕터로 쓰고 내보내기",
        body: "작품을 챕터 단위로 구성·정렬하고, PDF·한글(HWPX)·워드(DOCX)로 골라 묶어 내보냅니다.",
    },
] as const;

export function LandingFeatures() {
    return (
        <section className="landing-wrap landing-features">
            <div className="landing-fgrid">
                {FEATURES.map((f) => (
                    <div key={f.title} className="landing-fcard">
                        <div className="landing-ficon" aria-hidden="true">{f.icon}</div>
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 6: 푸터 컴포넌트**

`frontend/src/components/landing/LandingFooter.tsx`:

```tsx
import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="landing-footer">
            <div className="landing-wrap">
                <div className="landing-ftop">
                    <div>
                        <span className="landing-fmark" role="img" aria-label="소설빙" />
                        <div className="landing-ftag">소설에 기대어 쉬어가는 곳</div>
                    </div>
                    <div className="landing-flinks">
                        <Link href="/auth/login">로그인</Link>
                        <Link href="/privacy">개인정보처리방침</Link>
                    </div>
                </div>
                <p className="landing-notice">
                    아직 베타 테스트 중인 1인 개발 작업실이에요. 불편하거나 바라는 점이 있으면 언제든{" "}
                    <Link className="landing-ask" href="/contact">문의하기</Link>
                </p>
                <div className="landing-fcopy">© 2026 소설빙</div>
            </div>
        </footer>
    );
}
```

- [ ] **Step 7: 랜딩 루트 페이지 조합**

`frontend/src/app/page.tsx`:

```tsx
import "@/styles/landing.css";
import { LandingAuthRedirect } from "@/components/landing/LandingAuthRedirect";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";

/** 공개 소개 페이지 — 비로그인 진입점. 로그인 사용자는 LandingAuthRedirect 가 홈으로 보낸다. */
export default function LandingPage() {
    return (
        <div className="landing">
            <LandingAuthRedirect />
            <LandingHeader />
            <main>
                <LandingHero />
                <LandingPreview />
                <LandingFeatures />
            </main>
            <LandingFooter />
        </div>
    );
}
```

- [ ] **Step 8: 빌드 — RSC 경계·CSS·라우트 검증**

Run: `cd frontend && pnpm build`
Expected: 성공. 라우트 목록에 `○ /`(정적)과 `○ /home`이 보이고, `Event handlers cannot be passed to Client Component props` 류 에러 없음(표시 컴포넌트는 서버, `LandingAuthRedirect`만 client).

- [ ] **Step 9: 커밋**

```bash
cd frontend && git add src/app/page.tsx src/components/landing/ src/styles/landing.css
git commit -m "feat(landing): 공개 소개 페이지 — 헤더·히어로·미리보기·기능·푸터"
```

---

### Task 4: 랜딩 렌더 테스트 + 전체 게이트

**Files:**
- Test: `frontend/src/app/page.test.tsx` (신규 — 랜딩용)

**Interfaces:**
- Consumes: `LandingPage`(`./page`, Task 3).

- [ ] **Step 1: 랜딩 렌더 실패 테스트 작성**

`frontend/src/app/page.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import LandingPage from "./page";

// 비로그인 전제(소개 노출) — me 401. next/navigation 은 redirect 호출 없음만 확인.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function wrap(node: ReactNode) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("공개 랜딩 /", () => {
    beforeEach(() => {
        server.use(http.get("*/api/auth/me", () => new HttpResponse(null, { status: 401 })));
    });

    it("히어로 헤드라인과 CTA 2개(가입·로그인)를 보여준다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByRole("heading", { name: /이야기는 그 자리에/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "무료로 시작하기" })).toHaveAttribute("href", "/auth/signup");
        // 헤더+히어로 양쪽에 '로그인' 링크 존재 → 최소 1개가 /auth/login
        expect(screen.getAllByRole("link", { name: "로그인" })[0]).toHaveAttribute("href", "/auth/login");
    });

    it("기능 3개 제목을 보여준다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByText("맥락이 죽지 않아요")).toBeInTheDocument();
        expect(screen.getByText("메모와 집필이 한곳에")).toBeInTheDocument();
        expect(screen.getByText("챕터로 쓰고 내보내기")).toBeInTheDocument();
    });

    it("푸터 문의하기가 /contact 로 연결된다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/contact");
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test -- src/app/page.test.tsx`
Expected: 처음엔 PASS 가능(컴포넌트 이미 Task 3 존재). 만약 셀렉터 불일치로 FAIL 하면 컴포넌트의 텍스트/href와 정합되게 테스트 셀렉터만 조정(컴포넌트는 설계 확정값이라 변경 금지).

- [ ] **Step 3: 전체 게이트 실행**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: 전부 GREEN. lint 0 error(기존 warn 외 신규 error 0), 랜딩 test 통과, build 성공.

- [ ] **Step 4: 커밋**

```bash
cd frontend && git add src/app/page.test.tsx
git commit -m "test(landing): 공개 랜딩 렌더·CTA·기능·문의하기 링크"
```

---

## Self-Review

- **Spec coverage:** 라우팅(/ 랜딩·/home 이전·DESIGN_HOME·authed redirect)=Task1+2, 콘텐츠(헤더·히어로·미리보기·기능3·푸터+베타+문의하기)=Task3, 비주얼(웜 팔레트·명조·반응형)=Task3 CSS, 테스트/게이트=Task4. 백엔드 0 준수. ✅
- **Placeholder scan:** 모든 step에 실제 코드/명령/기대 출력 존재. Task1 Step5·Task4 Step2는 "grep 후 정합 조정" 검증 step(추측 아님, 실제 코드 기준). ✅
- **Type consistency:** `LandingAuthRedirect(): null` 시그니처 Task2 정의 = Task3 사용 일치. `DESIGN_HOME` key(`default`/`b`) 일관. 컴포넌트명(`LandingHeader/Hero/Preview/Features/Footer`) Task3 정의 = page.tsx import 일치. ✅

## Execution Notes

- Task 순서 의존: 1(이전·상수) → 2(redirect) → 3(컴포넌트, 2 의존) → 4(테스트). 1 직후 `/`는 일시 라우트 부재(연속 실행으로 즉시 3에서 채움).
- 구현 후 **dev 서버 dogfooding**: `pnpm dev`로 `/`(비로그인 소개)·로그인 후 `/home`(A)·`/b`(B) 자동 이동·`/contact` 연결·라이트/다크 OS에서 랜딩 고정 웜 톤 확인.
