# Contract — Share API (링크 · 스냅샷 · 공개 읽기)

모든 응답 = `Result<T>` envelope. 작가 endpoint = authenticated(`@AuthenticationPrincipal AuthenticatedPrincipal`). 공개 endpoint = permitAll + nullable principal.

## 작가 — 링크 관리 (authenticated)

### POST /api/share-links
- req: `{ targetType: "work"|"series", targetId: number }`
- 동작: 소유검증 → work 면 즉시 스냅샷 동결(그 시점 본문 ciphertext 복사). series 면 링크만 생성(공개작품은 PUT 으로).
- res 200: `ShareLinkResponse { id, token, targetType, targetId, isActive, shareUrl, createdAt, snapshots: SharedWorkMeta[] }`
- err: SHARE_TARGET_INVALID(400), SHARE_FORBIDDEN(403), SHARE_TARGET_NOT_FOUND(404)

### PATCH /api/share-links/{id}
- req: `{ isActive: false }` (revoke)
- res 200: `ShareLinkResponse`
- err: SHARE_LINK_NOT_FOUND(404), SHARE_FORBIDDEN(403)

### PUT /api/share-links/{id}/works  (series 전용)
- req: `{ projectIds: number[] }` — 공개 작품 목록 설정
- 동작: 추가분 그 시점 스냅샷 동결, 제거분 스냅샷 삭제. 소유·시리즈 소속 검증.
- res 200: `ShareLinkResponse`
- err: SHARE_LINK_NOT_FOUND(404), SHARE_FORBIDDEN(403), SHARE_TARGET_INVALID(400)

### GET /api/share-links/mine
- res 200: `ShareLinkResponse[]` (최근순, N+1 회피 일괄 조회)

## 공개 — 열람 (permitAll, nullable principal)

### GET /api/shared/{token}
- 동작: 토큰 활성 검증. 비활성/미존재 → 동형 404 안내(대상 존재 비노출).
- res 200: `SharedViewResponse { targetType, title, works: SharedWorkMeta[] }`
  - work 링크: works = [단일]. series 링크: works = 공개 작품 목록(스냅샷들).
  - `SharedWorkMeta { projectId, title }` (본문 미포함 — 목록용)
- err: SHARE_LINK_NOT_FOUND(404, 비활성 포함 동형)

### GET /api/shared/{token}/works/{projectId}
- 동작: 토큰 활성 + 해당 스냅샷 존재 검증 → 스냅샷 owner 키 서버측 복호 → 평문 PM JSON 반환. 요청자가 회원이면 **자기 댓글만** 동봉(R-3).
- res 200: `SharedWorkResponse { projectId, title, bodyJson, comments: CommentResponse[] }`
  - `comments` = 요청자 본인 것만(비로그인이면 빈 배열).
- err: SHARE_LINK_NOT_FOUND(404), SHARE_TARGET_NOT_FOUND(404)

## DTO
- `ShareLinkResponse`: id, token, targetType, targetId, isActive, shareUrl(파생: `https://soseolbi.com/shared/{token}`), createdAt, snapshots(SharedWorkMeta[])
- `SharedWorkMeta`: projectId, title
- `SharedViewResponse`: targetType, title(작품명 또는 시리즈명), works(SharedWorkMeta[])
- `SharedWorkResponse`: projectId, title, bodyJson(평문 PM JSON), comments(CommentResponse[])
