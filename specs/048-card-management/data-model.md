# Data Model: 카드 관리 (Card Management)

Phase 1 — 엔티티/마이그레이션/DTO/검증/상태 전이. research.md 결정 반영.

## 엔티티

### Card (확장 — 기존 `cards` 테이블)

| 필드 | 타입 | 변경 | 설명 |
|---|---|---|---|
| id | Long | 기존 | PK |
| **boardId** | Long? | **NOT NULL → nullable** | 소속 보드. null=독립 카드 |
| **userId** | Long | **신규 NOT NULL** | 소유 사용자(FK users, ON DELETE CASCADE). 전 카드 백필 |
| body | String | 기존 | 본문(TEXT NOT NULL DEFAULT '') |
| type | String? | 기존 | 종류(character/place/event/theme) 또는 null=무지정 |
| posX/posY | Double | 기존 | 캔버스 좌표. 독립 카드는 의미 없음(기본 0) |
| zIndex | Int | 기존 | 겹침 순서 |
| createdAt/updatedAt | Instant | 기존 | 생성/수정 시각(PrePersist/PreUpdate) |

- 소유 판별: `card.userId == principal.userId`(신규 유저 스코프 경로). 기존 보드 스코프 경로(`/api/boards/{boardId}/cards/*`)는 board 경유 검증 유지.
- 독립 카드는 링크를 가질 수 없다(링크는 board_id + 같은 보드 두 카드 필요 — `board_id IS NULL` 카드는 링크 대상 불가). 기존 링크 생성 검증(`findByIdAndBoardId` 양쪽)이 자연히 배제.

### Board / Link — 무변경

`boards`·`links` 스키마·엔티티 변경 없음. 링크는 여전히 board 스코프.

## 마이그레이션 V30 (신규)

`backend/src/main/resources/db/migration/V30__add_card_user_and_nullable_board.sql`:

```sql
-- V30 — 카드 관리(048). 보드 없는 독립 카드 허용:
--  (1) cards.user_id 신규(모든 카드 소유를 보드 경유가 아닌 카드 단위로 판별) — 기존 boards.user_id 에서 백필.
--  (2) cards.board_id 를 nullable 로(board_id IS NULL = 독립 카드).
-- additive/in-place. 기존 보드 카드 무손실(백필). 링크·보드 스키마 무변경.

-- (1) user_id 추가 → 백필 → NOT NULL + FK
ALTER TABLE cards ADD COLUMN user_id BIGINT;
UPDATE cards c SET user_id = b.user_id FROM boards b WHERE c.board_id = b.id;
ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cards ADD CONSTRAINT fk_cards_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- (2) board_id nullable (독립 카드 = NULL)
ALTER TABLE cards ALTER COLUMN board_id DROP NOT NULL;

-- (3) cross-board 카드 목록(생성일 내림차순) 인덱스
CREATE INDEX idx_cards_user ON cards (user_id, created_at DESC);
```

> `fk_cards_board`(ON DELETE CASCADE) 는 유지 — 보드 삭제 시 그 보드 카드는 여전히 함께 삭제(독립화 아님). 독립화는 명시적 재배정(board_id=null)으로만.
> 운영 Flyway 상태(board 배포 여부)는 배포 전 확인(rule 22) — 미배포면 V24~V30 최초 함께 적용, 배포됨이면 V30 이 기존 카드 백필. 어느 쪽이든 안전.

## 요청/응답 DTO (신규)

`model/request/CardRequests.kt`:

```kotlin
/** 독립 카드 생성 — board_id=null, 소유=principal. body 미지정 시 빈 본문(FE 가 내용 필수 가드). type 미지정 시 무지정. */
data class CreateCardRequest(
    val body: String? = null,
    val type: String? = null,
)

/** 카드 본문/종류 수정 — null 필드 미변경. 보드 카드·독립 카드 공통. */
data class UpdateCardRequest(
    val body: String? = null,
    val type: String? = null,
)

/** 카드 소속 보드 변경 — boardId=대상 보드(본인 소유), null=독립으로 떼기. 연결 있는 카드는 거부(400). */
data class SetCardBoardRequest(
    val boardId: Long? = null,
)
```

`model/response/CardResponses.kt`:

```kotlin
/** 카드 관리 목록/상세 항목. boardId/boardName=소속(null=독립). linkCount=연결된 다른 카드 수(distinct). */
data class CardItemResponse(
    val id: Long,
    val boardId: Long?,
    val boardName: String?,
    val body: String,
    val type: String?,
    val linkCount: Int,
    val createdAt: Instant,   // 정렬 키(생성일 내림차순) + 집필 뷰 그룹 내 정렬
    val updatedAt: Instant,
)
```

- 목록·상세 모두 `CardItemResponse` 재사용(상세는 단건). `boardName` = 소속 보드 이름(독립=null → FE "속한 보드 없음"). 소속 라벨은 보드 owner 라벨이 아니라 **보드 이름**(사용자 요구 "어느 보드에 속했는지").
- 기존 `CardResponse`(보드 캔버스용, posX/posY/zIndex 포함)는 무변경 — 카드 관리 목록은 위치 불필요.

## 검증 규칙

| 규칙 | 위치 | 실패 |
|---|---|---|
| 종류는 4종 또는 null | `normalizeCardType`(공유) | ValidationException(400) |
| 카드 소유(유저) | `cardRepository.findByIdAndUserId` | ResourceNotFoundException(404) |
| 재배정 시 연결 없어야 | CardService(linkCount>0 검사) | ValidationException(400) |
| 재배정 대상 보드 본인 소유 | `boardRepository.findByIdAndUserId`(boardId!=null) | BOARD_OWNER_INVALID(400) |
| 본문 내용 필수(생성) | **FE 생성 폼 가드** | (백엔드 미강제 — D7) |

## 상태 전이 (소속 보드)

```
[독립 카드] --배정(SetCardBoard: boardId=X, 본인 보드)--> [보드 X 소속]
[보드 X 소속·연결없음] --떼기(boardId=null)--> [독립 카드]
[보드 X 소속·연결없음] --옮기기(boardId=Y)--> [보드 Y 소속]
[보드 소속·연결있음] --재배정 시도--> 거부(400) : 소속 보드 변경 대상 제외(FR-017a)
```

- 배정/옮기기 시 대상 보드 캔버스에 기본 위치(posX=0, posY=0)로 나타남 → 사용자가 이후 드래그.
- 삭제: 카드 삭제 시 걸린 링크 DB cascade(기존 동작). 독립 카드는 링크 없어 경고 없이 삭제.

## 조회 경로 (표시값 출처 — rule 9)

| 표시값 | 조회 경로 |
|---|---|
| 카드 목록(cross-board) | `CardRepository` — user 소유 전량, 정렬 **created_at desc·id desc**(파생 메서드 또는 `@Query` — 구현 시 확정; `BoardRepository.findByUserIdOrderByUpdatedAtDesc` 선례 참조) |
| 검색·필터(소속/종류/문자열) | **FE 클라이언트 필터**(전체 로드 후 좁힘, 보드 허브 선례) — BE 는 정렬된 전량 반환, 신규 쿼리 파라미터 0 |
| 집필 뷰 3단 그룹 | `GET /api/cards`(전량) + `GET /boards/reference?projectId=`(그 작품 보드 id) FE 결합 — 작품 보드/시리즈 보드/독립으로 그룹, 각 그룹 생성일 내림차순 |
| boardName | 목록 카드의 distinct boardId(non-null) → `boardRepository.findAllById` → id→name 맵(N+1 회피) |
| linkCount(distinct 이웃) | `LinkRepository` grouped projection(카드 id 집합 대상, source/target UNION 후 COUNT DISTINCT 상대) |
| 카드 상세 | `findByIdAndUserId` + 위 boardName/linkCount 단건 |
