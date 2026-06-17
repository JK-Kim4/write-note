# 공개 소개 페이지(랜딩) 설계 — 소설빙

> **작성일:** 2026-06-17 · **브랜치:** `worktree-landing-page` (base develop `9044ef2`) · **범위:** 프론트(`frontend/`)만, 백엔드 변경 0

## 1. 배경 / 문제

현재 비로그인 방문자가 사이트 루트(`/`)에 들어오면 **로그인 페이지로 튕긴다** — `src/app/page.tsx`(A형 대시보드)가 `useAuthGuard("requireAuth")`로 비로그인 시 `/auth/login`으로 `router.replace`. 즉 첫 화면이 로그인이라, 서비스를 처음 접하는 사람이 **무엇을 하는 제품인지 알 수 없다**.

목표: **로그인 없이 접근 가능한 공개 소개 페이지**를 루트 `/`에 두어, 첫 방문자가 제품 가치를 보고 가입/로그인으로 진입하게 한다.

## 2. 현재 구조 (실측)

| 항목 | 현재 |
|---|---|
| `/` (`src/app/page.tsx`) | A형 대시보드(작가 홈), `useAuthGuard("requireAuth")` + design=b 사용자는 `/b`로 자동 이동 |
| 인증 판단 | 클라이언트 가드 `useAuthGuard`(`GET /api/auth/me` 200/401) — Next 미들웨어 서버 강제 없음 |
| 로그인 후 목적지 | `LoginForm`이 `DESIGN_HOME[design]`로 이동, `DESIGN_HOME = { default: "/", b: "/b" }` |
| Kakao 로그인 | 백엔드 `OAuth2SuccessHandler`가 프론트 `/`로 redirect |
| 디자인 2종 | A형(`/`, 웜 양피지·잉크블루), B형(`/b`, 흰 배경·인디고) |

## 3. 결정 사항 (사용자 승인)

1. **루트 `/` = 공개 소개 페이지** (비로그인 진입점). 첫 방문자가 보는 화면을 소개로 전환.
2. **A형 대시보드는 `/home`으로 이전** (컴포넌트 그대로, `requireAuth` 가드 유지).
3. **로그인 사용자가 `/` 진입 시 자신의 작업실로 자동 이동** — design 따라 `/home`(A) 또는 `/b`(B). 소개는 비로그인 전용.
4. **콘텐츠** = Hero + 기능 하이라이트 3 + 푸터.
5. **강조 기능 3** = 컨텍스트 영속(핵심) · 메모+집필 통합 · 챕터·내보내기.
6. **비주얼** = A형 웜 양피지 토큰 재사용 (새 로고 테라코타 톤과 정합).

## 4. 아키텍처

### 4-1. 라우팅 변경

- **`src/app/page.tsx` (A형 대시보드)** → **`src/app/home/page.tsx`** 로 이동. 내용·`useAuthGuard("requireAuth")`·design=b→`/b` 자동 이동 로직 그대로 유지(경로만 이전).
- **새 `src/app/page.tsx`** = 공개 소개 페이지.
  - **정적 서버 컴포넌트**로 소개 콘텐츠 렌더(인증 가드 없음 — 비로그인 접근 가능, SEO·초기 로딩 유리).
  - 내부에 **작은 client 컴포넌트** `LandingAuthRedirect`(`"use client"`): `GET /api/auth/me`(React Query `['auth','me']` 재사용) 결과가 인증이면 `DESIGN_HOME[design]`로 `router.replace`. 비로그인이면 아무것도 안 함(소개 표시). 로딩 중 깜빡임 방지 위해 redirect는 인증 확정 후에만.
- **`DESIGN_HOME = { default: "/home", b: "/b" }`** 로 갱신 (정의 위치 = `LoginForm.tsx` 또는 공용 상수 — 실제 위치는 구현 시 grep 확인).
- Kakao 백엔드 redirect(`/`)는 그대로 — `/` 도착 후 `LandingAuthRedirect`가 인증 상태이므로 홈으로 자동 이동. **백엔드 변경 0.**

### 4-2. 컴포넌트 분해

| 컴포넌트 | 책임 | 의존 |
|---|---|---|
| `app/page.tsx` (landing) | 소개 페이지 셸 — Hero·Features·Footer 조합 + `LandingAuthRedirect` 마운트 | 아래 표시 컴포넌트 |
| `LandingHero` | 로고·태그라인·CTA 2버튼 | 새 로고 에셋(`/soseolbing-logo.png`), `next/link` |
| `LandingFeatures` | 기능 3카드 (제목+설명, 정적 데이터 배열) | 없음(순수 표시) |
| `LandingFooter` | 브랜드 + `/privacy`·`/contact` 링크 | `next/link` |
| `LandingAuthRedirect` (client) | 인증 시 홈 자동 이동 | `useQuery(['auth','me'])`, `usePreferences(design)`, `useRouter` |

표시 컴포넌트(Hero/Features/Footer)는 이벤트 핸들러·hook 없음 → 서버 컴포넌트 가능. `LandingAuthRedirect`만 `"use client"`.

### 4-3. 콘텐츠

- **Hero:** 소설빙 로고(투명 PNG `/soseolbing-logo.png`) + 태그라인 **"소설에 기대어 쉬어가는 곳"** + 설명 **"컨텍스트가 안 죽는 작가용 작업공간"** + CTA: `시작하기`(`/auth/signup`)·`로그인`(`/auth/login`). 카카오 로그인은 기존 auth 페이지 내 존재.
- **기능 3카드:**
  - **컨텍스트가 안 죽습니다** — 세션이 끊겨도 작품 맥락(메모·등장인물·마지막 한 줄·다음 장면)이 그대로. 며칠 만에 열어도 흐름을 처음부터 되짚지 않습니다.
  - **메모와 집필이 한곳에** — 곁쪽지(메모)와 집필 에디터가 같은 시스템. 떠오른 아이디어를 따로 관리하다 잃지 않고 집필 중 바로 곁에 둡니다.
  - **챕터로 쓰고 내보내기** — 작품을 챕터 단위로 구성·정렬하고 PDF·HWPX(한글)·DOCX(워드)로 내보냅니다.
- **푸터:** "소설빙" + 개인정보처리방침(`/privacy`)·문의(`/contact`) 링크.

### 4-4. 비주얼

- A형 웜 양피지 토큰(`desktop-app.css`: `--bg` 양피지·`--ink`·`--accent-ink` 잉크블루·serif 폰트) 재사용.
- 랜딩 전용 스타일은 `desktop-app.css`에 `.landing__*` BEM 섹션 추가.
- 반응형: 모바일 1열(세로 스택)·데스크탑 중앙 정렬(max-width 컨테이너), 기능 카드 데스크탑 3열/모바일 1열. 라이트·다크 양쪽.
- CTA 버튼은 기존 `.btn`/`.btn--primary` 재사용.

## 5. 테스트

- **vitest (행위):**
  - 랜딩 렌더 — 브랜드("소설빙")·CTA 2개(`시작하기`/`로그인` role=link + href)·기능 3개 제목 표시.
  - `LandingAuthRedirect` — 인증(`me` 200)+design=default → `/home` replace, design=b → `/b` replace, 비로그인(401) → redirect 호출 안 함.
  - `DESIGN_HOME` 갱신 회귀 — `LoginForm` 테스트의 default 기대값 `/`→`/home` 갱신 + B형 `/b` 유지.
- **게이트:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` GREEN. `pnpm build`로 RSC 경계(서버/클라이언트) 검증 — `LandingAuthRedirect`만 client, 나머지 서버 컴포넌트.

## 6. 범위 밖 (비목표)

- 스크린샷·데모 이미지·FAQ·사용 흐름 등 풀 마케팅 섹션 (추후 확장).
- B형(`/b`) 진입 사용자용 별도 소개 (단일 공개 랜딩으로 충분).
- 백엔드 변경(OAuth redirect URL 등) — 프론트 자동 리다이렉트로 흡수.
- 앱 액센트 색을 테라코타로 이전 ([[vault ISSUE-035]], 별도 결정).

## 7. 영향 받는 파일 (예상)

- 이동: `src/app/page.tsx` → `src/app/home/page.tsx` (+ 관련 page 테스트)
- 신규: `src/app/page.tsx`(landing), `LandingHero`/`LandingFeatures`/`LandingFooter`/`LandingAuthRedirect` 컴포넌트
- 수정: `DESIGN_HOME` 상수 정의처(`LoginForm.tsx` 등) + 해당 테스트, `desktop-app.css`(`.landing__*` 추가)
- 검증 필요(구현 시 grep): `DESIGN_HOME` 정확한 정의 위치, `/home` 경로 충돌 여부, `/auth/signup` 라우트 존재
