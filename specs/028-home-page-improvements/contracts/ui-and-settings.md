# Contracts: 설정 키 + 홈 UI (028)

신규 HTTP endpoint 없음 — 기존 `GET/PUT /api/settings` 재사용. 본 문서는 (1) 설정 키 계약, (2) 홈 UI 표시 계약을 박는다.

## 1. 설정 API 계약 (기존 endpoint, 키만 확장)

### `PUT /api/settings`
- 요청 본문: `{ "settings": { ...부분 키맵 } }` — 보낸 키만 upsert.
- **신규 허용 키**: `dailyGoalMinutes` ∈ `{"30","60","90","120","180","240","300"}`.
- 허용값 외 → `400 VALIDATION_ERROR` ("Invalid value for dailyGoalMinutes").
- 미등록 키 → `400 VALIDATION_ERROR` ("Unknown setting key: ...").
- **하위호환(HARD-GATE)**: FE는 `theme/writingMode/manuscriptSize/paperSize/dailyGoalMinutes`를 한 맵으로 PUT한다. 따라서 **BE가 `dailyGoalMinutes`를 ALLOWED에 먼저 가진 뒤** FE 배포(미선행 시 전체 PUT 400).

### `GET /api/settings`
- 응답: `{ "settings": { "dailyGoalMinutes": "90", ... } }` — 저장된 키만. `dailyGoalMinutes` 미저장이면 부재 → FE 기본 60 적용.

## 2. 홈 UI 표시 계약

### 인사 영역
- h1 `안녕하세요.` 유지.
- 부제: `{날짜 라벨} — {인용구 본문} … {저자}` (마운트 전/SSR은 빈칸 — 기존 mounted 가드).
- 매 로드 무작위 1개. 저자 항상 동반.

### 집필 리듬 카드 (`BRhythmCard`)
- 7개 요일 막대(월~일). 오늘 막대: 색 강조 + 라벨에 날짜("토 6/20") + "오늘" 표식.
- 주간 합계 0 → 막대 영역에 "아직 이번 주 기록이 없어요" 안내(빈 막대만 X).
- 데이터: `dayMs[7]`, `todayIndex`(기존 시그니처 유지 — 확장만).

### 오늘 작업시간 게이지 (`BTodayGauge`)
- 세로 원통(rounded pill, 아래→위 채움). 채움 = `min(오늘ms / (목표분*60000), 1)`.
- 라벨: "오늘 {N}분 / 목표 {M}". 100%↑ "목표 달성".
- 0분 → 빈 원통 + "오늘 0분"(정상). 입력: 오늘ms, 목표분.

### 설정 페이지 (`settings/page.tsx`)
- "일일 작업 목표" select: 30분/1시간/1시간 30분/2시간/3시간/4시간/5시간 (값 30/60/90/120/180/240/300).
- 변경 시 기존 preferences 저장 경로로 즉시 반영(낙관적) + 디바운스 PUT.

## 3. 백엔드 변경 계약

| 파일 | 변경 |
|---|---|
| `application.yml` | `work-session.min-session-seconds: ${WORK_SESSION_MIN_SECONDS:15}` → `:10` (기본값만; env override는 운영 영역) |
| `SettingsService.kt` | `ALLOWED`에 `"dailyGoalMinutes" to setOf("30","60","90","120","180","240","300")` 1줄 |
| `SettingsServiceTest.kt` | 허용값 통과 / 비허용값 거부 행위 테스트 |
