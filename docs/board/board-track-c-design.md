# 설계 — 보드 트랙 C 코어 (진입점·매핑·아이디어 보드)

| 항목 | 내용 |
|------|------|
| 문서 상태 | v1.0 (brainstorming 확정 — 2026-06-25) |
| 작성일 | 2026-06-25 |
| 브랜치 | `038-memo-plot-board` (보드 트랙 누적, develop merge 보류) |
| 함께 보는 문서 | `board-prd.md`(§0·§5.3·§5.4·§7·§10) · `board-ux-worksheet.md`(TASK-4·4B·§5 문구) · `board-roadmap.md` §5-C |
| 본 문서의 역할 | 트랙 C **코어** brainstorming 결론 SoT. 이후 `/speckit-specify`→`plan`→`tasks`(`specs/041-board-entry-points/`)의 입력. |

> **선행**: 트랙 A(연결 UI ✅ `d19b879`) · 트랙 B(유비쿼터스 언어 rename ✅ `567935e`) 완료. 코드·DB·API·FE가 전부 `Card/Link/cards/links`. **신규 작업에서 React Flow `node/edge` 재도입 금지**(어댑터=PlotBoardCanvas·linkGraph·CardNode·LinkEdge 안에서만).

---

## 0. 확정 결정 (brainstorming 2026-06-25)

1. **데이터 모델 = PRD 정석**: `boards.category_id`·`project_id` 두 컬럼 → **`owner_type`/`owner_id` 다형 단일소유**로 교체. **1:N**(한 작품/시리즈가 보드 여러 개).
2. **스코프 = 코어만**: ① 매핑 모델 전환 + ② 전역 허브(소속 라벨·검색) + ③ 아이디어 보드·"나중에 붙이기" + ④ 전역 생성 picker. **내부 탭(TASK-4 내부생성·TASK-4B 호스트)·집필 참조(TASK-5)는 후속 증분**(호스트 UI 결정 필요).
3. **owner_type 값 = `'project'` / `'category'` / `NULL`**. 코드베이스 일관성(기존 엔티티 `Project`/`Category`, 테이블 `projects`/`categories`). 내부값이라 화면 비노출 — UI는 "이 작품 / 시리즈 전체 / 아이디어"(worksheet §5 COPY).
4. **대상 삭제 시 보드 = owner null 강등**(아이디어 보드로 보존, PRD §5.3). 다형이라 진짜 FK가 없어 `ON DELETE SET NULL`을 못 쓰므로 **앱 레벨 정리 훅**으로 처리.
5. **마이그레이션 = V24 in-place 편집**(보드 V24~26 develop·main 미배포 실증 — Track B 선례). 게이트 전 로컬 dev DB 리셋(board 3테이블 drop + flyway history 3행 삭제 + 재마이그레이션, **사용자 컨펌 후 실행**).
6. **검색 = 클라이언트 필터**: `GET /boards/mine`이 소속 라벨 포함 전체 보드를 반환 → FE가 검색어로 즉시 필터(단일 사용자·소량). 서버 `?q=` 미도입.

---

## 1. 범위 (Scope)

### In (코어)
- 매핑 데이터 모델 전환(dual-FK → 다형 owner) + 1:N.
- 전역 허브(`/boards`) 재설계: 소속 라벨 칩 · 검색 · 생성 picker · "나중에 붙이기".
- 아이디어 보드(owner null) 생성·라벨·연결.
- 대상(작품/시리즈) 삭제 시 보드 보존(owner null 강등).

### Out (후속 증분)
- **TASK-4(내부 생성·owner 자동) / TASK-4B 내부 탭** — 작품/시리즈 상세 호스트 페이지 결정 필요(현 작품 상세=집필 화면, 시리즈 상세=/library 드릴인).
- **TASK-5 집필 중 보드 참조** — `GET /works/:id/reference-boards` + 마지막 본 보드 기억(저장소 결정 필요 — `SettingsService.ALLOWED`는 값 화이트리스트라 임의 boardId 저장 불가) + 에디터 분할 뷰.
- 단 `GET /api/boards` 필터는 모델 변경 추종으로 **본 트랙에서 owner 기준으로 갱신**(내부 탭이 그 위에서 동작).

---

## 2. 데이터 모델 & 마이그레이션

### 2-1. `boards` 스키마 변경 (V24 in-place 편집)
현행(V24):
```sql
category_id BIGINT,  project_id BIGINT,
CONSTRAINT fk_boards_category ... ON DELETE SET NULL,
CONSTRAINT fk_boards_project  ... ON DELETE SET NULL,
CREATE UNIQUE INDEX uq_boards_project  ON boards (project_id)  WHERE project_id  IS NOT NULL;
CREATE UNIQUE INDEX uq_boards_category ON boards (category_id) WHERE category_id IS NOT NULL;
```
변경 후:
```sql
owner_type VARCHAR(16),   -- 'project' | 'category' | NULL(아이디어)
owner_id   BIGINT,
CONSTRAINT ck_boards_owner_pair CHECK (
    (owner_type IS NULL     AND owner_id IS NULL) OR
    (owner_type IN ('project','category') AND owner_id IS NOT NULL)
),
CREATE INDEX idx_boards_owner ON boards (owner_type, owner_id);
-- 부분 유니크 인덱스 2개 제거(1:N) · 두 FK 제거(다형이라 진짜 FK 불가)
```
- `cards`/`links` 테이블 및 V25(card_type)·V26(link_handles)는 **불변**(boards 컬럼만 교체).
- **무결성**: owner_id가 실제 본인 작품/시리즈인지는 **앱 검증**(BoardService). DB FK 없음.

### 2-2. 대상 삭제 시 보드 보존 (앱 훅)
- 진짜 FK(`ON DELETE SET NULL`)가 사라지므로, **작품/시리즈 삭제 경로에서 그 대상 소유 보드의 owner를 null로** 비운다(아이디어 보드로 보존, PRD §5.3).
- 구현: `ProjectService`/`CategoryService`의 삭제(또는 보관/하드삭제) 메서드에서 `BoardRepository`로 `owner_type='project' AND owner_id=:id`(또는 category) 보드를 찾아 owner null 처리.
  - ⚠️ Controller→Service→Repository 단방향 유지(역방향 금지) — Project/Category 서비스가 `BoardRepository`를 주입(같은 레이어 repository 의존은 허용). cross-service 호출은 피하고 repository 직접 사용.
  - 작품/시리즈 삭제가 **soft-delete(보관)** 인지 **hard-delete** 인지 구현 시 확인 — soft면 보드 owner 유지(대상 살아있음), hard에서만 강등. (구현 단계에서 ProjectService/CategoryService 삭제 의미 실측 후 결선.)

### 2-3. 마이그레이션 운용
- V24 in-place 편집 → 로컬 dev DB는 체크섬 불일치(공유 Docker PG, Testcontainers 아님 — Track B 회고 §4-1).
- **게이트 실행 전** 로컬 정합: `cards`·`links`·`boards` drop + `flyway_schema_history`에서 V24·V25·V26 행 삭제 + 재마이그레이션. **사용자 컨펌 후 내가 실행**(external-infra-safety §1 쓰기 컨펌).

---

## 3. 백엔드 API

### 3-1. 엔드포인트
| 구분 | 메서드·경로 | 내용 |
|---|---|---|
| **신규** | `GET /api/boards/mine` | 전역 허브. 내 모든 보드 + **소속 라벨**(작품 `title` / 시리즈 `name` / "아이디어") + cardCount + 최근순(updatedAt desc). 검색은 클라 필터라 파라미터 없음 |
| 변경 | `POST /api/boards` | 본문 `ownerType`/`ownerId`(선택, 생략=아이디어). owner 검증(본인 작품/시리즈). **매핑충돌 409 제거**(1:N) |
| 변경 | `PATCH /api/boards/{id}` | `name`(선택) + **owner 지정/해제**(선택) 통합. 아이디어 보드 "나중에 붙이기"가 이 경로 사용 |
| **제거** | `PUT /api/boards/{id}/project` · `PUT /api/boards/{id}/category` | `PATCH /api/boards/{id}`로 통합 |
| 변경 | `GET /api/boards` | 필터 `projectId/categoryId/unmapped` → `ownerType/ownerId/unmapped`(모델 변경 추종, 컴파일 필수). 코어 FE 미사용이나 계약 정합 — 내부 탭②이 사용 |
| 불변 | `GET /api/boards/{id}`(하이드레이션) · 카드 4 · 연결 2 · 뷰포트 | Track A/B 그대로 |

### 3-2. DTO 변경
- `BoardResponse` / `BoardSummary`: `projectId: Long?` · `categoryId: Long?` → **`ownerType: String?` · `ownerId: Long?`**.
- 신규 허브 응답(예: `BoardMineItem` 또는 `BoardSummary` 확장): `ownerType` · `ownerId` · **`ownerLabel: String`**(작품명/시리즈명/"아이디어" 파생) + `cardCount` + `updatedAt`.
  - 라벨 파생: owner_type='project'→`projectRepository`로 title, 'category'→`categoryRepository`로 name, null→"아이디어". **N+1 회피**: 보드 목록의 owner_id들을 모아 일괄 조회(기존 `listCards`의 `categoryById` 패턴 참조).
- 요청: `CreateBoardRequest`(projectId/categoryId → ownerType/ownerId). `SetBoardProjectRequest`/`SetBoardCategoryRequest` 제거, `PatchBoardRequest`(name?/ownerType?/ownerId?) 신설(또는 RenameBoardRequest 확장).

### 3-3. 에러코드 (AuthErrorCode.kt)
- **제거**: `BOARD_PROJECT_ALREADY_MAPPED` · `BOARD_CATEGORY_ALREADY_MAPPED`(1:N으로 매핑충돌 개념 소멸). FE 참조는 `BoardMappingControl` 제거로 함께 사라짐.
- **추가**: `BOARD_OWNER_INVALID`(400) — owner_type/owner_id 짝 불량, 본인 아닌/없는 작품·시리즈, 미지원 owner_type.
- 불변: `BOARD_LINK_INVALID`(400) · `BOARD_LINK_DUPLICATE`(409).

### 3-4. 검증 로직 (BoardService)
- `requireMappableProject`/`requireMappableCategory`의 "이미 매핑됨 409" 분기 **제거**(1:N). 본인 소유 검증만 남김.
- owner 검증 통합: `(ownerType, ownerId)` → null 짝이면 OK(아이디어), 'project'면 본인 project 존재, 'category'면 본인 category 존재, 그 외 `BOARD_OWNER_INVALID`.
- `BoardRepository`: `findByProjectId`/`findByCategoryId`(매핑충돌용) 제거. 목록 메서드를 owner 기준으로 갱신(`findByUserIdAndOwnerTypeAndOwnerId…`, `findByUserIdAndOwnerTypeIsNull…`, `findByUserIdOrderByUpdatedAtDesc` 유지).

---

## 4. FE 전역 허브 재설계 (`/boards/page.tsx`)

- **데이터**: `useBoardList()` → `GET /boards/mine`(라벨 포함) 기반 훅으로 교체. 타입 `BoardSummary`에 `ownerType`/`ownerId`/`ownerLabel`.
- **소속 라벨 칩**: 각 보드 카드에 작품명/시리즈명/"아이디어" 칩(출처 식별, PRD §5.4 필수).
- **검색바**: 입력 → `ownerLabel`+`name`으로 클라 즉시 필터(아이디어 보드도 name으로 매칭).
- **생성 picker**: "보드 만들기" → 모달 "이 보드는 어디에 쓸 건가요?"(이 작품 / 시리즈 전체 / 아이디어) + 대상 선택(작품·시리즈 목록) + 이름 → `POST /boards`(ownerType/ownerId). COPY = worksheet §5(`board.ownerPrompt`·`ownerWork`·`ownerSeries`·`ownerNone`·`namePlaceholder`).
- **나중에 붙이기**: 아이디어 보드 카드에 "작품/시리즈에 연결"(`board.attachAction`) → 같은 picker → `PATCH /boards/{id}`(owner 지정).
- **제거**: `BoardMappingControl`(작품·시리즈 2 드롭다운·409 안내) → picker로 대체. `useSetBoardProject`/`useSetBoardCategory` → `usePatchBoard`(owner 지정/해제).
- 정렬 최근순(이미 그러함). 화면 문구 worksheet §5 강제(`node/edge/메모/viewport/owner_type` 등 폐기·내부 용어 노출 0).

---

## 5. 검증 · 테스트 · 배포

- **게이트**: BE(ktlint·checkstyle·test·build) + FE(typecheck·lint·test·build).
- **TDD**: owner 검증·라벨 파생·검색 필터 등 순수 로직(룰 §5). 캔버스 상호작용 무관(코어는 목록·매핑·생성).
- **회귀 grep**: 어댑터 밖 `node/edge` 0 · 화면 폐기 문구 0 · Track A/B 동작 보존(연결·카드·뷰포트).
- **dogfooding 체크리스트**(전항 사용자 확인 후에만 통과 단정 — 룰 §25):
  1. 전역 생성 picker 3경로(이 작품/시리즈 전체/아이디어) → 각 소속 라벨 정확.
  2. 아이디어 보드 "작품/시리즈에 연결"(나중에 붙이기) → 라벨 갱신.
  3. 검색(작품명·시리즈명·보드명, 아이디어 보드 포함).
  4. **1:N** — 한 작품에 보드 2개 생성 가능(409 없음).
  5. **대상 삭제 시 보드 보존** — 작품/시리즈 삭제 후 그 보드가 아이디어 보드로 남음.
  6. 보드 열기·카드·연결(Track A/B) 무회귀.
- **배포**: 보드 develop·main 미배포 → API 계약 변경에도 prod 위험 0, 트랙 누적분과 **원자적 동반 merge**. 코어 내 **BE 선행 → FE 후행**.

---

## 6. 후속(②③) 메모 (본 트랙 범위 밖)

- **② 내부 탭(TASK-4 내부생성·TASK-4B 호스트)**: 작품 상세/시리즈 상세 호스트 결정 필요. `GET /api/boards?ownerType=&ownerId=`(본 트랙에서 계약 준비됨) 위에서 동작.
- **③ 집필 참조(TASK-5)**: `GET /works/:id/reference-boards`(그 작품 + 상위 시리즈 보드, 상위 시리즈=`project.categoryId`) + 마지막 본 보드 기억(저장소 결정 — localStorage vs 신규 서버 키, `SettingsService.ALLOWED`는 임의값 불가) + 에디터 분할 뷰(dynamic import 격리).
