---
description: "Task list — 028 홈(메인) 페이지 개선"
---

# Tasks: 홈(메인) 페이지 개선

**Input**: Design documents from `specs/028-home-page-improvements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-and-settings.md, quickstart.md

**Tests**: 포함 (프로젝트 TDD HARD-GATE §5 — 행위/매핑/순수함수는 Red→Green). 설정 파일·데이터 파일은 §5-5 완화.

**Organization**: user story 별 phase. 작업 브랜치 = `develop` 직접.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 + 의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3 (Setup/Foundational/Polish 은 라벨 없음)

## Path Conventions

- Web app: `backend/src/...`, `frontend/src/...`

---

## Phase 1: Setup & Investigation (공유)

**Purpose**: 코드 착수 전 사실 확정. 빈 막대 원인은 추측 금지(HARD-GATE) — 라이브 관찰 먼저.

- [ ] T001 빈 막대 근본 원인 라이브 관찰 (quickstart 0단계): 작품에서 10초↑ 머문 뒤 홈 복귀 시 막대 생성 여부 + 라이브 `GET /api/work-sessions/total?from..to`(이번 주) 응답값 확인. 결과를 `specs/028-home-page-improvements/research.md` R1 "미확정" 절에 분기 기록(값 있음=캐싱 갭 / 값 없음=세션 미기록). **이 기록 전 US1 수정 단정 금지.**

**Checkpoint**: 원인 분기 확정 → US1 수정 범위 결정 가능.

---

## Phase 2: Foundational (백엔드 — BE 선행 배포 prerequisites) ⚠️

**Purpose**: 배포 순서 HARD-GATE(BE 선행→FE 후행) — 백엔드 변경은 FE보다 먼저 배포되어야 한다(FE가 `dailyGoalMinutes` PUT 시 구 BE가 설정 PUT 전체 400). 따라서 모든 FE user story 작업의 배포 전제.

**⚠️ CRITICAL**: 이 phase 완료·배포 전 FE(특히 US2) 배포 금지.

- [X] T002 [P] `backend/src/test/kotlin/com/writenote/service/SettingsServiceIT.kt` 에 `dailyGoalMinutes` allowlist 행위 테스트 작성 (Red): 허용값 통과 / 비허용값("45","abc","0") `ValidationException`. (기존 IT 파일에 추가)
- [X] T003 `backend/src/main/kotlin/com/writenote/service/SettingsService.kt` `ALLOWED` 에 `"dailyGoalMinutes" to setOf("30","60","90","120","180","240","300")` 1줄 추가 (Green). 검증 로직 무수정.
- [X] T004 `backend/src/main/resources/application.yml` `work-session.min-session-seconds` 기본값 `:15` → `:10` (설정 파일, §5-5). 주석에 "2026-06-20 15→10 완화" 갱신.
- [X] T005 백엔드 게이트: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` GREEN 확인(포어그라운드). → BUILD SUCCESSFUL.

**Checkpoint**: 백엔드 GREEN → 배포 후 FE 작업 진행 가능.

---

## Phase 3: User Story 1 - 집필 시간 홈 즉시 반영 + 오늘 강조 (Priority: P1) 🎯 MVP

**Goal**: 집필 세션 종료 후 홈 복귀 시 작업시간 즉시 갱신, 오늘 막대 날짜+"오늘" 강조, 빈 주 안내.

**Independent Test**: 작품에서 10초↑ 작업 후 홈 복귀 → 추가 새로고침 없이 막대 반영 + 오늘 식별 + 기록 없으면 안내.

### Tests for User Story 1 (TDD)

- [X] T006 [P] [US1] `frontend/src/components/b/dashboard/BRhythmCard.test.tsx` (신규): 오늘 열에 날짜+"오늘" 표식 렌더 / 주간 합계 0이면 "아직 이번 주 기록이 없어요" 안내 렌더 (RTL 행위, Red).

### Implementation for User Story 1

- [X] T007 [US1] `frontend/src/hooks/useWorkSession.ts`: `end`·`endWithLog` 성공 후 `queryClient.invalidateQueries({ queryKey: sessionKeys.all })` 결선(`useQueryClient` 주입, `sessionKeys` import). `endBeacon`(unload)은 무효화 제외(페이지 종료 중).
- [X] T008 [P] [US1] `frontend/src/lib/query/useSessions.ts` `useWeeklyByDay` 에 `refetchOnMount: "always"` 추가(홈 복귀 mount 마다 신선).
- [X] T009 [US1] `frontend/src/components/b/dashboard/BRhythmCard.tsx`: 오늘 막대 라벨에 날짜("토 6/20")+"오늘" 강조, 주간 합계 0 빈 상태 안내 (T006 Green). 오늘 날짜는 prop 으로 전달받거나 `weekDayRanges` 파생.
- [X] T010 [US1] `frontend/src/app/(main)/page.tsx`: T009 가 요구하는 오늘 날짜 라벨/빈 상태 데이터를 `BRhythmCard` 에 전달(필요 시 prop 추가). 기존 `todayIndex`/`weeklyQuery` 재사용.

**Checkpoint**: US1 단독 동작 — 집필 후 즉시 반영 + 오늘 강조 + 빈 안내.

---

## Phase 4: User Story 2 - 오늘 작업시간 원통형 게이지 + 일일 목표 설정 (Priority: P2)

**Goal**: 오늘 작업시간을 일일 목표 대비 원통형 게이지로 표시, 목표를 설정에서 변경·다기기 동기화.

**Independent Test**: 설정에서 목표 지정 후 오늘 작업 → 게이지 채움이 (오늘÷목표)에 맞고, 0분·초과·미설정에서 안 깨지며, 다른 세션에 목표 동기화.

**Dependency**: Phase 2(백엔드 `dailyGoalMinutes`) 배포 완료 후 FE 배포.

### Tests for User Story 2 (TDD)

- [X] T011 [P] [US2] `frontend/src/lib/todayGauge.test.ts` (신규): 채움 계산 — 정상(30분/60분=0.5), 0분(0, NaN 금지), 초과(목표 초과=1.0 clamp), 목표 미설정 폴백(60). 표시 라벨 포맷. (Red)
- [X] T012 [P] [US2] `frontend/src/components/PreferencesSync.test.tsx` 또는 store 테스트: `dailyGoalMinutes` hydrate(서버값 주입)·시딩(기본 PUT 포함) 검증 (기존 테스트 패턴 정합, Red).

### Implementation for User Story 2

- [X] T013 [P] [US2] `frontend/src/lib/todayGauge.ts` (신규): `gaugeFill(todayMs, goalMinutes)` = `min(todayMs/(goalMinutes*60000),1)` + `gaugeLabel(...)` 순수함수 (T011 Green).
- [X] T014 [US2] `frontend/src/stores/preferences.ts`: `dailyGoalMinutes: number` 필드 + 세터 + `PREFERENCE_DEFAULTS` 에 `60` 추가.
- [X] T015 [US2] `frontend/src/components/PreferencesSync.tsx`: `PreferencesSnapshot`/`toMap`(`String(dailyGoalMinutes)`)/hydrate 파싱(`Number(server.dailyGoalMinutes)` 허용값 검증 후 주입)/기본 시딩에 `dailyGoalMinutes` 포함 (T012 Green). 허용값 상수 `DAILY_GOALS = [30,60,90,120,180,240,300]` 추가.
- [X] T016 [P] [US2] `frontend/src/components/b/dashboard/BTodayGauge.tsx` (신규): 세로 원통(rounded pill, 아래→위 채움) + "오늘 {N}분 / 목표 {M}" + 100%↑ "목표 달성". 입력 prop = `todayMs`, `goalMinutes`. `'use client'`.
- [X] T017 [US2] `frontend/src/app/(main)/page.tsx`: `BTodayGauge` 배치(리듬 카드 옆/안), `todayMs = weeklyQuery.data.dayMs[todayIndex]`, `goalMinutes = usePreferences(...)` 전달.
- [X] T018 [US2] `frontend/src/app/(main)/settings/page.tsx`: "일일 작업 목표" select(30분/1시간/1시간30분/2시간/3시간/4시간/5시간 → 30/60/90/120/180/240/300) 추가, 기존 preferences 저장 경로 결선. `settings/page.test.tsx` 갱신.

**Checkpoint**: US1 + US2 독립 동작.

---

## Phase 5: User Story 3 - 인사 문학 인용구 회전 (Priority: P3)

**Goal**: 인사 부제 뒷문구를 퍼블릭 도메인 문학 인용구 무작위 회전으로 교체("안녕하세요."·날짜·저자 유지).

**Independent Test**: 홈 여러 번 열어 인용구 회전 + 날짜/"안녕하세요."/저자 항상 동반.

### Tests for User Story 3 (TDD)

- [X] T019 [P] [US3] `frontend/src/lib/literaryQuotes.test.ts` (신규): `pickRandom(list, rand)` rand 주입 결정성(특정 rand→특정 항목) + 빈 목록 시 폴백/안전 동작 (Red).

### Implementation for User Story 3

- [X] T020 [P] [US3] `frontend/src/lib/literaryQuotes.ts` (신규): `LiteraryQuote{text,author}` 큐레이션 20~40개(퍼블릭 도메인 — research R6 저자 한정, 외국=자체 한국어 번역/한국=원문) + `pickRandom` (T019 Green).
- [X] T021 [US3] `frontend/src/app/(main)/page.tsx`: 부제(64~66행)를 `{dateLabel} — {quote.text} … {quote.author}` 로 교체. `useState(() => pickRandom(...))` 마운트 1회 선택, 기존 `mounted` 가드 재사용(SSR 불일치 방지), 목록 빈 경우 기존 톤 기본 문구 폴백.

**Checkpoint**: US1+US2+US3 모두 독립 동작.

---

## Phase 6: Polish & Cross-Cutting

- [X] T022 프론트 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN(포어그라운드 — build 가 RSC 경계 검출).
- [ ] T023 dogfooding 검증(라이브, quickstart 게이트): 즉시 반영 / 오늘 강조 / 빈 안내 / 게이지(0·초과 무깨짐) / 목표 동기화 / 인용구 회전. **BE 배포(Phase 2) 선행 → FE 배포(`vercel --prod`) 후행** 순서 준수. OCI `WORK_SESSION_MIN_SECONDS` env 존재 시 사용자 영역 갱신 안내.
- [ ] T024 마무리: `docs/plan/02-progress.md` + vault `02-PROGRESS.md` 028 진척 반영(finish-work/sync-vault 스킬). (커밋·merge 는 사용자 요청 시)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작. T001 관찰이 US1 수정 범위 확정.
- **Foundational (Phase 2)**: 백엔드 — FE user story 배포의 전제(BE 선행). 코드상 US1/US3 FE 와 독립이나 **배포 순서상** 선행.
- **US1 (Phase 3)**: Phase 1 관찰 후. FE 단독(BE 배포와 무관하게 코드 작성 가능, 배포만 BE 후행 무관).
- **US2 (Phase 4)**: Phase 2(백엔드 키) 배포 후 FE 배포. 코드 작성은 병렬 가능하나 배포 게이트 존재.
- **US3 (Phase 5)**: Phase 1 후 독립.
- **Polish (Phase 6)**: 모든 원하는 story 완료 후.

### User Story Dependencies

- US1 / US2 / US3 상호 독립(각 단독 테스트·배포 가능). 공유 파일 `page.tsx` 는 phase 순차 편집(충돌 회피).

### Within Each User Story

- 테스트(Red) → 구현(Green). 순수함수/매핑/행위 우선.

### Parallel Opportunities

- T002(BE 테스트) 와 FE 작업은 다른 트리라 병렬 가능하나 배포 순서 유지.
- 각 story 의 [P] 테스트/신규 파일(todayGauge.ts, BTodayGauge.tsx, literaryQuotes.ts)은 병렬 작성 가능.
- `page.tsx`(T010/T017/T021)·`PreferencesSync.tsx`·`preferences.ts` 는 동일 파일군 → 비병렬.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1(관찰) → Phase 2(백엔드 GREEN·배포) → Phase 3(US1) → 즉시 반영·오늘 강조 dogfooding → 배포.

### Incremental Delivery

1. Setup + Foundational(BE 배포) → 기반.
2. US1 → 독립 검증 → 배포(MVP — 보고된 결함 해소).
3. US2 → 독립 검증 → 배포(게이지+목표).
4. US3 → 독립 검증 → 배포(인용구).

---

## Notes

- [P] = 다른 파일 + 의존 없음.
- 빈 막대 원인은 T001 관찰 전 단정 금지(HARD-GATE). 즉시 반영·임계 완화로 해결 안 되면 별도 트랙 보고.
- 배포 순서 BE→FE(설정 키). 로컬/운영 DB 쓰기 명령 없음(신규 키는 런타임 PUT 으로 행 생성).
- 커밋/merge 는 사용자 요청 시에만.
