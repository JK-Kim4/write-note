# Research — 보드 유비쿼터스 언어 정리 (트랙 B)

> 영향범위 전수 인벤토리는 `docs/board/board-track-b-impact-survey.md`(grep 실측). 본 문서는 **결정 근거 + rename 순서 + 마이그레이션 메커니즘**만.

## Decision 1 — 마이그레이션 = V24~26 in-place 편집 (신규 V27 rename 아님)

- **Decision**: V24·V25·V26 SQL 파일을 직접 편집해 최종 `cards`/`links` 스키마로. 신규 rename 마이그레이션 추가 안 함.
- **Rationale**: 보드 스키마가 **develop·main에 한 번도 없음**(실측: `git ls-tree origin/develop|main | grep V2[4-6]` = 0). prod·통합 브랜치에 보드가 미배포라 마이그레이션 history 무결성 의무가 없다. in-place 편집 시 038 merge 때 prod가 **처음부터 깨끗한 cards/links** 스키마를 받음(create→rename cruft 0).
- **Alternatives**: (B) 신규 V27 `ALTER TABLE ... RENAME` — history 보존·로컬 리셋 불필요하나, 미배포 테이블에 대한 create-then-rename 단계가 영구 cruft로 남고 prod 배포 시에도 낭비 실행. **사용자 승인으로 (A) 채택**(brainstorming 2026-06-25).

### 로컬 dev DB 리셋 메커니즘 (검증된 절차)

in-place 편집은 **이미 적용된 V24~26의 flyway 체크섬 불일치**를 만든다. `flyway migrate`는 적용 전 `validate`로 체크섬을 검사 → V24 파일 변경 시 "checksum mismatch"로 **실패**. `flyway repair`는 체크섬만 재정렬할 뿐 **DB 내용은 안 바꾼다**(이미 board_nodes 적용됨 → cards로 안 바뀜). 따라서 **repair 단독 불충분**.

올바른 리셋(보드 테이블만 surgical, 다른 dev 데이터 보존) — **DB 쓰기라 사용자 컨펌 후 실행**:
1. `DROP TABLE IF EXISTS board_edges, board_nodes, boards CASCADE;` (보드 3테이블. 다른 테이블이 boards를 참조하지 않음 — 안전)
2. `DELETE FROM flyway_schema_history WHERE version IN ('24','25','26');` (적용 기록 제거 → V24~26이 pending 상태로 돌아감)
3. `./gradlew flywayMigrate`(또는 `bootRun`이 자동 적용) → **편집된 V24~26 재적용** → `boards`/`cards`/`links` 신규 생성.

> 대안(전체 DB 재생성 `docker compose down -v`)은 projects·documents 등 모든 dev 데이터를 날려 과함 — surgical 3테이블 drop이 적절. 로컬 한정·운영 무접촉.

## Decision 2 — FE 어댑터 경계: RF API는 보존, 도메인 식별자만 rename

- **Decision**: React Flow 자체 API(`useNodesState`·`useEdgesState`·`Node`/`Edge` 타입·`onConnect`·`OnConnect`·`ConnectionMode`·`nodeTypes`/`edgeTypes`·`nodesConnectable`·`getNode`·`useReactFlow`·`@xyflow/react` import)는 어댑터 파일(`PlotBoardCanvas`·`linkGraph`·`CardNode`·`LinkEdge`) 안에 **그대로**. 우리 도메인 데이터/타입/훅 참조만 card/link로 rename.
- **Rationale**: PRD §8 어댑터 경계 — "React Flow의 node/edge는 어댑터 안에서만". `linkGraph.ts` 헤더가 이미 이 경계를 명시(이미 존재·문서화된 어댑터). grep 분류 결과 `PlotBoardCanvas` 130 refs 중 ~절반이 RF API(보존), ~절반이 도메인(rename). RF API를 억지로 rename하면 라이브러리 계약이 깨진다.
- **Alternatives**: 얇은 어댑터 추출 리팩토링까지 — 아키텍처는 깨끗하나 rename에 구조 변경이 겹쳐 트랙 A 연결 UI 회귀 위험 ↑(룰 §15). **사용자 승인으로 rename-only 채택**.

### 어댑터 내부 식별자 처리 규칙
| 식별자 | 처리 | 사유 |
|---|---|---|
| `NodeCard.tsx`/`NodeCard` | → `CardNode.tsx`/`CardNode` | RF custom node가 Card를 렌더 → "Card를 그리는 node". 도메인(Card) 선행 |
| `LinkEdge.tsx`/`LinkEdge` | **유지** | 이미 Link-led(Link를 그리는 edge). 변경 불필요 |
| `linkGraph.toRFEdge(edge)` | 함수명 유지, 인자 `edge: BoardEdgeResponse`→`link: LinkResponse`, 반환 RF `Edge` 유지 | RF 경계 변환 함수 — 이름이 "RF Edge로 변환"을 명시 |
| `linkGraph.neighborNodeIds` | → `neighborCardIds` | 반환이 이웃 **카드** id 집합 |
| `linkGraph.incidentEdgeIds` | → `incidentLinkIds` | 반환이 인접 **연결** id 집합 |
| `linkGraph.isPairLinked/isSelfLink/canLink(edges)` | 함수명 유지, RF `Edge[]` 인자명 `edges` 유지(RF 타입) | 어댑터 내부 RF 그래프 질의 |
| `nodeKinds.ts`/`NODE_KINDS` 등 | → `cardKinds.ts`/`CARD_KINDS` | 카드 종류 정의(도메인). **값 문자열(plot 등)은 DB type 값이라 유지** |

## Decision 3 — 네이밍 = bare Card / Link

- **Decision**: 엔티티 `Card`/`Link`, DTO `CardResponse`/`LinkResponse`/`CreateCardRequest` 등. board 접두 없음.
- **Rationale**: PRD §0 유비쿼터스 언어("코드·DB·API·화면 같은 용어"). 하드 충돌 없음(실측: BE에 `class Card`/`class Link` 부재). 의미 중복(`ProjectCardResponse`·`LinkEmailResponse`·`LinkKakaoStateRequest`)은 board 패키지/컨텍스트로 구분.
- **Alternatives**: `BoardCard`/`BoardLink` — 모호성 제거하나 PRD "같은 용어" 약화 + 테이블 `cards`/`links`와 접두 불일치. **사용자 승인으로 bare 채택**.

## Decision 4 — rename 순서 = BE 선행 → FE 후행

- **Decision**: BE 전부(마이그레이션·엔티티·repo·service·DTO·controller·에러코드·테스트) 먼저 GREEN → 로컬 DB 리셋(컨펌) → FE 전부 GREEN → 통합 dogfooding.
- **Rationale**: BE가 API 계약(endpoint·필드명)의 SoT. BE를 먼저 확정해야 FE가 맞출 대상이 고정된다. BE 테스트는 standalone GREEN 가능(통합은 dogfooding). **배포 순서 아님** — 보드 미배포라 038 merge 시 원자적 동반(BE-first-deploy로 구 FE 깨질 prod가 없음).
- **Note**: 각 측 게이트는 독립 GREEN. 통합(FE↔BE endpoint·필드 정합)은 풀스택 dogfooding이 게이트.

## Decision 5 — 동작 보존 검증 = 기존 테스트 + 회귀 grep + dogfooding 전항

- **Decision**: 신규 테스트 0(rename은 룰 §5-5 TDD 예외). 기존 `BoardServiceTest`/`BoardControllerIT`/`linkGraph.test.ts`/`useBoards.test.tsx`를 rename 동기 후 GREEN = 회귀 게이트. + 회귀 grep(어댑터 밖 node/edge 0·DB board_nodes/edges 0·화면 node/edge/메모 0) + dogfooding 전항(트랙 A quickstart 동일).
- **Rationale**: 동작 변화가 없어야 하므로 "기존 테스트가 rename 후에도 통과"가 곧 동작 보존 증명. 캔버스 제스처는 jsdom 미검증이라 dogfooding이 필수 게이트(룰 §25 전항 확인).
