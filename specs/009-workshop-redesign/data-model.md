# Phase 1 Data Model — 작업실 디자인 고도화

본 작업의 **데이터 변경은 두 건**: (1) 곁에 둘 쪽지 고정(`memo_projects.pinned`), (2) 작품의 다음에 쓸 장면(`projects.next_scene`). 둘 다 스키마 v5 한 마이그레이션에 묶는다. 그 외 엔티티 골격(documents/memos)은 불변.

## 스키마 변경 — v4 → v5

### `projects` — `next_scene` 컬럼 추가 (FR-027)

| 컬럼 | 타입 | v5 |
|---|---|---|
| (기존 title/summary/tone/genre/target_length/...) | | (불변) |
| **next_scene** | **TEXT** | **신규 `NOT NULL DEFAULT ''`** (작가가 적는 "다음에 쓸 장면" 한 줄) |

영향 파일: `projectRepository.ts`(ProjectRow·toProject·CreateProjectInput·create INSERT·update SET 에 next_scene 추가), `types.ts`(`Project.nextScene: string`). 기존 `projects.update`(IPC) 가 `UpdateProjectInput` 으로 next_scene 을 받는다(새 채널 불요).

### `memo_projects` (연결 테이블) — `pinned` 컬럼 추가

| 컬럼 | 타입 | 현재(v4) | v5 |
|---|---|---|---|
| memo_id | TEXT | FK memos, PK | (불변) |
| project_id | TEXT | FK projects, PK | (불변) |
| created_at | TEXT | 연결 시각 | (불변) |
| **pinned** | **INTEGER** | — | **신규 `NOT NULL DEFAULT 0`** (0=일반, 1=이 작품의 곁에 둘 쪽지) |

**마이그레이션(schema.ts, 기존 v2~v4 패턴 동일 — v5 한 블록에 두 ALTER)**:
```
if (version < 5) {
  const pcols = PRAGMA table_info(projects)
  if (!pcols.some(c => c.name === "next_scene")) {
    ALTER TABLE projects ADD COLUMN next_scene TEXT NOT NULL DEFAULT ''
  }
  const mcols = PRAGMA table_info(memo_projects)
  if (!mcols.some(c => c.name === "pinned")) {
    ALTER TABLE memo_projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0
  }
}
SCHEMA_VERSION = 5  // CREATE TABLE IF NOT EXISTS 정의에도 두 컬럼 반영
```

**불변식**:
- 작품당 고정 ≤ 1: 한 `project_id` 에서 `pinned=1` 행은 최대 1개(FR-026). set 시 같은 project 의 기존 pinned=1 → 0 후 대상 → 1(한 트랜잭션).
- 연결 삭제 시 고정 소멸: `removeLink` 가 행 삭제(기존 동작) → 고정도 사라짐(FR-025). 추가 코드 불필요.

## 도메인 타입 (electron/db/types.ts)

`Project` 에 `nextScene` 추가:
```ts
export type Project = { /* ...기존... */ nextScene: string };  // next_scene, DEFAULT ''
```

`Memo`(전역)는 그대로(작품 무관). **작품별 고정은 "그 작품 맥락의 메모"에서만 의미** → `listByProject` 결과에 작품 기준 `pinned` 를 실어 보낸다.

```ts
// 신규 — 특정 작품 맥락의 메모(그 작품에서의 고정 여부 포함)
export type ProjectMemo = Memo & { pinned: boolean };
```

- `MemoRepository.listByProject(projectId)` 반환을 `ProjectMemo[]` 로(메모별 그 작품 pinned 포함).
- `MemoRepository.list()`(전역 메모 화면)는 `Memo[]` 유지 — 쪽지 책상은 작품별 이름표/붙이기만 필요(고정 토글은 작품 맥락이 있는 곳: 집필 서랍/특정 작품 추림에서).

## 뷰 타입 (renderer)

- `InboxMemo`(쪽지 책상): 기존 유지(linkedProjects 이름표 + 붙이기). 고정 토글은 작품 맥락 진입 시.
- `ReentryCard`(재진입 한 장): `{ pinnedOrRecentMemo: Memo | null, lastSentence: string | null, nextScene: string }`. 곁 쪽지 = `store.pickReentryMemo`(고정→최근연결→최근캡처), 마지막 문장 = 본문 파생, **다음 장면 = `project.nextScene`(저장값, R1 B안)**.
- `lastSentence(plainText: string): string | null` — 신규 순수 함수(R2).

## 상태 전이

```
[일반 연결]  --setPin(true)-->  [고정]      (같은 작품 기존 고정은 일반으로)
[고정]       --setPin(false)--> [일반 연결]
[고정/일반]  --removeLink-->    [연결 없음] (고정 표식도 소멸)
```

## 영향 없는 것

- `documents`/`memos` 테이블·컬럼: 변경 없음. `projects` 는 `next_scene` 만 추가(기존 컬럼 불변).
- 기존 connection/persistence/store/repository 테스트: pinned·next_scene 추가분 외 회귀 없어야 함(102 GREEN 유지).
