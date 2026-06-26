# Contracts — 보드 API (트랙 C 코어)

base: `/api/boards`, JWT principal(@AuthenticationPrincipal), Result envelope. 본인 보드만(아니면 404).

> **PATCH 분리 결정**: rename과 owner 변경을 분리한다 — `PATCH /{id}`(rename, body `{name}`, 기존 유지)와 `PATCH /{id}/owner`(owner set/clear, null=아이디어 해제). 이유: 단일 PATCH에 name+owner를 섞으면 "owner 변경 안 함" vs "아이디어로 해제(null)"를 JSON 누락/null로 구분 못 함. owner 전용 경로는 body 전체가 owner 의도라 무모호(null ownerType = 해제). PUT /project·/category 2개를 이 하나로 대체. data-model.md의 PatchBoardRequest 스케치는 본 계약으로 확정.

## 신규

### `GET /api/boards/mine` — 전역 허브
- 본인 모든 보드 + 소속 라벨, 최근순(updatedAt desc). 검색 파라미터 없음(클라 필터).
- 응답 `Result<List<BoardSummary>>`:
```json
{ "success": true, "data": [
  { "id": 12, "name": "1부 사건 흐름", "ownerType": "project", "ownerId": 5, "ownerLabel": "달밤의 늑대", "cardCount": 7, "updatedAt": "..." },
  { "id": 9,  "name": "세계관 메모", "ownerType": "category", "ownerId": 3, "ownerLabel": "늑대 연대기", "cardCount": 4, "updatedAt": "..." },
  { "id": 4,  "name": "막연한 구상", "ownerType": null, "ownerId": null, "ownerLabel": "아이디어", "cardCount": 2, "updatedAt": "..." }
] }
```
- `ownerLabel` 파생: project→`project.title`, category→`category.name`, null→`"아이디어"`. owner_id 종류별 일괄조회(N+1 회피).

### `PATCH /api/boards/{id}/owner` — 소속 지정/해제 (PUT /project·/category 대체)
- body `SetBoardOwnerRequest`:
```json
{ "ownerType": "project", "ownerId": 5 }   // 작품 5에 연결
{ "ownerType": "category", "ownerId": 3 }  // 시리즈 3에 연결
{ "ownerType": null, "ownerId": null }     // 아이디어로 해제(나중에 붙이기 반대)
```
- 검증(data-model §7): 짝 불완전·미지원 type·본인 아닌/없는 대상 → **400 BOARD_OWNER_INVALID**. 매핑충돌 409 **없음**(1:N).
- 응답 `Result<BoardResponse>`.

## 변경

### `POST /api/boards` — 생성
- body `CreateBoardRequest`: `{ "name": "...", "ownerType": null|"project"|"category", "ownerId": null|Long }`. owner 생략/null = 아이디어 보드.
- owner 검증 동일(BOARD_OWNER_INVALID). 매핑충돌 409 제거.
- 응답 `Result<BoardResponse>`(201).

### `GET /api/boards` — 목록(필터)
- 파라미터 `projectId/categoryId/unmapped` → **`ownerType`/`ownerId`/`unmapped`**.
  - `?ownerType=project&ownerId=5` → 그 작품 보드. `?unmapped=true` → 아이디어 보드. 무필터 → 전체(최근순).
- 코어 FE 미사용(허브는 /mine 사용). 내부 탭②이 사용할 계약. 응답 `Result<List<BoardSummary>>`(라벨 포함).

### DTO 변경 요약
- `BoardResponse`·`BoardSummary`: `projectId`/`categoryId` → `ownerType`/`ownerId`. `BoardSummary`에 `ownerLabel` 추가.
- `CreateBoardRequest`: `projectId`/`categoryId` → `ownerType`/`ownerId`.

## 제거
- `PUT /api/boards/{id}/project`·`PUT /api/boards/{id}/category` → `PATCH /{id}/owner`로 통합.
- `SetBoardProjectRequest`·`SetBoardCategoryRequest` DTO 제거.

## 불변 (Track A/B 보존)
- `GET /api/boards/{id}`(하이드레이션) · `PATCH /api/boards/{id}`(rename `{name}`) · `DELETE /api/boards/{id}`.
- 카드 4(POST/PATCH/PATCH batch/DELETE) · 연결 2(POST/DELETE) · `PATCH /{id}/viewport`.

## 에러코드 (AuthErrorCode)
| 코드 | status | 변경 |
|---|---|---|
| `BOARD_OWNER_INVALID` | 400 | **신규** — 없는·본인 아닌 대상, 짝 불완전, 미지원 owner_type |
| `BOARD_PROJECT_ALREADY_MAPPED` | 409 | **제거**(1:N) |
| `BOARD_CATEGORY_ALREADY_MAPPED` | 409 | **제거**(1:N) |
| `BOARD_LINK_INVALID` | 400 | 불변 |
| `BOARD_LINK_DUPLICATE` | 409 | 불변 |

## 대상 삭제 보존 (보드 API 외 — Project/Category 서비스)
- `DELETE /api/projects/{id}`(hard) → 그 작품 소유 보드 owner null 강등.
- `DELETE /api/categories/{id}`(hard) → 그 시리즈 소유 보드 owner null 강등.
- 작품 보관(`POST /projects/{id}/archive`, soft) → 보드 owner 유지(무처리).
