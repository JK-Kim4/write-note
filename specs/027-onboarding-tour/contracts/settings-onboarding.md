# Contract: settings — onboardingCompleted 키

기존 `/api/settings` GET/PUT 을 그대로 재사용한다. 본 기능은 허용 키에 `onboardingCompleted`
를 추가하는 것이 전부이며, 엔드포인트 시그니처·envelope 변경은 없다.

## GET /api/settings

완료 여부 조회에 사용.

**Response** (성공, envelope `Result`):
```json
{
  "success": true,
  "data": { "settings": { "theme": "light", "onboardingCompleted": "true" } },
  "error": null
}
```
- `settings` 맵에 `onboardingCompleted` 키가 **있고 값이 `"true"`** → 완료(투어 미노출).
- 키가 **없으면** → 미완료(투어 노출 대상).
- (인증 필요 — 기존 보호 엔드포인트. 비로그인은 본 기능 진입 자체가 없음.)

## PUT /api/settings

완료/건너뛰기 시 저장에 사용.

**Request**:
```json
{ "settings": { "onboardingCompleted": "true" } }
```

**Response** (성공): 갱신 후 전체 settings 맵 반환(기존 동작).

**검증**:
- `onboardingCompleted` 는 `SettingsService.ALLOWED` 에 허용 키로 등록되어 있어야 한다(본 기능에서 추가).
- 값이 `"true"` 가 아니면 400 ValidationException(허용 value 집합 위반).

## 백엔드 변경 (단일)

`SettingsService` 의 `ALLOWED` 맵:
```kotlin
"onboardingCompleted" to setOf("true"),
```

## 계약 테스트 (백엔드)

- `PUT` `onboardingCompleted: "true"` → 200, 저장 후 GET 응답에 포함.
- `PUT` `onboardingCompleted: "false"` → 400 (허용 value 위반).
- (기존 settings 테스트 패턴 재사용 — 키 1개 케이스 추가.)
