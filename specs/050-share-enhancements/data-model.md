# Phase 1 Data Model: 공유 페이지 고도화

실측 기준: 최신 마이그레이션 = V30. 신규 = **V31 · V32**. 기존 공유 엔티티/DTO는 additive 확장.

## 1. 신규 엔티티 — ShareReaction (V31)

테이블 `share_reaction` — 공유 스냅샷 구간에 대한 회원 이모지 반응(공개 집계).

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | BIGINT | PK, IDENTITY | |
| `share_snapshot_id` | BIGINT | NOT NULL, idx | 대상 스냅샷(불변 본문) |
| `anchor_block_index` | INT | NOT NULL | 앵커 문단 인덱스(스냅샷 평탄화 기준) |
| `anchor_start` | INT | NOT NULL | 문단 내 시작 오프셋 |
| `anchor_length` | INT | NOT NULL | 구간 길이 |
| `emoji` | VARCHAR | NOT NULL | 화이트리스트 5종 중 하나 |
| `reactor_id` | BIGINT | NOT NULL | 반응 남긴 회원(users) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

- **UNIQUE(`share_snapshot_id, anchor_block_index, anchor_start, anchor_length, emoji, reactor_id`)** — 회원·구간·이모지당 1개(토글의 멱등 근거).
- 인덱스: `idx_share_reaction_snapshot (share_snapshot_id)` — 집계 조회.
- 반응은 **공개**(가시성 제한 없음, 집계는 개수만). 삭제 = 토글 off.
- 대상(작품/시리즈) 삭제 시 스냅샷 보존 정책(046)과 정합 — 스냅샷 살아있으면 반응도 접근 가능. FK ON DELETE는 스냅샷 기준(046 CASCADE 정합, V31에서 `share_snapshot_id` FK CASCADE).

```kotlin
// entity/ShareReaction.kt (신규)
@Entity @Table(name = "share_reaction")
class ShareReaction(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(name = "share_snapshot_id", nullable = false) val shareSnapshotId: Long,
    @Column(name = "anchor_block_index", nullable = false) val anchorBlockIndex: Int,
    @Column(name = "anchor_start", nullable = false) val anchorStart: Int,
    @Column(name = "anchor_length", nullable = false) val anchorLength: Int,
    @Column(nullable = false) val emoji: String,
    @Column(name = "reactor_id", nullable = false) val reactorId: Long,
    @Column(name = "created_at", nullable = false, updatable = false) val createdAt: Instant? = null,
)
```

## 2. 변경 엔티티 — ShareComment 앵커 nullable (V32)

- `anchor_block_index / anchor_start / anchor_length`: `NOT NULL` → **nullable**. 엔티티 `Int` → `Int?`.
- **셋 다 null = 전체 의견(구간 미지정)**, 셋 다 값 = 구간 댓글. 섞임(부분 null) = 400.
- 기존 데이터(전부 non-null) 무손상(제약 완화 방향).
- `content`·가시성(작가 전용)·`readAt`·`projectId`·`shareSnapshotId`·`authorId` 불변.

```sql
-- V32__share_comment_anchor_nullable.sql
ALTER TABLE share_comment ALTER COLUMN anchor_block_index DROP NOT NULL;
ALTER TABLE share_comment ALTER COLUMN anchor_start       DROP NOT NULL;
ALTER TABLE share_comment ALTER COLUMN anchor_length      DROP NOT NULL;
```

## 3. DTO 변경 (model/request·response/ShareRequests·ShareResponses.kt)

**요청**
- `CreateCommentRequest`: 앵커 3필드 `Int` → `Int?`(nullable). content `@NotBlank @Size(max=2000)` 유지. (서버가 "셋 다 null=전체 / 셋 다 값=구간 / 섞임=400" 판정.)
- `CreateReactionRequest(anchorBlockIndex: Int, anchorStart: Int, anchorLength: Int, emoji: String)` — 신규. (반응은 항상 구간 앵커 필수, emoji 화이트리스트.)

**응답**
- `CommentResponse` / `AuthorCommentResponse`: 앵커 3필드 `Int` → `Int?`.
- `ReactionAggregate(anchorBlockIndex: Int, anchorStart: Int, anchorLength: Int, emoji: String, count: Int, mine: Boolean)` — 신규. `mine` = 요청자(회원)가 누른 것(비로그인=false).
- `SharedWorkResponse`: `reactions: List<ReactionAggregate> = emptyList()` 추가(공개 열람 응답 embed).
- `AuthorSnapshotFeedbackResponse(projectId: Long, title: String, bodyJson: String, comments: List<AuthorCommentResponse>, reactions: List<ReactionAggregate>)` — 신규(작가 맥락 뷰 단일 조회).

## 4. 에러코드 (error/ShareErrorCode.kt)

- 신규 **`REACTION_EMOJI_INVALID`(400)** 1개.
- 재사용: `COMMENT_UNAUTHENTICATED`(401, 반응·댓글 미회원) · `COMMENT_ANCHOR_INVALID`(400, 반응·구간댓글 앵커 오류) · `SHARE_FORBIDDEN`(403, 작가 피드백 뷰 비소유) · `SHARE_LINK_NOT_FOUND`(404) · `COMMENT_NOT_FOUND`(404).

## 5. 서비스 로직 (신규·변경)

> **신규 repo 메서드(명시)** — 현재 `ShareCommentRepository`엔 `findByShareSnapshotIdAndAuthorId`·`findByProjectIdInOrderByCreatedAtDesc`·`markReadByProjectId`만 있음(스냅샷 단위 전체 조회·읽음 없음). 아래 2개 **신규 추가**:
> - `findByShareSnapshotIdOrderByCreatedAtDesc(shareSnapshotId): List<ShareComment>` — 스냅샷 전체 댓글(작가 뷰용, authorId 무관).
> - `markReadByShareSnapshotId(shareSnapshotId, now): Int` — 스냅샷 스코프 읽음(projectId 단위 아님, D7).
> `ShareReactionRepository`(신규)엔 집계 group-by·본인 반응 조회·`deleteByShareSnapshotIdAndAnchor...AndEmojiAndReactorId` 포함.

- `ShareReactionService`(신규): 두 경로 — `add(token,projectId,req,reactorId)`(회원 필수, unique 멱등, 앵커 검증 AnchorValidator, emoji 화이트리스트) / `remove(token,projectId,anchor,emoji,reactorId)`(쿼리 파라미터로 받은 앵커+emoji, 본인 것만 삭제). `aggregate(snapshotId, viewerId?)`: `share_reaction` group-by (anchor,emoji)→count + `mine`(viewerId 매칭) — **N+1 회피 단일 그룹 쿼리**.
- `ShareCommentService.createComment`: 앵커 null 허용(전체 의견) — null이면 AnchorValidator skip, 값이면 검증(부분 null 400).
- `ShareService`(또는 신규) `authorSnapshotFeedback(linkId, projectId, ownerId)`: `share_link.findByIdAndOwnerId`(비소유 SHARE_FORBIDDEN) → 스냅샷 복호(BodyCipherService) + `findByShareSnapshotIdOrderByCreatedAtDesc`(전체 댓글) + reaction aggregate → `AuthorSnapshotFeedbackResponse`.
- `markReadBySnapshotId(linkId, projectId, ownerId)`(신규): 소유 검증 후 그 스냅샷 댓글 `read_at` 채움(스냅샷 스코프, D7).
- 공개 `getSharedWork`: 응답에 reaction aggregate(viewer=principal?.userId) 포함.

## 6. 마이그레이션 순서

1. **V31** `create_share_reaction` — 테이블 + unique + idx + FK(share_snapshot_id → share_snapshot ON DELETE CASCADE).
2. **V32** `share_comment_anchor_nullable` — 앵커 3컬럼 DROP NOT NULL.

배포 = BE 선행(V31·V32 적용) → FE 후행. **046/047(V27~V29)·048(V30)은 이미 운영 배포됨**(main `8c56b32`, prod Flyway V30 — 2026-07-01 검증). develop은 049(마이그레이션 0)만 앞섬. 따라서 050 배포 시 **신규 마이그레이션 = V31·V32만** 운영 첫 적용. (배포 전 `git log origin/main..origin/develop` 범위 재확인, 룰 §22.)

## 7. FE 데이터 계층 (lib/)

- `lib/api/share.ts`: `getAuthorFeedback(linkId, projectId)` · `addReaction(token,projectId,input)` · `removeReaction(token,projectId,input)` · `markSnapshotCommentsRead(linkId,projectId)` · `createComment` 앵커 optional(전체 의견 null). 타입 `ReactionAggregate`·`AuthorSnapshotFeedback` 추가, `CommentResponse`/`AuthorCommentResponse` 앵커 `number|null`.
- `lib/query/useShareReactions.ts`(신규): `useAddReaction`·`useRemoveReaction`(낙관적, aggregate 캐시 갱신) / `useShares.ts`: `useAuthorFeedback(linkId,projectId)` / `useShareComments.ts`: `useMarkSnapshotRead`.
- `lib/share/returnTo.ts`(신규 순수): `saveReturnTo(path)`·`consumeReturnTo(): string|null`(`/shared/` prefix 검증) — TDD 대상.
- `lib/share/reactionAggregate.ts`(신규 순수, 선택): 낙관적 토글 시 집계 갱신 헬퍼 — TDD.
