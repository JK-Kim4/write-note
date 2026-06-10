# Backend API Contracts: 대시보드 허브 (018, v3)

신규 읽기 endpoint 2종. 공통: JWT 인증(`BearerJwt`), 응답은 기존 `Result` envelope, 401 = `AUTH_TOKEN_*`(기존 공통). **기존 endpoint 변경 0** — `GET /api/projects`(페이지네이션 목록)·`GET /api/projects/{projectId}/work-sessions/total` 불변.

## BE-1. 기간 작업시간 합계

```
GET /api/work-sessions/total?from={ISO-8601 instant}&to={ISO-8601 instant}
```

- **의미**: 인증 사용자의 **전체 작품 횡단**(아카이브 포함), `from ≤ startedAt < to`이고 **종료된** 세션(`endedAt IS NOT NULL`)의 `Σ(endedAt − startedAt)` ms.
- **규약**: 주/기간 경계에 걸친 세션은 `startedAt` 기준 한 기간에만 귀속(이중 계산 없음). 진행 중·폐기 세션 제외(기존 작품별 total과 동일). 시간대 환산은 클라이언트 책임(서버 시간대 무지).
- **응답 200**:
```json
{ "success": true, "data": { "totalDurationMs": 12000000 } }
```
- **오류**: `from >= to` 또는 파라미터 누락/형식 오류 → 400 `VALIDATION_FAILED`. 미인증 → 401.
- **구현 위치**: `WorkSessionTotalController`(신규, `/api/work-sessions` 베이스) → `WorkSessionService.rangeTotalDurationMs(userId, from, to)`(`@Transactional(readOnly = true)`) → `WorkSessionRepository` JPQL(projects join — WorkSession에 userId 없음).

## BE-2. 작품 카드 집계

```
GET /api/projects/cards
```

- **의미**: 인증 사용자의 **활성 작품 전량**(`archivedAt IS NULL`, 페이지네이션 없는 배열 — 베타 작품 소수 전제) + 카드 표시용 집계 동봉.
- **응답 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "title": "여름의 끝, 우리가 머물던 곳", "genre": null, "targetLength": null,
      "toneNotes": null, "synopsis": null, "worldNotes": null,
      "nextScene": "은하가 등대지기를 처음 만나는 장면",
      "archivedAt": null, "createdAt": "2026-05-01T00:00:00Z", "updatedAt": "2026-06-10T01:00:00Z",
      "wordCount": 42500,
      "documentUpdatedAt": "2026-06-10T02:30:00Z",
      "totalDurationMs": 12000000
    }
  ]
}
```
- **규약**: `wordCount`·`documentUpdatedAt` = 1:1 문서(작품 생성 시 자동 생성 — 항상 존재)의 저장 컬럼. `totalDurationMs` = 그 작품의 종료 세션 합(세션 없으면 0). **본문(body)은 미포함** — 마지막 문장 파생은 클라이언트가 기존 `GET /api/projects/{id}/document`로 수행(사용자 결정). 기존 작품별 total·기록 화면 수치와 동일 데이터 기준(spec SC-005).
- **오류**: 미인증 → 401. (파라미터 없음 — 400 경로 없음)
- **구현 위치**: `ProjectController.listProjectCards()`(메서드 추가 — 경로 리터럴 `cards`는 `/{projectId}` 템플릿보다 우선 매칭) → `ProjectService.listCards(userId)` → 3쿼리 일괄(활성 작품 / `DocumentRepository.findByProjectIdIn` / `WorkSessionRepository.findByProjectIdInAndEndedAtIsNotNull`) 후 조립 — **SQL N+1 금지**.

## 검증·테스트 계약 (TDD 선작성 대상)

| 대상 | 케이스 |
|---|---|
| BE-1 서비스 단위 | 범위 내 종료 세션만 합산 / 경계(`from` 포함·`to` 제외) / 진행 중 제외 / 타 사용자 세션 제외 / 빈 결과 0 / `from >= to` 검증 오류 |
| BE-1 IT | 200 정상 합 / 400(`from>=to`·파라미터 누락) / 401 |
| BE-2 서비스 단위 | 집계 조립 정확성(글자수·문서시각·세션 합) / 세션 0 작품 = 0 / 아카이브 제외 / 타 사용자 제외 |
| BE-2 IT | 200 배열·필드 검증 / 빈 작품 목록 `[]` / 401 / 기존 `GET /api/projects`·작품별 total **회귀 무변화** |

검증값은 `eq()`/`match {}` 정확값(글로벌 룰 — `any()` matcher 금지). IT는 기존 Testcontainers 패턴.
