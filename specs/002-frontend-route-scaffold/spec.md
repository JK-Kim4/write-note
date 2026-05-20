# Feature Specification: Frontend Route & Page Scaffold

**Feature Branch**: `002-frontend-route-scaffold`

**Created**: 2026-05-20

**Status**: Draft

**Input**: User description: "현재 프로젝트 코드베이스 구현 현황을 파악하고 프로젝트 구축을 위한 기본적인 스케폴드 구현 작업을 진행하고싶어 / 프론트 라우트·페이지 스케폴드 — wireframe 전체 (메인 view + 인증 패널 + 빈 상태) + 공유 프론트 인프라."

## Context & Position

본 spec 의 직전 산출물은 [`specs/001-phase-1a-backend-scaffold`](../001-phase-1a-backend-scaffold/) (Phase 1A Backend Foundation, commit `acd7d3e`). 본 spec 은 그 백엔드 기반 위에 **프론트 전체 wireframe 의 진입 가능한 라우트 골격**을 박는다.

본질 정의 출처:
- [`DESIGN.md §화면 구성`](../../DESIGN.md) — V1 메인 view 6 종 (홈 / 작성-원고지 / 작성-에디터 / 미리보기 / 메모 inbox / 설정)
- [`DESIGN.md §추가된 13개 패널`](../../DESIGN.md) — 인증 12 패널 + 신규 사용자 빈 홈 (H0)
- [`docs/plan/01-phase-breakdown.md`](../../docs/plan/01-phase-breakdown.md) — Phase 분해 Week 1B-7/8 (인증 라우트 매핑), Week 2~6 (홈/작성/메모/설정 view 구현)
- [`designs/wireframe.html`](../../designs/wireframe.html) — 7 wireframe view 탭 + login 탭 내 12 panel toggle 의 정적 시각 산출물

본 spec 은 **라우트 골격 + 정적 wireframe 시각 1:1 재현 + 공유 인프라** 까지 다룬다. 도메인 동작(메모 CRUD, 자동 저장, 검색 등)은 Week 2~6 의 별도 spec 으로 분리.

## Clarifications

### Session 2026-05-20

- Q: PoC 산출물 (`frontend/src/app/poc/*`) 처리 정책은? → A: PoC 검증용 page 2 건 (`/poc/tiptap`, `/poc/pwa`) 폐기, production manifest+sw-register 유지 (회귀 기록은 `docs/poc/0-1*.md`, `docs/poc/0-3*.md` 에 영구화됨).
- Q: 인증 12 패널 라우팅 구조는? → A: Nested route + shared layout — `/auth/{login,signup,signup-email,reset-request,reset-sent,reset-new,reset-done,verify-pending,verify-done,login-error,signup-error,login-loading}` 12 자식 route + `/auth/layout.tsx` 공통 shell (브랜드 블록 + 카드 컨테이너). URL 공유성 / 이메일 콜백 깊은 링크 / 인라인 해결 경로 링크 지원.
- Q: 작성 모드 (원고지 / 에디터) 결정 mechanic 은? → A: `/write` 단일 URL — 진입 시 사용자의 작성 모드 설정 읽어 layout 결정. 미리보기는 `/write/preview` 자식 route. URL 에 모드 노출 없음 (DESIGN.md §핵심 UX 결정 §1 의 "설정 → 작성 모드 카드 선택 → 작성 화면이 그 모드로 고정" 원칙 정합).
- Q: 빈 홈 (H0) 진입점은? → A: `/` 홈 라우트의 동적 변형 — 프로젝트 0 개 → H0 외관 (환영 + 첫 프로젝트 만들기 hero CTA + 모바일/⌘+N hint 2 개), 1+ → 일반 홈 외관 (프로젝트 카드 + 지난 세션 hero 인용 + 최근 활동 + 보관함). 별도 진입점 없음 (DESIGN.md §빈 상태 1개 + 01-phase §5 의 "홈 view 의 빈 상태" 정합).
- Q: wireframe 1:1 시각 대응의 측정 기준은? → A: 디자인 토큰 일치 + 컴포넌트 구조 유사 — DESIGN.md §디자인 시스템 의 색상 토큰 (#0066cc/#2997ff), 타이포 (SF Pro Display, Noto Serif KR, Nanum Myeongjo), radius (14/16/18px), hairline 1px, active scale(0.95) 가 적용됐는지 육안 + 토큰 검증. visual regression 자동화 도입은 보류 (V1 / 단일 개발자 / 비용 최소).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 인증 진입 surface 골격 (Priority: P1)

프로젝트 메인테이너로서, V1 wireframe 에 정의된 13 개 인증 패널이 모두 라우트로 진입 가능해야 한다. 인증이 안 되면 어떤 후속 기능도 dogfooding 진입 불가하므로 가장 먼저 필요한 surface 다.

**Why this priority**: 인증 진입이 안 되면 모든 후속 surface (홈/작성/메모/설정) 의 시연·검증이 불가능. write-note 의 본질 (세션 끊겨도 컨텍스트 영속) 을 dogfooding 하려면 우선 로그인 가능해야 한다.

**Independent Test**: 사용자가 인증 진입 URL 들로 직접 이동했을 때 wireframe 과 일치하는 정적 외관이 표시되고, 빠른 패널 전환(로그인↔회원가입↔재설정↔인증 결과)이 wireframe panel toggle 과 동일하게 동작한다.

**Acceptance Scenarios**:

1. **Given** 사용자가 인증 진입 URL 로 이동, **When** 페이지가 로드, **Then** wireframe 의 해당 인증 패널과 동일한 정적 시각 외관(브랜드 블록, 폼 필드, CTA, 보조 링크)이 표시된다.
2. **Given** 사용자가 로그인 패널에서 회원가입 진입을 선택, **When** 전환이 발생, **Then** wireframe panel toggle 과 동일한 흐름으로 회원가입 step-1 (메서드 선택) 으로 이동한다.
3. **Given** 사용자가 회원가입 step-1 에서 이메일 방식을 선택, **When** 전환이 발생, **Then** wireframe 의 회원가입 step-2 (이메일 폼 + 약관) 가 표시된다.
4. **Given** 사용자가 비밀번호 재설정 흐름을 시작, **When** 4 단계(request → sent → new → done) 를 순차 진행, **Then** 각 단계가 wireframe 의 해당 패널로 정확히 전환된다.
5. **Given** 사용자가 이메일 인증 흐름에 진입, **When** verify-pending → verify-done 으로 전환, **Then** wireframe 의 verify-pending / verify-done 패널이 표시된다.
6. **Given** 잘못된 인증 시도 또는 회원가입 충돌이 발생한 상황을 가정, **When** 해당 오류 패널(login-error / signup-error) 로 라우팅, **Then** wireframe 의 alert-error 와 일치하는 외관이 표시된다.
7. **Given** 로그인 제출 진행 중을 가정, **When** loading 패널이 활성화, **Then** wireframe 의 login-loading (spinner + 폼 dim) 외관이 표시된다.

---

### User Story 2 - 메인 진입 surface 골격 (Priority: P2)

프로젝트 메인테이너로서, 인증 후 사용자가 마주칠 홈 / 메모 inbox / 설정 라우트가 wireframe 외관 그대로 진입 가능해야 한다. 또한 신규 가입자가 처음 진입했을 때의 빈 홈 (H0) 도 별도로 진입 가능해야 한다.

**Why this priority**: 인증 후 가장 먼저 도달하는 표면이며, 후속 Week 2 (프로젝트 CRUD), Week 4 (메모 캡처), Week 6 (설정) 의 구현 작업이 본 surface 의 정적 골격 위에 동작 코드를 채우는 흐름이다.

**Independent Test**: 사용자가 각 메인 진입 URL 로 이동했을 때 wireframe 와 일치하는 정적 외관과 공통 shell (top bar, 사이드 영역, 진행 ring 등) 이 표시된다. 빈 홈은 별도 URL 또는 별도 상태로 진입 가능하다.

**Acceptance Scenarios**:

1. **Given** 사용자가 홈 URL 로 이동, **When** 페이지가 로드, **Then** wireframe 의 홈 (프로젝트 카드 + "지난 세션" hero 인용 + 최근 활동 + 보관함) 정적 외관이 표시된다.
2. **Given** 신규 가입자 빈 홈 상태로 진입, **When** 페이지가 로드, **Then** wireframe 의 H0 (환영 + 첫 프로젝트 만들기 hero CTA + 모바일/⌘+N hint card 2개) 외관이 표시된다.
3. **Given** 사용자가 메모 inbox URL 로 이동, **When** 페이지가 로드, **Then** wireframe 의 메모 inbox (필터 칩 + 카드 expand 큐레이션 폼) 외관이 표시된다.
4. **Given** 사용자가 설정 URL 로 이동, **When** 페이지가 로드, **Then** wireframe 의 설정 (작성 / 일반 / 계정 3 그룹) 외관이 표시된다.
5. **Given** 사용자가 한 메인 view 에서 다른 메인 view 로 이동, **When** 전환이 발생, **Then** 공통 shell (top bar, 사이드, 진행 ring 등) 은 깜빡임 없이 유지되고 본문만 교체된다.

---

### User Story 3 - 작성 진입 surface 골격 (Priority: P3)

프로젝트 메인테이너로서, V1 의 핵심 작업면인 작성 화면 3 종 (원고지 / 에디터 / 미리보기) 라우트가 진입 가능해야 한다. 설정의 작성 모드 선택이 작성 진입 시 어떤 layout 으로 갈지 결정한다.

**Why this priority**: 작성 surface 는 dogfooding 의 본 작업면이지만, 인증 + 메인 진입이 먼저 박혀야 거기에서 도달 가능. 또한 작성 화면의 실제 동작(분량 카운터, 자동 저장, 메모 핀 등) 은 Week 3~5 의 별도 phase 영역이라 본 spec 은 라우트 + 정적 외관 까지만 다룬다.

**Independent Test**: 사용자가 작성 모드 선택 후 작성 URL 로 이동했을 때 모드에 맞는 layout (원고지 격자 / 에디터 툴바) 이 wireframe 외관으로 표시된다. 미리보기 진입 / 복귀가 동작한다.

**Acceptance Scenarios**:

1. **Given** 설정에서 원고지 모드가 선택된 상태, **When** 사용자가 작성 진입, **Then** wireframe 의 작성-원고지 (격자 오버레이 + 매수 카운터 + 컬럼 마커 + 행 번호) 외관이 표시된다.
2. **Given** 설정에서 에디터 모드가 선택된 상태, **When** 사용자가 작성 진입, **Then** wireframe 의 작성-에디터 (풀 툴바 + 본문 영역 + 사이드 패널 골격) 외관이 표시된다.
3. **Given** 사용자가 작성 화면 top bar 의 "미리보기" 버튼을 활성화, **When** 진입이 발생, **Then** wireframe 의 미리보기 (본문 페이지 break + sticky footer: 진행률·페이지·목차·prev/next) 외관이 표시되고 "편집으로 돌아가기" 보조 액션이 표시된다.
4. **Given** 미리보기 상태에서 "편집으로 돌아가기" 가 활성화, **When** 복귀가 발생, **Then** 직전 작성 화면으로 돌아온다.

---

### User Story 4 - 공유 프론트 인프라 (Priority: P4)

프로젝트 메인테이너로서, 모든 surface 가 같은 디자인 토큰 / 같은 폰트 / 같은 다크 모드 결정 / 같은 데이터 접근 도구를 공유해야 한다. 후속 phase 가 각자 다른 추상화를 박지 않게 하기 위함이다.

**Why this priority**: 공유 인프라는 후속 phase 의 작업 시간을 좌우한다. 토큰·다크모드·데이터 도구가 일관되면 Week 2~6 phase 별 작업이 표면 채우기에 집중 가능. P4 인 이유는 US1~3 의 surface 진입이 가시적으로 먼저 보이는 게 dogfooding 가치 입증에 우선이기 때문.

**Independent Test**: 라이트↔다크 토글이 모든 진입 가능한 surface 에 깜빡임 없이 일관 적용된다. 후속 phase 가 사용할 데이터 도구 (서버 상태 / 로컬 UI 상태) 가 셋업되어 placeholder 동작이 확인된다.

**Acceptance Scenarios**:

1. **Given** 사용자가 어떤 진입 가능한 surface 에 있는, **When** 라이트↔다크 토글 활성화, **Then** 색상 토큰·본문 weight·원고지 paper·accent blue 가 wireframe 의 다크 변환 규칙대로 일관 변환된다.
2. **Given** 사용자가 다크 모드 선택 후 다른 surface 로 이동, **When** 새 surface 가 로드, **Then** 다크 선호가 깜빡임 없이 유지된다.
3. **Given** 후속 phase 가 서버 상태 접근을 시도, **When** 공유 데이터 접근 도구를 사용, **Then** 도구가 이미 셋업되어 즉시 사용 가능하다 (placeholder query 1 건이 성공 응답 처리 가능).
4. **Given** 후속 phase 가 로컬 UI 상태 (예: 사이드 패널 열림/닫힘) 를 박을 위치를 필요, **When** 공유 클라이언트 상태 도구를 사용, **Then** 도구가 이미 셋업되어 즉시 사용 가능하다.

### Edge Cases

- 사용자가 인증 안 된 상태에서 메인/작성/메모/설정 URL 에 직접 진입 시도 시 → 인증 진입 surface 로 안내된다.
- 사용자가 이미 인증된 상태에서 인증 진입 URL 에 직접 진입 시도 시 → 메인 진입 surface 로 안내된다.
- 빈 홈 (H0) 상태와 일반 홈 상태 사이 전환이 명확해야 한다 (프로젝트가 0 개 ↔ 1 개 이상).
- 작성 모드가 설정에서 변경된 직후 작성 진입 시 변경된 모드의 layout 이 즉시 반영되어야 한다.
- 미리보기에서 "편집으로 돌아가기" 시 직전 모드(원고지/에디터) 가 정확히 복원되어야 한다.
- 사용자가 시스템 테마를 따라가도록 설정한 상태에서 OS 테마가 변경 시 surface 가 깜빡임 없이 따라간다.
- 한국어 IME 가 폼 입력에 사용될 때 조합/완성 사이클이 깨지지 않는다 (이미 PoC 0-1 에서 검증된 회귀 회피).
- 사용자가 직접 임의 URL 을 입력했을 때 (wireframe 에 정의되지 않은 경로) 인식 가능한 처리 화면으로 안내된다.

## Requirements *(mandatory)*

### Functional Requirements

#### 라우트 surface (인증)

- **FR-001**: 시스템은 wireframe 의 12 개 인증 패널 (`login`, `signup`, `signup-email`, `reset-request`, `reset-sent`, `reset-new`, `reset-done`, `verify-pending`, `verify-done`, `login-error`, `signup-error`, `login-loading`) 각각에 **고유 URL 로 진입 가능**해야 한다 (Clarification 2026-05-20: nested route 구조 `/auth/<panel>` + 공통 shared layout 으로 박힘).
- **FR-002**: 시스템은 인증 패널 간 전환을 wireframe panel toggle 과 동일한 흐름 (로그인↔회원가입↔재설정 4 단계↔인증 결과 2 단계↔오류 패널) 으로 지원해야 하며, 전환 시 공통 shared layout (브랜드 블록 + 카드 컨테이너) 은 유지하고 자식 패널 내용만 교체해야 한다.
- **FR-003**: 시스템은 wireframe 의 정적 외관 (브랜드 블록, success-block, alert-error, form-error, submit.is-loading 등 디자인 컴포넌트) 을 인증 surface 에서 1:1 재현해야 한다.

#### 라우트 surface (메인)

- **FR-004**: 시스템은 wireframe 의 메인 view 6 종 (홈, 작성-원고지, 작성-에디터, 미리보기, 메모 inbox, 설정) 각각에 진입 가능한 라우팅을 제공해야 한다.
- **FR-005**: 시스템은 신규 가입자 빈 홈 (H0) 상태에 진입 가능해야 한다 (Clarification 2026-05-20: 홈 라우트 `/` 의 **동적 변형** 으로 박힘 — 프로젝트 0 개 → H0 외관, 1+ → 일반 홈 외관. 별도 진입점 없음).
- **FR-006**: 시스템은 메인 view 간 이동 시 공통 shell (top bar, 사이드 영역, 진행 ring) 을 깜빡임 없이 유지해야 한다.
- **FR-007**: 시스템은 작성 진입 시 사용자의 작성 모드 설정 (원고지 / 에디터) 에 따라 wireframe 의 해당 layout 을 표시해야 한다 (Clarification 2026-05-20: 작성 surface 는 `/write` 단일 URL 로 박힘 — URL 에 모드 노출 없음. 모드는 설정의 영속 preference 에서 읽음).
- **FR-008**: 시스템은 작성 화면 top bar 의 "미리보기" 액션을 통해 미리보기 surface (`/write/preview` 자식 route) 로 진입 가능해야 하고, "편집으로 돌아가기" 액션을 통해 직전 작성 layout 으로 복귀 가능해야 한다.

#### 라우트 가드 / 진입 제어

- **FR-009**: 시스템은 사용자가 인증되지 않은 상태에서 메인/작성/메모/설정 surface 에 진입 시도 시 인증 진입 surface 로 안내해야 한다.
- **FR-010**: 시스템은 이미 인증된 사용자가 인증 진입 surface 에 직접 진입 시도 시 메인 진입 surface 로 안내해야 한다.
- **FR-011**: 시스템은 wireframe 에 정의되지 않은 임의 경로 진입 시 인식 가능한 처리 surface 를 표시해야 한다.

#### 디자인 토큰 / 다크 모드

- **FR-012**: 시스템은 모든 진입 가능한 surface 에 [`DESIGN.md §디자인 시스템`](../../DESIGN.md) 의 색상·타이포·radius·active state 토큰을 일관 적용해야 한다.
- **FR-013**: 시스템은 라이트 / 다크 / 시스템 따라가기 3 모드의 다크 모드 선호를 지원해야 한다.
- **FR-014**: 시스템은 다크 모드 전환 시 본문 weight (400→300), 원고지 paper (cream→warm cream-dark), accent (`#0066cc`→`#2997ff`) 를 wireframe 의 다크 변환 규칙대로 반영해야 한다.
- **FR-015**: 시스템은 다크 모드 선호를 surface 간 이동 시 깜빡임 없이 유지해야 한다.
- **FR-016**: 시스템은 한국어 본문 프로즈 (Noto Serif KR) 와 원고지 (Nanum Myeongjo) 폰트 적용을 지원해야 한다.

#### 공유 데이터 인프라

- **FR-017**: 시스템은 후속 phase 가 서버 상태 접근에 사용할 공유 데이터 접근 도구를 셋업해야 한다 ([`docs/plan/00-stack-and-schedule.md §2-1`](../../docs/plan/00-stack-and-schedule.md) 의 React Query 결정 박힘).
- **FR-018**: 시스템은 후속 phase 가 로컬 UI 상태 (예: 사이드 패널 열림/닫힘, 다크 모드 선호, 작성 모드 선호) 에 사용할 공유 클라이언트 상태 도구를 셋업해야 한다 ([`docs/plan/00-stack-and-schedule.md §2-1`](../../docs/plan/00-stack-and-schedule.md) 의 Zustand 결정 박힘).
- **FR-019**: 시스템은 백엔드 (Phase 1A 가 박은 `/api/projects`) 와의 통신을 위한 공통 클라이언트 셋업을 포함해야 한다 (Result 응답 envelope / 오류 envelope 처리 일관화).
- **FR-020**: 본 spec 의 surface 는 백엔드 실제 데이터 없이도 진입 가능해야 한다 (placeholder / 정적 wireframe 외관 우선, 실제 데이터 연결은 후속 phase 영역).

#### PWA / 모바일 정합

- **FR-021**: 시스템은 Phase 0-3 에서 박힌 PWA manifest + service worker (홈 화면 추가 노출) 산출물을 본 라우트 구조 안에서 깨뜨리지 않고 유지해야 한다.

#### 검증

- **FR-022**: 본 spec 의 결과물은 frontend 빌드 및 lint 게이트 (Next.js `next build` + ESLint) 가 GREEN 인 상태로 land 되어야 한다.
- **FR-023**: 본 spec 의 결과물은 wireframe 와 1:1 대응이 검증 가능해야 한다 — 각 surface 가 wireframe 의 어느 view/panel 에 대응하는지 spec 내 명시 + Clarification 2026-05-20 으로 박힌 측정 기준 (DESIGN.md §디자인 시스템 의 색상·타이포·radius·hairline·active scale 토큰 적용 + 컴포넌트 구조 유사 + 육안 비교) 으로 검증한다. visual regression 자동화는 본 spec 영역 밖.

### Key Entities *(include if feature involves data)*

본 spec 은 라우트·시각 골격 + 공유 인프라만 다루며 새로운 도메인 entity 를 도입하지 않는다. 본 spec 이 의존하는 기존 개념:

- **Account (Phase 1A 기존)**: 인증 진입 라우트 가드의 판단 기준. 본 spec 에서는 인증 여부 신호로만 사용.
- **Project (Phase 1A 기존)**: 홈 / 빈 홈 (H0) 의 시각 변형 판단 기준 (0 개 ↔ 1 개 이상). 본 spec 에서는 placeholder 데이터로 충분.

후속 entity (Document, Memo, Character, SessionNote 등) 는 본 spec 영역 밖.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자는 wireframe 의 12 개 인증 패널 + 6 개 메인 view + 1 개 빈 홈 상태 (총 19 surface) 모두에 진입 가능하다.
- **SC-002**: 100% 의 진입 가능한 surface 가 wireframe 의 해당 view/panel 과 시각적 1:1 대응한다 — 측정 기준: ① DESIGN.md §디자인 시스템 의 디자인 토큰 (색상 #0066cc/#2997ff, 타이포 SF Pro Display/Noto Serif KR/Nanum Myeongjo, radius 14/16/18px, hairline 1px, active scale(0.95)) 적용, ② wireframe.html 의 컴포넌트 구조 (브랜드 블록, success-block, alert-error, form-error, submit.is-loading, empty-hero/cta/hint-card 등) 와 의미적 매칭, ③ 라이트·다크 양쪽에서 육안 비교 (Clarification 2026-05-20).
- **SC-003**: 라이트↔다크 토글이 19 개 surface 모두에 일관 적용되고 surface 간 이동 시 다크 선호가 유지된다 (모든 surface 에서 검증 가능).
- **SC-004**: 인증되지 않은 사용자의 메인/작성/메모/설정 surface 직접 진입 시도가 100% 인증 진입 surface 로 안내된다.
- **SC-005**: 인증된 사용자의 인증 surface 직접 진입 시도가 100% 메인 진입 surface 로 안내된다.
- **SC-006**: 후속 phase 가 서버 상태·로컬 UI 상태 도구를 즉시 사용 가능 (placeholder 사용 예시 1 건이 본 spec 결과물 안에 포함되어 검증).
- **SC-007**: Frontend 빌드 + lint 게이트가 GREEN 상태로 본 spec 결과물이 land 된다.
- **SC-008**: 메인 view 간 이동 시 공통 shell 의 깜빡임 (full reload / layout shift) 이 발생하지 않는다.
- **SC-009**: Phase 0-3 의 PWA 산출물 (manifest + service worker + 홈 화면 추가) 이 본 spec land 후에도 동등하게 동작한다.

## Assumptions

- 본 spec 의 surface 는 **시각 골격 + 라우트 진입 + 공유 인프라** 까지만 다루고, 도메인 동작 (프로젝트 CRUD UI, 메모 캡처 / 큐레이션, 자동 저장, 메모 핀, 검색, 자수 카운팅 등) 은 [`docs/plan/01-phase-breakdown.md`](../../docs/plan/01-phase-breakdown.md) 의 Week 2~6 별도 phase 영역이다.
- 인증의 실제 동작 (Kakao OAuth2, 이메일·비번 로그인, JWT 발급, 5 회 실패 정책, 비밀번호 재설정 메일 발송 등) 은 Week 1B-1~6 백엔드 + 본 spec 의 클라이언트 측 폼 연동 보강 영역이며, 본 spec 은 진입 가능한 라우트 + wireframe 정적 외관 + panel toggle 흐름까지만 보장한다.
- 새 프로젝트 만들기 흐름 / 세션 종료 모달 / 빠른 입력 모달 / 등장인물·메타 관리 페이지 등 [`DESIGN.md §미디자인 화면`](../../DESIGN.md) 에 🔴/🟡 표시된 surface 는 본 spec 영역 밖이며 각자의 Week 마주칠 시점에 별도 디자인·구현된다.
- 본 spec 의 결과물은 단일 워크트리 + `develop` 베이스의 단일 feature 브랜치 (`002-frontend-route-scaffold`) 에서 진행된다 (현 시점 워크트리 1 개 정책 유지).
- 백엔드 (Phase 1A) 가 제공하는 `/api/projects` 의 임시 `X-User-Id` header ownership 메커니즘은 본 spec 의 라우트 가드 / 데이터 접근 도구 설계 시점에 알려진 임시 상태이며, Week 1B-5 에서 authenticated principal 로 교체될 것이다.
- Phase 0-1 (TipTap 한국어 IME) / Phase 0-3 (PWA) 의 검증된 산출물 처리 (Clarification 2026-05-20 박힘):
  - PoC 검증용 page (`frontend/src/app/poc/tiptap/page.tsx`, `frontend/src/app/poc/pwa/page.tsx`) 는 본 spec 진입 시 폐기. 회귀 기록은 `docs/poc/0-1-tiptap-korean.md`, `docs/poc/0-3-pwa.md` 에 영구화되어 있으므로 라우트에서는 제거.
  - Production PWA 산출물 (`frontend/src/app/manifest.ts`, `frontend/src/app/sw-register.tsx`) 은 유지 (FR-021 의 PWA 정합 요구로 모든 surface 가 사용).
  - TipTap 패턴의 후속 활용은 Week 3 의 작성-에디터 surface 구현 시점에 본 spec 의 라우트 위에서 재적용된다.
- 본 spec 은 [`frontend/AGENTS.md`](../../frontend/AGENTS.md) 의 경고 (Next.js 16 breaking change → `node_modules/next/dist/docs/` 사전 정독 의무) 를 따른다.
