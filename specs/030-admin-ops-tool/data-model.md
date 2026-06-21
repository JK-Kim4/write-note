# Phase 1 Data Model: 운영 툴 (Admin Ops Tool) v1

## 신규 엔티티: Announcement (공지)

기존 `Character.kt` 패턴 따름 — `@Entity`, `@GeneratedValue(IDENTITY)`, `@PrePersist`/`@PreUpdate` 시각 관리, FK 없음(독립 테이블).

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | Long | PK, IDENTITY | 공지 식별자 |
| `title` | String | NOT NULL, 1..200 | 공지 제목 |
| `body` | String (TEXT) | NOT NULL, 1..* | 공지 본문(일반 텍스트, 줄바꿈 허용) |
| `isPublished` | Boolean | NOT NULL, default false | 공개 여부(false=사용자 비노출) |
| `isPinned` | Boolean | NOT NULL, default false | 배너 고정 여부(배너 우선 노출) |
| `publishedAt` | Instant? | nullable | 공개 시각(정렬·표시용) |
| `createdAt` | Instant | NOT NULL, @PrePersist | 생성 시각 |
| `updatedAt` | Instant | NOT NULL, @PreUpdate | 수정 시각 |

### 유효성 규칙
- `title`, `body` 비어 있으면 발행 거부(FR-006) — DTO `@NotBlank` + 서비스 검증.
- `isPublished=true` 로 전환 시 `publishedAt` 이 null 이면 현재 시각으로 설정(또는 발행 시점 기록).
- `isPublished=false` 면 공개 조회(`GET /api/announcements`)에서 제외(FR-003).

### 상태 전이
```
[작성: isPublished=false] --발행--> [공개: isPublished=true, publishedAt 설정]
[공개] --비공개 전환--> [숨김: isPublished=false]   (사용자 화면에서 사라짐, FR-002/004)
[any] --삭제--> (행 제거)
```

### Flyway 마이그레이션 — `V16__create_announcements.sql`

```sql
CREATE TABLE announcements (
  id            BIGSERIAL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  body          TEXT         NOT NULL,
  is_published  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 공개 공지 최신순 조회 최적화(배너·목록)
CREATE INDEX idx_announcements_published
  ON announcements (is_published, published_at DESC);
```

> 최신 Flyway 버전 V15 확인됨 → 신규 V16. 네이밍 컨벤션 `V{n}__{설명}.sql` 준수. 로컬/IT DB 만 적용(external-infra-safety). prod 는 배포 시 Flyway 자동.

### 조회 쿼리 (AnnouncementRepository)
- 공개 목록: `findAllByIsPublishedTrueOrderByPublishedAtDesc(pageable)`
- 배너(최신 1건): 공개 공지 중 `isPinned DESC, publishedAt DESC` 첫 1건 — 메서드명 쿼리 또는 `@Query`
- 상세: `findByIdAndIsPublishedTrue(id)` (공개 GET) / `findById(id)` (어드민)

---

## 기존 엔티티 재사용 (읽기 전용)

### User (회원 조회 — Phase B)
운영 조회용 파생 응답 `AdminUserResponse`:

| 노출 필드 | 출처 | 비고 |
|---|---|---|
| `id` | `user.id` | |
| `email` | `user.email` | |
| `kakaoLinked` | `user.kakaoId != null` | 카카오 연동 여부(Boolean) |
| `emailVerified` | `user.emailVerifiedAt != null` | 이메일 인증 여부(Boolean) |
| `lastLoginAt` | `user.lastLoginAt` | |
| `createdAt` | `user.createdAt` | 가입일 |
| `projectCount` | `count(projects where user_id=...)` | 작품 수 집계 |

**절대 미노출**: `passwordHash`, `kakaoId` 원문, `failedLoginCount`, `lockoutUntil`, 인증 토큰류 (FR-010 / SC-006).

- 목록: `createdAt DESC` 페이지네이션(`PageResponse<AdminUserResponse>`)
- 검색: email `ILIKE %term%`

### User / Project / WorkSession (통계 — Phase C)
| 지표 | 집계 |
|---|---|
| 총 가입자 | `count(users)` |
| 오늘 신규 | `count(users where createdAt >= 오늘00:00 KST)` |
| 이번 주 신규 | `count(users where createdAt >= 주시작(월) KST)` |
| 활성 사용자 | `count(users where lastLoginAt >= now-7d)` |
| 총 작품 수 | `count(projects)` |
| 30일 가입 추이 | `users` 가입일(KST) 그룹핑, 빈 날 0 채움, 30개 |

> 타임존 = `Asia/Seoul`. `WorkSession` 은 v1 통계에서 직접 사용 안 함(총 작품 수까지만) — 상세 작성활동 통계는 범위 밖.
