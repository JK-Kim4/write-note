# Research: 온보딩 가이드 고도화 — 설계 결정 (Phase 0)

spec/인터뷰에서 확정된 결정을 driver.js 1.4.0 + Next.js 16 위에서 구현 가능한 기술 선택으로 해소. NEEDS CLARIFICATION 없음.

---

## D1. 인트로 설명 카드 3장 (타겟 없는 중앙 popover)

- **Decision**: driver.js step 의 `element` 를 생략 → 화면 중앙 popover 로 렌더. 3개 step(시리즈 생성 / 작품 포함 / 단위 내보내기) 순차.
- **Rationale**: `DriveStep.element?` optional 확인(타입 정의). 별도 모달 컴포넌트 불필요 — 동일 driver 흐름에 자연 편입.
- **Alternatives**: 커스텀 모달 컴포넌트(중복 UI·상태 관리) 기각.

## D2. 메뉴 스포트라이트 3 + data-tour 마커

- **Decision**: 작품→메모→인물 순. 메모(`nav-memos`)·인물(`nav-characters`)은 기존 마커 재사용, **작품 nav 링크에 `data-tour="nav-works"` 신규 추가**(`layout.tsx`).
- **Rationale**: 기존 027 의 첫 step 은 '새 작품' 버튼(`new-work`)이라 "작품 메뉴" 와 다름 → 작품 메뉴(=/library 링크)를 별도 마커로 짚는다.
- **Alternatives**: 기존 `new-work` 재사용(메뉴가 아니라 버튼이라 의미 불일치) 기각.

## D3. "더 보기 / 바로 시작" 분기

- **Decision**: 메뉴 마지막(인물) step popover 버튼을 2지선다로 — `onNextClick`("더 보기")·done/`onCloseClick`("바로 시작"). `showButtons`/버튼 텍스트 커스터마이즈로 "다음/이전/닫기" 대신 의미 있는 라벨.
- **Rationale**: driver.js 1.4.0 step별 `onNextClick`/`onCloseClick`/`onPopoverRender` 콜백 지원 확인 → 분기 로직을 콜백에서 처리.
- **주의**: 기본 버튼 스타일/배치를 2지선다로 정돈하려면 `onPopoverRender` 로 버튼 영역 커스터마이즈 또는 popover description 내 액션 버튼. 구현 시 가장 단순한 방식 택1(자동 테스트는 "더보기→navigate/핸드오프", "바로시작→완료종료" 호출로 검증).
- **Alternatives**: 별도 분기 모달(흐름 단절) 기각.

## D4. 완료 저장 시점 (이탈 내성)

- **Decision**: 인트로+메뉴 흐름 종료(또는 그 전 끝내기/건너뛰기/ESC/배경) 시 `putSettings({onboardingCompleted:"true"})`. "더 보기" 분기 진입 **전에 이미 완료 저장**.
- **Rationale**: FR-008 — 라이브러리 가이드(보너스) 중 이탈해도 다음 진입에 긴 인트로 재노출 0. 기존 027 의 `onDestroyed→putSettings` 패턴을 "메뉴 종료/바로시작/더보기 직전" 으로 일반화.
- **세부**: "더 보기" 선택도 완료 저장을 트리거(분기 자체가 메뉴 흐름의 끝). 라이브러리 2차 투어는 완료 상태와 무관하게 동작.

## D5. 멀티페이지 핸드오프 (driver.js 인스턴스 한계 우회)

- **Decision**: "더 보기" 시 `sessionStorage["writenote.onboarding.stage.v1"]="library"` set → `router.push("/library")`. `/library` 의 `LibraryOnboardingTour` 가 마운트 시 그 값 확인 → 있으면 2차 투어 시작 + **키 즉시 제거**(1회성, 새로고침 시 재발 방지).
- **Rationale**: driver.js 한 인스턴스가 페이지 이동을 못 이음(실측) → 페이지별 독립 투어 + 경량 상태 핸드오프. localStorage 아닌 `sessionStorage`(임시·탭 한정, 영속 오염 방지).
- **Alternatives**: URL 쿼리(`?onboarding=library`)도 가능하나 주소창 노출·뒤로가기 얽힘 → sessionStorage 선호. 전역 store(zustand) 도입(과함) 기각.

## D6. 2차 투어 마운트 레이스 (FR-011)

- **Decision**: `LibraryOnboardingTour` 는 타겟(`[data-tour="new-series"]`·`[data-tour="new-work-root"]`)이 DOM 에 존재할 때까지 대기 후 `driver().drive()`. 존재 폴링(짧은 간격·상한) 또는 `requestAnimationFrame`/`MutationObserver` 1회.
- **Rationale**: LibraryBoard 가 데이터 로드(React Query) 후 렌더 → 마운트 직후 타겟이 없을 수 있음. 빈 강조/깜빡임 방지(FR-011).
- **주의**: 신규 사용자라도 루트 뷰에 두 버튼은 항상 렌더(실측) → 타겟은 결국 존재. 상한 도달 시 조용히 skip(가이드 못 띄워도 서비스 사용 방해 0).

## D7. deps 안정 (무한 렌더 회귀 예방)

- **Decision**: driver 인스턴스·`router`·`putSettings`·`onboardingCompleted` 를 ref 로 안정화하고 effect deps 최소화(022 BChapterEditor OOM 회귀 패턴 회피). 부모 setState 를 호출하는 effect 의 deps 불안정 금지.
- **Rationale**: CLAUDE.md code-quality §"커스텀 훅 반환을 deps 에 직접 넣지 말 것" 회귀 사례.

## D8. 테스트 경계 (Classist) + 한계

- **Decision**: driver.js(외부 DOM 라이브러리)·next `useRouter`(네비)·설정 HTTP client 만 mock. 검증 = 단계 순서·분기 시 navigate/핸드오프 set 호출·완료 시 putSettings 호출·재진입 시 미시작.
- **한계(명시)**: 실제 시각 스포트라이트·중앙 카드·페이지 이동 후 강조 타이밍은 자동 테스트로 단정 불가 → **dogfooding 게이트**(quickstart). 자동 GREEN 을 시각 정합 증거로 단정 금지.

---

## 미해결 → 구현 재량 (아키텍처 영향 경미)

- 분기 2지선다 버튼의 정확한 렌더 방식(`onPopoverRender` vs description 내 버튼) — 구현 시 단순·접근성 우선 택1.
- 타겟 대기 구현체(폴링 간격/상한 vs observer) — D6 범위 내.
- 인트로/메뉴/라이브러리 문구 최종 카피 — 한국어, dogfooding 에서 다듬기.
