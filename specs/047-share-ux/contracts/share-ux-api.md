# API Contracts: 공유 사용성 개선 (Share UX)

Phase 1 — 신규 endpoint 1개 + 기존 응답 additive 2곳. 모든 변경은 기존 046 계약과 호환(additive).

공통: 인증 = 작가(`@AuthenticationPrincipal AuthenticatedPrincipal`, SecurityConfig 보호 경로). 응답 = `Result<T>` envelope. 신규 에러코드 0.

## 1. (신규) 작품 단위 받은 피드백 읽음 처리

```
POST /api/projects/{projectId}/comments/read
```

- **목적**: 작가가 그 작품의 "피드백 보기"를 열 때, 그 작품의 안 읽은 피드백 전체를 읽음 처리(read_at 채움).
- **인증**: 작가(로그인). 소유 작품만.
- **요청 본문**: 없음.
- **동작**: `projectRepository.findByIdAndUserId(projectId, userId)` 소유 검증 → `markReadByProjectId(projectId, now)` bulk update.
- **응답 200**:

```json
{ "success": true, "data": { "markedRead": 3 } }
```

`markedRead` = 이번에 안 읽음 → 읽음으로 바뀐 댓글 수(이미 다 읽었으면 0).

- **에러**:
  - `404`/`403` 미소유·미존재 작품 → `COMMENT_FORBIDDEN`(기존 코드, listForAuthor 와 동일 검증). 대상 존재 비노출 정책 유지.

응답 DTO: `MarkCommentsReadResponse(markedRead: Int)` 신규(작은 결과 DTO).

## 2. (기존, additive) 내 공유 링크 목록 — 안 읽은 수 동봉

```
GET /api/share-links/mine
```

- **변경**: 응답의 각 `snapshots[]`(`SharedWorkMeta`)에 `unreadCommentCount` 추가.

```json
{
  "success": true,
  "data": [
    {
      "id": 12, "token": "8kQ2…", "targetType": "work", "targetId": 7,
      "isActive": true, "shareUrl": "https://soseolbi.com/shared/8kQ2…",
      "createdAt": "2026-06-25T…",
      "snapshots": [
        { "projectId": 7, "title": "물의 기억", "unreadCommentCount": 3 }
      ]
    }
  ]
}
```

- `unreadCommentCount` = 그 작품(projectId)의 `read_at IS NULL` 댓글 수(작품 단위 집계 — 같은 작품이 여러 링크에 있으면 동일 값).
- FE: 작품/시리즈 진입점은 이 응답을 targetType/targetId 로 필터해 그 대상의 링크 목록을 구성. 관리 화면 "받은 피드백"은 작품 단위로 dedup·합산(순수 헬퍼 `shareGrouping`).
- 기존 필드 무변경 → 구 FE 호환.

## 3. (기존, additive) 작가 댓글 인박스 — 읽음 여부 동봉

```
GET /api/projects/{projectId}/comments
```

- **변경**: 각 `AuthorCommentResponse` 에 `readAt`(nullable) 추가.

```json
{
  "success": true,
  "data": [
    {
      "id": 88, "shareSnapshotId": 31, "projectId": 7,
      "anchorBlockIndex": 2, "anchorStart": 10, "anchorLength": 5,
      "content": "이 문장 좋아요", "authorNickname": "독자123",
      "createdAt": "2026-06-26T…", "readAt": null
    }
  ]
}
```

- `readAt` = 작가 확인 시각(NULL = 안 읽음). FE 인박스에서 안 읽은 항목 강조용.
- 기존 필드 무변경.

## FE 호출 흐름 (참고)

1. **작품/시리즈 공유 팝오버 열기**: `GET /share-links/mine` → targetType/targetId 필터 → 그 대상 링크 목록(0개면 "공유 링크 만들기"). 생성 = 기존 `POST /share-links`(046 무변경), 끄기 = 기존 `PATCH /share-links/{id}`.
2. **관리 화면(`/shares`)**: `GET /share-links/mine` 1콜 → (a) 받은 피드백 = unreadCommentCount>0 작품들, (b) 링크 목록 = 작품/시리즈별 그룹.
3. **피드백 보기 열기**: `GET /projects/{projectId}/comments`(인박스) + 즉시 `POST /projects/{projectId}/comments/read` → 읽음 처리 후 `share-links/mine` invalidate(안 읽은 수 갱신).

## 불변(046 무변경 — FR-015)

- `POST /share-links`, `PATCH /share-links/{id}`, `PUT /share-links/{id}/works`, `GET /shared/{token}`, `GET /shared/{token}/works/{projectId}`, `POST /shared/{token}/works/{projectId}/comments`, `DELETE /share-comments/{id}` — 전부 무변경.
- 공개 read 응답(`SharedWorkResponse.comments`)에 read_at 미노출(작가 측 메타).
