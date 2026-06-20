# Phase 1 Data Model: 온보딩 가이드 투어

신규 테이블 없음. 기존 `user_settings`(사용자별 key-value)에 키 1개를 추가한다.

## 설정 키: onboardingCompleted

| 속성 | 값 |
|---|---|
| 저장소 | `user_settings` (복합 PK: `userId` + `settingKey`) |
| settingKey | `"onboardingCompleted"` |
| 허용 value | `"true"` (단일) |
| 미저장 시 의미 | 미완료 (가이드를 아직 안 봄) → 투어 노출 대상 |
| 저장 시점 | 가이드 완료(마지막 "시작하기") 또는 건너뛰기(close/ESC/배경) 시 |
| 상태 전이 | (없음/미저장) ──[완료·건너뛰기]──▶ `"true"` (단방향, v1 에선 되돌림 없음) |

### 검증 규칙 (백엔드)

- `SettingsService.ALLOWED` 에 `"onboardingCompleted" to setOf("true")` 추가.
- `"true"` 외 value(예: `"false"`) → `ValidationException("Invalid value")` 로 거부.
- 미등록 key 였다면 `ValidationException("Unknown setting key")` → 추가로 해소.

### 읽기/쓰기 흐름

- **읽기**: `GET /api/settings` 응답 `settings` 맵에 `onboardingCompleted` 키 존재 여부로 완료 판정.
  - 키 부재 → 미완료 → 투어 시작 대상.
  - `"true"` → 완료 → 투어 미노출.
- **쓰기**: `PUT /api/settings { settings: { onboardingCompleted: "true" } }` (부분 upsert, 다른 키 영향 없음).

## v1 범위 밖

- "다시 보기"용 값 되돌림(`onboardingCompleted` 삭제/`false`)은 미구현(YAGNI). 추후 키 인프라로 손쉽게 추가 가능.
