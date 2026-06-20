# Phase 0 Research: 온보딩 가이드 투어

## R-1. driver.js 통합 (가이드 엔진)

**Decision**: `driver.js`를 client component 내에서 동적 import 하여 사용. 홈 진입 시
설정을 조회해 미완료면 `driver({ steps }).drive()` 로 투어 시작, 완료/건너뛰기 모두
`onDestroyed` 콜백에서 `onboardingCompleted` 저장.

**확인된 정확 API** (출처: https://driverjs.com/docs/configuration — context7 `/websites/driverjs`):

```ts
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const d = driver({
  showProgress: true,
  showButtons: ["next", "close"],
  nextBtnText: "다음",
  doneBtnText: "시작하기",
  steps: [
    { element: '[data-tour="new-work"]',  popover: { title: "새 작품", description: "여기서 첫 작품을 시작해요", side: "bottom", align: "start" } },
    { element: '[data-tour="nav-memos"]', popover: { title: "메모", description: "떠오른 아이디어를 곁쪽지로 남겨요", side: "bottom" } },
    { element: '[data-tour="nav-characters"]', popover: { title: "인물", description: "등장인물을 한곳에 정리해요", side: "bottom" } },
    { element: '[data-tour="nav-write"]', popover: { title: "집필", description: "작품으로 들어가 이어 써요", side: "bottom" } },
  ],
  onDestroyed: () => { /* onboardingCompleted=true 저장 */ },
});
d.drive();
```

- `.drive()` 로 시작, `.destroy()` 로 강제 종료.
- **완료(마지막 "시작하기")와 건너뛰기(close) 모두 결국 `onDestroyed` 로 수렴** → 저장 로직 한 곳.
  - `doneBtnText`/`nextBtnText` 로 한국어 버튼. `showProgress` 로 "1 of 4" 진행 표시.
- `allowClose`(기본 true)로 배경 클릭·ESC 닫기 허용 → 그 경우도 `onDestroyed` 발화.

**Rationale**: 바닐라 JS(프레임워크 무관)라 React 19 렌더 사이클과 충돌 없음. 의존성 0,
경량. 완료/스킵이 단일 콜백(`onDestroyed`)으로 수렴해 영속 저장 결선이 단순.

**Alternatives considered**:
- react-joyride — React 친화적이나 무겁고 상태 관리 보일러플레이트 증가. 본 4단계엔 과함.
- intro.js / Shepherd.js — 기능 과다·라이선스(intro.js 상용) 부담.

## R-2. SSR / Next.js 16 App Router 경계

**Decision**: `OnboardingTour` 는 `'use client'`. driver.js 는 `useEffect` 안에서 사용
(브라우저 전용 DOM API). CSS(`driver.js/dist/driver.css`)는 client component 모듈 상단 import.

**Rationale**: driver.js 는 `document`/DOM 측정에 의존 → 서버 렌더 시점에 실행되면 안 됨.
`useEffect`(클라이언트 마운트 후)에서만 구동. 작성 직후 `pnpm build` 로 RSC 경계 검증
(CLAUDE.md 회귀 사례 — 이벤트/훅 컴포넌트 `'use client'` 누락 시 build fail).

## R-3. 완료 상태 영속 (서버 user_settings)

**Decision**: 기존 `user_settings`(key-value) + `/api/settings` GET/PUT 재사용. 신규 키
`onboardingCompleted`(허용 value `"true"`). `SettingsService.ALLOWED` 에 1줄 추가.

**확인된 사실** (실제 코드):
- `SettingsService` 는 `ALLOWED: Map<String, Set<String>>` 화이트리스트로 key·value 검증.
  허용 외 key → `ValidationException("Unknown setting key")`. 항목 추가 = "한 줄, 스키마 변경 0".
- `GET /api/settings` → `{ settings: { key: value } }` (저장된 key 만 포함, 미저장 key 부재).
- `PUT /api/settings { settings: { onboardingCompleted: "true" } }` → 부분 upsert(per-key).
- FE `@/lib/api/settings` 에 GET/PUT 헬퍼 존재.

**Rationale**: 신규 테이블·마이그레이션 0. 서버 영속이라 기기·브라우저 무관 1회(FR-005).
미저장=미완료 규약이 자연스러움(FR-001).

**트리거 판정**: `GET /api/settings` 응답에 `onboardingCompleted` 키가 **없으면** 미완료 →
투어 시작. 조회 실패 시 미표시(FR-007, 핵심 흐름 비차단).

## R-4. 대상 요소 표식 (data-tour)

**Decision**: 강조 대상 4곳에 `data-tour="..."` 속성을 추가(기능·스타일 무영향). driver.js
가 이 속성 선택자로 대상 지정.

**확인된 대상 위치** (실제 코드):
- `src/app/(main)/page.tsx` — 홈 "새 작품" 버튼(`onClick → /library?new=1`) → `data-tour="new-work"`
- `src/app/(main)/layout.tsx` — 네비 "메모"(`/memos`) → `nav-memos`, "인물"(`/characters`) → `nav-characters`, "집필" 버튼(`handleWriteClick`) → `nav-write`

**주의**: 네비는 데스크탑/모바일 양쪽에 렌더될 수 있음(layout 의 nav 구조). driver.js 는
선택자의 **첫 번째 매칭 요소**를 강조하므로, 데스크탑 상단 네비의 가시 요소에 표식을 단다.
모바일(좁은 폭)에서의 동작은 quickstart dogfooding 에서 확인(메뉴 접힘 시 첫 매칭 처리).

## 미해결 사항

없음 — spec 의 모든 결정이 설계 합의 + 실제 코드 확인으로 해소됨.
