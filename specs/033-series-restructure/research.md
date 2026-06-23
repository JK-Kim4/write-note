# Research: 시리즈 중심 재구성 (Phase 0)

**Feature**: 033-series-restructure | **Date**: 2026-06-22

명세의 미결·설계 선택을 코드베이스 실측 위에서 해소한다. 각 항목은 Decision / Rationale / Alternatives 형식.

## 실측 기준선 (코드·운영 데이터)

- **엔티티 컬럼** (`backend/.../entity/`):
  - `Project`: genre, targetLength, toneNotes, synopsis, worldNotes, nextScene(NOT NULL ""), **paperSize(NOT NULL "A4")**, **layoutMode(NOT NULL "paper")**, fontScale("m"), categoryId(nullable), archivedAt.
  - `Category`: name(60), parentId(self-FK, v1 항상 NULL 강제), sortOrder. (메타 없음)
  - `Document`: projectId(NOT NULL), title, body(jsonb), wordCount, sortOrder, deletedAt, @Version updatedAt.
- **endpoint**: `DocumentController` 9개(목록/생성/순서/단일본문/단건/저장/제목/삭제/복구), `CategoryController` 4개(POST/GET/PATCH/DELETE), `ProjectController` 9개(생성/목록/cards/단건/수정/category이동/archive/unarchive/삭제).
- **운영 데이터(2026-06-22)**: 작품 6, 활성 본문 6, **다중 본문 작품 0건**(샘플 삭제 후).
- **판형 FE 사용처**: 집필실(`BStudioShell`·`CustomEditor`·`BCustomChapterEditor`) + 내보내기(`PrintDocument`·`PrintOverlay`·`ExportDialog`) + 작품 폼(`library/page`·`LibraryBoard`) + `preferences`/`settings`/`PreferencesSync`(사용자 전역 기본값).

## D1. 챕터 제거 — Document 1:N → 1:1 회귀 방식

**Decision**: 스키마는 파괴하지 않고 **앱 레벨에서 1:1 강제**한다.
- `DocumentController`에서 챕터 endpoint 제거: 목록(`GET /projects/{id}/documents`), 생성(`POST /projects/{id}/documents`), 순서(`PUT /projects/{id}/documents/order`), 제목(`PATCH /documents/{id}/title`), 삭제(`DELETE /documents/{id}`), 복구(`POST /documents/{id}/restore`).
- 단일 본문 경로만 유지: `GET /projects/{id}/document`(작품의 활성 본문 1개), `GET /documents/{id}`, `PUT /documents/{id}`(저장).
- `documents.sort_order`·`deleted_at` 컬럼은 **물리 제거하지 않고 보존**(무손실·롤백 안전). 작품 생성 시 본문 1개만 생성.
- soft-deleted 본문(있으면)은 DB에 남되 조회 대상 아님(무손실).

**Rationale**: 운영 데이터상 다중 본문 0건이라 데이터 정리·병합이 불필요(FR-003 자동 충족). 컬럼 DROP은 롤백을 어렵게 하고 무손실 위험을 키운다. "챕터 제거"의 사용자 가치는 화면·동작에서 챕터 장치가 사라지는 것이며, 이는 endpoint/UI 제거로 100% 달성된다.

**Alternatives**:
- *V22로 sort_order/deleted_at DROP + project_id UNIQUE 복원*: 구조적으로 깔끔하나 롤백·무손실 위험. dogfooding 단계에 과한 파괴. **기각**(단, R0에서 다중·soft-deleted 분포 재확인 후 "보강 마이그레이션"이 정말 필요하면 V22로 추가 — 아래 D1-보강).
- *본문 병합 로직 구현*: 다중 0건이라 불필요. **기각**.

**D1-보강(조건부)**: R0 재확인에서 작품당 활성 본문이 1개임이 보장되면 V22 불필요. 만약 향후 무결성 보장을 원하면 `documents(project_id) WHERE deleted_at IS NULL` 부분 UNIQUE 인덱스를 V22로 추가(데이터 파괴 없음). 본 plan 기본값 = V22 없음, R0 결과로 확정.

## D2. 메타데이터 위치 — Project → Category 이동

**Decision**: 출판 메타를 **Category에 additive 추가**, Project 컬럼은 **보존(미사용 전환)**.
- `Category` (V21, 전부 nullable): `paper_size`(16), `layout_mode`(16), `genre`(100), `synopsis`(TEXT), `target_length`(INT, 시리즈 총 목표).
- `Project` 컬럼 처리:
  - 톤류 `tone_notes`·`world_notes`·`next_scene`: **보존**, UI만 제거(FR-013/014).
  - `paper_size`·`layout_mode`·`genre`·`synopsis`: **컬럼 보존**하되 effective 해석에서 더 이상 작품 자체 값으로 쓰지 않음(미분류는 시스템 기본값). 데이터 안전·롤백 위해 DROP 안 함.
  - `target_length`(작품 목표): **유지·계승**(FR-017).
  - `font_scale`: 무관(유지).

**Rationale**: additive는 무손실·롤백 안전이며 신규 status/에러코드 0. Project의 기존 판형·장르 값을 버리지 않아 향후 정책 변경(예: 미분류 작품의 마지막 판형 복원)에 여지를 남긴다. nullable은 Clarify Q1(시리즈 판형 선택) 결정과 정합.

**Alternatives**:
- *Project 판형·장르·줄거리 컬럼 DROP*: 무손실 위반·롤백 곤란. **기각**.
- *메타를 Project에 두고 시리즈는 참조만*: 요구사항("시리즈 단위 일괄 적용")과 모순. **기각**.

## D3. Effective 판형/출판방식 해석

**Decision**: **BE가 effective 값을 해석해 Project 응답에 포함**한다.
- 규칙: 작품이 시리즈에 속하고(`categoryId != null`) 그 시리즈가 판형을 설정했으면(`category.paperSize != null`) → 시리즈 값. 아니면(미분류 or 시리즈 미설정) → **시스템 기본값 상수**(`paperSize="A4"`, `layoutMode="paper"` — 현행 Project default 재사용).
- `ProjectResponse`(및 `ProjectCardResponse`)에 `effectivePaperSize`·`effectiveLayoutMode` 필드 추가(additive).
- FE 집필실·내보내기는 `project.effectivePaperSize`/`effectiveLayoutMode`만 읽는다(기존 `project.paperSize` 직접 참조 교체).

**Rationale**: 해석을 BE 1곳에 모으면 FE 다수 경로(집필실 3 + 내보내기 3)가 fallback 분기를 중복 구현하지 않는다(정보 은닉, deep module). 시스템 기본값을 현행 Project default 상수로 재사용해 기존 렌더와 연속성 유지.

**Alternatives**:
- *FE가 시리즈 조회 후 분기*: fallback 로직이 6+ 경로에 흩어짐. **기각**.
- *시스템 기본값을 사용자 preferences에서*: preferences는 "새 작품 생성 기본값"이라 의미가 다름. 미분류 렌더 기준은 상수가 단순·예측가능. **기각**(단 작품 생성 시 기본 판형 prefill은 R2 FE에서 preferences 재사용 가능).

## D4. 시리즈 진척 — 글자수 합산

**Decision**: `CategoryResponse`에 `totalWordCount`(하위 작품 `documents.word_count` 합, archived 제외) + `targetLength`(시리즈 총 목표) 추가.
- 집계: `SELECT category_id, SUM(word_count)` — 작품 join 활성 본문. 기존 `ProjectCardResponse.wordCount` 집계 경로 재사용.
- 진척 표시·0 나눗셈 가드는 FR-016/018대로 FE에서 처리(목표 0/null이면 "목표 없음").

**Rationale**: 신규 fetch 최소(Category 응답 확장). 작품 목표(`Project.target_length`)와 독립(FR-017).

**Alternatives**: *진척 전용 endpoint 신설* — 불필요한 신규 계약. **기각**.

## D5. 작품 생성·시리즈 폼 재배치

**Decision**:
- 작품 생성(`ProjectFormModal`/`library` 폼): 입력 = 제목 + 작품 목표 분량. **제거** = 판형·출판방식·장르·줄거리·톤류. `CreateProjectRequest`에서 해당 필드 제거(또는 무시). 작품 생성 시 본문 1개 동반 생성은 유지.
- 시리즈 생성·편집(`LibraryBoard` 인라인폼/`CategoryTile`): 입력 = 이름 + 판형 + 출판방식 + 장르 + 줄거리 + 시리즈 총 목표. `CreateCategoryRequest`/`UpdateCategoryRequest` 확장.

**Rationale**: FR-019/020 직접 구현. 출판 정체성이 시리즈 한 곳에 모임.

**Alternatives**: *작품 폼에 판형 read-only 표시(시리즈값)* — 혼란·불필요. 집필실에서 effective로 충분. **기각**.

## D6. 배포 순서 / 통합 경로

**Decision**: `buffer` 통합 브랜치에 032 + 033 누적 → 충분히 검증 후 develop 한 번에 머지 → (사용자 승인 시) main 승격.
- 라운드 내: additive(R2~R4 BE 응답 확장) = BE 선행→FE 후행. R1(제거) = FE 챕터 호출 중단 확인 후 BE endpoint 제거.
- buffer 내 BE·FE 동시 존재라 prod 단일 배포 시 순서 위험 완화. 단 `branch-base-verify`(§18)대로 buffer→develop 직전 develop 누락 커밋(보안·공개경로) 재점검.

**Rationale**: 챕터 제거 같은 큰 변경을 시리즈 분류와 묶어 통째 검증하려는 사용자 의도. develop=preview 자동배포를 미성숙 중간상태로 오염시키지 않음.

## 미해소 → R0(구현 직전) 확인 항목

- **현재 시리즈/작품-시리즈 분포**: 시리즈가 0개면 모든 작품 미분류 → 마이그레이션·effective 검증 단순. (운영 DB 읽기 조회)
- **soft-deleted 본문 분포**: 작품당 활성 본문 1개 보장 여부 → D1-보강(V22) 필요성 확정.
- 두 항목 모두 **읽기 조회**(external-infra-safety §2, 무컨펌). 메모리 [[oci-db-readonly-access]] 경로 사용.
