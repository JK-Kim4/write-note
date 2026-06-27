# Quickstart / 검증 게이트 — 보드 유비쿼터스 언어 정리 (트랙 B)

> rename 트랙의 검증 = ① 게이트 GREEN ② 회귀 grep(잔재 0) ③ dogfooding 전항(트랙 A 동작 보존). 셋 다 통과해야 완료(룰 §25 — 일부 통과를 전체로 단정 금지).

## 0. 구현 순서 (BE 선행 → 로컬 DB 리셋 → FE)

1. **BE rename** 전부 → 게이트 GREEN (아래 §1)
2. **로컬 DB 리셋**(컨펌 후) → §3
3. **FE rename** 전부 → 게이트 GREEN (§2)
4. **풀스택 dogfooding**(§4) + **회귀 grep**(§5)

## 1. BE 게이트
```bash
cd backend
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```
- 기대: 전부 GREEN. `BoardServiceTest`·`BoardControllerIT` rename 동기 후 통과(엣지 케이스 = 자기연결 400·중복 409·타보드 400·매핑 충돌 409 동일).
- 포어그라운드 실행(CLAUDE.md 작업 실행 지침).

## 2. FE 게이트
```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
- 기대: typecheck 0err · lint 0err · test(트랙 A 685 대비 감소 0) · build(RSC 경계).
- `linkGraph.test.ts`(헬퍼명 `neighborCardIds`/`incidentLinkIds` 동기)·`useBoards.test.tsx`(훅명 동기) GREEN.

## 3. 로컬 dev DB 리셋 (DB 쓰기 — 사용자 컨펌 후 실행, 로컬 한정)
in-place 마이그레이션 편집으로 V24~26 체크섬이 어긋남. board 3테이블만 surgical 리셋:
```bash
# 1) 보드 3테이블 drop + flyway history 3행 삭제 (다른 dev 데이터 보존)
docker exec write-note-postgres psql -U writenote -d writenote -c \
  "DROP TABLE IF EXISTS board_edges, board_nodes, cards, links, boards CASCADE; \
   DELETE FROM flyway_schema_history WHERE version IN ('24','25','26');"
# 2) 재마이그레이션 (편집된 V24~26 재적용 → boards/cards/links 생성)
cd backend && ./gradlew flywayMigrate   # 또는 bootRun 이 자동 적용
# 3) 확인
docker exec write-note-postgres psql -U writenote -d writenote -c "\dt cards; \dt links;"
docker exec write-note-postgres psql -U writenote -d writenote -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='links' AND column_name LIKE '%card_id';"
```
- 기대: `cards`·`links` 존재, `board_nodes`·`board_edges` 부재, `links`에 `source_card_id`/`target_card_id`.
- 트랙 A dogfooding 카드는 지워짐 → §4 dogfooding 때 새로 생성.

## 4. dogfooding 전항 (트랙 A 동작 보존 — 풀스택, 전부 사용자 확인)
> 로컬 풀스택 필요(DB→BE bootRun→FE pnpm dev, 메모리 [[local-dogfooding-needs-backend]]). 아래 **전항**을 사용자가 확인해야 "통과" 단정(룰 §25).

- [ ] **카드 만들기**: 툴바 새 카드 / 빈 곳 → 생성·제목 입력·본문·종류(색) 정상.
- [ ] **드래그 배치 + 영속**: 카드 드래그 후 손 떼면 위치 저장, 재진입 시 복원.
- [ ] **잇기 4경로**: ① 연결점 드래그→유효 카드 drop ② 빈 곳 drop→"새 카드 만들어 잇기" ③ 클릭-클릭(잇기 모드 인디케이터 "연결할 카드 고르기") ④ 중복쌍·자기연결 무시.
- [ ] **테두리 앵커**: 드래그로 고른 시작/종료 테두리에 연결선이 붙고, 재진입에도 같은 테두리 유지.
- [ ] **끊기**: custom edge hover ✕ + Delete 키 → 연결 제거(낙관/롤백).
- [ ] **이웃 강조**: 카드 선택 시 이웃 카드·연결선 또렷, 나머지 dim.
- [ ] **매핑**: 보드↔작품·시리즈 연결/해제, 매핑 충돌 409 안내.
- [ ] **뷰포트 영속**: 줌/팬 후 재진입 시 마지막 뷰포트 복원.
- [ ] **화면 문구**: `node/edge/메모` 등 내부·폐기 용어 노출 0.

## 5. 회귀 grep (잔재 0 — SC-002)
```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note
# (a) BE 도메인 코드에 board_node/board_edge·BoardNode/BoardEdge 잔재 0
grep -rniE "board_node|board_edge|BoardNode|BoardEdge" backend/src --include=*.kt
# (b) BE 마이그레이션에 board_nodes/board_edges 0 (cards/links만)
grep -rniE "board_nodes|board_edges" backend/src/main/resources/db/migration
# (c) FE 어댑터 밖 도메인 코드에 도메인 node/edge 식별자 0
#     (어댑터 파일=PlotBoardCanvas/linkGraph/CardNode/LinkEdge 제외하고 검사)
grep -rnE "BoardNodeResponse|BoardEdgeResponse|sourceNodeId|targetNodeId|useCreateNode|useCreateEdge|nodeKinds|NodeCard" frontend/src/lib frontend/src/app
# (d) 화면 문구(JSX 텍스트)에 node/edge/메모(구 메뉴) 0 — 수동 확인 보조
grep -rniE ">[^<]*(노드|엣지)[^<]*<" frontend/src/components/board frontend/src/app
```
- 기대: (a)(b)(c) **0건**. (d)는 화면 텍스트 점검 보조(어댑터 코드 주석/RF 타입은 제외 판단).
- **어댑터 내부 RF API(`useNodesState`·`Node`·`onConnect` 등)는 의도적 보존** — grep 잔재로 세지 않음(PRD §8).
