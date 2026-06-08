# Phase 0 Research: 메모↔작품 연결 + 집필 사이드 패널 (Desktop Phase 6)

브레인스토밍(2026-06-05)에서 주요 결정이 확정되어 NEEDS CLARIFICATION 은 없다. 본 문서는 (a) 확정 결정의 근거 정리와 (b) 마이그레이션 기술 리스크의 **실측 결과**를 담는다.

## R1. 메모↔작품 연결의 저장 형태 — 연결 테이블 (many-to-many)

- **Decision**: 별도 연결 테이블 `memo_projects(memo_id, project_id, created_at)` 도입. 기존 `memos.linked_project_id` 단일 컬럼은 은퇴.
- **Rationale**: 한 메모가 여러 작품에 연결되려면(다중 연결, spec FR-002) 단일 외래키 컬럼으로 표현 불가. 연결 쌍을 행으로 저장하는 정규화 테이블이 표준. 보존된 WEB 트랙도 동일하게 `memo_projects` 연결 테이블(V6)로 설계했다 — 제품 원래 의도와 정합.
- **Alternatives considered**:
  - `linked_project_id` 를 콤마 구분 문자열/JSON 배열로 확장 → 조회·무결성·인덱싱 모두 악화, STRICT 테이블 취지 위배. 기각.
  - 단일 연결 유지(다중 미지원) → spec 범위 확장 결정과 충돌. 기각.

## R2. 마이그레이션 v3 → v4 — `linked_project_id` 은퇴 절차 (실측 완료)

- **Decision**: ① `memo_projects` 생성 → ② 기존 `linked_project_id IS NOT NULL` 행을 연결 행으로 이관 → ③ `ALTER TABLE memos DROP COLUMN linked_project_id` → ④ `PRAGMA user_version = 4`.
- **실측 (Node 24.14.0 / node:sqlite, 2026-06-05):**
  - `SELECT sqlite_version()` → **3.51.2** (DROP COLUMN 지원 기준 3.35.0 상회).
  - STRICT + FK 테이블에서 `ALTER TABLE memos DROP COLUMN linked_project_id` → **성공**. `PRAGMA foreign_keys = ON` 상태(실제 `createDb` 경로)에서도 성공.
  - 이관 쿼리 `INSERT INTO memo_projects (memo_id, project_id, created_at) SELECT id, linked_project_id, <now> FROM memos WHERE linked_project_id IS NOT NULL` → 기존 단일 연결이 연결 행으로 정확히 보존(spec SC-006).
  - `ON DELETE CASCADE` (foreign_keys ON) → 작품 삭제 시 연결 행만 삭제, 메모 보존 확인.
- **Rationale**: DROP COLUMN 직접 가능함이 실측되어, 작업 지시서가 대비책으로 남긴 "표준 테이블 재생성(12-step)"은 **불필요**. 단일 진실원(연결은 `memo_projects` 만) 유지.
- **Alternatives considered**: 컬럼 유지(두 진실원) → 동기화 버그 위험. 기각. 테이블 재생성 → DROP COLUMN 가능하므로 과한 복잡도. 기각.
- **주의**: 마이그레이션은 로컬 dev `.db` 한정 자체 수행. 외부 PostgreSQL/redis 대상 아님(`external-infra-safety.md` 비대상).

## R3. Inbox 메모별 연결 작품 조회 — `list()` 집계 vs 별도 조회

- **Decision**: `MemoRepository.list()` 가 각 메모에 `linkedProjectIds: string[]` 를 채워 반환(연결 테이블 조인/집계). renderer 는 메모 목록 한 번으로 연결 상태까지 확보.
- **Rationale**: Inbox 는 모든 메모 + 각자의 연결을 한 화면에 그리므로, 메모별 N회 추가 조회(N+1)보다 한 번의 집계가 단순·효율. 기존 Inbox 가 이미 `projects.list()` 로 제목 맵을 만드는 흐름과 합쳐 칩 표시(spec FR-004) 완성.
- **Alternatives**: `list()` 는 순수 메모만, 연결은 `listLinks()` 별도 IPC → 호출 2회 + renderer 조립 부담. 단순성 위해 집계 채택.

## R4. 집필 패널 데이터 — `listByProject(projectId)` 신규 조회

- **Decision**: `MemoRepository.listByProject(projectId)` 신규 — 연결 테이블 조인으로 해당 작품 연결 메모(soft-delete 제외)만 `captured_at DESC` 반환. 집필 패널(spec FR-006)이 이를 호출.
- **Rationale**: 패널은 "현재 작품 연결 메모만" 필요(다른 작품/미연결 노출 0건, SC-003). 전체 `list()` 를 renderer 에서 필터링할 수도 있으나, 전용 쿼리가 의도를 명확히 하고 메모 증가 시에도 그 작품 분량만 전송.
- **Alternatives**: renderer 가 `list()` 후 `linkedProjectIds.includes(projectId)` 필터 → 동작은 하나 패널이 전체 메모를 받는 낭비 + 의도 불명확. 전용 메서드 채택.

## R5. 연결 변경 후 패널 갱신 (spec FR-009)

- **Decision**: 기존 App `memoRefresh` 카운터 브리지 재사용 + 패널 자체 재조회.
  - 패널 내 해제(US2) → 패널이 즉시 `listByProject` 재조회(즉시 반영).
  - Inbox/캡처에서의 변경 → 집필 화면 재진입 시 패널이 마운트/`activeProject` 변화로 재조회(현 구조상 두 화면 동시 노출 불가하므로 충분).
- **Rationale**: Phase 5 가 이미 `memoRefresh` 로 모달 캡처↔inbox 교차 갱신을 해결한 패턴. 신규 전역 상태 도입 없이 일관 유지(YAGNI).
- **Alternatives**: 전역 상태 라이브러리/이벤트 버스 → 단일 사용자 로컬 앱 규모에 과함. 기각.

## R6. 캡처 자동연결 동작 보존 (spec FR-010)

- **Decision**: `Store.captureMemo({ body, source?, linkProjectId? })` 신규 — 메모 INSERT + (linkProjectId 있으면) 연결 행 INSERT 를 **한 트랜잭션**으로. QuickCapture 는 기존처럼 active 작품 id 를 넘기고(없으면 미연결), inline inbox 캡처는 미연결.
- **Rationale**: 다대다 전환 후에도 "캡처 시 active 작품 자동 연결" 동작 유지. 메모만 생기고 연결이 누락되는 부분 실패를 트랜잭션으로 차단(Phase 4 `createProjectWithDocument`/`updateDocument` 트랜잭션 패턴 정합).
- **현황 확인(실측)**: `QuickCapture.tsx` 는 `memos.create({ body, linkedProjectId: activeProjectId })` 호출, `MemoInboxScreen` inline 은 `linkedProjectId: null`. → create 입력 키를 `linkProjectId` 로 정리하고 store 트랜잭션으로 결선.

## R7. 연결/해제 UI (spec FR-005, FR-001~003)

- **Decision**: Inbox 메모 행에 **"연결" 버튼**(삭제 버튼 옆) → 클릭 시 **체크리스트 팝오버**(신규 `LinkPopover`): 전체 작품 목록 + 연결 상태 체크, 토글 시 `addLink`/`removeLink` 즉시 호출. 연결된 작품은 행에 **칩**으로 표시하고 칩 ✕ 로도 해제. 작품 0개면 안내(FR-013).
- **Rationale**: 브레인스토밍 질문1=(b 연결 버튼), 질문2=(a 체크리스트 팝오버 + 칩 ✕). 다중 연결 상태를 한 화면에서 파악·수정. DESIGN.md §연결 칩·§세그먼트 토글·§Card 토큰 재사용(신규 비주얼 언어 없음).
- **Alternatives**: 단일 select 드롭다운 → 다중 연결 부적합. 기각.

## R8. 의존성·환경

- **Decision**: 신규 외부 의존성 0. 기존 스택(Electron + vite-plugin-electron, React 19, node:sqlite 내장) 그대로.
- **환경 게이트(회귀 방지)**: 셸 기본 Node v20 이나 node:sqlite 는 Node 24 필요 → 테스트/빌드 시 `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행 후 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행(corepack pnpm lockfile 충돌 회피). quickstart 에 명시.
