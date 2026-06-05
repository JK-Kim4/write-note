# Desktop Phase 6 — 메모↔작품 연결 + 집필 사이드 패널 (작업 지시서)

> **용도:** 본 문서는 `speckit-specify` 입력 brief(SDD, Spec-Driven Development)다. 브레인스토밍으로 확정한 설계를 담는다. 이 문서를 근거로 `specs/NNN-phase-6-memo-linking-side-panel/`의 spec → plan → tasks → implement 를 생성한다.
>
> **메타**
> - Phase: 6 / 8 (Desktop MVP 트랙, Electron 로컬 우선 앱)
> - 작성일: 2026-06-05
> - 기준 브랜치: `develop` (Phase 5 merge `386aac1`)
> - 상위 SoT: `PRODUCT.md`(전략) · `docs/DESIGN.md`(비주얼) · `docs/phase/06-memo-linking-side-panel/README.md` · vault `02-PROGRESS.md`
> - 브레인스토밍 확정: 2026-06-05 (다중 연결 확장 + 연결 버튼/체크리스트 팝오버 + 패널 실데이터·빠른 해제)

---

## 1. 목표

메모를 작품(project)에 **연결/해제**하고, 집필 화면(Write Studio)에서 **현재 작품에 연결된 메모만** 곁에서 볼 수 있게 한다. 메모 하나가 **여러 작품에 연결**될 수 있다(다중 연결, many-to-many).

Phase 5 dogfooding 에서 집필 화면 우측 "연결된 메모" 패널(`MemoPanel`)이 더미라 혼란을 일으켰고, 그 결선이 본 Phase 의 핵심이다.

---

## 2. 범위 변경 기록 (HARD — 지침 문서와의 충돌)

`docs/phase/06-memo-linking-side-panel/README.md` 는 **"다중 프로젝트 연결"을 제외 항목**으로 박아뒀고, 현재 스키마도 단일 연결(`memos.linked_project_id` 단일 컬럼)만 지원한다.

**브레인스토밍 2026-06-05 에서 사용자가 다중 연결을 Phase 6 범위로 포함하기로 확정.** 따라서:

- Phase 6 범위가 "단일 연결 + 패널 결선" → **"메모↔작품 many-to-many 연결(연결 테이블 도입) + 패널 결선"**으로 확장된다.
- `docs/phase/06/README.md` 의 제외 항목에서 "다중 프로젝트 연결"을 제거한다(본 Phase 산출물에 포함되므로).
- 근거: 보존된 WEB 트랙이 이미 `memo_projects` 연결 테이블(V6 마이그레이션)로 many-to-many 를 설계했었다. 제품 원래 의도에 다중 연결이 있었고 Desktop MVP 가 단순화를 위해 단일로 줄여둔 상태였다.

---

## 3. 배경 — 현재 코드 상태 (실측)

### 3-1. 이미 완성된 backend (Phase 5 산출, 결선 확인됨)

| 레이어 | 파일 | 상태 |
|---|---|---|
| Repository | `desktop/electron/db/memoRepository.ts` | `create` / `getById` / `list`(captured_at DESC) / `link`(단일) / `softDelete` / `restore` |
| Store | `desktop/electron/db/store.ts` | `store.memos` 노출 + `createProjectWithDocument`/`updateDocument` 트랜잭션 패턴 |
| IPC handler | `desktop/electron/ipc/registerHandlers.ts` | `memos:create/list/link/delete/restore` 등록 |
| IPC contract | `desktop/electron/ipc/contract.ts` | `memos.{create,list,link,delete,restore}` 타입 + 채널 |
| preload | `desktop/electron/preload.ts` | `window.electronAPI.memos.*` 노출 |
| 스키마 | `desktop/electron/db/schema.ts` | v3 — `memos` 테이블(STRICT), `linked_project_id` 단일 FK `ON DELETE SET NULL`, `deleted_at`(soft delete) |
| 도메인 타입 | `desktop/electron/db/types.ts` | `Memo { id, body, capturedAt, source, linkedProjectId, createdAt, updatedAt, deletedAt }` |
| 뷰 매퍼 | `desktop/src/lib/memoView.ts` | `toInboxMemoView` — `linkedProjectId`(단수) + 제목 맵 → `InboxMemo` |

→ 저장/조회/단일연결/soft delete 경계는 동작. **Phase 6 은 (a) 데이터 모델 다대다 전환 + (b) renderer 결선이 핵심.**

### 3-2. 더미·미결선 상태인 UI (결선 대상)

| 컴포넌트 | 현재 | 비고 |
|---|---|---|
| `desktop/src/components/MemoPanel.tsx` | 하드코딩 `MEMOS` 배열 + 구 `Memo`(date/tag) 타입, props 는 `MemoState` 문자열만 | **완전 더미 — 본 Phase 핵심 결선** |
| `desktop/src/screens/MemoInboxScreen.tsx` | 연결 칩(`link-chip`)이 연결 작품명/"미연결" **읽기 전용 표시만** | 연결/해제 동작 없음 → 신설 |
| `desktop/src/App.tsx` | `memos: MemoState`("loaded" 고정) 더미 전달 | 패널 실데이터 결선 시 제거 |

### 3-3. 발견된 갭

- **다대다 미지원**: 스키마·repository·도메인 타입·뷰가 전부 단일 연결(`linked_project_id`) 전제. 연결 테이블 도입 + 전 계층 복수화 필요.
- **연결/해제 UI 부재**: Inbox 칩은 표시 전용, 작품 선택 진입점 없음.
- **패널 실데이터 경로 부재**: `MemoPanel` 이 실제 메모를 받는 경로 자체가 없음(`MemoState` enum 만).
- **특정 작품 연결 메모 조회 부재**: `listByProject` 류 메서드 없음.

### 3-4. 환경 주의 (회귀 방지 — vault·CLAUDE.md)

- 셸 기본 Node `v20.10.0` 이나 **node:sqlite 는 Node 24 필요**. nvm 에 `v24.14.0` 설치됨.
- 테스트/빌드 시: `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행 후 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행(corepack pnpm lockfile 충돌 회피).

---

## 4. 확정된 설계 결정 (브레인스토밍 2026-06-05)

| # | 결정 | 근거 |
|---|---|---|
| D1 | **메모↔작품 many-to-many.** 연결 테이블 `memo_projects(memo_id, project_id, created_at)` 도입. 한 메모가 여러 작품에, 한 작품이 여러 메모에. | 사용자 확정(범위 확장) + WEB 트랙 원래 설계 정합 |
| D2 | **연결 진입점 = Inbox 메모 행의 "연결" 버튼.** 삭제 버튼 옆에 연결용 액션 버튼 신설(연결 칩 클릭이 아닌 별도 버튼). | 사용자 선택 (질문 1) |
| D3 | **연결 UI = 체크리스트 팝오버.** "연결" 클릭 → 전체 작품 목록 + 각 항목 연결 상태(체크). 체크 토글 = `addLink`/`removeLink` 즉시 호출. 연결된 작품은 메모 행에 칩으로 표시, **칩 ✕ 로도 해제**. | 사용자 선택 (질문 2-a) — 다중 연결 상태를 한 화면에서 파악·수정 |
| D4 | **집필 패널 = 보기 + 빠른 해제.** 패널은 현재 작품 연결 메모를 조용히 나열(DESIGN "에디터보다 약하게" 유지). 각 카드 칩 ✕ 로 그 자리에서 해제 가능. 연결 *추가* 는 Inbox 에서만. | 사용자 선택 (질문 3-b) |
| D5 | **`linked_project_id` 컬럼 은퇴.** 기존 단일 연결을 연결 테이블로 이관 후 컬럼 제거(두 진실원 방지). | 사용자 확정 (설계 1) |
| D6 | **작품 삭제 시 `ON DELETE CASCADE`.** 그 작품의 연결 행만 사라지고 메모 자체는 보존(현재 `SET NULL` 의 "메모 보존" 의미 계승). | 현행 동작 계승 |
| D7 | **soft-delete 메모는 조회에서 제외, 연결 행은 보존.** `memos.deleted_at` 으로 필터. 복원 시 연결 그대로 복귀. | 기존 soft delete 정합 |

---

## 5. 설계 — 데이터 모델 + 마이그레이션 (v3 → v4)

### 5-1. 연결 테이블

```sql
CREATE TABLE memo_projects (
  memo_id    TEXT NOT NULL REFERENCES memos(id)    ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (memo_id, project_id)
) STRICT;
```

- 메모↔작품 쌍을 행으로 저장. `PRIMARY KEY(memo_id, project_id)` 로 중복 연결 방지(`addLink` 멱등성 근거).
- 양쪽 `ON DELETE CASCADE`: 메모 hard-delete 시 연결 행 정리, 작품 삭제 시 연결 행 정리(메모는 보존).

### 5-2. 마이그레이션 절차 (v3 → v4)

1. `memo_projects` 테이블 생성(신규 DB 는 `IF NOT EXISTS` 로 최신 스키마 직행).
2. 기존 DB 업그레이드: `linked_project_id IS NOT NULL` 인 메모를 연결 행으로 이관(단일 연결 → 첫 연결 행, `created_at = memos.updated_at` 또는 now).
3. `memos.linked_project_id` 컬럼 은퇴 — `ALTER TABLE memos DROP COLUMN` 가용성 확인(Node 24 SQLite 3.35+ 지원) 후 제거. 불가/제약 시 표준 SQLite 테이블 재생성(12-step) 방식.
4. `PRAGMA user_version = 4`.

> **TDD HARD-GATE:** "v3 단일 연결 메모가 v4 연결 행으로 보존되는가" 마이그레이션 테스트를 먼저 작성(RED). 적용은 로컬 dev `.db` 한정(외부 DB 아님 — `external-infra-safety.md` 비대상).

---

## 6. 설계 — Repository · Store · IPC 계층

### 6-1. 도메인 타입 (`electron/db/types.ts`)

- `Memo.linkedProjectId: string | null` → **`Memo.linkedProjectIds: string[]`** (연결 작품 id 목록, 읽기용 집계. 미연결이면 `[]`).

### 6-2. MemoRepository (`memoRepository.ts`)

| 메서드 | 동작 |
|---|---|
| `list()` | soft-delete 제외 메모를 `captured_at DESC` 로, 각 메모에 `linkedProjectIds` 채워 반환(Inbox 표시용) |
| `listByProject(projectId)` *(신규)* | 해당 작품에 연결된(soft-delete 제외) 메모만 `captured_at DESC`(집필 패널용) |
| `addLink(memoId, projectId)` *(신규)* | 연결 행 INSERT, 이미 있으면 무시(멱등 — `INSERT OR IGNORE` 또는 PK 충돌 무시) |
| `removeLink(memoId, projectId)` *(신규)* | 연결 행 DELETE |
| `create` / `softDelete` / `restore` / `getById` | 유지 (단 `create` 는 단일 `linkedProjectId` 의존 제거) |
| `link(id, projectId\|null)` | **제거**(단일 연결 전용 폐기) |

### 6-3. Store (`store.ts`)

- **신규** `captureMemo({ body, source?, linkProjectId? })` → 메모 생성 + (`linkProjectId` 있으면) 연결 행 INSERT 를 **한 트랜잭션**으로. QuickCapture 의 "active 작품 자동 연결"을 메모만 생기고 연결이 누락되는 일 없이 처리(기존 `CreateMemoInput.linkedProjectId` 자동연결 동작 계승).

### 6-4. IPC (`contract.ts` · `registerHandlers.ts` · `CHANNELS`)

```
memos.list()                                  → Memo[]   (linkedProjectIds 포함)
memos.listByProject(projectId)                → Memo[]               ← 신규
memos.create({body, source?, linkProjectId?}) → Memo     (store.captureMemo 결선)
memos.addLink(memoId, projectId)              → void                 ← 신규
memos.removeLink(memoId, projectId)           → void                 ← 신규
memos.delete(id) / memos.restore(id)          → 유지
memos.link                                    → 제거
```

### 6-5. 뷰 매퍼 (`src/lib/memoView.ts` · `src/types.ts`)

- `InboxMemo.linkedProjectId / linkedProjectTitle`(단수) → **`linkedProjects: { id: string; title: string }[]`**(복수).
- `toInboxMemoView(memo, projectTitleById, now)` 가 `linkedProjectIds` → 제목 붙은 목록으로 변환. **사라진 작품 id 는 걸러냄.**
- renderer 구 `Memo`(date/tag) 타입 제거.

---

## 7. 설계 — Renderer UI

### 7-1. Inbox 메모 화면 (`MemoInboxScreen.tsx`)

- 각 메모 행: 연결된 작품들을 **칩 목록**(복수)으로 표시. 각 칩에 ✕(해제). 삭제 버튼 옆 **"연결" 버튼** 신설.
- "연결" 클릭 → **체크리스트 팝오버**(신규 `LinkPopover` 컴포넌트):
  - 전체 작품 목록 + 각 항목 연결 상태(체크).
  - 체크 토글 → `addLink`/`removeLink` 즉시 호출 후 `load()` 재조회.
  - 작품 0개면 "먼저 작품을 만들어주세요" 빈 상태.
- 칩 ✕ → `removeLink` → 재조회.
- 스타일: DESIGN.md §연결 칩·§세그먼트 토글·§Card 토큰 재사용(**신규 비주얼 언어 없음**).

### 7-2. 집필 화면 사이드 패널 (`MemoPanel.tsx` — 더미 완전 제거)

- props `state: MemoState` → **실데이터 결선**: `activeProject.id` 로 `memos.listByProject` 조회.
- 연결 메모를 조용한 카드로 나열(DESIGN "에디터보다 약하게" 유지) + 각 카드 칩 ✕ 로 **빠른 해제**(`removeLink` → 패널 재조회).
- 빈 상태: 기존 "이 작품에 연결된 메모가 아직 없어요" 문구 유지(README #5 — 비어도 어색하지 않게).
- 구 `Memo`(date/tag) 타입 제거 → `InboxMemo`(또는 패널 전용 view) 재사용.

### 7-3. App 상태 결선 (`App.tsx`)

- 더미 `memos: MemoState` 제거. 패널이 자체적으로 `activeProject.id` 기반 조회 + 로컬 refresh.
- 기존 `memoRefresh` 카운터 브리지 재사용: QuickCapture 캡처 / Inbox 연결 변경 시 패널이 다음 진입 때 최신 반영(README #6). 패널 내 ✕ 해제는 패널 자체 재조회로 즉시 반영.

---

## 8. 완료 기준 (README 정합)

- [ ] 기존 미연결 메모를 특정 작품에 연결할 수 있다.
- [ ] 메모를 여러 작품에 연결할 수 있다(다중 연결).
- [ ] 메모 연결을 해제할 수 있다(Inbox 칩 ✕ / 팝오버 체크 해제 / 패널 칩 ✕).
- [ ] 집필 화면에서 현재 작품에 연결된 메모만 보인다.
- [ ] 메모가 많지 않은 초기 상태에서 UI 가 무겁게 느껴지지 않는다.
- [ ] 연결 변경 후 패널이 (재진입/자체 갱신으로) 최신 반영된다.

---

## 9. 테스트 · 검증

### 9-1. TDD (Red-Green-Refactor)

- **마이그레이션**: v3 단일 연결 → v4 연결 행 보존.
- **repository**: `addLink` 멱등, `removeLink`, `listByProject` 필터(soft-delete 제외·정렬), `list` 의 `linkedProjectIds` 집계.
- **store**: `captureMemo` 트랜잭션(메모+연결 원자성).
- **renderer (RTL, 행위 기준 `getByRole`/`getByText`)**: `LinkPopover` 토글, `MemoInboxScreen` 칩 복수 표시·연결·해제, `MemoPanel` 실데이터·빈 상태·칩 해제.

### 9-2. 게이트

```bash
cd desktop
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
```

### 9-3. dogfooding (수동 — README 정합 + 다중 연결)

- 메모 2개 생성. 하나는 작품 A 에 연결, 하나는 미연결 유지.
- 작품 A 집필 화면 패널에 연결 메모만 표시 확인.
- 연결 해제 후 패널에서 사라지는지 확인.
- **다중 연결**: 한 메모를 작품 A·B 둘에 연결 → A 패널과 B 패널 양쪽에 표시 확인.
- 다크모드 + 한국어 본문 표시 확인.

---

## 10. 문서 정정 대상

- `docs/phase/06-memo-linking-side-panel/README.md` — 제외 항목에서 "다중 프로젝트 연결" 제거.
- spec 산출물(`specs/NNN-...`)에 범위 확장(§2) 명시.
- 완료 후: `docs/STATUS.md` Phase 표 + vault `02-PROGRESS.md` 갱신.

---

## 11. 제외 (Phase 6 비범위 — README 계승)

- 메모 pin.
- 메모 태그 / 이유 노트.
- drag-and-drop 고급 큐레이션.
- 모바일 큐레이션.

> (당초 README 제외였던 "다중 프로젝트 연결"은 §2 에 따라 **본 Phase 에 포함**되므로 제외 목록에서 빠진다.)
