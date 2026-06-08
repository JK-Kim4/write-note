# Frontend Route & Page Scaffold Research

본 spec 의 Technical Context 에서 도출된 결정 사항. 추측 영역은 본 phase 진입 시점 (구현 직전) 에 `node_modules/next/dist/docs/` + 공식 docs 정독 후 추가 박힘 가능.

## Decision: Next.js 16 App Router 의 nested route + shared layout 으로 인증 surface 구현

**Rationale**: Clarification 2026-05-20 §Q2 가 nested route + shared layout 박음. Next.js 16 App Router 의 file-system convention 에 정확히 부합 — `app/auth/layout.tsx` 가 12 자식 route 모두에 공통 shell 을 제공하고, panel 전환 시 layout 은 유지되며 자식 page 만 교체된다.

**Alternatives considered**:

- 1 route + 클라이언트 panel toggle (URL 1 개, query/state 기반): 이메일 인증 콜백 (`verify-done`, `reset-new`) 의 외부 깊은 링크 안정성 떨어짐. DESIGN.md §핵심 인증 UX 결정 §6 의 인라인 해결 경로 링크 (`이미 가입된 이메일입니다. 로그인하기 →`) 도 URL 공유성 시사. 거절.
- 12 별도 route + shared layout 없음: panel 전환마다 브랜드 블록 / 카드 컨테이너 재로드. wireframe 의 panel toggle 외관 재현 어려움. 거절.

**Source**: Clarification 2026-05-20 §Q2 / DESIGN.md §추가된 13개 패널 + 핵심 인증 UX 결정 §6.

## Decision: 작성 surface 는 `/write` 단일 URL + `/write/preview` 자식 route

**Rationale**: Clarification 2026-05-20 §Q3 박음. DESIGN.md §핵심 UX 결정 §1 의 "설정 → 작성 모드 → 카드 선택하면 작성 화면이 그 모드로 고정" 원칙과 정합. URL 에 모드 노출 시 사용자가 잘못된 URL 진입으로 설정 무시 가능 — 본 결정은 그 회귀 회피.

미리보기는 *임시 view 액션* (DESIGN.md §핵심 UX 결정 §1) — `/write/preview` 자식 route 로 분리하면 "편집으로 돌아가기" 가 자연스러운 라우터 뒤로가기 또는 명시 `router.push('/write')` 동작.

**Alternatives considered**:

- `/write/manuscript`, `/write/editor` 별도 URL: DESIGN.md SoT 와 충돌. 거절.
- `/write?mode=manuscript` query 기반: 단일 URL (A) 와 거의 동등하나 query 가 표면적으로 노출. 단순성 우선 A 채택.
- 미리보기를 dialog (`shadcn/ui` Dialog 등): "편집으로 돌아가기" 가 자연스러운 라우터 흐름과 분리됨. 미리보기 URL 공유 어려움. 거절.

**Source**: Clarification 2026-05-20 §Q3 / DESIGN.md §핵심 UX 결정 §1.

## Decision: H0 빈 홈은 `/` 홈 라우트의 동적 변형

**Rationale**: Clarification 2026-05-20 §Q4 박음. DESIGN.md §빈 상태 1개 가 H0 를 "신규 가입자 첫 진입 홈" 으로 명시 — 별도 surface 가 아니라 홈의 상태 변형. `01-phase §5 Week 2-4` 도 "홈 view (프로젝트 카드 + 빈 상태 H0)" 로 묶음.

`app/page.tsx` 안에서 React Query 로 프로젝트 카운트 조회 → 0 이면 H0 외관 (EmptyHero + HintCard 2 개), 1+ 이면 일반 홈 외관 (프로젝트 카드 + 지난 세션 hero 인용 + 최근 활동 + 보관함). 본 spec 단계는 placeholder 데이터로 분기 검증.

**Alternatives considered**:

- 별도 `/welcome` 또는 `/onboarding` route: DESIGN.md SoT 와 충돌. 거절.
- `/` 와 `/welcome` 둘 다: 본 spec 영역 / dogfooding 검증 측면에선 매력이나, KISS / SoT 정합 우선. 거절.

**Source**: Clarification 2026-05-20 §Q4 / DESIGN.md §빈 상태 1개 / docs/plan/01-phase-breakdown.md §5.

## Decision: 디자인 토큰 정의는 Tailwind 4 의 `@theme` directive + CSS variables 이중

**Rationale**: DESIGN.md §디자인 시스템 의 토큰 (색상 #0066cc / #2997ff, radius 14/16/18px, hairline 1px, active scale 0.95 등) 을 정량으로 적용해야 함. Tailwind 4 는 `@theme` directive 로 토큰을 정의 + Tailwind utility 자동 생성. CSS variables 는 다크 모드 toggle 시 동적 값 교체 (예: `--color-accent` 가 라이트 #0066cc → 다크 #2997ff). 두 메커니즘을 결합:

```css
/* globals.css */
@theme {
  --color-accent: var(--w-accent);   /* CSS variable 으로 위임 */
  --radius-card-memo: 14px;
  --radius-card-mode: 16px;
  --radius-card-project: 18px;
}

@layer base {
  :root { --w-accent: #0066cc; }
  :root.dark { --w-accent: #2997ff; }
}
```

**Alternatives considered**:

- Tailwind 4 `@theme` 만 (CSS variables 없음): 다크 모드 토글이 utility 교체 (`bg-accent-light` → `bg-accent-dark`) 형태로 가야 함 — wireframe 의 `.dark` 클래스 토글 패턴과 충돌. 거절.
- 순수 CSS variables (Tailwind 토큰 없음): utility class 자동 생성 손해. Tailwind 4 의 강점 우회. 거절.

**Source**: DESIGN.md §디자인 시스템 / wireframe.html 의 `.dark` 토글 패턴 / Tailwind 4 공식 docs.

## Decision: 다크 모드 mechanism 은 직접 구현 우선 (`next-themes` 보류)

**Rationale**: 본 프로젝트 V1 / 단일 개발자 / 비용 최소 우선. 직접 구현 = (a) `:root.dark` 클래스 토글 + (b) Zustand persist 로 선호 영속 + (c) `usePreferences` hook 에서 `useEffect` 로 시스템 테마 감지. SSR FOUC (first-paint flash) 회피는 `<script>` blocking inline 1 회로 가능 (localStorage 즉시 읽어 `class="dark"` 추가).

`next-themes` 도입은 의존성 +1 / hydration 안정성 검증 비용. 본 spec 시점에는 직접 구현으로 시작하고, FOUC / hydration mismatch 가 실제 발견되면 `next-themes` 옵션으로 채택.

**Alternatives considered**:

- `next-themes` 즉시 채택: SSR FOUC 회피가 검증된 라이브러리이긴 하나 본 spec 시점에는 비용 우선 직접 구현. 보류.
- Tailwind 4 의 `prefers-color-scheme` 단독 (사용자 선택 X): DESIGN.md §"다크 모드 전 앱" 의 "라이트 / 다크 / 시스템 따라가기 3 모드" 요구 충족 X. 거절.

**Source**: DESIGN.md §6 다크 모드 / FR-013/014/015 / 본 plan 의 비용 최소 우선.

## Decision: 폰트 로딩은 `next/font/google` (Noto Serif KR + Nanum Myeongjo)

**Rationale**: DESIGN.md §디자인 시스템 / 타이포그래피 가 "본문 프로즈 Noto Serif KR 18-19px / 원고지 Nanum Myeongjo / Display SF Pro Display (system-ui fallback)" 박음. Next.js 의 `next/font/google` 은:

- 폰트 self-host (외부 CDN 요청 X) → 개인정보 / GDPR 안전
- 자동 `font-display: swap` + preload
- CLS 회피 (font fallback metric 자동 적용)

SF Pro Display 는 Google Fonts 외부 → `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif` 시스템 fallback 으로 처리 (Apple 디바이스 외부에선 system-ui).

**Alternatives considered**:

- 외부 Google Fonts CDN 직접 link: 개인정보 회귀. 거절.
- 폰트 self-host 수동 (`public/fonts/`): 사이즈 직접 관리 비용. `next/font/google` 가 자동화. 거절.

**Source**: DESIGN.md §디자인 시스템 / Next.js 16 docs (`node_modules/next/dist/docs/` 정독 — 진입 시점 의무).

## Decision: 인증 라우트 가드는 client-side `useEffect` 기반 redirect placeholder

**Rationale**: Phase 1A 의 임시 `X-User-Id` ownership 메커니즘이 본 spec 의 가드 판단 기준. Week 1B-1 에서 실제 JWT / Spring Security 로 swap 예정. 본 spec 시점에는:

- `lib/auth/guard.ts` 가 Zustand placeholder store (`userId: string | null`) 의 값 검사
- 메인/작성/메모/설정 layout 또는 page 진입 시 `useEffect` → `null` 이면 `router.push('/auth/login')`
- 인증 surface 에서 `userId` 가 있는 상태로 진입 시 `router.push('/')`

Next.js middleware (`middleware.ts`) 는 JWT 검증 / refresh / cookie 처리가 필요한 Week 1B 시점에 도입. 본 spec 의 placeholder 단계에서 middleware 는 과한 추상화.

**Alternatives considered**:

- `middleware.ts` 즉시 도입: Week 1B 의 JWT cookie 검증 패턴을 placeholder 로 시뮬레이션해야 함 — 의미 없는 추상화. 거절.
- Server Component 안에서 `redirect()` 호출: Next.js 16 App Router 의 권장 패턴이긴 하나 Phase 1A 의 `X-User-Id` 가 클라이언트에서만 알려진 (Zustand store) 정보라 server-side 검사 어려움. 본 placeholder 단계에서는 client-side 가 정합.

**Source**: Clarification 2026-05-20 §자체 메모 §3 / Phase 1A spec.md §FR-018 / Next.js 16 docs.

## Decision: API client 는 fetch wrapper + `Result<T>` envelope unwrap + 임시 X-User-Id 주입

**Rationale**: Phase 1A 의 `Result<T>` envelope 패턴 (`{ ok: true, data: T }` / `{ ok: false, error: ErrorInfo }`) 을 클라이언트 측에서 일관 처리해야 React Query / 컴포넌트가 unwrap 책임 안 가짐.

```
lib/api/client.ts
  fetch wrapper:
    - 기본 base URL: `process.env.NEXT_PUBLIC_API_BASE_URL` (또는 dev default `http://localhost:8080`)
    - 임시 X-User-Id header 자동 주입 (Zustand placeholder store 에서)
    - Response → Result<T> JSON parse → ok 면 data 반환, !ok 면 throw ApiError(ErrorInfo)
    - 네트워크 에러 / parse 에러 → throw ApiError
  React Query 가 throw 를 자동 처리 → query.isError + query.error 활용
```

Week 1B 진입 시 X-User-Id placeholder 제거 + Authorization header (Bearer JWT) swap. `lib/api/client.ts` 한 파일 수정으로 전 호출 swap 가능 (가드 + API client 단일 책임).

**Alternatives considered**:

- React Query 가 envelope 직접 처리 (queryFn 안에서 unwrap): 모든 query 마다 boilerplate 반복. DRY 위반. 거절.
- Axios 도입: 추가 의존성 비용 + 본 spec 영역에서 fetch 로 충분. Next.js 16 의 fetch 자동 캐싱 / revalidate 활용 가능. 거절.

**Source**: Phase 1A spec.md §FR-007~009 / docs/plan/00-stack §2-1 / Clarification 2026-05-20 §자체 메모 §3.

## Decision: PoC 검증용 page (`frontend/src/app/poc/*`) 폐기, production manifest+sw-register 유지

**Rationale**: Clarification 2026-05-20 §Q1 박음.

- `frontend/src/app/poc/tiptap/page.tsx` — 폐기. PoC 0-1 회귀 검증 기록은 `docs/poc/0-1-tiptap-korean.md` 영구화됨. TipTap 패턴 재활용은 Week 3 의 작성-에디터 surface 구현 시점.
- `frontend/src/app/poc/pwa/page.tsx` — 폐기. PoC 0-3 회귀 검증 기록은 `docs/poc/0-3-pwa.md` 영구화됨.
- `frontend/src/app/manifest.ts` — 유지 (production PWA manifest, FR-021).
- `frontend/src/app/sw-register.tsx` — 유지 (production service worker 등록, FR-021).

**Alternatives considered**:

- PoC page 유지 + 라우트 그룹으로 분리: production 라우트와 PoC 검증용을 같은 deploy 에 노출 — V1 dogfooding 의 surface 1:1 측정 기준 (SC-001) 왜곡. 거절.
- PoC page 흡수: TipTap 의 한국어 IME 검증 코드를 작성-에디터 placeholder 안에 흡수 — Week 3 의 본 구현 시점에 다시 작성될 코드이므로 본 spec 단계에서 흡수 X. 거절.

**Source**: Clarification 2026-05-20 §Q1 / FR-021 / docs/poc/0-1, 0-3.

## Decision: 1:1 시각 대응 측정은 디자인 토큰 grep + 컴포넌트 매핑 표 + 라이트/다크 육안 비교

**Rationale**: Clarification 2026-05-20 §Q5 박음. V1 / 단일 개발자 / 비용 최소 우선 → visual regression 자동화 도구 (Percy/Chromatic/Playwright snapshot) 도입은 보류. 측정 기준:

1. **디자인 토큰 적용 grep**: `frontend/src/styles/tokens.css` 또는 `globals.css` 의 `@theme` block 에 DESIGN.md 박힌 토큰 값 (#0066cc, #2997ff, radius 14/16/18, hairline 1px 등) 존재 — `grep` 으로 확인 가능
2. **컴포넌트 매핑 표**: contracts/route-surfaces.md 에 19 surface 각각의 URL → wireframe panel/view → React 컴포넌트 트리 1:1 매핑 박음. Week 진행 중 surface 추가 시 매핑 표 즉시 갱신.
3. **라이트/다크 육안 비교**: 19 surface 모두 라이트/다크 양쪽에서 wireframe.html 의 해당 view 와 나란히 비교. 토큰·구조 일치 시 PASS.

**Alternatives considered**:

- Percy / Chromatic 도입: 셋업 비용 + 월 비용 + 본 spec 의 정적 외관 영역에는 과한 정밀도. 거절.
- Playwright snapshot: 셋업 비용 적은 편이나 본 spec 의 폰트 로딩 / 시스템 폰트 차이로 false positive 빈발 위험. 보류.
- 측정 기준 자체를 plan 영역으로 위임 (정성 "1:1 대응" 유지): SC-002 의 "100% 1:1 대응" 검증 가능성 떨어짐. 거절.

**Source**: Clarification 2026-05-20 §Q5 / FR-023 / SC-002.
