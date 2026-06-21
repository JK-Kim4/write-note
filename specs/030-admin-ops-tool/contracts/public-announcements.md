# Contract: 공개 공지 조회 (비인증)

본 앱 배너·`/notice` 가 호출. SecurityConfig `permitAll`. 응답은 기존 `Result<T>` envelope.

## GET /api/announcements

공개된(`isPublished=true`) 공지 최신순 목록.

**Query**: `page`(기본 0), `size`(기본 20, 1..100)

**200 Response**
```json
{
  "success": true,
  "data": {
    "content": [
      { "id": 12, "title": "정식 오픈 안내", "publishedAt": "2026-06-21T05:00:00Z" }
    ],
    "page": 0, "size": 20, "totalElements": 3, "totalPages": 1
  },
  "error": null
}
```
> 목록 항목은 `body` 제외(요약). 배너는 별도 분기 없이 목록 첫 항목 또는 상세로 표시.

## GET /api/announcements/{id}

공개 공지 상세. 비공개/없음 → 404.

**200 Response**
```json
{
  "success": true,
  "data": {
    "id": 12, "title": "정식 오픈 안내",
    "body": "소설비가 정식 오픈했습니다.\n많은 이용 바랍니다.",
    "publishedAt": "2026-06-21T05:00:00Z"
  },
  "error": null
}
```

**404** — `{ "success": false, "error": { "code": "ANNOUNCEMENT_NOT_FOUND", "message": "..." } }`

## 배너 데이터
배너는 `GET /api/announcements?size=1`(최신 1건, 서버가 `isPinned DESC, publishedAt DESC` 정렬) 또는 전용 경량 응답 사용. v1 은 목록 재사용으로 충분(공개 공지 없으면 `content: []` → 배너 미표시, FR-004).
