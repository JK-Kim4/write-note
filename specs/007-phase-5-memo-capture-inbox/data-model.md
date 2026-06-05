# Phase 1 Data Model: 빠른 메모 캡처 + Inbox

## 1. 도메인 엔티티 — Memo

기존 `desktop/electron/db/types.ts`의 `Memo`에 `deletedAt` 추가.

| 필드 | 타입 | 의미 | 비고 |
|---|---|---|---|
| `id` | `string` | 메모 식별자(UUID) | 기존 |
| `body` | `string` | 본문(필수, 공백만 불가) | 기존 |
| `capturedAt` | `string`(ISO) | 캡처 시각 — inbox 정렬·날짜 라벨 기준 | 기존 |
| `source` | `string` | 캡처 출처(기본 `"app"`) | 기존, 본 Phase 미사용 |
| `linkedProjectId` | `string \| null` | 연결된 작품 id(미연결이면 null) | 기존 |
| `createdAt` | `string`(ISO) | 생성 시각 | 기존 |
| `updatedAt` | `string`(ISO) | 수정 시각(삭제/복원 시 touch) | 기존 |
| **`deletedAt`** | **`string \| null`(ISO)** | **삭제 시각(null = 미삭제). soft delete 표식** | **신규** |

**검증 규칙**
- `body.trim()` 비어 있으면 생성 거부(repository 진입 전 UI 가드 + 의미상 빈 메모 무의미).
- `deletedAt != null`인 메모는 `list()` 결과에서 제외.

**상태 전이**
```
(생성) ──create──▶ active(deletedAt = null)
active ──softDelete──▶ deleted(deletedAt = ISO now)
deleted ──restore──▶ active(deletedAt = null)
```
- `active`만 inbox에 표시. `deleted`는 어떤 필터에서도 비노출.
- 재시작 후에도 `deletedAt` 영속 → 삭제 상태 유지(FR-012/FR-013).

## 2. 저장 스키마 — `memos` 테이블 (v3)

```sql
CREATE TABLE IF NOT EXISTS memos (
  id                TEXT PRIMARY KEY,
  body              TEXT NOT NULL,
  captured_at       TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'app',
  linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT            -- 신규: nullable, NULL = 미삭제
) STRICT;
```

**마이그레이션 (v2 → v3)** — `schema.ts`
- `SCHEMA_VERSION = 3`.
- 신규 DB: 위 `CREATE TABLE`에 `deleted_at` 포함.
- 기존 DB: `PRAGMA user_version < 3` 분기에서 `PRAGMA table_info(memos)`로 `deleted_at` 부재 확인 후 `ALTER TABLE memos ADD COLUMN deleted_at TEXT`.
- 기존 `linked_project_id ... ON DELETE SET NULL` 유지 → 작품 삭제 시 메모는 미연결로 보존(spec Edge Case).

## 3. Repository 연산 — `MemoRepository`

| 메서드 | 시그니처 | 동작 |
|---|---|---|
| `create` | `(CreateMemoInput) => Memo` | 기존. row에 `deleted_at = null` |
| `getById` | `(id) => Memo \| null` | 기존. `deleted_at` 매핑 포함(삭제분도 조회 가능 — restore 대상 확인용) |
| `list` | `() => Memo[]` | **수정**: `WHERE deleted_at IS NULL ORDER BY captured_at DESC` |
| `link` | `(id, projectId \| null) => Memo \| null` | 기존 |
| **`softDelete`** | **`(id) => boolean`** | **신규**: `UPDATE memos SET deleted_at=?, updated_at=? WHERE id=?`. 영향 행 1이면 true |
| **`restore`** | **`(id) => Memo \| null`** | **신규**: `UPDATE memos SET deleted_at=NULL, updated_at=? WHERE id=?` 후 갱신된 Memo 반환(없으면 null) |

> `softDelete`/`restore`는 단일 테이블 작업이라 Store 트랜잭션 use-case 불필요 — `store.memos.softDelete(id)`로 직접 노출(기존 `link` 패턴).

## 4. Renderer view 타입

### 4-1. `InboxMemo` (수정) — `src/types.ts`
도메인 `Memo`에서 inbox 표시에 필요한 것만 파생.

```ts
export type InboxMemo = {
  id: string;
  body: string;
  dateLabel: string;            // capturedAt → "오늘/어제/N일 전/N주 전"
  linkedProjectId: string | null;
  linkedProjectTitle: string | null;  // 연결 작품 제목(미연결/미존재 시 null)
};
```
> 기존 더미 `InboxMemo`(`date`, `linkedProject` 문자열)는 위로 대체. `MemoPanel`이 쓰는 `Memo`(tag 보유)는 Phase 6 영역이라 **유지**.

### 4-2. 매퍼 — `src/lib/memoView.ts`
```ts
toInboxMemoView(memo: Memo, projectTitleById: Map<string,string>, now: Date): InboxMemo
```
- `dateLabel = formatRelativeDay(memo.capturedAt, now)` (공용 `lib/relativeDate.ts`)
- `linkedProjectTitle = memo.linkedProjectId ? projectTitleById.get(memo.linkedProjectId) ?? null : null`

## 5. 엔티티 관계

```
Project (1) ──◀ linked_project_id (0..N) Memo
   │ ON DELETE SET NULL
   └─ 작품 삭제 → 연결 메모는 linkedProjectId=null(보존)

Memo.deletedAt: null(active) | ISO(deleted) — inbox는 active만
```
