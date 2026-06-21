# API Contract: Projects (031 layoutMode + 판형 확장)

**Feature**: 031-publish-layout-modes | **Date**: 2026-06-21

기존 `/api/projects` 계약에 `layoutMode` 1개 필드 추가 + `paperSize` 허용값 8종 확장. 기존 필드·경로 무변경.

## 1. POST /api/projects (작품 생성)

**Request (`CreateProjectRequest`)** — 기존 필드 + 추가:

```jsonc
{
  "title": "string (필수, ≤120)",
  "genre": "string? (≤100)",
  "targetLength": "int? (1..1e8)",
  "toneNotes": "string? (≤2000)",
  "synopsis": "string? (≤5000)",
  "worldNotes": "string? (≤10000)",
  "paperSize": "string? (≤8) — 미지정 시 'A4'. 허용 8종",
  "layoutMode": "string? — 미지정 시 'paper'. 허용 {paper, web}"  // ★ 추가
}
```

- **강제 선택**: 프론트는 `layoutMode` 미선택 시 생성 요청 자체를 보내지 않음(FR-001). 백엔드는 null 허용→'paper' 기본(기존 클라이언트 호환).
- **검증**: `layoutMode` ∉ {paper, web} → 400 `VALIDATION_FAILED`. `paperSize` ∉ 8종 → 400.

**Response 201 (`ProjectResponse`)** — 기존 필드 + `layoutMode: string` 추가.

## 2. PATCH /api/projects/{projectId} (작품 수정/모드 전환)

**Request (`UpdateProjectRequest`)** — 부분 갱신, 기존 필드 + 추가:

```jsonc
{
  "title": "string?", "genre": "string?", "targetLength": "int?",
  "toneNotes": "string?", "synopsis": "string?", "worldNotes": "string?",
  "nextScene": "string?",
  "paperSize": "string? — 허용 8종",
  "layoutMode": "string? — 허용 {paper, web}"  // ★ 추가 (모드 전환 경로)
}
```

- **모드 전환**: `{ "layoutMode": "web" }` 또는 `{ "layoutMode": "paper" }` 단독 PATCH. 본문·paperSize 불변(무손실).
- **판형 변경**: `{ "paperSize": "sinkukpan" }` 단독 PATCH(기존 BStudioShell handlePaperSizeChange 경로 재사용).

**Response 200 (`ProjectResponse`)** — `layoutMode` 포함.

## 3. ProjectResponse (공통 응답)

```jsonc
{
  "id": 1, "title": "...", "genre": null, "targetLength": null,
  "toneNotes": null, "synopsis": null, "worldNotes": null, "nextScene": "",
  "paperSize": "A4",          // 8종 중 하나
  "layoutMode": "paper",      // ★ 추가: paper | web
  "archivedAt": null, "createdAt": "...", "updatedAt": "..."
}
```

## 4. 허용값 매트릭스 (동기 의무 지점)

| 값 종류 | 허용값 | 강제 지점 |
|---|---|---|
| `layoutMode` | `paper`, `web` | DB CHECK(V17) + `ProjectService.ALLOWED_LAYOUT_MODES` + `SettingsService.ALLOWED`(전역 기본 추가 시) |
| `paperSize` | `A4`,`A3`,`A2`,`B4`,`sinkukpan`,`kukpan`,`pan46`,`mungopan` | DB CHECK(V18) + `ProjectService.ALLOWED_PAPER_SIZES` + `SettingsService.ALLOWED["paperSize"]` + 프론트 select 6곳 |

**HARD-GATE**: 위 매트릭스의 한 지점이라도 누락하면 정상 값이 거짓 거부(400/ValidationException)된다. 8종/2종 확장 시 모든 지점 grep 동기.

## 5. 에러 코드 (기존 매트릭스 재사용)

- 400 `VALIDATION_FAILED` — layoutMode/paperSize 비허용값, title 위반 등(기존). 신규 에러 코드 없음.
- 404 `PROJECT_NOT_FOUND` — 기존.
- 본 기능은 **신규 status/에러코드 도입 0** (client.ts status 분기 추가 불필요 → 409 오분류 회귀 위험 없음).
