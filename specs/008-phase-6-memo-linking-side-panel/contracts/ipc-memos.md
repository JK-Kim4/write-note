# IPC 계약 — memos (Phase 6)

renderer ↔ main 경계. `electron/ipc/contract.ts`(타입 + `CHANNELS`) / `registerHandlers.ts`(핸들러) / `preload.ts`(노출)에 동기 반영. renderer 는 `window.electronAPI.memos.*` 로만 접근(DB 직접 접근 금지).

## 변경 요약

| 채널 | 시그니처 | 변경 |
|---|---|---|
| `memos:list` | `list() => Promise<Memo[]>` | **수정** — Memo 에 `linkedProjectIds: string[]` 포함 |
| `memos:listByProject` | `listByProject(projectId: string) => Promise<Memo[]>` | **신규** |
| `memos:create` | `create(input: { body: string; source?: string; linkProjectId?: string \| null }) => Promise<Memo>` | **수정** — `linkedProjectId` → `linkProjectId`, store.captureMemo 결선 |
| `memos:addLink` | `addLink(memoId: string, projectId: string) => Promise<void>` | **신규** |
| `memos:removeLink` | `removeLink(memoId: string, projectId: string) => Promise<void>` | **신규** |
| `memos:delete` | `delete(id: string) => Promise<boolean>` | 유지 |
| `memos:restore` | `restore(id: string) => Promise<Memo \| null>` | 유지 |
| ~~`memos:link`~~ | ~~`link(id, projectId\|null)`~~ | **제거** |

## ElectronAPI.memos (수정 후)

```ts
memos: {
  list: () => Promise<Memo[]>;                                  // linkedProjectIds 포함
  listByProject: (projectId: string) => Promise<Memo[]>;        // 신규
  create: (input: {
    body: string;
    source?: string;
    linkProjectId?: string | null;                             // active 작품 자동연결(없으면 null)
  }) => Promise<Memo>;
  addLink: (memoId: string, projectId: string) => Promise<void>;     // 신규
  removeLink: (memoId: string, projectId: string) => Promise<void>;  // 신규
  delete: (id: string) => Promise<boolean>;
  restore: (id: string) => Promise<Memo | null>;
};
```

## CHANNELS (수정 후)

```ts
memosList: "memos:list",
memosListByProject: "memos:listByProject",   // 신규
memosCreate: "memos:create",
memosAddLink: "memos:addLink",               // 신규
memosRemoveLink: "memos:removeLink",         // 신규
memosDelete: "memos:delete",
memosRestore: "memos:restore",
// memosLink 제거
```

## 핸들러 결선 (`registerHandlers.ts`)

```
memos:list          → store.memos.list()
memos:listByProject → store.memos.listByProject(projectId)
memos:create        → store.captureMemo(input)              // 트랜잭션
memos:addLink       → store.memos.addLink(memoId, projectId)
memos:removeLink    → store.memos.removeLink(memoId, projectId)
memos:delete        → store.memos.softDelete(id)
memos:restore       → store.memos.restore(id)
```

## 불변식

- `list` / `listByProject` 는 `deleted_at IS NULL` 만 반환(FR-006, FR-012).
- `addLink` 는 멱등 — 같은 쌍 재호출해도 연결 1개 유지(FR-014).
- `create` 의 `linkProjectId` 가 null/미지정이면 미연결 메모(FR-010 — inline 캡처 / active 작품 없음).
- 모든 변경은 로컬 SQLite 한정(외부 스토어 아님).

## preload smoke (agent-workflow §8)

신규 채널(`listByProject`/`addLink`/`removeLink`) renderer 첫 호출 전, `window.electronAPI.memos.addLink` 등 존재를 1회 확인(preload 결선 누락이 typecheck/build 로 안 잡히고 첫 호출에서 터지는 회귀 방지).
