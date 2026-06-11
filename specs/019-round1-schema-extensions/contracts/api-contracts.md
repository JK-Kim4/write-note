# API Contracts: Round 1 스키마 확장 기능

**Date**: 2026-06-11 · 응답 envelope = 기존 `Result<T>`(success/error) 패턴. 인증 = JWT principal(`@AuthenticationPrincipal`). 에러 코드는 기존 매트릭스(`docs/plan/03-backend-requirements.md`) 재사용 — 신규 에러 코드·신규 HTTP status 분기 없음(공용 `client.ts` status 분기 룰 비저촉).

---

## US1 — 곁쪽지 삭제/복원

### `DELETE /api/memos/{id}` (기존 — hard→soft 전환, 계약 유지)

기존 시그니처·응답 코드 **변경 없음**. 동작만 hard delete → soft delete(`deleted_at = now()`).

| 항목 | 값 |
|---|---|
| 성공 | `204 No Content` (body 없음) |
| 멱등 | 이미 삭제된 메모도 `204` (no-op) |
| 404 | `RESOURCE_NOT_FOUND` — 미존재 / 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` |

Swagger `@Operation` description 갱신: "영구 삭제" → "버리기(soft-delete) — 연결 보존, 복원 가능".

### `POST /api/memos/{id}/restore` (신규)

```
POST /api/memos/{id}/restore
Authorization: Bearer <jwt>
(body 없음)
```

| 항목 | 값 |
|---|---|
| 성공 | `200 OK` → `Result<MemoResponse>` (복원된 메모 + 복귀한 연결) |
| 멱등 | 미삭제 메모도 `200` (no-op, 현재 상태 반환) |
| 404 | `RESOURCE_NOT_FOUND` — 미존재 / 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` |

**구현 위치**: `MemoController` 에 `@PostMapping("/{id}/restore")` 추가 → `MemoEditService.restoreMemo(userId, memoId)` 신설. `restoreMemo` 는 `findByIdAndUserId`(deleted 포함)로 조회 후 `deleted_at = null` 저장, `buildResponse` 재사용.

### 목록/단건 쿼리 필터 (계약 외 — 내부 동작)

research D1 표의 7개 쿼리에 deleted 제외 필터. FE adapter(`memos.ts`)·API 클라이언트 계약은 **변경 없음** — 동일 endpoint 가 deleted 제외 목록을 반환.

### FE adapter (`webElectronApi.memos`)

```ts
// 신규 — memos.ts 보류 주석(12-13행) 해소
delete: (memoId: number) => Promise<void>          // → deleteMemo(memoId)  (lib/api/memo.ts:107 기존)
restore: (memoId: number) => Promise<void>         // → restoreMemo(memoId) (신규 lib/api/memo.ts)
```

---

## US2 — 설정 서버 영속

### `GET /api/settings` (신규)

```
GET /api/settings
Authorization: Bearer <jwt>
```

| 항목 | 값 |
|---|---|
| 성공 | `200 OK` → `Result<SettingsResponse>` |

```jsonc
// SettingsResponse — 저장된 key 만 포함(미저장 key 는 키 자체 부재)
{ "settings": { "theme": "dark", "writingMode": "editor", "manuscriptSize": "400" } }
```

### `PUT /api/settings` (신규)

```
PUT /api/settings
Authorization: Bearer <jwt>
Content-Type: application/json

{ "settings": { "theme": "dark" } }   // 부분 맵 — 보낸 key 만 upsert(per-key last-write-wins)
```

| 항목 | 값 |
|---|---|
| 성공 | `200 OK` → `Result<SettingsResponse>` (갱신 후 전체 맵) |
| 400 | `VALIDATION_FAILED` — 허용 외 key 또는 값(data-model §2 allowlist) |
| 401 | `AUTH_TOKEN_*` |

**검증**: `theme ∈ {light,dark,system}`, `writingMode ∈ {manuscript,editor}`, `manuscriptSize ∈ {200,400,1000}`. 허용 key allowlist 밖이면 거부.

### FE 동기화 (`lib/api/settings.ts` 신규 + `PreferencesSync` 컴포넌트)

- `fetchSettings(): Promise<SettingsResponse>` / `putSettings(partial): Promise<SettingsResponse>`
- `PreferencesSync`(client): 인증 확정 후 1회 `fetchSettings` → store 주입(없으면 현재 로컬값 시딩 PUT). store 변경 구독 → 디바운스 `putSettings`.
- `layout.tsx` FOUC 스크립트·기존 store 소비자 **무변경**.

---

## US3 — 등장인물 확장

기존 6 endpoint(`/api/projects/{projectId}/characters` 하위) 계약 유지 — **요청/응답 DTO 에 필드 3개만 추가**.

### `CreateCharacterRequest` / `UpdateCharacterRequest` (확장)

```kotlin
// 추가 필드 (둘 다)
val age: String? = null,        // @field:Size(max = 80)
val gender: String? = null,     // @field:Pattern(regexp = "MALE|FEMALE|OTHER") 또는 서비스 검증
val traits: String? = null,     // @field:Size(max = 10_000)
```

`gender` 허용값: `MALE` | `FEMALE` | `OTHER` | null. 허용 외 → `400 VALIDATION_FAILED`.

### `CharacterResponse` (확장)

```kotlin
// 기존 필드 + 추가
val age: String?,
val gender: String?,    // MALE|FEMALE|OTHER|null
val traits: String?,
```

### FE (`CharacterForm` + `lib/api/characters` 타입)

- `CreateCharacterInput` 에 `age?`/`gender?`/`traits?` 추가
- `CharacterForm`: 나이(`FormInput`) + 성별(드롭다운: 비움/남/여/기타 ↔ null/MALE/FEMALE/OTHER) + 특징(`FormTextarea`)
- 표시 매핑: `MALE`→"남", `FEMALE`→"여", `OTHER`→"기타", `null`→미표시

### Rail 등장인물 메뉴 (`Rail.tsx`)

Item 배열에 추가: `label:"등장인물"`, 클릭 시 `getLastProject()` → `/projects/{id}/characters`, 없으면 `/library`. `match: (p) => p.includes("/characters")`.
