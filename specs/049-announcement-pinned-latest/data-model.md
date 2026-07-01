# Phase 1 Data Model: 공지 고정·최신 슬롯

## 스키마 변경: 없음

기존 `announcements` 테이블 재사용. **마이그레이션·신규 컬럼·신규 인덱스 0.**

### 재사용 엔티티 — Announcement (`entity/Announcement.kt`)

| 필드 | 용도(본 기능) |
|---|---|
| `id` | 슬롯 dedup 키(pinned==latest 판정) |
| `title` | 배너 제목 |
| `isPublished` | 공개 공지만 노출(양 슬롯 공통 필터) |
| `isPinned` | 고정 슬롯 선택 필터 |
| `publishedAt` | "최신" 정렬 기준(내림차순), 배너 날짜 표시 |
| `body` | 슬롯엔 미사용(상세 `/notice/{id}` 에서 표시) |

## 파생(read model) — 서버측 계산, 저장 아님

홈 조회가 반환하는 두 슬롯은 엔티티에서 파생한다:

- **pinned pick** = `isPublished && isPinned` 중 `publishedAt` 최신 1건. 없으면 `null`.
- **latest pick** = `isPublished` 중 `publishedAt` 최신 1건, 단 `pinned` 와 `id` 동일하면 그다음 공개 1건. 없으면 `null`.

### 파생 규칙 (spec FR-002·003·004·006·007·009 대응)

| 상황 | pinned | latest |
|---|---|---|
| 공개+고정 여러 건 | 그중 공개일 최신 1 (FR-003) | 고정과 다른 공개일 최신 1 |
| 고정 = 공개일 최신 | 그 고정 | 그다음 공개 1 (FR-004 중복 방지) |
| 고정 없음, 공개 있음 | null (FR-006) | 공개일 최신 1 |
| 공개 정확히 1건이며 고정 | 그 1건 | null (FR-004 edge) |
| 공개 0건 | null | null (FR-007) |
| 미공개(고정이든 아니든) | 제외 (FR-009) | 제외 |

## 신규 응답 DTO

`model/response/AnnouncementResponse.kt` 에 추가(기존 `AnnouncementSummaryResponse` 재사용):

```kotlin
/** 홈 공지 두 슬롯 — 고정/최신 각각 요약(없으면 null). */
data class HomeAnnouncementsResponse(
    val pinned: AnnouncementSummaryResponse?,
    val latest: AnnouncementSummaryResponse?,
)
```

- 기존 `AnnouncementSummaryResponse{id,title,publishedAt}` 변경 없음(요약에 `isPinned` **미추가** — 슬롯이 이름으로 구분되므로 불필요).

## 신규 Repository 메서드

```kotlin
/** 고정 슬롯 — 공개+고정 중 공개일 최신 1건. */
fun findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc(): Optional<Announcement>
```
- 기존 `findAllByIsPublishedTrueOrderByPublishedAtDesc(pageable)` 는 top-2 조회에 재사용.
- 쿼리 수 = 상수 2(고정 pick 1 + top-2 1). N+1 없음.
