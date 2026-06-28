# Contract — Comment API (위치 지정, 작가 전용 비공개)

가시성 = 작가 전용(R-3). 공개 read 는 요청자 본인 댓글만, 작가 인박스만 전체.

## 회원 — 댓글 작성/삭제

### POST /api/shared/{token}/works/{projectId}/comments  (permitAll 경로, 회원 필수)
- 인증: nullable principal → null 이면 401(COMMENT_UNAUTHENTICATED). 비로그인 차단(FR-017).
- req: `{ anchorBlockIndex: number, anchorStart: number, anchorLength: number, content: string }`
- 동작: 링크 활성 + 해당 스냅샷 검증 → 앵커 범위 검증(스냅샷 블록 길이 내) → 저장(author_id=principal.userId).
- res 200: `CommentResponse`
- err: COMMENT_UNAUTHENTICATED(401), SHARE_LINK_NOT_FOUND(404), SHARE_TARGET_NOT_FOUND(404), COMMENT_ANCHOR_INVALID(400)

### DELETE /api/share-comments/{id}  (authenticated)
- 동작: author_id == principal.userId 검증 → 삭제. 타인 댓글 불가.
- res 200: `{ deleted: true }`
- err: COMMENT_NOT_FOUND(404), COMMENT_FORBIDDEN(403)

## 작가 — 인박스 (authenticated)

### GET /api/projects/{projectId}/comments
- 인증: project 소유자 == principal.userId(SHARE_FORBIDDEN/COMMENT_FORBIDDEN 403).
- 동작: 그 작품의 모든 스냅샷에 달린 전체 댓글 반환(스냅샷=공유 인스턴스별 그룹핑 가능하도록 shareSnapshotId 동봉).
- res 200: `AuthorCommentResponse[]` (최근순, 작성자 표시명·위치·내용·스냅샷 ref)
- err: PROJECT_NOT_FOUND(404, 기존), COMMENT_FORBIDDEN(403)

## DTO
- `CommentResponse`: id, anchorBlockIndex, anchorStart, anchorLength, content, authorNickname, createdAt
- `AuthorCommentResponse`: id, shareSnapshotId, projectId, anchorBlockIndex, anchorStart, anchorLength, content, authorNickname, createdAt
  - authorNickname = users.nickname(036) 재사용.

## 가시성 검증 매트릭스 (IT 필수 — SC-009)
| 요청자 | GET shared work 의 comments | 작가 인박스 |
|---|---|---|
| 비로그인 | [] (빈) | 접근 불가(authenticated) |
| 회원 A(댓글 작성자) | A 의 댓글만 | 접근 불가(타 작품) |
| 회원 B(다른 열람자) | B 의 댓글만(A 것 안 보임) | 접근 불가 |
| 작가(글 주인) | (작가가 공개 페이지서 열람 시) 작가 자기 댓글만 | **전체**(A·B 모두) |
