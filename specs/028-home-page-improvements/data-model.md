# Data Model: 홈(메인) 페이지 개선 (028)

신규 테이블·마이그레이션 없음. 신규 엔티티는 (1) 설정 키 1개, (2) 정적 인용구 항목, (3) 파생 표시값.

## 1. 일일 작업 목표 — `dailyGoalMinutes`

기존 `user_settings`(key-value) 테이블에 **신규 키**로 적재. 스키마 변경 0(행 추가).

| 속성 | 값 |
|---|---|
| 설정 key | `dailyGoalMinutes` |
| 허용 value (백엔드 ALLOWED) | `"30","60","90","120","180","240","300"` (문자열 분 단위) |
| 기본값(미설정 시) | `60` (1시간) |
| 영속 | 서버 SoT(user_settings) + localStorage 미러(Zustand persist) |
| 동기화 | `PreferencesSync` hydrate/디바운스 PUT (기존 theme 등과 동일 경로) |

**프론트 표현**: `preferences` store에 `dailyGoalMinutes: number`(60 등). 서버 전송 시 `String(n)`로 직렬화(기존 `manuscriptSize` 패턴 정합). hydrate 시 `Number(server.dailyGoalMinutes)`가 허용 집합에 포함될 때만 주입.

**검증 규칙**: 백엔드 `SettingsService.validate`가 허용 집합 외 값 거부(ValidationException → 400 `VALIDATION_ERROR`). 프론트는 select라 허용값만 발생.

## 2. 문학 인용구 — `LiteraryQuote`

repo 내장 정적 데이터(`frontend/src/lib/literaryQuotes.ts`). DB·네트워크 비의존.

```ts
type LiteraryQuote = {
    text: string;    // 인용 본문 (한국어)
    author: string;  // 저자 표기 (예: "안톤 체호프")
};
```

| 규칙 | 내용 |
|---|---|
| 규모 | 20~40개 |
| 저작권 | 저자 사후 70년 경과 퍼블릭 도메인만. 외국=자체 한국어 번역, 한국=원문 (research R6) |
| 선택 | `pickRandom(list, rand=Math.random)` — 인덱스 `Math.floor(rand()*len)`. 빈 목록이면 폴백 사용처에서 기본 문구 |

## 3. 파생 표시값 (저장 안 함 — 계산)

에이전트 규율 §9(표시값 출처 명시):

| 표시 요소 | 출처 | 계산 |
|---|---|---|
| 리듬 막대(요일별) | `useWeeklyByDay().data.dayMs[0..6]` (기존 work_session 집계) | `barScale`(기존) |
| 오늘 막대 강조/날짜 | `weekDayRanges(now)` 의 `isToday` + `from` 날짜 | `todayIndex`, "토 6/20" 포맷 |
| 빈 상태 여부 | `dayMs` 합계 === 0 | — |
| 오늘 작업시간 | `dayMs[todayIndex]` (ms) | 분 환산 |
| 게이지 채움 | 오늘 작업시간 ÷ 목표 | `min(todayMs / (goalMin*60000), 1)` |
| 게이지 라벨 | 오늘 작업시간 + 목표 | "오늘 {N}분 / 목표 {M}" + 100%↑ "목표 달성" |
| 인사 부제 | 날짜(기존) + 무작위 인용구 | `{dateLabel} — {quote.text} … {quote.author}` |

**불변식**:
- `goalMin`은 항상 허용 집합 값(미설정 시 60) → 0 division 불가.
- `todayMs` 결측/undefined(쿼리 로딩 중)면 게이지는 0%·"오늘 0분"으로 안전 표시(NaN 금지, SC-006).
- `todayIndex`가 -1(이론상)일 일 없음 — `weekDayRanges`가 오늘을 항상 포함.
