# Contract: GET /api/announcements/home

홈 공지 두 슬롯(고정/최신) 조회. **비인증 허용**(기존 `/api/announcements/*` permitAll 커버). 공개 공지만 노출.

## Request

```
GET /api/announcements/home
```
- 파라미터 없음. 인증 불필요.

## Response 200

`Result<HomeAnnouncementsResponse>` envelope(기존 `Result.success` 패턴):

```json
{
  "data": {
    "pinned": { "id": 12, "title": "서비스 이용약관 개정 안내 (7/1 시행)", "publishedAt": "2026-06-20T09:00:00Z" },
    "latest": { "id": 31, "title": "7월 정기 점검 안내 — 7/5 02:00~04:00", "publishedAt": "2026-06-30T02:00:00Z" }
  }
}
```

- `pinned`: 공개+고정 중 공개일 최신 1건. **없으면 `null`**.
- `latest`: 공개 중 공개일 최신 1건(단 `pinned` 와 동일 id 면 그다음). **없으면 `null`**.
- 슬롯 항목 스키마 = 기존 `AnnouncementSummaryResponse` = `{ id: number, title: string, publishedAt: string|null }`. 본문(`body`) 미포함.
- 상세는 기존 `GET /api/announcements/{id}` 로 이동(배너 클릭).

### 상태별 응답 예

| 상황 | pinned | latest |
|---|---|---|
| 둘 다 | 객체 | 객체 |
| 고정만 | 객체 | null |
| 최신만(고정 없음) | null | 객체 |
| 공개 0건 | null | null |
| 고정=최신 최신 | 그 고정 | 그다음 공개(없으면 null) |

## 에러

- 신규 에러코드 없음. 항상 200(빈 상태는 null 필드). 인증 실패 경로 없음(permitAll).

## FE 연동

- `lib/api/announcements.ts`: `getHomeAnnouncements(): Promise<HomeAnnouncements>` where `HomeAnnouncements = { pinned: AnnouncementSummary|null, latest: AnnouncementSummary|null }`.
- `lib/query/useAnnouncements.ts`: `useHomeAnnouncements()`(staleTime 재사용). 기존 `useLatestAnnouncement` 는 배너 교체 후 미사용 → 제거.
- `components/AnnouncementBanner.tsx`: `pinned` → 고정 스타일 배너, `latest` → 최신 스타일 배너. 둘 다 null 이면 `null` 반환(미표시).
