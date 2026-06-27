# Phase 1 Data Model: 플롯 보드

마이그레이션 **V24** (`V24__create_plot_boards.sql`). 기존 테이블 변경 0, 신규 테이블 3개. 좌표/줌은 `DOUBLE PRECISION`(음수·소수 허용). 시각은 기존 컨벤션 `TIMESTAMPTZ` + `@PrePersist`/`@PreUpdate`(`Instant.now()`).

## 엔티티

### Board (`boards`) — 플롯 보드

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | |
| `user_id` | BIGINT | NOT NULL, FK users ON DELETE CASCADE | 소유자 |
| `name` | VARCHAR(120) | NOT NULL | 보드 이름 |
| `category_id` | BIGINT | NULL, FK categories ON DELETE SET NULL | 시리즈 매핑(0~1). 대상당 1개 = 부분 유니크 |
| `project_id` | BIGINT | NULL, FK projects ON DELETE SET NULL | 작품 매핑(0~1). 대상당 1개 = 부분 유니크 |
| `viewport_zoom` | DOUBLE PRECISION | NOT NULL DEFAULT 1 | 마지막 줌 |
| `viewport_x` | DOUBLE PRECISION | NOT NULL DEFAULT 0 | 마지막 팬 x |
| `viewport_y` | DOUBLE PRECISION | NOT NULL DEFAULT 0 | 마지막 팬 y |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

인덱스/제약:
- `idx_boards_user (user_id)`
- `CREATE UNIQUE INDEX uq_boards_project ON boards(project_id) WHERE project_id IS NOT NULL` — 작품당 보드 ≤1 (FR-026)
- `CREATE UNIQUE INDEX uq_boards_category ON boards(category_id) WHERE category_id IS NOT NULL` — 시리즈당 보드 ≤1 (FR-026)
- `CONSTRAINT fk_boards_user / fk_boards_category / fk_boards_project`

> `ON DELETE SET NULL`: 매핑된 작품/시리즈 삭제 시 보드 보존·매핑만 해제(FR-027).

### BoardNode (`board_nodes`) — 플롯 노드 (캡처 메모와 별개)

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | |
| `board_id` | BIGINT | NOT NULL, FK boards ON DELETE CASCADE | 소속 보드(1:N) |
| `body` | TEXT | NOT NULL DEFAULT '' | 노드 본문(평문 v1) |
| `pos_x` | DOUBLE PRECISION | NOT NULL | 캔버스 절대 x |
| `pos_y` | DOUBLE PRECISION | NOT NULL | 캔버스 절대 y |
| `z_index` | INTEGER | NOT NULL DEFAULT 0 | 겹침 순서 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

인덱스: `idx_board_nodes_board (board_id)`. `fk_board_nodes_board`. 보드 삭제 시 노드 cascade(FR-029).

### BoardEdge (`board_edges`) — 연결

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | |
| `board_id` | BIGINT | NOT NULL, FK boards ON DELETE CASCADE | 소속 보드 |
| `source_node_id` | BIGINT | NOT NULL, FK board_nodes ON DELETE CASCADE | 출발 노드 |
| `target_node_id` | BIGINT | NOT NULL, FK board_nodes ON DELETE CASCADE | 도착 노드 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

인덱스/제약:
- `UNIQUE (board_id, source_node_id, target_node_id)` — 같은 방향 동일 쌍 유일(FR-019)
- `CHECK (source_node_id <> target_node_id)` — 자기연결 금지(FR-020)
- `idx_board_edges_board (board_id)`
- 노드 삭제 시 그 노드에 걸린 엣지 cascade(FR-023 고아 엣지 방지) — DB 레벨

> **보드 내 한정(FR-021)**: source/target 노드가 같은 board_id 인지는 앱(서비스) 검증(엣지의 board_id 와 두 노드의 board_id 일치). DB CHECK 로는 교차참조 검증 불가.

## 관계 다이어그램

```
User 1───N Board ──0..1── Category(시리즈)   [uq: category_id]
            │      ──0..1── Project(작품)      [uq: project_id]
            │
            ├─1──N BoardNode
            └─1──N BoardEdge ──N..1── BoardNode (source)
                            └─N..1── BoardNode (target)
```

## 검증 규칙(서비스 계층)

| 규칙 | 적용 | 위반 |
|---|---|---|
| 보드/노드/엣지는 본인 소유만 | 모든 조작 | NOT_FOUND 은닉 (R5) |
| 작품/시리즈 매핑 시 대상에 기존 보드 없을 것 | PUT project/category | 409 `BOARD_*_ALREADY_MAPPED` |
| 매핑 대상(작품/시리즈)도 본인 소유 | PUT project/category | NOT_FOUND/403 |
| 엣지 source≠target | POST edge | 400 `BOARD_EDGE_INVALID` |
| 엣지 두 노드가 같은 보드 소속 | POST edge | 400 `BOARD_EDGE_INVALID` |
| 엣지 (board, source, target) 유일 | POST edge | 409 `BOARD_EDGE_DUPLICATE` |
| name 비어있지 않음(1~120자) | create/rename | 400 `VALIDATION_FAILED` |

## 상태 전이

- **보드 매핑**: 미매핑 ⇄ 작품 매핑 / 시리즈 매핑(독립). set(대상 지정)·clear(null) 로 전이. 대상당 1개 제약.
- **노드 위치**: 드래그 중(클라 임시) → 드래그 종료 시 배치 PATCH 로 영속. soft-delete 없음(즉시 hard delete + 엣지 cascade).
- 보드/노드/엣지 모두 v1 **soft-delete 미도입**(캡처 메모와 달리 복원 요구 없음). 필요 시 후속.

## 기존 도메인 영향

- `memos` 계열: **무변경·무참조**(SC-007).
- `categories`·`projects`: 컬럼 추가 없음. boards 가 FK 로 **참조만**. 기존 동작 불변.
