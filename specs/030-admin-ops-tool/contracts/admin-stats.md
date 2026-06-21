# Contract: 어드민 통계 (읽기 전용)

`/api/admin/stats/*` — 단일 관리자만. 기존 데이터 집계. 타임존 = `Asia/Seoul`. `Result<T>` envelope.

## GET /api/admin/stats/summary
대시보드 카운트 카드.

**200** — `data: AdminStatsSummaryResponse`
```json
{
  "totalUsers": 152,
  "newUsersToday": 7,
  "newUsersThisWeek": 23,
  "activeUsers": 41,
  "totalProjects": 310
}
```
- `newUsersToday`: 오늘 00:00 KST 이후 가입
- `newUsersThisWeek`: 이번 주(월요일 00:00 KST) 이후 가입
- `activeUsers`: `lastLoginAt >= now-7d`(기본 7일)
- 데이터 0건 → 모든 값 0(오류 아님, US3 AC3)

## GET /api/admin/stats/signups?days=30
일별 가입 추이(그래프용).

**Query**: `days`(기본 30, 1..90)

**200** — `data: { "points": [...] }`
```json
{
  "points": [
    { "date": "2026-05-23", "count": 0 },
    { "date": "2026-05-24", "count": 2 }
  ]
}
```
- 결과 없는 날도 `count: 0` 으로 포함해 `days` 개수만큼 연속 반환(그래프 끊김 방지).
- `date` 는 KST 기준 일자.

## 인가 (공통)
비인증 401 / 비관리자 403 / 관리자 200.
