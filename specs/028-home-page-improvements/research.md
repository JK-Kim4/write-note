# Research: 홈(메인) 페이지 개선 (028)

코드 정독으로 확정한 사실관계와 설계 결정. (NEEDS CLARIFICATION 없음 — 모든 결정 확정)

## R1. 집필 리듬 데이터 흐름 (US1)

**확정 사실** (`frontend/src/lib/query/useSessions.ts`, `frontend/src/lib/dashboardView.ts`, `backend/.../WorkSessionService.kt`):

- 리듬 막대 = 문서 저장이 아니라 **작업 세션(work_session)** 집계. `useWeeklyByDay`가 이번 주 요일별 `[from, to)` 범위로 `rangeTotal`을 7회 병렬 GET → 백엔드 `rangeTotalDurationMs`가 **종료된(ended) 세션만, `from ≤ startedAt < to`** 합산.
- 세션 종료는 집필실 라우트 이탈(`end`) / 탭 닫기(`endBeacon`) / `endWithLog`(`useWorkSession.ts`).
- 최소 인정 시간: `application.yml` `work-session.min-session-seconds: ${WORK_SESSION_MIN_SECONDS:15}` — **현재 effective 15초**(코드 `@Value(...:30)`의 30은 yml이 값을 주므로 미발동 fallback). 주석에 "2026-06-13 30→15 완화" 기록.

**Decision**: 즉시 반영은 (a) `useWorkSession`의 `end`/`endWithLog` 성공 후 `sessionKeys.all` 무효화 + (b) 홈 `useWeeklyByDay`에 `refetchOnMount: "always"`. 임계는 yml 기본값 15→10.

**Rationale**: 현재 세션 종료 어디에도 `sessionKeys` 무효화가 없고(grep 확인), QueryClient 기본 `staleTime: 60s` + `refetchOnWindowFocus: false`(`QueryProvider.tsx`)라 홈 복귀 60초 내면 stale 캐시를 그대로 서빙 → 안 바뀜. (a)는 종료 시점에 stale 표시, (b)는 홈 mount마다 강제 재요청으로 복귀 즉시 신선. 두 겹으로 "집필 직후 홈" 경로를 확실히 커버.

**Alternatives 기각**:
- 현재 열린 세션을 합계에 포함(오픈 세션 카운트) — 홈과 집필실이 동시 표시되지 않아 효용 낮고 백엔드 변경 필요. v1 제외.
- staleTime 전역 0 — 다른 화면 캐시 효용(집필실 재진입 지연 제거) 훼손. weekly 쿼리 한정 refetchOnMount만 조정.

**미확정 — 관찰로 확정(HARD-GATE)**: 화면의 막대가 **전부 0**인 근본 원인. fresh 로드라면 캐시가 아니라 "이번 주 ≥임계 종료 세션 부재"가 유력하나 **단정 금지**. 구현 1단계 = 라이브 관찰:
1. 작품에서 10초↑ 머문 뒤 홈 복귀 → 막대 생기나?
2. 라이브 `/api/work-sessions/total?from..to`(이번 주) 응답에 값이 있나?
- 값 있음 + 화면 빈 → 캐싱 갭(본 수정으로 해결).
- 값 없음 → 세션이 안 잡힘(종료 신호 유실/임계 미만/dangling). 10초 완화로 잡히는지 재확인, 그래도 빈약하면 종료 트리거(`pagehide`/unmount) 신뢰성을 별도 트랙으로 좁혀 보고.

## R2. 오늘 강조 + 빈 상태 (US1)

**확정**: `BRhythmCard`는 `todayIndex`를 받아 오늘 막대만 `bg-terracotta-600`(색)으로 구분. 날짜·"오늘" 텍스트 없음. `weekDayRanges(now)`가 `{from, to, isToday}` 7개 제공 → 날짜 라벨 파생 가능.

**Decision**: 오늘 열 라벨에 날짜(예: "토 6/20")와 "오늘" 표식을 굵게. 빈 상태(주간 합계 0)면 막대 영역에 "아직 이번 주 기록이 없어요" 안내.

**Rationale**: SC-002(설명 없이 오늘 식별). 색만으로는 약함(스크린샷에서 빈 막대뿐이라 오늘이 안 보임).

## R3. 오늘 작업시간 게이지 (US2)

**Decision**: 신규 데이터 fetch 0. `useWeeklyByDay().data.dayMs[todayIndex]`가 오늘 작업시간(ms). 게이지 채움 = `min(todayMs / goalMs, 1)`. 표시 = "오늘 {N}분 / 목표 {M}시간|분". 100%↑ "목표 달성".

**Rationale**: 기존 집계 재사용으로 비용 0(에이전트 규율 §9 — 표시값 출처 명시: 오늘 작업시간 = weekly 집계 파생, 목표 = 설정값). 순수함수 분리로 TDD.

**Alternatives 기각**: 별도 "오늘 총합" endpoint — 불필요(weekly에 이미 포함).

## R4. 일일 목표 설정 (US2)

**확정** (`backend/.../SettingsService.kt`, `frontend/src/components/PreferencesSync.tsx`, `frontend/src/lib/api/settings.ts`):

- `SettingsService.ALLOWED`는 **key → 허용 value 집합**(정확값 allowlist). 예: `manuscriptSize to setOf("200","400","1000")`. 항목 추가 = 한 줄.
- FE 동기화: 서버 SoT + Zustand persist(localStorage) 미러. `PreferencesSync`가 인증 후 hydrate(서버값 주입 or 로컬 시딩 PUT) + store 변경 디바운스 PUT. `toMap`이 전송 맵 구성(현재 theme/writingMode/manuscriptSize/paperSize).

**Decision**: 신규 키 `dailyGoalMinutes`, 허용값 `setOf("30","60","90","120","180","240","300")`, 기본 60.
- 백엔드: ALLOWED 1줄 추가(검증 로직 무변경 — 이산 집합이라 그대로 맞음).
- 프론트: `preferences.ts`에 `dailyGoalMinutes: number` + 세터 + `PREFERENCE_DEFAULTS` 60, `PreferencesSync`의 `PreferencesSnapshot`/`toMap`/hydrate 파싱에 추가, 설정 페이지 select 추가, 홈 게이지가 `usePreferences`에서 읽음.

**Rationale**: 기존 강한 allowlist 패턴(임의 문자열 적재 차단) 유지 → 이산 선택지가 정합. 숫자 범위 허용으로 `validate` 바꾸면 패턴 일탈 + 검증 약화.

**Alternatives 기각**:
- 자유 입력(임의 분) — allowlist 패턴 깨고 검증 로직 수정 필요. 이산 드롭다운으로 충분.
- 별도 설정 시스템/테이블 — 과설계. 기존 user_settings 재사용.

**배포 순서(HARD-GATE)**: BE 선행 필수. FE가 `dailyGoalMinutes` 포함 맵을 PUT하면 구 BE가 "Unknown setting key"로 **PUT 전체 400** → 설정 동기화 붕괴. (hydrate 시딩 PUT·디바운스 PUT 모두 전체 맵 전송이므로 부분 키만 깨지는 게 아니라 전부 실패.)

## R5. 인사 인용구 회전 (US3)

**확정**: `app/(main)/page.tsx` 63~66행. h1 "안녕하세요." + 부제 `{dateLabel} — 오늘도 곁에 있을게요.`. `mounted`(useSyncExternalStore) 가드로 SSR 하이드레이션 불일치 방지 중(서버=빈칸, 클라=날짜).

**Decision**: `frontend/src/lib/literaryQuotes.ts` 정적 배열 `ReadonlyArray<{ text: string; author: string }>` + `pickRandom(list, rand?)` 순수함수(rand 주입으로 테스트 결정성). 부제 = `{dateLabel} — {quote.text} … {quote.author}`. 인용구는 `useState(() => pickRandom(...))`로 마운트 1회 선택(방문/로드마다 새로). 기존 `mounted` 가드 재사용 → 서버/클라 불일치·하이드레이션 경고 방지(서버는 빈칸, 클라 mount 후 무작위 1개).

**Rationale**: 외부 네트워크 0, 저작권 안전(R6), 회전 주기 "방문마다"(승인). `Math.random`은 워크플로 스크립트가 아닌 런타임 클라이언트라 사용 가능(스크립트 제약과 무관).

**저작권(R6)**: 저자 사후 70년 경과 퍼블릭 도메인만 — 톨스토이†1910·도스토옙스키†1881·체호프†1904·카프카†1924·니체†1900·릴케†1926·윤동주†1945·이상†1937 등. 외국 작가는 자체 한국어 번역(특정 번역가 문장 복사 X), 한국 작가는 원문. 헤르만 헤세†1962 등 70년 미경과 작가는 제외.

## R7. 검증 전략

- **백엔드**: `SettingsServiceTest`에 `dailyGoalMinutes` 허용값 통과 / 비허용값(예: "45","abc") 거부(ValidationException) 행위 테스트(Red→Green).
- **프론트 순수함수**: `pickRandom`(rand 주입 결정성, 빈 목록 폴백), 게이지 채움(정상/0/초과/NaN 가드) — Vitest.
- **프론트 컴포넌트**: 오늘 강조 라벨·빈 상태 안내 렌더(RTL, 행위 기반 getByText). 게이지 표시 텍스트.
- **PreferencesSync**: dailyGoalMinutes hydrate/시딩 포함(기존 테스트 패턴 정합).
- **dogfooding(라이브)**: 집필 10초↑ 후 홈 즉시 반영 / 게이지 채움·목표 변경 동기화 / 인용구 회전 — §생성물 단위테스트 한계(렌더·라이브 동작은 dogfooding 게이트).
