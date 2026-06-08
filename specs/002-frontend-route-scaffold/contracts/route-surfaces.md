# Route Surfaces — Contract

본 contract 는 19 surface 의 URL ↔ wireframe panel/view ↔ React 컴포넌트 트리 1:1 매핑을 박는다. SC-002 (100% 1:1 시각 대응) 의 검증 단위.

## 1. 인증 surface (12)

공통 부모: `app/auth/layout.tsx` — 브랜드 블록 (`BrandBlock`) + 카드 컨테이너 (panel container). 12 자식 route 전환 시 본 layout 유지.

| URL | wireframe (DESIGN.md / wireframe.html) | 자식 page 컴포넌트 트리 |
|---|---|---|
| `/auth/login` | `panel[data-mode="login"]` (wireframe.html 2678 줄) | `LoginForm` (email + password + Kakao CTA + 비번 재설정 link + 회원가입 link) |
| `/auth/signup` | `panel[data-mode="signup"]` (wireframe.html 2716 줄) | `SignupMethodPicker` (Kakao + 이메일 — DESIGN.md §핵심 인증 UX 결정 §2 Entry→Wizard) |
| `/auth/signup-email` | `panel[data-mode="signup-email"]` (wireframe.html 2738 줄) | `SignupEmailForm` (이메일 + 비번 + 비번 확인 + 약관 + 가입 CTA) |
| `/auth/reset-request` | `panel[data-mode="reset-request"]` (wireframe.html 2773 줄) | `ResetRequestForm` (이메일 입력) |
| `/auth/reset-sent` | `panel[data-mode="reset-sent"]` (wireframe.html 2800 줄) | `SuccessBlock` (info icon + "메일을 보냈습니다") + `success-foot` (다시 보내기) |
| `/auth/reset-new` | `panel[data-mode="reset-new"]` (wireframe.html 2825 줄) | `ResetNewForm` (새 비번 + 확인) |
| `/auth/reset-done` | `panel[data-mode="reset-done"]` (wireframe.html 2858 줄) | `SuccessBlock` (success icon + "비밀번호가 변경됐습니다") + 로그인 CTA |
| `/auth/verify-pending` | `panel[data-mode="verify-pending"]` (wireframe.html 2876 줄) | `SuccessBlock` (info icon + "메일로 마지막 단계를 보냈습니다") |
| `/auth/verify-done` | `panel[data-mode="verify-done"]` (wireframe.html 2901 줄) | `SuccessBlock` (success icon + "환영합니다") + 홈 진입 CTA |
| `/auth/login-error` | `panel[data-mode="login-error"]` (wireframe.html 2919 줄) | `LoginForm` + `AlertError` 박스 ("남은 시도 N 회 / 5 회 실패 시 30분 제한" — DESIGN.md §핵심 인증 UX 결정 §7) |
| `/auth/signup-error` | `panel[data-mode="signup-error"]` (wireframe.html 2965 줄) | `SignupEmailForm` + `FormError` (이메일 중복 + 비번 약함 — DESIGN.md §핵심 인증 UX 결정 §6 인라인 해결 경로 링크) + disabled CTA |
| `/auth/login-loading` | `panel.is-loading[data-mode="login-loading"]` (wireframe.html 3001 줄) | `SubmitLoading` (`spinner` + 폼 dim) — Kakao 는 full redirect 라 로딩 디자인 없음 (DESIGN.md §핵심 인증 UX 결정 §5) |

### 1-1. 인증 layout shared shell

```
app/auth/layout.tsx
├── BrandBlock
│   ├── Pen-tip SVG icon chip (ink 배경)
│   ├── "write-note" wordmark (display 22px)
│   └── mode-label ("로그인" / "회원가입" / "비밀번호 재설정" / "이메일 인증" — 자식 route 에서 prop 으로 결정 가능)
└── children (자식 page 가 panel container 안 내용 렌더)
```

### 1-2. 패널 간 인라인 링크 (`PanelLink`)

DESIGN.md §핵심 인증 UX 결정 §6 의 "해결 경로 인라인 링크" 패턴. wireframe.html 의 alert-error / form-error / success-foot 안의 `<a>` 들이 이에 해당.

| 출발 패널 | 인라인 링크 | 도착 패널 |
|---|---|---|
| `login` | "회원가입" | `signup` |
| `login` | "비밀번호 재설정" | `reset-request` |
| `signup-error` (이메일 중복) | "로그인하기 →" | `login` |
| `reset-sent` | "다시 보내기" | `reset-request` |
| `verify-done` | "시작하기" | `/` (홈) |
| `reset-done` | "로그인하기 →" | `login` |

본 매핑은 plan-implement 단계의 컴포넌트 구현 시점에 1:1 검증 의무.

## 2. 메인 surface (6 + 1 H0 변형 = 7 표면)

### 2-1. 홈 + H0 변형

| URL | 상태 | wireframe | 자식 컴포넌트 트리 |
|---|---|---|---|
| `/` (프로젝트 1+) | 일반 홈 | wireframe.html 의 "홈" 탭 — DESIGN.md §화면 구성 | `Greeting` + `MemoInboxAlert` + `ProjectCard[]` (지난 세션 hero 인용 + 분량 ring) + `RecentActivityFeed` + `ArchivedSection` |
| `/` (프로젝트 0) | H0 빈 홈 | wireframe.html 의 "홈 (빈)" 탭 — DESIGN.md §추가된 13개 패널 §빈 상태 1개 | `EmptyHero` ("환영" + "첫 프로젝트 만들기" CTA + 모바일/⌘+N hint card 2 개) |

`app/page.tsx` 안에서 React Query `useProjects` 가 반환한 `Page<ProjectResponse>` 의 `totalElements` 에 따라 분기.

### 2-2. 작성 + 미리보기

| URL | 모드 (preferences.writingMode) | wireframe | 자식 컴포넌트 트리 |
|---|---|---|---|
| `/write` | `'manuscript'` | wireframe.html 의 "작성 — 원고지" 탭 — DESIGN.md §화면 구성 + §핵심 UX 결정 §2 | `WriteTopBar` + `ManuscriptGrid` (200/400/1000 격자 + 컬럼 마커 + 행 번호) + `SidePanel` (프로젝트 메타 + 등장인물) |
| `/write` | `'editor'` | wireframe.html 의 "작성 — 에디터" 탭 | `WriteTopBar` + `EditorToolbar` (스타일·폰트·크기·B/I/U/S·정렬·인용·목록·undo — placeholder 정적) + `EditorBody` (TipTap placeholder) + `SidePanel` |
| `/write/preview` | (모드 무관) | wireframe.html 의 "미리보기" 탭 | `PreviewBody` (페이지 break) + `PreviewStickyFooter` (진행률 + 페이지 + 목차 + prev/next + "편집으로 돌아가기") |

`app/write/layout.tsx` 는 `WriteTopBar` (프로젝트 타이틀 + 진행 ring + 미리보기 진입 버튼 + 사이드 토글) 를 박는다. `app/write/page.tsx` 와 `app/write/preview/page.tsx` 가 본문 영역 교체.

### 2-3. 메모 inbox

| URL | wireframe | 자식 컴포넌트 트리 |
|---|---|---|
| `/memos` | wireframe.html 의 "메모 inbox" 탭 — DESIGN.md §화면 구성 + §메모 inbox + 큐레이션 | `MemosTopBar` + `FilterChips` (overlap 카운트 placeholder) + `MemoCard[]` (expand 시 큐레이션 폼 — 정적 외관, 큐레이션 동작은 Week 4) |

본 spec 단계는 정적 외관만. 큐레이션 동작·필터 동작·overlap 카운트 계산은 Week 4.

### 2-4. 설정

| URL | wireframe | 자식 컴포넌트 트리 |
|---|---|---|
| `/settings` | wireframe.html 의 "설정" 탭 — DESIGN.md §화면 구성 + §7 분리 원칙 | `SettingsTopBar` + `SettingsGroup name="작성"` (작성 모드 카드 + 원고지 크기) + `SettingsGroup name="일반"` (테마 + 폰트/크기 등) + `SettingsGroup name="계정"` (이메일 + 로그아웃 placeholder) |

본 spec 단계의 동작:
- 작성 모드 카드 선택 → `preferences.writingMode` 갱신 → `/write` 진입 시 layout 분기 반영
- 테마 선택 → `preferences.theme` 갱신 → 즉시 라이트/다크 전환
- 원고지 크기 선택 → `preferences.manuscriptSize` 갱신 (Week 3 작성-원고지 layout 에서 사용)

기타 설정 (자동 저장 / 페이지 형식 / 기본 폰트·크기 / 계정 관리) 은 Week 6 (설정 phase) 영역.

## 3. Fallback surface (임의 URL)

| URL | wireframe | 자식 컴포넌트 트리 |
|---|---|---|
| `*` (정의되지 않은 경로) | (없음 — DESIGN.md 미디자인) | `app/not-found.tsx` — 인식 가능한 처리 (브랜드 블록 + "찾을 수 없는 페이지" + 홈으로 진입 CTA) |

DESIGN.md 의 wireframe 에는 not-found 패널이 없지만 FR-011 가 요구. 본 spec 의 디자인 시스템 토큰을 재활용해 minimal 만 박음 (Week 7 dogfooding 시 발견된 마찰 fix 의 일부일 수 있음).

## 4. 공유 shell ↔ 자식 위계 요약

```
RootLayout (app/layout.tsx)
├── Providers (QueryClient + Theme + Store)
├── 폰트 클래스 적용
├── PWA sw-register
└── child slot
    ├── AuthLayout (app/auth/layout.tsx)
    │   └── 12 인증 page
    │
    ├── WriteLayout (app/write/layout.tsx)
    │   ├── /write page (manuscript or editor)
    │   └── /write/preview page
    │
    ├── / page (홈 동적 변형)
    ├── /memos page
    ├── /settings page
    └── not-found page
```

`/memos`, `/settings`, `/` 는 별도 layout 없이 RootLayout 직속. 후속 phase 에서 메인 view 공통 shell 이 필요해지면 `app/(main)/layout.tsx` route group 으로 추가.

## 5. 라우트 가드 적용 표

`lib/auth/guard.ts` 의 placeholder 검사가 적용되는 영역:

| URL 패턴 | 가드 정책 | 미인증 시 redirect | 인증 시 redirect |
|---|---|---|---|
| `/auth/*` | 미인증 사용자 진입 가능 | (해당 없음) | `/` |
| `/`, `/write*`, `/memos`, `/settings` | 인증 필요 | `/auth/login` | (해당 없음) |
| `*` (not-found) | 가드 없음 | (해당 없음) | (해당 없음) |

가드 mechanism: client-side `useEffect` 기반 redirect (research.md §"인증 라우트 가드 placeholder" 박힘). Week 1B 진입 시 middleware + JWT cookie 검증으로 swap.

## 6. 검증 절차 (SC-002 측정)

본 contract 의 매핑이 시각 1:1 대응 검증의 기준:

1. **컴포넌트 매핑 확인**: 본 contract 의 19 행 모두에 React 컴포넌트가 존재하고 wireframe 의 해당 영역과 1:1 매칭
2. **디자인 토큰 grep**: `frontend/src/styles/tokens.css` 또는 `globals.css` 에 DESIGN.md 박힌 토큰 값 존재 (`#0066cc`, `#2997ff`, `14px`, `16px`, `18px`, `0.95` 등)
3. **라이트/다크 육안 비교**: 19 surface 모두 `next dev` 로 진입 + wireframe.html 의 해당 탭을 옆에 띄워 양쪽 비교 (라이트 + 다크 토글)
4. **인라인 링크 동작 확인**: §1-2 표의 6 인라인 링크 모두 클릭 시 도착 패널 진입
5. **가드 동작 확인**: §5 표의 정책 4 행 (미인증 → /auth/login 이동, 인증 + 가드 영역 → /, /auth → / redirect, /auth → /auth) 모두 행동 일치
