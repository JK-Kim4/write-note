# Frontend Route & Page Scaffold — Quickstart

본 quickstart 는 본 spec 의 결과물을 로컬에서 셋업하고 검증하는 절차를 박는다.

## 0. 사전 조건

- Node.js + pnpm 설치 (모노레포 frontend 환경)
- `frontend/AGENTS.md` 의 경고 (Next.js 16 breaking change → `node_modules/next/dist/docs/` 정독 의무) 인지
- Phase 1A backend 가 로컬에서 기동 가능 (FR-020 placeholder query 검증용)

## 1. 의존성 설치

본 spec 진입 시 신규 의존성 2 종 설치 (production):

```bash
cd frontend
pnpm add @tanstack/react-query zustand
```

다크 모드 mechanism 으로 `next-themes` 를 채택한 경우에만 추가:

```bash
pnpm add next-themes
```

(research.md §"다크 모드 mechanism" — 본 spec 의 default 는 직접 구현 우선)

## 2. PoC 검증용 page 폐기 (Clarification §Q1)

```bash
rm -rf frontend/src/app/poc
```

확인: `git status` 에서 `frontend/src/app/poc/tiptap/page.tsx`, `frontend/src/app/poc/pwa/page.tsx` 삭제됨. production 산출물 (`frontend/src/app/manifest.ts`, `frontend/src/app/sw-register.tsx`) 은 유지.

## 3. 디자인 토큰 셋업

`frontend/src/styles/tokens.css` 생성 — DESIGN.md §디자인 시스템 의 토큰 박음:

- 색상: `#ffffff` canvas, `#f5f5f7` parchment, `#fbf8ee` manuscript cream / `#1c1c1e` tile-1, `#242426` tile-2, `#2c2c2e` tile-3, `#28231d` warm cream-dark / `#0066cc` accent light, `#2997ff` accent dark / `#1d1d1f` ink, `#f4f4f6` on-dark / `#d70015` system red light, `#ff453a` system red dark / `#e0e0e0` hairline
- 타이포: SF Pro Display / SF Pro Text 17px line-height 1.47 letter-spacing -0.374px / Noto Serif KR 18-19px line-height 1.85-1.9 / Nanum Myeongjo
- Radius: card-memo 14px / card-mode 16px / card-project 18px / button-pill / button-utility 8px / tile 0
- Hairline 1px, no shadow, active scale 0.95

`frontend/src/app/globals.css` 에서 `@import './styles/tokens.css'` + Tailwind 4 `@theme` directive.

## 4. 라우트 골격 생성

contracts/route-surfaces.md 의 19 surface 매핑대로 page 파일 생성:

```text
frontend/src/app/
├── layout.tsx          # Providers + 폰트 + 메타 + sw-register
├── globals.css         # 토큰 import + Tailwind 4 @theme
├── manifest.ts         # 유지
├── sw-register.tsx     # 유지
├── page.tsx            # 홈 (동적 변형)
├── not-found.tsx       # fallback
├── auth/
│   ├── layout.tsx      # 인증 공통 shell (BrandBlock)
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── signup-email/page.tsx
│   ├── reset-{request,sent,new,done}/page.tsx
│   ├── verify-{pending,done}/page.tsx
│   └── {login-error,signup-error,login-loading}/page.tsx
├── write/
│   ├── layout.tsx      # WriteTopBar + SidePanel
│   ├── page.tsx        # 모드 분기 (manuscript vs editor)
│   └── preview/page.tsx
├── memos/page.tsx
└── settings/page.tsx
```

각 page 는 contracts/route-surfaces.md 의 자식 컴포넌트 트리 박힌 대로 정적 외관 렌더.

## 5. 공유 인프라 셋업

- `frontend/src/lib/query/QueryProvider.tsx` — React Query QueryClientProvider (`'use client'`)
- `frontend/src/stores/preferences.ts` — Zustand persist (theme / writingMode / manuscriptSize)
- `frontend/src/stores/ui.ts` — Zustand transient (sidePanelOpen 등)
- `frontend/src/stores/authPlaceholder.ts` — Zustand persist placeholder (userId | null)
- `frontend/src/lib/api/client.ts` — fetch wrapper + envelope unwrap + X-User-Id 주입
- `frontend/src/lib/api/projects.ts` — `listProjects` placeholder query
- `frontend/src/lib/auth/guard.ts` — client-side useEffect redirect placeholder
- `frontend/src/components/theme/ThemeToggle.tsx` — 라이트/다크/시스템 3 모드
- `frontend/src/types/api.ts` — `Result<T>`, `ErrorInfo`, `Page<T>`, `ProjectResponse`

## 6. 검증 절차

### 6-1. 빌드 + 린트 게이트 (의무)

```bash
cd frontend
pnpm lint
pnpm build
```

둘 다 GREEN 이 본 spec 의 SC-007 통과 조건.

### 6-2. 로컬 dev 모드 + surface 진입 확인

```bash
# 터미널 1
docker compose up -d --wait postgres
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'

# 터미널 2
cd frontend && pnpm dev
```

`http://localhost:3000` 진입 후 다음 URL 모두 진입 가능 확인 (SC-001):

```text
/                          # 홈 (프로젝트 0 → H0, 1+ → 일반)
/auth/login
/auth/signup
/auth/signup-email
/auth/reset-request
/auth/reset-sent
/auth/reset-new
/auth/reset-done
/auth/verify-pending
/auth/verify-done
/auth/login-error
/auth/signup-error
/auth/login-loading
/write                     # writingMode='manuscript' or 'editor' 분기
/write/preview
/memos
/settings
/some-random-path          # → not-found.tsx fallback
```

### 6-3. 1:1 시각 대응 확인 (SC-002)

`designs/wireframe.html` 을 같은 브라우저의 별도 탭으로 열고 19 surface 각각에 대해:

1. 라이트 모드: production 화면 ↔ wireframe 해당 탭 비교
2. 다크 모드: 우상단 토글로 양쪽 다크 전환 후 비교
3. 토큰 grep: `grep -E "(#0066cc|#2997ff|14px|16px|18px|0\.95)" frontend/src/styles/tokens.css frontend/src/app/globals.css`

### 6-4. 라우트 가드 동작 확인 (SC-004 / SC-005)

- 인증 placeholder store 의 `userId` 가 `null` 인 상태에서 `/`, `/write`, `/memos`, `/settings` 진입 시도 → `/auth/login` 으로 redirect
- `userId === 'dev-user-id'` 설정 후 `/auth/login` 진입 시도 → `/` 로 redirect

### 6-5. 다크 모드 일관성 확인 (SC-003)

- 한 surface 에서 라이트→다크 토글 후 다른 surface 로 이동 → 다크 선호 유지
- 시스템 테마를 macOS 시스템 설정에서 변경 → `theme === 'system'` 일 때 자동 따라가기 확인

### 6-6. PWA 정합 확인 (SC-009)

- iOS Safari / Android Chrome 에서 본 spec 결과물을 띄워 "홈 화면 추가" 메뉴 노출 확인 (Phase 0-3 회귀 회피)
- service worker 등록 콘솔 로그 확인

## 7. 후속 phase 합류 안내

본 quickstart 의 검증 게이트 모두 통과 후:

- 본 spec 결과를 commit (`feat: 002 frontend route scaffold — wireframe 19 surface + shared infra`)
- `docs/plan/02-progress.md` 갱신 (Phase 1A 완료 → 002 완료, Week 1B 진입 대기)
- Week 1B-1 (Spring Security 확장) spec 작성 또는 Week 2 (Project CRUD UI) 합류 결정
