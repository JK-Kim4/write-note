# API Contracts: 공유 페이지 고도화

기존 046/047 엔드포인트는 무변경(additive). 아래는 **신규 3 + 변경 2**. 모든 응답은 프로젝트 `Result<T>` envelope. 경로 실측 정합(`/api/shared/**`=optional auth, `/api/share-links/**`·`/api/projects/**`=필수 auth).

## 신규

### N1. GET /api/share-links/{linkId}/works/{projectId}/feedback  — 작가 맥락 뷰 (US1)
- **Auth**: 필수. `share_link.owner_id == principal.userId` 아니면 **403 SHARE_FORBIDDEN**.
- **동작**: 그 링크의 `(projectId)` 스냅샷 본문 복호 + 그 스냅샷 **전체 댓글**(작가 권한) + 반응 집계. 비활성(off) 링크도 열람 가능.
- **200** `AuthorSnapshotFeedbackResponse`:
  ```json
  { "projectId": 12, "title": "별빛 연대기 2화", "bodyJson": "<PM JSON>",
    "comments": [ { "id": 5, "shareSnapshotId": 8, "projectId": 12,
      "anchorBlockIndex": 1, "anchorStart": 0, "anchorLength": 20,
      "content": "여운이 남아요", "authorNickname": "물푸레나무",
      "createdAt": "2026-06-28T...", "readAt": null } ],
    "reactions": [ { "anchorBlockIndex": 0, "anchorStart": 3, "anchorLength": 12,
      "emoji": "❤️", "count": 3, "mine": false } ] }
  ```
  - 전체 의견(구간 미지정) 댓글은 앵커 3필드 `null`.
- **404** SHARE_LINK_NOT_FOUND(링크/스냅샷 없음).

### N2. POST /api/shared/{token}/works/{projectId}/reactions  — 반응 추가 (US3)
- **Auth**: optional. 비회원(principal null) → **401 COMMENT_UNAUTHENTICATED**.
- **Body** `CreateReactionRequest`: `{ "anchorBlockIndex": 0, "anchorStart": 3, "anchorLength": 12, "emoji": "❤️" }`
- **검증**: emoji ∈ 화이트리스트(아니면 **400 REACTION_EMOJI_INVALID**) · 앵커 = AnchorValidator(스냅샷) 실패 시 **400 COMMENT_ANCHOR_INVALID**.
- **동작**: `(snapshot, anchor, emoji, reactor)` unique — 이미 있으면 멱등(무해). 링크 비활성/없음 → 404 SHARE_LINK_NOT_FOUND.
- **200** 갱신된 그 구간 `ReactionAggregate`(또는 해당 emoji 집계).

### N3. DELETE /api/shared/{token}/works/{projectId}/reactions  — 반응 제거(토글 off) (US3)
- **Auth**: optional. 비회원 → 401 COMMENT_UNAUTHENTICATED.
- **쿼리 파라미터**(body 없음 — 프록시 스멜 회피, research D3): `?blockIndex={n}&start={n}&length={n}&emoji={urlencoded}`. 요청자 본인 반응만 삭제.
- **200** 갱신된 `ReactionAggregate`(없으면 count 0).

### N4. POST /api/share-links/{linkId}/works/{projectId}/comments/read  — 스냅샷 스코프 읽음 (US1, D7)
- **Auth**: 필수. 비소유 403 SHARE_FORBIDDEN.
- **동작**: 그 스냅샷 안읽은 댓글 `read_at` 채움(그 링크 범위만 — projectId 전체 아님).
- **200** `MarkCommentsReadResponse { markedRead: N }`.

## 변경(additive)

### C1. GET /api/shared/{token}/works/{projectId}  — 공개 열람 (반응 집계 embed)
- 응답 `SharedWorkResponse`에 `reactions: ReactionAggregate[]` **추가**(기존 `projectId·title·bodyJson·comments` 무변경). `mine`은 principal 회원이면 본인 반응 반영, 비로그인 false.
- 하위호환: 기존 필드 유지 → 구 FE 무손상.

### C2. POST /api/shared/{token}/works/{projectId}/comments  — 전체 의견 지원 (앵커 optional)
- `CreateCommentRequest` 앵커 3필드 **optional(nullable)**. 규칙: 셋 다 null=전체 의견 / 셋 다 값=구간 댓글 / 부분 null=**400 COMMENT_ANCHOR_INVALID**.
- 응답 `CommentResponse` 앵커 `number|null`.
- 하위호환: 기존 구간 댓글(앵커 3값) 그대로 동작.

## FE 계약(lib/api/share.ts 추가 함수)
- `getAuthorFeedback(linkId, projectId): Promise<AuthorSnapshotFeedback>` → N1
- `addReaction(token, projectId, input): Promise<ReactionAggregate>` → N2
- `removeReaction(token, projectId, input): Promise<ReactionAggregate>` → N3
- `markSnapshotCommentsRead(linkId, projectId): Promise<{markedRead:number}>` → N4
- `createComment(token, projectId, input)` — `input.anchor*` optional(전체 의견 시 미포함) → C2
- 타입: `ReactionAggregate{anchorBlockIndex,anchorStart,anchorLength,emoji,count,mine}` · `AuthorSnapshotFeedback{projectId,title,bodyJson,comments,reactions}` · `CommentResponse.anchor* : number|null`.

## client.ts 에러 분기
- 신규 status 분기 없음(REACTION_EMOJI_INVALID·COMMENT_ANCHOR_INVALID = 기존 400 흐름 `ApiError(code)` 그대로). 409/401 신규 없음 → 룰(§client.ts 409 매트릭스) 회귀 위험 0.
