# Data Model — 공유하기 (046)

PK = `BIGSERIAL`(Long). timestamptz. 기존 컨벤션(snake_case, `created_at` DEFAULT now()) 답습. 기존 테이블 변경 0.

## V27 — share_link, share_snapshot

### share_link
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | bigserial | PK | |
| token | text | UNIQUE, NOT NULL | 추측불가 base62 32자(URL 노출 값, 원문 저장) |
| target_type | text | NOT NULL, CHECK in ('work','series') | 공유 대상 종류 |
| target_id | bigint | NOT NULL | project.id 또는 category.id (앱레벨 검증, 진짜 FK 아님 — 다형) |
| owner_id | bigint | NOT NULL, FK→users.id | 링크 만든 작가(스냅샷 복호 키 주체) |
| is_active | boolean | NOT NULL DEFAULT true | revoke 시 false |
| created_at | timestamptz | NOT NULL DEFAULT now() | |

- 인덱스: `idx_share_link_token`(unique), `idx_share_link_owner`(owner_id, 목록 조회).

### share_snapshot  (공유된 작품의 동결 본문 = 공개 작품 목록 겸용)
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | bigserial | PK | |
| share_link_id | bigint | NOT NULL, FK→share_link.id ON DELETE CASCADE | 소속 링크 |
| project_id | bigint | NOT NULL, FK→projects.id ON DELETE SET NULL? | 스냅샷 대상 작품 |
| title_snapshot | text | NOT NULL | 공유 시점 작품 제목 |
| body_snapshot | text | NOT NULL | 공유 시점 본문 암호문(owner 키, documents.body ciphertext 복사) |
| created_at | timestamptz | NOT NULL DEFAULT now() | 동결 시각 |

- UNIQUE(share_link_id, project_id).
- `project_id` FK 처리: **대상 삭제 시 보존(FR-025)** 이므로 `ON DELETE` 로 행을 지우면 안 됨 → FK 를 `ON DELETE SET NULL`(project_id nullable) 로 두거나, FK 없이 앱레벨 훅(R-5)으로 link 비활성만. **선택**: project_id NOT NULL 유지 + projects FK 미설정(보드 다형 owner 선례) → 삭제 훅이 link 비활성, 스냅샷은 project_id 값 보존(작가 인박스 표시). title_snapshot 이 있어 작품 삭제 후에도 표시 가능.
  - 최종: `project_id bigint NOT NULL`(FK 제약 없음, 앱레벨 정합). 인덱스 `idx_share_snapshot_link`(share_link_id), `idx_share_snapshot_project`(project_id).

### 엔티티 (Kotlin, JPA)
- `ShareLink(id, token, targetType, targetId, ownerId, isActive, createdAt)` — `targetType` = enum 회피, String + 앱레벨 검증(또는 `@Enumerated` 미사용 literal).
- `ShareSnapshot(id, shareLinkId, projectId, titleSnapshot, bodySnapshot, createdAt)`.

## V28 — share_comment

### share_comment  (위치 지정, 작가 전용 비공개)
| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | bigserial | PK | |
| share_snapshot_id | bigint | NOT NULL, FK→share_snapshot.id ON DELETE CASCADE | 댓글이 달린 스냅샷(불변 본문) |
| project_id | bigint | NOT NULL | 작가 집계용(스냅샷의 작품, 비정규화) |
| author_id | bigint | NOT NULL, FK→users.id | 회원만 |
| anchor_block_index | int | NOT NULL, CHECK >= 0 | 스냅샷 PM JSON top-level 블록 인덱스 |
| anchor_start | int | NOT NULL, CHECK >= 0 | 문단 내 시작 문자 오프셋 |
| anchor_length | int | NOT NULL, CHECK >= 0 | 구간 길이(0 허용 = caret 위치) |
| content | text | NOT NULL | 댓글 본문(평문, R-3) |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | |

- 인덱스: `idx_share_comment_snapshot`(share_snapshot_id), `idx_share_comment_project`(project_id, 작가 인박스), `idx_share_comment_author`(author_id).
- 가시성은 스키마 아닌 **조회 레이어**에서 강제(R-3): 공개 read = `WHERE author_id = :requester`, 작가 인박스 = `WHERE project_id IN (작가 소유 작품)`.

### 엔티티
- `ShareComment(id, shareSnapshotId, projectId, authorId, anchorBlockIndex, anchorStart, anchorLength, content, createdAt, updatedAt)`.

## 관계 요약
- ShareLink 1—N ShareSnapshot (work 링크=1, series 링크=N). CASCADE: 링크 삭제 시 스냅샷 삭제(단 revoke 는 삭제 아닌 is_active=false).
- ShareSnapshot 1—N ShareComment. CASCADE.
- 대상(Project/Category) 삭제: FK 아닌 앱레벨 훅 → 관련 ShareLink.is_active=false, 스냅샷·댓글 보존.

## 검증 규칙 (서버)
- target_type ∈ {work, series}; work 면 target_id = 소유 project, series 면 소유 category(SHARE_TARGET_INVALID 400 / SHARE_FORBIDDEN 403).
- 공유 토큰 활성 검증: is_active=false 또는 미존재 → 동형 "볼 수 없음"(SHARE_LINK_NOT_FOUND/INACTIVE, 대상 존재 비노출).
- 앵커: anchor_block_index < 스냅샷 블록 수, anchor_start + anchor_length ≤ 해당 블록 텍스트 길이 → 아니면 COMMENT_ANCHOR_INVALID(400).
- 댓글 작성: principal != null(회원) + 링크 활성 → 아니면 401/410.
- 댓글 삭제: author_id == principal.userId → 아니면 COMMENT_FORBIDDEN(403).
- 작가 인박스: project 소유자 == principal.userId.
