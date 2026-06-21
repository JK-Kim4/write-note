# Contract: 어드민 공지 CRUD

`/api/admin/announcements` — 단일 관리자만(AdminAuthorizationManager: `principal.email == ADMIN_EMAIL`). 비인증 401 / 비관리자 403. `Result<T>` envelope.

## GET /api/admin/announcements
공개/비공개 **전체** 공지 최신순 목록(어드민용). Query: `page`, `size`.

**200** — `data: PageResponse<AdminAnnouncementResponse>`
```json
{ "id": 12, "title": "...", "isPublished": true, "isPinned": false,
  "publishedAt": "2026-06-21T05:00:00Z", "createdAt": "...", "updatedAt": "..." }
```

## POST /api/admin/announcements
공지 작성.

**Request** — `{ "title": "...", "body": "...", "isPublished": false, "isPinned": false }`
- `title` `@NotBlank` 1..200, `body` `@NotBlank`. 빈 값 → 400 `VALIDATION_ERROR`(FR-006).
- `isPublished=true` 면 `publishedAt`=현재 시각 설정.

**201** — `data: AdminAnnouncementResponse`

## PUT /api/admin/announcements/{id}
공지 수정(제목·본문·공개/고정 토글 포함). 없음 → 404.

**Request** — `{ "title": "...", "body": "...", "isPublished": true, "isPinned": false }`
- `isPublished` false→true 전환 시 `publishedAt` null 이면 현재 시각 설정(FR-002).

**200** — `data: AdminAnnouncementResponse`

## DELETE /api/admin/announcements/{id}
공지 삭제(행 제거). 없음 → 404.

**204** (또는 `Result.success(null)`)

## 인가 검증(공통, FR-015/016 / SC-005)
- 비인증 → 401 `AUTH_TOKEN_MISSING`
- 관리자 아님 → 403 `FORBIDDEN`(운영 데이터 미노출)
- 관리자 → 정상
