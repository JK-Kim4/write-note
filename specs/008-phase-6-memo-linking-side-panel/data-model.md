# Phase 1 Data Model: 메모↔작품 연결 + 집필 사이드 패널 (Desktop Phase 6)

## 1. 도메인 엔티티

### 1-1. Memo (수정) — `desktop/electron/db/types.ts`

`linkedProjectId`(단수, nullable) 를 **`linkedProjectIds: string[]`**(연결 작품 id 목록, 읽기용 집계)로 교체.

| 필드 | 타입 | 의미 | 변경 |
|---|---|---|---|
| `id` | `string` | 메모 식별자(UUID) | 기존 |
| `body` | `string` | 본문 | 기존 |
| `capturedAt` | `string`(ISO) | 캡처 시각 — 정렬·날짜 라벨 기준 | 기존 |
| `source` | `string` | 캡처 출처(기본 `"app"`) | 기존 |
| ~~`linkedProjectId`~~ | ~~`string \| null`~~ | — | **제거** |
| **`linkedProjectIds`** | **`string[]`** | **연결된 작품 id 목록(미연결이면 `[]`)** | **신규(집계 필드)** |
| `createdAt` | `string`(ISO) | 생성 시각 | 기존 |
| `updatedAt` | `string`(ISO) | 수정 시각 | 기존 |
| `deletedAt` | `string \| null`(ISO) | soft delete 표식(null = 미삭제) | 기존 |

> `linkedProjectIds` 는 `memos` row 에 없는 **파생 집계** — repository 가 `memo_projects` 조인으로 채운다.

### 1-2. Memo–Project Link (신규 엔티티)

메모와 작품의 다대다 연결. 도메인 타입으로 노출할 필요는 없고 저장 계층(연결 테이블)으로만 존재.

| 속성 | 의미 |
|---|---|
| `memoId` | 연결된 메모 |
| `projectId` | 연결된 작품 |
| `createdAt` | 연결 생성 시각 |
| 제약 | `(memoId, projectId)` 쌍 유일 — 중복 연결 불가(FR-014 멱등 근거) |

## 2. 저장 스키마 (v3 → v4)

### 2-1. 신규 연결 테이블

```sql
CREATE TABLE IF NOT EXISTS memo_projects (
  memo_id    TEXT NOT NULL REFERENCES memos(id)    ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (memo_id, project_id)
) STRICT;
```

- `PRIMARY KEY(memo_id, project_id)` → 같은 쌍 중복 방지(멱등). `INSERT OR IGNORE` 로 addLink 멱등 구현.
- 양쪽 `ON DELETE CASCADE` → 메모 hard-delete/작품 삭제 시 연결 행 자동 정리. 메모 자체는 작품 삭제와 무관하게 보존(FR-011).

### 2-2. `memos` 테이블 — `linked_project_id` 제거

```sql
-- v4 신규 DB: memos 에서 linked_project_id 빠짐
CREATE TABLE IF NOT EXISTS memos (
  id          TEXT PRIMARY KEY,
  body        TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'app',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
) STRICT;
```

### 2-3. 마이그레이션 (v3 → v4) — `schema.ts`

`SCHEMA_VERSION = 4`. 실측 검증 완료(research R2).

1. `memo_projects` 테이블 생성(신규 DB 는 `IF NOT EXISTS` 로 최신 스키마 직행, `linked_project_id` 없음).
2. 기존 DB 업그레이드 — `PRAGMA user_version < 4` 분기:
   - `PRAGMA table_info(memos)` 로 `linked_project_id` 컬럼 존재 시:
     - 이관: `INSERT OR IGNORE INTO memo_projects (memo_id, project_id, created_at) SELECT id, linked_project_id, updated_at FROM memos WHERE linked_project_id IS NOT NULL`
     - 제거: `ALTER TABLE memos DROP COLUMN linked_project_id` (SQLite 3.51.2 / FK=ON 가용 — 실측)
3. `PRAGMA user_version = 4`.

> 기존 v2(genre)·v3(deleted_at) 분기는 유지. v4 분기 추가.

## 3. Repository 연산 — `MemoRepository` (`memoRepository.ts`)

| 메서드 | 시그니처 | 동작 | 변경 |
|---|---|---|---|
| `create` | `(CreateMemoInput) => Memo` | 메모 INSERT(연결은 store.captureMemo 가 처리). `linkedProjectId` 입력 의존 제거 | 수정 |
| `getById` | `(id) => Memo \| null` | `linkedProjectIds` 채워 반환(삭제분도 조회 — restore 확인용) | 수정 |
| `list` | `() => Memo[]` | `deleted_at IS NULL` + `captured_at DESC`, 각 메모 `linkedProjectIds` 집계 | 수정 |
| **`listByProject`** | **`(projectId) => Memo[]`** | 연결 테이블 조인 → 해당 작품 연결(미삭제) 메모만 `captured_at DESC` | **신규** |
| **`addLink`** | **`(memoId, projectId) => void`** | `INSERT OR IGNORE INTO memo_projects (...)` (멱등) | **신규** |
| **`removeLink`** | **`(memoId, projectId) => void`** | `DELETE FROM memo_projects WHERE memo_id=? AND project_id=?` | **신규** |
| `softDelete` | `(id) => boolean` | 기존 유지 | — |
| `restore` | `(id) => Memo \| null` | 기존 유지(연결 행은 그대로라 복원 시 연결 복귀, FR-012) | — |
| ~~`link`~~ | ~~`(id, projectId\|null)`~~ | — | **제거** |

`CreateMemoInput` 에서 `linkedProjectId` 제거(연결은 store 단에서 분리 처리).

## 4. Store use-case — `store.ts`

| 메서드 | 시그니처 | 동작 | 변경 |
|---|---|---|---|
| **`captureMemo`** | **`({ body, source?, linkProjectId? }) => Memo`** | 메모 생성 + (linkProjectId 있으면) `addLink` 를 **한 트랜잭션**으로(BEGIN/COMMIT/ROLLBACK, 기존 패턴) | **신규** |

> `addLink`/`removeLink`/`listByProject` 는 단일 테이블 작업이라 store 트랜잭션 불필요 — `store.memos.*` 직접 노출(기존 `softDelete`/`restore` 패턴). `captureMemo` 만 두 테이블(메모+연결)이라 트랜잭션.

## 5. Renderer view 타입

### 5-1. `InboxMemo` (수정) — `src/types.ts`

`linkedProjectId/linkedProjectTitle`(단수) → **`linkedProjects`(복수)**.

```ts
export type LinkedProject = { id: string; title: string };

export type InboxMemo = {
  id: string;
  body: string;
  dateLabel: string;                 // capturedAt → "오늘/어제/N일 전/N주 전"
  linkedProjects: LinkedProject[];   // 연결 작품(제목 붙음). 미연결이면 []
};
```

> 기존 더미 `Memo`(`date`, `tag`)는 `MemoPanel` 더미 제거와 함께 삭제.

### 5-2. 매퍼 — `src/lib/memoView.ts`

```ts
toInboxMemoView(memo: Memo, projectTitleById: Map<string,string>, now: Date): InboxMemo
```

- `dateLabel = formatRelativeDay(memo.capturedAt, now)` (기존 공용 `lib/relativeDate.ts`).
- `linkedProjects = memo.linkedProjectIds.map(id => ({ id, title: projectTitleById.get(id) })).filter(제목 존재)` — 사라진 작품 id 는 걸러냄(작품 삭제 cascade 로 보통 발생 안 하나 방어).

## 6. 엔티티 관계

```
Project (0..N) ──< memo_projects >── (0..N) Memo
                      │ PK(memo_id, project_id)
                      │ memo_id  → memos(id)    ON DELETE CASCADE
                      └ project_id → projects(id) ON DELETE CASCADE

작품 삭제 → 그 작품의 memo_projects 행만 삭제(메모 보존, FR-011)
메모 soft-delete(deletedAt) → list/listByProject 에서 제외, 연결 행은 보존(복원 시 복귀, FR-012)
중복 (memo_id, project_id) → PK 충돌, INSERT OR IGNORE 로 멱등(FR-014)
```
