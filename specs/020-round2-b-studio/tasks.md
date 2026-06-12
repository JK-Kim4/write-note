# Tasks: Round 2 — B 집필실 페이지 분할·용지·반응형

**Branch**: `020-round2-b-studio` | **Plan**: [plan.md](./plan.md)

오케스트레이션: Opus advisor(설계·리뷰) + Sonnet implementer(구현). Phase 경계마다 Opus 리뷰 게이트.

## Phase 1 — 분할 PoC (핵심 증명, §10 최우선)

- [ ] T001 `pageLayout.ts` 읽고 A4 분할 메커니즘·상수 파악(구현자 grep)
- [ ] T002 BEditor에 paged 분기 추가 — A4 하드코딩 geometry로 시트·쪽번호·column-split·click-fill·`CSS.supports` 폴백. 흐름형은 폴백 경로로 유지
- [ ] T003 b.css에 paged 스킨 추가(B 스킨: 흰 시트·gray-200·인디고, A 웜페이퍼 미도입) + `@supports` 가드. 줄선을 `.sheet` 절대배치로 이전
- [ ] T004 works page에서 paged BEditor 렌더(A4 고정), 자동저장·draft·아웃라인 불변 확인
- [ ] T005 게이트(vitest·tsc·eslint·build) GREEN
- [ ] **GATE-1 (human dogfooding)**: 브라우저에서 한글 입력·IME 4케이스·장 분할·줄선 정렬 육안 — Opus가 사용자에게 surface

## Phase 2 — 기하 파라미터화 + 용지 4종 (TDD)

- [ ] T006 `pageLayout.test.ts` — PAPER_PRESETS·paperGeometry 4종 산출 + **A4 회귀**(현 상수와 동일) 테스트 RED
- [ ] T007 pageLayout.ts PaperGeometry 리팩토링 GREEN — 함수 시그니처에 geometry 주입, A PaperEditor 호출부 갱신(동작 불변)
- [ ] T008 PaperEditor 회귀 테스트(있으면) + B BEditor가 geometry prop 수용
- [ ] T009 게이트 GREEN(A·B 양쪽 회귀 0)

## Phase 3 — 설정 영속

- [ ] T010 preferences store `paperSize: PaperSize`(default "A4") 추가 + 타입
- [ ] T011 PreferencesSync paperSize 직렬화·hydrate(019 패턴, allowlist 정합)
- [ ] T012 backend `SettingsService.ALLOWED += "paperSize"` + 테스트 1건(허용값 검증)
- [ ] T013 `/b/settings` 용지 선택 UI(4종 라디오/셀렉트)
- [ ] T014 works page: 설정 paperSize→geometry→BEditor 배선
- [ ] T015 게이트 GREEN(frontend + backend)

## Phase 4 — 좁은 폭 패널 (US2)

- [ ] T016 works page 좌 목차·우 BWorkSidePanel breakpoint(880px) 미만 토글 drawer/오버레이
- [ ] T017 넓은 폭 3패널 불변 + 좁은 폭 접근 수단 보장(숨김 일변도 금지) 확인
- [ ] T018 게이트 GREEN

## Phase 5 — 검증 격차 (US3) + 마감

- [ ] T019 useEditorOutline H3 포함(grep 확정 후 수정) + 목차 H3 들여쓰기
- [ ] T020 헤더 네비 영속(모든 /b/* 라우트)·H1/H2/H3 툴바 동작 확인
- [ ] T021 A 디자인 동결 기록(`docs/plan/04`·vault) + 전체 게이트 GREEN
- [ ] **GATE-2 (human dogfooding)**: 용지 4종 전환·다기기 설정 동기화·좁은 폭 패널 육안

## 게이트 정책

- 각 Phase 끝 자동 게이트(vitest·tsc·eslint·build / backend ktlint main+test·checkstyle·test·build) Opus 직접 확인 후 다음 Phase.
- GATE-1·GATE-2는 human dogfooding(브라우저·IME) — Opus가 자동 게이트 GREEN 후 사용자에게 surface, 자동 진행은 여기까지.
- subagent 자기진단("기존 회귀") 무검증 수용 금지(§7) — Opus 직접 재현.
