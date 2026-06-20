# Quickstart: 홈(메인) 페이지 개선 (028)

구현 순서·검증·dogfooding. 작업 브랜치 = `develop` 직접.

## 구현 순서 (의존 + 배포순서 반영)

### 0단계 — 빈 막대 원인 라이브 관찰 (US1 선행, 추측 금지 HARD-GATE)
1. 작품에 들어가 10초↑ 머문 뒤 홈 복귀 → 막대 생기나 관찰.
2. 라이브 `/api/work-sessions/total?from..to`(이번 주) 응답 직접 확인.
3. 분기 기록(research R1): 값 있음→캐싱 갭 / 값 없음→세션 미기록(종료신호·임계·dangling). **이 관찰 결과를 plan/회고에 박은 뒤** 1단계로.

### 1단계 — 백엔드 (BE 선행 배포 대상)
- `SettingsService.ALLOWED`에 `dailyGoalMinutes` 1줄 (TDD: `SettingsServiceTest` Red→Green: 허용값 통과 / "45"·"abc" 거부).
- `application.yml` 임계 15→10 (설정 파일, §5-5 완화).
- 게이트: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`.
- **BE 배포 먼저** (FE의 dailyGoalMinutes PUT을 받을 수 있게).

### 2단계 — 프론트 US1 (즉시 반영 + 오늘 강조 + 빈 상태)
- `useWorkSession`: `end`/`endWithLog` 성공 후 `queryClient.invalidateQueries({ queryKey: sessionKeys.all })`.
- `useSessions.useWeeklyByDay`: `refetchOnMount: "always"`.
- `BRhythmCard`: 오늘 날짜+"오늘" 강조, 주간합계 0 빈 상태 안내 (RTL 행위 테스트).

### 3단계 — 프론트 US2 (게이지 + 일일 목표)
- `lib/todayGauge.ts`: 채움/표시 순수함수 (Vitest: 정상/0/초과/NaN 가드 Red→Green).
- `stores/preferences.ts`: `dailyGoalMinutes` 필드+세터+기본60.
- `PreferencesSync`: `PreferencesSnapshot`/`toMap`/hydrate 파싱에 dailyGoalMinutes 추가 (기존 테스트 정합 유지).
- `BTodayGauge.tsx` 신규 + 홈 배치.
- `settings/page.tsx`: 일일 목표 select 추가.

### 4단계 — 프론트 US3 (인용구)
- `lib/literaryQuotes.ts`: 큐레이션 20~40개 + `pickRandom` (Vitest: rand 주입 결정성, 빈목록 폴백).
- `page.tsx`: 부제 인용구 결선 (mounted 가드 재사용).

### 5단계 — 검증 + 배포
- `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` (build = RSC 경계 검출).
- **FE 배포는 BE 배포 후** (`vercel --prod` 수동). 운영 OCI `WORK_SESSION_MIN_SECONDS` env 존재 시 임계 적용 위해 사용자 영역 갱신 필요.

## dogfooding 게이트 (라이브)
- [ ] 집필 10초↑ 후 홈 복귀 → 작업시간 즉시 반영 (US1, SC-001).
- [ ] 오늘 막대가 날짜와 함께 "오늘"로 명확 식별 (US1, SC-002).
- [ ] 이번 주 기록 0 → 빈 상태 안내 (US1).
- [ ] 게이지가 오늘/목표 비율로 채워짐, 0분·초과 안 깨짐 (US2, SC-003/006).
- [ ] 설정에서 목표 변경 → 다른 세션 홈에 동기화 (US2, SC-004).
- [ ] 홈 재방문 시 인용구 회전, 날짜·저자 동반 (US3, SC-005).

## 주의 (HARD-GATE 재확인)
- 배포 순서 BE→FE (설정 키). FE 선행 시 설정 PUT 전체 400.
- 빈 막대 원인은 0단계 관찰 전 단정 금지. 즉시 반영·임계 완화로 해결 안 되면 별도 트랙 보고.
- 로컬/운영 DB 쓰기 명령(migrate 등) 없음 — 신규 키는 런타임 PUT으로 행 생성.
