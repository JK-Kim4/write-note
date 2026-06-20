# Contract: OnboardingTour 컴포넌트 + data-tour 표식

## OnboardingTour (신규, client component)

`src/components/onboarding/OnboardingTour.tsx`

**책임**: "언제 가이드를 시작/종료하고 완료를 저장하는가"만 담당. driver.js 인스턴스 생성·
단계 정의·구동을 감싼다. 대상 컴포넌트는 본 컴포넌트를 알지 못한다(결합 최소).

**Props**: 없음(자기완결). 홈 페이지에 마운트.

**동작 계약**:
1. 마운트 시 React Query 로 `GET /api/settings` 조회.
2. `onboardingCompleted` 키 부재(미완료) → `useEffect` 안에서 driver.js 동적 import 후 `drive()`.
   - 키가 `"true"`(완료) → 아무것도 안 함.
   - 조회 실패/로딩 → 투어 시작 안 함(FR-007 비차단).
   - **중복 시작 가드**: 한 번 시작하면 재마운트·리렌더에도 다시 시작하지 않음(ref 가드).
3. 단계: research R-1 의 4단계(`data-tour` 선택자). `showProgress`, 한국어 버튼(`nextBtnText="다음"`, `doneBtnText="시작하기"`).
4. `onDestroyed`(완료·건너뛰기·ESC·배경클릭 모두 수렴) → `PUT /api/settings { onboardingCompleted: "true" }` mutation. 저장 실패는 사용자 동작 비차단(로깅만).
5. 렌더 출력 없음(`null` 반환) — driver.js 가 DOM 오버레이를 직접 그림.

**의존**: `@/lib/api/settings`(GET/PUT), React Query, `driver.js`(동적 import).

## data-tour 표식 (대상 4곳)

기능·스타일 무영향 속성만 추가:

| 대상 | 파일 | 속성 |
|---|---|---|
| 홈 "새 작품" 버튼 | `src/app/(main)/page.tsx` | `data-tour="new-work"` |
| 네비 "메모" | `src/app/(main)/layout.tsx` | `data-tour="nav-memos"` |
| 네비 "인물" | `src/app/(main)/layout.tsx` | `data-tour="nav-characters"` |
| 네비 "집필" | `src/app/(main)/layout.tsx` | `data-tour="nav-write"` |

## 행위 테스트 (프론트, OnboardingTour.test.tsx)

driver.js DOM 은 시스템 경계로 mock(`vi.mock("driver.js")`), HTTP 는 msw.

1. `onboardingCompleted` 부재(미완료) 응답 → driver `drive()` 호출됨.
2. `onboardingCompleted: "true"`(완료) 응답 → `drive()` 미호출.
3. `onDestroyed` 콜백 발화 → `PUT /api/settings { onboardingCompleted: "true" }` 호출.
4. (조회 실패 → `drive()` 미호출, 비차단.)
