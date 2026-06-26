# Quickstart — 보드 트랙 C 코어 (검증·로컬 리셋·dogfooding)

## 1. 로컬 DB 리셋 (마이그레이션 in-place 편집 후, BE 게이트 전 — 사용자 컨펌 필수)

V24 in-place 편집은 공유 로컬 Docker PG(`localhost:5432/writenote`)와 체크섬 불일치 → 컨텍스트 로드 실패. 게이트 전 정합:

```sql
-- docker exec write-note-postgres psql -U writenote -d writenote
DROP TABLE IF EXISTS links CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS boards CASCADE;
DELETE FROM flyway_schema_history WHERE version IN ('24','25','26');
```
이후 BE 기동/테스트 시 Flyway가 V24(신 스키마)·V25·V26 재적용. **로컬 dev DB 쓰기 = 사용자 컨펌 후 내가 실행**(external-infra-safety §1). 보드 데이터는 로컬 dev뿐(미배포)이라 손실 무해.

## 2. 게이트

```bash
# BE (cwd=backend) — 로컬 리셋 후
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build

# FE (cwd=frontend 고정)
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## 3. 회귀 grep

```bash
# 어댑터 밖 node/edge 0 (어댑터=PlotBoardCanvas·linkGraph·CardNode·LinkEdge)
grep -rniE "\b(node|edge)\b" frontend/src/components/board frontend/src/app/\(main\)/boards | grep -viE "PlotBoardCanvas|linkGraph|CardNode|LinkEdge|@xyflow"
# 화면 폐기 문구 0
grep -rniE "owner_type|board_nodes|board_edges|메모 노드|엣지" frontend/src/app/\(main\)/boards frontend/src/components/board
# 제거된 에러코드 잔존 0
grep -rniE "BOARD_PROJECT_ALREADY_MAPPED|BOARD_CATEGORY_ALREADY_MAPPED|setBoardProject|setBoardCategory|BoardMappingControl" frontend/src backend/src/main
```

## 4. dogfooding 체크리스트 (전항 사용자 확인 후에만 통과 단정 — 룰 §25)

로컬 풀스택: `docker compose up -d --wait postgres`(확인) → `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`(:8080) → `cd frontend && pnpm dev`(:3000). 로그인 후 `보드` 메뉴.

1. **전역 생성 picker 3경로** — "보드 만들기" → "이 보드는 어디에 쓸 건가요?" → ① 이 작품(대상 선택) ② 시리즈 전체(대상 선택) ③ 아이디어 → 각각 생성 후 허브에 **소속 라벨**(작품명/시리즈명/"아이디어") 정확.
2. **나중에 붙이기** — 아이디어 보드 카드의 "작품/시리즈에 연결" → 대상 선택 → 라벨이 그 대상으로 즉시 갱신. (해제도: 다시 "아이디어"로 되돌리기.)
3. **검색** — 검색창에 작품명/시리즈명/보드명 일부 입력 → 가로질러 필터. 아이디어 보드도 보드명으로 잡힘. 비우면 전체 복귀.
4. **1:N** — 같은 작품에 보드 2개 생성 → 둘 다 그 작품 라벨로 보임(충돌·거부 0).
5. **대상 삭제 시 보드 보존** — 작품(또는 시리즈)에 소속된 보드를 둔 뒤 그 작품/시리즈 삭제 → 보드가 "아이디어" 라벨로 허브에 남고, 열어보면 카드·연결 보존.
6. **Track A/B 무회귀** — 보드 열기·카드 생성/드래그/본문·연결 잇기/끊기·이웃 강조·화면상태 복원 정상.

## 5. 배포

- 보드 도메인 develop·main 미배포 → API 계약 변경에도 prod 위험 0. 보드 트랙 누적분과 **원자적 동반 merge**(develop merge 시점은 사용자 결정).
- 코어 내 **BE 선행 → FE 후행**(API 계약 먼저 확정).
