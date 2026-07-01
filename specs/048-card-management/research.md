# Research: 카드 관리 (Card Management)

Phase 0 — spec 의 열린 결정과 기술 미지수를 코드 실측 기반으로 해소한다. 모든 결정은 실제 코드 인용(추측 금지).

## 실측 기준선 (Baseline — 현재 코드)

- `cards`: `board_id BIGINT NOT NULL`(FK ON DELETE CASCADE), `body TEXT NOT NULL DEFAULT ''`, `type VARCHAR(16)` nullable(V25), `pos_x/pos_y/z_index`. **user_id 없음** — 카드 소유는 `boards.user_id` 경유. (`Card.kt`, `V24`/`V25`)
- 카드 소유 검증 = `BoardService.requireOwnedBoard(userId, boardId)` → `boardRepository.findByIdAndUserId`. 모든 카드 CRUD 가 `/api/boards/{boardId}/cards/*` 아래(보드 스코프). (`BoardController.kt:130-176`, `BoardService.kt:329-346`)
- 카드 종류 검증 = `normalizeCardType` → `ALLOWED_CARD_TYPES = {character, place, event, theme}`, null=무지정. (`BoardService.kt:377-384, 472`)
- 링크: `links(board_id, source_card_id, target_card_id)` FK ON DELETE CASCADE, `uq_links_triplet`, `ck_links_no_self`. 무방향(저장순서). A→B·B→A 별개 허용(039). 카드 삭제 시 링크 DB cascade. (`V24:38-51`, `BoardService.kt:264-272`)
- 에러코드(공유 `AuthErrorCode`): `BOARD_LINK_INVALID`(400)·`BOARD_OWNER_INVALID`(400)·`BOARD_LINK_DUPLICATE`(409). `ValidationException`(400)·`ResourceNotFoundException`(404). (`AuthErrorCode.kt:32,35,42`)
- N+1 회피 선례: `CardRepository.countGroupedByBoardId` projection(`BoardCardCount`). (`CardRepository.kt:31-35`, `BoardService.kt:432-433`)
- 최신 마이그레이션 = **V29** → 다음 **V30**. `/cards` 라우트 미존재. `/memos → /boards` redirect 존재(`next.config.ts:42`). 고아 memo FE 파일 4종 존재(`lib/api/memo.ts` 등).

## D1. 독립(보드 없는) 카드 데이터 모델

**Decision**: `cards.board_id` 를 nullable 로 바꾸고, **모든 카드**에 `cards.user_id`(NOT NULL, `boards.user_id` 에서 백필) 추가. 독립 카드 = `board_id IS NULL`. 소유는 `card.user_id` 로 직접 판별.

**Rationale**:
- 사용자가 "보드 없는 독립 카드"를 명시 선택(spec) — 보드를 거치지 않는 소유 판별이 본질적으로 필요.
- user_id 를 전 카드에 uniform 하게 두면 신규 `/api/cards`(유저 스코프)와 기존 US1 조회가 **같은 `findByIdAndUserId` 경로**를 공유 → throwaway 코드 없음.
- 백필이 안전(기존 카드는 board 를 통해 user 가 확정) → board 미배포면 마이그레이션 위험 사실상 0.

**Alternatives considered**:
- **숨은 인박스 보드(사용자별)**: board_id NOT NULL 유지, 독립 카드=인박스 보드 소속. 기각 — `ck_boards_owner_pair` CHECK(project/category/null) 완화 필요 + `listMyBoards`/`listBoards`/`listReferenceBoards`/owner picker 등 **모든 보드 목록에서 인박스 필터링**이 번져 누수 위험 큼. "보드 없음"을 "숨은 보드 있음"으로 우회하는 것이라 사용자 선택과도 어긋남.
- **board-less 에만 nullable user_id**(compound 소유검사): move 시 user_id 토글·복합 검증으로 더 fiddly. 기각.

## D2. API 표면 — 신규 `/api/cards`(유저 스코프)

**Decision**: 신규 `CardController @RequestMapping("/api/cards")`. 소유는 `card.user_id == principal.userId`. 기존 `/api/boards/{boardId}/cards/*`(보드 캔버스)는 **무변경**.

**Rationale**: 독립 카드는 boardId 경로 변수가 없다(보드 밖). 카드 관리는 여러 보드를 가로지르므로 board 스코프 URL 로는 표현 불가. 신규 컨트롤러가 관심사 분리에도 맞고 기존 보드 흐름을 건드리지 않아 회귀 위험 0(additive).

**Alternatives**: 기존 BoardController 확장 — 기각(boardId 없는 카드를 board 스코프 URL 에 못 얹음).

## D3. 소유·마이그레이션 무결성 — 모든 insert 경로가 user_id 채움

**Decision**: user_id NOT NULL 이므로 카드를 만드는 **모든 경로**가 user_id 를 채운다 — 신규 `CardService.createIndependentCard` + **기존 `BoardService.createCard`**(보드 캔버스 카드 생성, `BoardService.kt:187-206`). 마이그레이션은 add(nullable)→backfill→set NOT NULL 순으로 기존 데이터 무손실.

**Rationale**: NOT NULL 은 user_id 를 안 채우는 경로를 런타임에 터뜨린다(insert 실패). 기존 createCard 는 boardId 만 받으므로 그 board 의 user_id(=principal.userId, 이미 requireOwnedBoard 로 확보)를 카드에도 기입해야 한다. 이 항목을 R1 태스크로 명시(누락 시 보드 캔버스 카드 생성이 깨짐).

## D4. linkCount 의미 — distinct 이웃 카드 수

**Decision**: `linkCount` = 그 카드와 연결된 **서로 다른(distinct) 카드 수**. 목록·상세 응답에 동봉. 삭제 경고 문구 = "이 카드는 N개의 다른 카드와 연결되어 있습니다". 재배정 가드(FR-017a)도 `linkCount > 0` 로 판정.

**Rationale**: 039 가 A→B·B→A 를 별개 link 로 허용하므로 "링크 수"와 "연결된 카드 수"가 다를 수 있다. 사용자 요구("다른 카드와 연결이 있는 경우")는 **카드 단위**이므로 distinct 이웃이 정확. 목록에 함께 담아 재배정 가드·"연결 중" 표시·삭제 경고를 한 번의 조회로 커버(추가 fetch 없음).

**구현**: `LinkRepository` 에 grouped projection(native) — 카드 id 집합에 대해 source/target 양쪽을 UNION 후 `COUNT(DISTINCT 상대카드)` group by. 링크 없는 카드(독립 카드 포함)는 결과에 없음 → 0. `countGroupedByBoardId` 선례와 동형.

**Alternatives**: `hasLinks` 불리언(목록) + 삭제 시점 정확 카운트 — 두 번 조회. 기각(한 번에 distinct 카운트가 더 단순).

## D5. 페이징·정렬·검색·규모

**Decision**: 페이징 미도입(전체 로드). 정렬 = **`created_at DESC`**(동률 id desc) — 생성 순서라 카드를 편집해도 순서가 안 바뀜(안정적). 인덱스 `idx_cards_user(user_id, created_at DESC)`. 찾기는 **문자열 검색**(내용·보드명) + **필터**(소속: 전체/보드소속/독립, 종류: 4종+무지정)로 제공, 모두 **FE 클라이언트 처리**(전량 로드 후 좁힘).

**Rationale**: 최근 수정순(updated_at)은 편집할 때마다 순서가 튀어 불안정 → 사용자가 안정적 순서 + 찾기 수단(필터·검색)을 선호(2026-07-01). 솔로 규모라 전량 로드 + 클라 필터가 비용 무시 가능(보드 허브 `filtered` 클라 필터 선례). 조기 페이징·서버 검색은 불필요 복잡도(CLAUDE.md §2). `createdAt` 을 `CardItemResponse` 에 포함(정렬 + 집필 뷰 그룹 내 정렬).

## D6. 에러코드 — 신규 0

**Decision**: 신규 에러코드 추가 안 함. (a) 카드 없음/타인 카드 → `ResourceNotFoundException`(404), (b) 연결 걸린 카드 재배정 → `ValidationException`(400), (c) 잘못된/타인 대상 보드 → `BOARD_OWNER_INVALID`(400), (d) 지원 안 하는 종류 → `ValidationException`(기존 normalizeCardType).

**Rationale**: FE 가 `linkCount` 로 재배정을 선제 차단하므로 (b)는 방어용 — 별도 UX 분기 불필요 → 400 재사용 충분. (c)는 기존 BOARD_OWNER_INVALID 문구("없는·본인 아닌 대상")가 정확히 부합. 신규 status 분기 없음 → FE `client.ts` `error.code` 매트릭스 무변경(code-quality §공용 fetch).

## D7. 빈 본문 — 백엔드 관대 / FE 가드

**Decision**: 백엔드는 빈 본문 허용(`body` 미지정 시 `''`, 보드 카드와 동일). FR-009 "본문 필수"는 **FE 생성 폼 검증 가드**로만 구현.

**Rationale**: `cards.body TEXT NOT NULL DEFAULT ''` — 엔티티가 빈 본문 허용(044 결정). PATCH 로 빈 문자열 저장이 가능하므로 create-time non-blank 강제는 porous(만들고 지우면 빈 카드) + 같은 엔티티 이원 검증을 낳음. spec 도 FR-009 를 UX 가드로 규정. → 백엔드 단일 규칙 유지.

## D8. 진입점 라우트·고아 메모 코드

**Decision**: 카드 관리 진입점 = **`/boards` 하위 탭**([보드 | 카드], 2026-07-01 목업 확정 — `docs/research/2026-07-01-card-management-mockup.html`). 최상위 NAV 신규 항목·신규 top-level 라우트 없음. 탭 내 뷰 전환(쿼리 `?tab=` 등)은 R3 구현 확정. 고아 memo FE 파일(`lib/api/memo.ts`·`lib/query/useMemos.ts`·`lib/memoView.ts`·`lib/electron-api/memos.ts`)은 어떤 화면도 import 하지 않는 dead code — **본 기능 범위 밖**(별도 정리 트랙 surfacing).

**Rationale**: 사용자 선택(보드와 별개의 진입점을 보드 화면 탭으로) — 044 가 메모·인물 메뉴를 보드로 통합한 방향과 정합, 헤더 NAV 붐빔 회피. 신규 top-level `/cards` 라우트 불필요(=`/memos → /boards` redirect 와 무관). 고아 코드는 신규 `lib/api/cards.ts`·`useCards` 와 이름이 달라 혼동·부활 위험 낮고, 정리는 본 기능과 무관한 별도 청소라 스코프 창궐 방지 위해 분리(rule 28 — `03-ISSUES` 후보 surfacing).

## D9. 집필 화면 카드 뷰(R4)

**Decision**: 집필 화면 `BoardReferencePanel`(043/046)에 [보드 | 카드] 토글을 더해 그 작품 관련 카드 + 독립 카드를 모아 본다. 범위 = 그 작품 참조 보드(그 작품 보드 + 상위 시리즈 보드)의 카드 + 독립 카드(board_id null). 조회는 **신규 BE 0** — `GET /api/cards`(전체, R1) + `GET /boards/reference?projectId=`(그 작품 보드 목록, 기존)를 FE 에서 필터(`card.boardId ∈ 참조 보드 id 집합 || boardId == null`).

표시 = **이 작품 보드 → 상위 시리즈 보드 → 독립** 3단 그룹, 각 그룹 안 생성일 내림차순. 그룹 판정은 `GET /boards/reference` 가 workBoards(owner=project)·seriesBoards(owner=category)를 이미 구분해 주므로, 카드의 boardId 가 어느 집합에 속하는지로 판정(boardId null=독립).

**Rationale**: 기존 "보드 참조"가 이미 그 작품 보드 + 상위 시리즈 보드로 범위를 좁혀 주므로, 그 보드 id 집합으로 카드를 FE 필터하면 신규 조회 경로 없이 "그 작품 카드"를 얻는다. 독립 카드는 boardId null 로 합류. 3단 그룹은 맥락 거리 순(작품이 가장 직접적, 시리즈는 상위 맥락, 독립은 떠도는 메모). 솔로 규모라 전체 카드 로드 + 클라 필터는 비용 무시 가능(보드 허브 클라 필터 선례). 참조 목적이라 열람·상세(R3 슬라이드오버 재사용)만 — 관리(생성·재배정·삭제)의 주 무대는 `/boards` 카드 탭.

**Alternatives**: 작품 스코프 전용 BE 엔드포인트(`GET /api/cards?projectId=`) — 정확하나 신규 BE. 솔로 규모·기존 계약 재사용으로 불필요, 후속에 필요 시 도입.

## 미해소 없음

모든 [NEEDS CLARIFICATION] / 열린 결정 해소. Phase 1 진입 가능.
