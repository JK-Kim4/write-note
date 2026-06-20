# 공개 소개 페이지(랜딩) 설계 — 소설비

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
| `app/page.tsx` (landing) | 소개 페이지 셸 — Header·Hero·Preview·Features·Footer 조합 + `LandingAuthRedirect` 마운트 | 아래 표시 컴포넌트 |
| `LandingHeader` | sticky 헤더 — 로고 + 로그인·무료로 시작하기 | `next/link`, `/soseolbi-logo.png` |
| `LandingHero` | eyebrow·명조 헤드라인·설명·CTA 2버튼 | `next/link` |
| `LandingPreview` | 집필 작업실 목업(챕터│원고│곁쪽지) — 순수 CSS 정적 표현 | 없음(순수 표시) |
| `LandingFeatures` | 기능 3카드 (제목+설명, 정적 데이터 배열) | 없음(순수 표시) |
| `LandingFooter` | 브랜드·태그라인 + 링크(`/auth/login`·`/privacy`) + 베타 안내 한 줄 + 문의하기(`/contact`) + copyright | `next/link`, `/soseolbi-mark.png` |
| `LandingAuthRedirect` (client) | 인증 시 홈 자동 이동 | `useQuery(['auth','me'])`, `usePreferences(design)`, `useRouter` |

표시 컴포넌트(Header/Hero/Preview/Features/Footer)는 이벤트 핸들러·hook 없음(모두 `next/link` 네비게이션) → 서버 컴포넌트 가능. `LandingAuthRedirect`만 `"use client"`.

### 4-3. 콘텐츠 (비주얼 컴패니언으로 확정한 "간단" 단일 페이지)

스크롤 순서: **헤더 → 히어로 → 제품 미리보기 → 기능 3카드 → 푸터**. (좌우 교차 큰 섹션·별도 CTA 밴드는 제외 — 사용자 "간단" 결정)

- **헤더(sticky):** 소설비 로고(`/soseolbi-logo.png`) + `로그인`(→`/auth/login`) + `무료로 시작하기`(→`/auth/signup`, 테라코타 버튼).
- **히어로(중앙 정렬):** eyebrow "작가를 위한 집필 작업실" + 명조 헤드라인 **"쉬었다 와도, 이야기는 그 자리에."**("그 자리에"=테라코타 강조) + 설명 "메모도, 등장인물도, 마지막으로 쓴 한 줄도 한자리에. 며칠 만에 다시 열어도 작품의 맥락이 그대로 남습니다." + CTA `무료로 시작하기`(→`/auth/signup`)·`로그인`(→`/auth/login`). 카카오 로그인은 기존 auth 페이지 내 존재.
- **제품 미리보기:** 브라우저 창 프레임 안에 집필 작업실 목업(챕터 목록 │ 원고 │ 곁쪽지 패널) — **순수 CSS 정적 표현**(실제 스크린샷 아님, 자산 불필요).
- **기능 3카드(한 줄, 모바일 1열):**
  - **맥락이 죽지 않아요** — 세션이 끊겨도 메모·등장인물·마지막 한 줄·다음 장면이 그대로. 다시 열면 어디서 멈췄는지 한눈에.
  - **메모와 집필이 한곳에** — 곁쪽지(메모)와 집필 에디터가 같은 시스템. 떠오른 설정·복선을 잃지 않고 집필 중 바로 곁에.
  - **챕터로 쓰고 내보내기** — 챕터 단위 구성·정렬 + PDF·HWPX(한글)·DOCX(워드) 내보내기.
- **푸터(다크):** 로고 마크(`/soseolbi-mark.png`) + 태그라인 "소설에 기대어 쉬어가는 곳" + 링크(`로그인`·`개인정보처리방침`→`/privacy`) + **베타 안내 한 줄** "아직 베타 테스트 중인 1인 개발 작업실이에요. 불편하거나 바라는 점이 있으면 언제든 **문의하기**" — '문의하기'는 클릭 링크 → **`/contact`**(앱 내 문의·메일 발송 화면) + © 2026 소설비. (만든 이 이름 없음 — "1인 개발 작업실" 문구로 대체.)

### 4-4. 비주얼

- **랜딩 전용 웜 팔레트**(새 로고 톤 정합, 랜딩 스코프 한정 — 앱 전역 잉크블루 토큰은 미변경, [[vault ISSUE-035]] 별개): 크림 배경 `#F4EFE5`/`#FBF8F1`, 잉크 `#2B2722`, 테라코타 액센트/CTA `#C06A41`(hover `#A4552F`), 세이지 보조 `#8C9A6A`, 경계 `#E7DFD0`, 다크 푸터 `#2B2722`.
- **타이포:** 헤드라인 = 명조(Nanum Myeongjo — 앱이 이미 `next/font`로 로드) / 본문·UI = sans. **결정(plan)**: 기존 폰트 재사용 우선, 목업의 Pretendard는 정확 일치가 필요하면 옵션으로 추가.
- 랜딩 전용 스타일 = **`landing.css`(신규)** 또는 `desktop-app.css`의 `.landing__*` BEM 섹션. 앱 공용 토큰/컴포넌트 회귀 0 위해 스코프 격리.
- **반응형:** 데스크탑 중앙 정렬(max-width 컨테이너)·기능 3열, 모바일 1열 세로 스택(제품 미리보기 패널은 모바일에서 원고만). 헤더 sticky + blur.
- CTA 버튼은 랜딩 전용 `.btn-pri`(테라코타)/`.btn-ghost` 사용(앱 `.btn--primary`와 톤 다름 — 랜딩 한정).

## 5. 테스트

- **vitest (행위):**
  - 랜딩 렌더 — 브랜드·CTA(`무료로 시작하기`→`/auth/signup`·`로그인`→`/auth/login` role=link + href)·기능 3개 제목·푸터 문의하기(→`/contact`) 표시.
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
- 신규: `src/app/page.tsx`(landing) + `LandingHeader`/`LandingHero`/`LandingPreview`/`LandingFeatures`/`LandingFooter`/`LandingAuthRedirect` 컴포넌트 + 랜딩 전용 CSS(`landing.css` 또는 `.landing__*`)
- 수정: `DESIGN_HOME` 상수 정의처(`LoginForm.tsx` 등) + 해당 테스트
- 검증 필요(구현 시 grep): `DESIGN_HOME` 정확한 정의 위치, `/home` 경로 충돌 여부, `/auth/signup`·`/contact` 라우트 존재, 폰트(Pretendard 추가 여부) 결정
