# API 계약 변경: 시리즈 중심 재구성 (Phase 1)

**Feature**: 033-series-restructure | **Date**: 2026-06-22

기존 계약(031/032) 위 변경. **신규 status·에러코드 0 지향**. additive(추가) vs removed(제거) 구분.

## 1. Category (시리즈) — 메타 확장

### POST `/api/categories` (생성) — 요청 확장

`CreateCategoryRequest` 필드 추가(전부 optional, null 허용):

| 필드 | 타입 | 비고 |
|---|---|---|
| name | string | (기존) 필수, ≤60 |
| paperSize | string? | 031 판형 식별자 (예: `A4`,`sinkukpan`...) |
| layoutMode | string? | `paper`/`web` |
| genre | string? | ≤100 |
| synopsis | string? | TEXT |
| targetLength | number? | 시리즈 총 목표(≥0) |

### PATCH `/api/categories/{categoryId}` (수정) — 요청 확장

`UpdateCategoryRequest`: 위 메타 필드 추가(전부 optional, null=미변경 또는 명시적 비움 — partial update 규칙은 기존 패턴 따름). 기존 name/sortOrder 유지.

### GET `/api/categories` / 응답 — 확장

`CategoryResponse` 필드 추가:

| 필드 | 타입 | 의미 |
|---|---|---|
| (기존) id, name, parentId, sortOrder, projectCount, createdAt, updatedAt | — | 032 |
| paperSize | string? | 시리즈 판형 |
| layoutMode | string? | 시리즈 출판방식 |
| genre | string? | 장르 |
| synopsis | string? | 줄거리 |
| targetLength | number? | 시리즈 총 목표 |
| totalWordCount | number | 하위 작품(미archive) 활성 본문 word_count 합 |

## 2. Project (작품) — effective 추가, 생성 메타 제거

### POST `/api/projects` (생성) — 요청 축소

`CreateProjectRequest`에서 **제거**(무시): genre, paperSize, layoutMode, synopsis, toneNotes, worldNotes, nextScene.
**유지**: title(필수), targetLength(작품 목표), fontScale(선택).
> 제거 필드를 구 클라이언트가 보내도 400이 아닌 **무시**(하위호환). BE는 누락 시 컬럼 default 사용.

### PATCH `/api/projects/{projectId}` (수정) — 요청 축소

`UpdateProjectRequest`에서 판형·장르·줄거리·톤류 변경 경로 제거(무시). title·targetLength·fontScale·archived 등 유지.

### GET 응답(단건/cards/목록) — effective 추가

`ProjectResponse`·`ProjectCardResponse` 필드 추가:

| 필드 | 타입 | 의미 |
|---|---|---|
| effectivePaperSize | string | 시리즈값 or `"A4"` fallback |
| effectiveLayoutMode | string | 시리즈값 or `"paper"` fallback |

기존 `paperSize`/`layoutMode`/`genre`/`synopsis` 필드는 응답에 당분간 유지(하위호환)하되 FE는 effective·시리즈값으로 전환. `nextScene` 등 톤류 필드는 응답에 남되 FE 미표시.

### PATCH `/api/projects/{projectId}/category` (작품 이동) — 동작 유지·의미 확장

요청/응답 형태 불변(`{ categoryId: number|null }`). 이동 후 응답의 `effectivePaperSize`/`effectiveLayoutMode`가 **새 시리즈 기준으로 재해석**됨(FR-022). 본문 불변.

## 3. Document (본문) — 챕터 endpoint 제거

### 제거 (removed)

| 메서드·경로 | 역할 | 제거 사유 |
|---|---|---|
| GET `/api/projects/{projectId}/documents` | 챕터 목록 | 챕터 제거 |
| POST `/api/projects/{projectId}/documents` | 챕터 생성 | 챕터 제거 |
| PUT `/api/projects/{projectId}/documents/order` | 챕터 순서 | 챕터 제거 |
| PATCH `/api/documents/{id}/title` | 챕터 제목 | 단일 본문은 작품 제목 사용 |
| DELETE `/api/documents/{id}` | 챕터 삭제 | 단일 본문은 삭제 불가 |
| POST `/api/documents/{id}/restore` | 챕터 복구 | 삭제 없음 |

> 제거된 `LAST_CHAPTER_UNDELETABLE`(409, 022) 등 챕터 전용 에러코드는 함께 사용 중단(신규 0, 제거만).

### 유지 (kept)

| 메서드·경로 | 역할 |
|---|---|
| GET `/api/projects/{projectId}/document` | 작품의 단일 활성 본문 조회 |
| GET `/api/documents/{id}` | 본문 단건 조회 |
| PUT `/api/documents/{id}` | 본문 저장(016 @Version 낙관적 잠금 유지) |

## 4. 배포 순서 계약 영향

- **§제거(Document 챕터)**: FE가 챕터 endpoint 호출을 중단한 뒤 BE에서 제거(구 FE→404 방지). buffer 내 동시 충족.
- **§추가(Category 메타·Project effective)**: BE 응답 additive 선행 → FE 후행 소비. 구 FE는 신규 필드 무시(안전).
- 전 구간 신규 status/에러코드 0, 기존 계약 호환.
