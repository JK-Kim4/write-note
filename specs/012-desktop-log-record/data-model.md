# Phase 1 Data Model: Desktop 기록(Log)

기존 `desktop/electron/db/` 패턴(snake_case DB ↔ camelCase 도메인, repository 매핑)을 따른다.

## 1. 신규 테이블 (스키마 v5 → v6)

`schema.ts` 메인 `CREATE TABLE IF NOT EXISTS` 블록에 두 테이블을 추가하고 `SCHEMA_VERSION = 6` 으로 올린다. **두 테이블 모두 완전 신규**라 기존 DB 업그레이드용 `ALTER` 가 필요 없다 — 메인 블록의 `IF NOT EXISTS` 가 기존 DB 에도 생성한다. `migrate()` 의 버전 분기에는 v6 주석만 추가(별도 `if (version < 6)` ALTER 불필요).

```sql
CREATE TABLE IF NOT EXISTS project_logs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS work_sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at  TEXT NOT NULL,
  ended_at    TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_project_logs_project   ON project_logs(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project  ON work_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_open     ON work_sessions(ended_at);  -- closeDangling/열린 세션 조회
```

**CASCADE**: 작품 삭제 시 두 테이블 행도 삭제(기존 `documents`/`memo_projects` 와 동일). FK=ON 은 기존 connection 설정 사용(검증된 PRAGMA).

**STRICT**: 기존 테이블과 동일하게 STRICT 타입 적용.

## 2. 도메인 타입 (`types.ts` 추가)

```ts
export type ProjectLog = {
  id: string;
  projectId: string;
  body: string;
  createdAt: string;        // ISO
};

export type WorkSession = {
  id: string;
  projectId: string;
  startedAt: string;        // ISO
  endedAt: string | null;   // null = 진행 중
};

/** 기록 화면 카드용 집계 — 작품 + 파생 표시값 + 최신 기록 1개 + 총 작업 시간. */
export type LogCard = {
  project: Project;             // title, targetLength, updatedAt 등
  wordCount: number;           // 그 작품 단일 document 의 word_count(공백 제외 글자수)
  lastSentenceSource: string;  // document.plain_text (renderer 가 lastSentence() 파생)
  latestLog: ProjectLog | null;// 최신 기록 메모 1개(없으면 null)
  totalDurationMs: number;     // 종료된 세션 합(진행 중·폐기 제외)
};
```

> 누적 기록 전체(`logs: ProjectLog[]`)는 `LogCard` 에 싣지 않는다(R1 — 아코디언 펼침 시 `logs.listByProject` lazy 조회).

## 3. Repository 인터페이스

### 3-1. `ProjectLogRepository` (신규)

| 메서드 | 시그니처 | 동작 |
|---|---|---|
| create | `create(projectId: string, body: string): ProjectLog` | `created_at = now()`(main 시계). id 생성(기존 id 생성 유틸 재사용). |
| listByProject | `listByProject(projectId: string): ProjectLog[]` | `created_at DESC` 정렬(아코디언 누적). |
| latestByProject | `latestByProject(projectId: string): ProjectLog \| null` | 최신 1개(카드 집계용). |

### 3-2. `WorkSessionRepository` (신규)

상수: `MIN_SESSION_MS = 30_000`.

| 메서드 | 시그니처 | 동작 |
|---|---|---|
| start | `start(projectId: string): WorkSession` | 그 작품의 열린 세션이 있으면 먼저 `endOpen` 으로 닫고, 새 행 생성(`started_at = now`, `ended_at = NULL`). 작품당 열린 세션 1개 보장. |
| endOpen | `endOpen(projectId: string, endedAt: string): void` | 그 작품의 열린 세션을 `ended_at = endedAt` 으로 종료. duration < `MIN_SESSION_MS` 면 행 삭제(자동 종료 30s 폐기). |
| endAllOpenSessions | `endAllOpenSessions(endedAt: string): void` | 모든 작품의 열린 세션 종료(앱 `before-quit`). 각 세션 30s 폐기 동일 적용. |
| closeDangling | `closeDangling(): void` | 앱 시작 시 `ended_at IS NULL` 세션을 폐기 처리(`ended_at = started_at` → duration 0, 또는 행 삭제). 비정상 종료 잔여 정리. |
| totalDurationMsByProject | `totalDurationMsByProject(projectId: string): number` | `SUM(ended_at − started_at)` (종료된 세션만, ISO 차이 ms). |

> **명시 종료는 repository 가 아닌 Store 트랜잭션**(`endSessionWithLog`)에서 처리 — 짧은 세션이라도 기록 메모가 붙으면 보존(R6). 따라서 명시 종료는 `endOpen` 의 30s 폐기 분기를 타지 않는 별도 종료 경로를 쓴다(예: `endOpenKeep(projectId, endedAt)` 또는 Store 내부에서 직접 UPDATE).

## 4. Store use-case (집계·트랜잭션)

| 메서드 | 시그니처 | 동작 |
|---|---|---|
| addProjectLog | `addProjectLog(projectId, body): ProjectLog` | 기록 메모만 추가(세션 무관 경로, 필요 시). |
| endSessionWithLog | `endSessionWithLog(projectId, body): { session, log }` | **트랜잭션**: 열린 세션 종료(30s 폐기 미적용·보존) + `project_logs` 추가. 부분 실패 방지(FR-011). |
| listLogCards | `listLogCards(): LogCard[]` | 작품마다 `{ project, wordCount, lastSentenceSource, latestLog, totalDurationMs }` 집계. `projects.list()`(updated_at DESC) 순회 + 각 작품 document·latestLog·totalDuration 조회. |
| closeDangling | `closeDangling(): void` | `workSessions.closeDangling()` 위임(앱 시작 시 main 호출). |
| endAllOpenSessions | `endAllOpenSessions(endedAt): void` | `workSessions.endAllOpenSessions(endedAt)` 위임(before-quit main 호출). |

> `endSessionWithLog` 의 세션 종료는 `endOpen`(30s 폐기) 과 **다른 경로**여야 한다. 짧은 명시 종료 보존을 위해 Store 트랜잭션 내에서 열린 세션을 직접 `ended_at` 갱신(폐기 분기 없이) 후 로그 추가.

## 5. 표시값 출처 명세 (rule §9 정합)

| 화면 표시 | 테이블·필드 | 분류 | IPC |
|---|---|---|---|
| 작품 제목 | `projects.title` | 저장 입력 | `logs.list` |
| 진척 % | `documents.word_count` ÷ `projects.target_length` | 파생(renderer 계산) | `logs.list` |
| 최근 수정일 | `projects.updated_at` | 저장(본문 저장 시 touch) | `logs.list` |
| 마지막 문장 | `documents.plain_text` → `lastSentence()` | 파생(renderer) | `logs.list` |
| 최신 기록 1줄 | `project_logs.body`(latest) | 저장 입력(집필 종료 모달) | `logs.list` |
| 누적 기록 전체 | `project_logs.*`(DESC) | 저장 입력 | `logs.listByProject`(lazy) |
| 총 작업 시간 | `Σ work_sessions(ended−started)` | 파생(repository 합산) | `logs.list` |

## 6. 마이그레이션 안전성

- v6 는 **신규 테이블 추가만** — 기존 행 변형(ALTER/UPDATE) 없음 → 데이터 손실 0.
- 기존 DB(v5): 메인 `CREATE TABLE IF NOT EXISTS` 가 두 테이블 생성, `PRAGMA user_version = 6` 설정.
- 신규 DB: 동일 경로로 최신 스키마.
- 테스트: `schema.test.ts` 에 v5→v6 업그레이드(기존 데이터 보존 + 신규 테이블 존재) + 신규 DB 케이스.
