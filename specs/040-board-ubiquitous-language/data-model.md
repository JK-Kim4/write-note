# Data Model — 보드 유비쿼터스 언어 정리 (트랙 B)

> 스키마/동작은 **불변** — 식별자(테이블·컬럼·제약·인덱스명)만 rename. 행 데이터·타입·제약 의미 동일.

## 엔티티

### Card (구 `BoardNode`, 테이블 `cards`)
보드 위의 한 장. 한 보드에 전속. 캡처 메모(`memos`)·인물(`characters`)과 무참조.

| 컬럼 | 타입 | 비고 | rename? |
|---|---|---|---|
| id | BIGSERIAL PK | | — |
| board_id | BIGINT NOT NULL | FK→boards(id) ON DELETE CASCADE | — |
| body | TEXT NOT NULL DEFAULT '' | 평문 | — |
| pos_x / pos_y | DOUBLE PRECISION NOT NULL | 캔버스 좌표(음수·소수) | — |
| z_index | INT NOT NULL DEFAULT 0 | 겹침 순서 | — |
| type | VARCHAR(16) NOT NULL DEFAULT 'plot' | 카드 종류 값(plot/character/place/theme/note) — **값 유지** | — |
| created_at / updated_at | TIMESTAMPTZ | | — |

- 제약/인덱스: `fk_board_nodes_board`→`fk_cards_board`, `idx_board_nodes_board`→`idx_cards_board`
- 엔티티 클래스 `BoardNode`→`Card`, `@Table("board_nodes")`→`@Table("cards")`

### Link (구 `BoardEdge`, 테이블 `links`)
같은 보드 두 카드를 잇는 **무방향** 연결(화살표 없음 — source/target는 저장 순서일 뿐). 테두리 앵커 저장.

| 컬럼 | 타입 | 비고 | rename? |
|---|---|---|---|
| id | BIGSERIAL PK | | — |
| board_id | BIGINT NOT NULL | FK→boards(id) ON DELETE CASCADE | — |
| source_node_id | BIGINT NOT NULL | FK→cards(id) ON DELETE CASCADE | **→ source_card_id** |
| target_node_id | BIGINT NOT NULL | FK→cards(id) ON DELETE CASCADE | **→ target_card_id** |
| source_handle / target_handle | VARCHAR(8) nullable | 테두리 앵커(top/right/bottom/left), V26 | — |
| created_at | TIMESTAMPTZ | | — |

- 제약/인덱스: `fk_board_edges_board`→`fk_links_board`, `fk_board_edges_source`→`fk_links_source`, `fk_board_edges_target`→`fk_links_target`, `uq_board_edges_triplet`→`uq_links_triplet`(board_id, source_card_id, target_card_id), `ck_board_edges_no_self`→`ck_links_no_self`(source_card_id ≠ target_card_id), `idx_board_edges_board`→`idx_links_board`
- 엔티티 클래스 `BoardEdge`→`Link`, `@Table("board_edges")`→`@Table("links")`, 필드 `sourceNodeId/targetNodeId`(+`@Column source_node_id/target_node_id`)→`sourceCardId/targetCardId`(+`source_card_id/target_card_id`)

### Board (불변)
`boards` 테이블·`Board` 엔티티·매핑(`category_id`/`project_id`)·뷰포트 컬럼 모두 **변경 없음**.

## 마이그레이션 (V24~26 in-place 편집 — 최종 상태)

### V24 — `cards`/`links` 생성 (편집)
```sql
-- boards 블록: 변경 없음 (생략)
CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    pos_x DOUBLE PRECISION NOT NULL,
    pos_y DOUBLE PRECISION NOT NULL,
    z_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cards_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);
CREATE INDEX idx_cards_board ON cards (board_id);

CREATE TABLE links (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    source_card_id BIGINT NOT NULL,
    target_card_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_links_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
    CONSTRAINT fk_links_source FOREIGN KEY (source_card_id) REFERENCES cards (id) ON DELETE CASCADE,
    CONSTRAINT fk_links_target FOREIGN KEY (target_card_id) REFERENCES cards (id) ON DELETE CASCADE,
    CONSTRAINT uq_links_triplet UNIQUE (board_id, source_card_id, target_card_id),
    CONSTRAINT ck_links_no_self CHECK (source_card_id <> target_card_id)
);
CREATE INDEX idx_links_board ON links (board_id);
```
> 주석의 "노드/엣지"도 "카드/연결"로 정리.

### V25 — 카드 종류 type 컬럼 (편집, 파일 설명도 정합)
```sql
-- 파일명: V25__add_board_node_type.sql → V25__add_card_type.sql (설명 정합, version 25 유지)
ALTER TABLE cards ADD COLUMN type VARCHAR(16) NOT NULL DEFAULT 'plot';
```

### V26 — 연결 앵커 (편집, 파일 설명도 정합)
```sql
-- 파일명: V26__add_board_edge_handles.sql → V26__add_link_handles.sql (설명 정합, version 26 유지)
ALTER TABLE links ADD COLUMN source_handle VARCHAR(8);
ALTER TABLE links ADD COLUMN target_handle VARCHAR(8);
```

> **파일 rename 주의**: version 숫자(24/25/26)는 유지하고 description 부분만 정합. 로컬은 history 행 삭제 후 재마이그레이션이므로 description 변경이 체크섬 충돌을 안 만든다(재적용). 운영은 미배포라 무관.

## FE 타입 맵 (`lib/api/boards.ts`)
| 현재 | 목표 |
|---|---|
| `BoardNodeResponse` | `CardResponse` |
| `BoardEdgeResponse`(`sourceNodeId`/`targetNodeId`) | `LinkResponse`(`sourceCardId`/`targetCardId`) |
| `BoardDetail.nodes` / `.edges` | `.cards` / `.links` |
| `CreateNodeInput` / `UpdateNodeInput` / `NodePositionItem` | `CreateCardInput` / `UpdateCardInput` / `CardPositionItem` |
| `BoardSummary.nodeCount` | `cardCount` |

> BE `BoardDetailResponse.nodes/.edges`(JSON 키 `nodes`/`edges`)도 `cards`/`links`로 바뀌므로 FE 디시리얼라이즈 키와 정합. 미배포라 계약 변경 안전.
