# Data Model: 공유 사용성 개선 (Share UX)

Phase 1 — 신규 도메인 0. 기존 046 `share_comment` 에 `read_at` 1컬럼 추가 + 응답 DTO additive.

## 마이그레이션 V29 — share_comment.read_at

```sql
-- V29 — 공유 사용성 개선(047). 작가의 받은 피드백 읽음 관리.
-- read_at = 작가가 이 피드백을 확인한 시각(NULL=안 읽음). "받은 피드백 N" = read_at IS NULL 개수.
-- 읽음 처리 단위 = 작품(projectId): 작가가 그 작품 '피드백 보기'를 열면 그 작품의 안 읽은 댓글 전체 read_at 채움.
-- 기존 댓글은 NULL(안 읽음)로 시작 — 백필 없음(작가가 새로 모아 봄). additive nullable, 운영 무손실.
ALTER TABLE share_comment ADD COLUMN read_at TIMESTAMPTZ NULL;
-- 안 읽은 수 group 집계(작품별) 가속 — 부분 인덱스(안 읽은 행만).
CREATE INDEX idx_share_comment_unread ON share_comment (project_id) WHERE read_at IS NULL;
```

부분 인덱스(`WHERE read_at IS NULL`): 안 읽은 행만 색인 → "작품별 안 읽은 수" group-by 가속, 읽음 처리 후 행은 인덱스에서 빠짐.

## 엔티티 변경

### ShareComment (`entity/ShareComment.kt`)

- `read_at` 매핑 필드 추가(nullable):

```kotlin
@Column(name = "read_at")
var readAt: Instant? = null,
```

- `@PrePersist` 무변경(read_at 은 생성 시 NULL = 안 읽음).
- 기존 필드/제약 무변경.

## 응답 DTO 변경 (additive — 기존 호환)

### SharedWorkMeta (`model/response/ShareResponses.kt`)

```kotlin
data class SharedWorkMeta(
    val projectId: Long,
    val title: String,
    val unreadCommentCount: Int = 0,   // 추가 — 그 작품의 안 읽은 피드백 수(작가 listMine 에서만 실제 값)
)
```

- `listMine`(작가) 응답에서만 실제 값 채움. 공개 열람(`getPublicView`)의 `works` 는 기본 0(작가 비노출, 무해).
- 기본값 0 → 기존 직렬화/호출 호환.

### AuthorCommentResponse (`model/response/ShareResponses.kt`)

```kotlin
data class AuthorCommentResponse(
    ... 기존 필드 ...,
    val readAt: Instant? = null,       // 추가 — 작가 확인 시각(NULL=안 읽음). 인박스 안읽은 강조용
)
```

## 리포지토리 (`repository/ShareCommentRepository.kt`)

```kotlin
// 작품별 안 읽은 피드백 수(group-by 일괄, N+1 회피). [projectId, count] projection.
@Query(
    "SELECT c.projectId AS projectId, COUNT(c) AS unreadCount " +
        "FROM ShareComment c WHERE c.projectId IN :projectIds AND c.readAt IS NULL GROUP BY c.projectId",
)
fun countUnreadByProjectIds(projectIds: Collection<Long>): List<UnreadCountRow>

// 작품 단위 읽음 처리 — 그 작품의 안 읽은 댓글 read_at 채움(bulk). 반환=갱신 행 수.
@Modifying
@Query("UPDATE ShareComment c SET c.readAt = :now WHERE c.projectId = :projectId AND c.readAt IS NULL")
fun markReadByProjectId(projectId: Long, now: Instant): Int
```

`UnreadCountRow` = projection 인터페이스(`getProjectId(): Long`, `getUnreadCount(): Long`).

## 서비스 변경

### ShareCommentService

- `markReadForProject(userId, projectId)`: `projectRepository.findByIdAndUserId(projectId, userId)` 소유 검증(실패 → `COMMENT_FORBIDDEN`) → `markReadByProjectId(projectId, Instant.now())` → 처리 수 반환. `@Transactional(rollbackFor=[Exception::class])`.
- `listForAuthor`: `AuthorCommentResponse` 매핑에 `readAt = comment.readAt` 동봉.

### ShareService

- `listMine`: 스냅샷 projectId 들 모아 `countUnreadByProjectIds` 1쿼리 → `Map<projectId, count>` → 각 `SharedWorkMeta.unreadCommentCount` 채움.

## 상태 전이

```
share_comment.read_at:
  NULL (안 읽음, 생성 시 기본)
    └─[작가가 그 작품 '피드백 보기' 열기 → markReadForProject]→ Instant(읽음)
  Instant (읽음)
    └─[변경 없음 — 읽음 해제 없음. 새 피드백은 새 행으로 NULL 생성]
```

- 읽음 해제(다시 안 읽음) 기능 없음(YAGNI — spec 미요구).
- 새 피드백 도착 = 새 `share_comment` 행(read_at NULL) → 다시 안 읽은 수에 집계(FR-012, US3 AC4).

## 불변 사항(046 보존 — FR-015)

- `share_link`/`share_snapshot` 테이블·동작 무변경(1:N, 불변 스냅샷, 활성 링크만 공개).
- 공개 열람·회원 댓글 작성·작가 전용 가시성·대상 삭제 보존 무변경.
- `read_at` 은 작가 측 메타 — 공개 read(`getSharedWork`·`listMineForSharedWork`) 미노출.
