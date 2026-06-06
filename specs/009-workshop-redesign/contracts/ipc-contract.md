# Phase 1 IPC Contract — 작업실 디자인 고도화

renderer↔main 의 IPC 계약 변경. 기존 `electron/ipc/contract.ts`(ElectronAPI + CHANNELS) + `registerHandlers.ts` + `preload.ts` 3곳을 함께 갱신한다(기존 패턴).

## 변경 요약

| 동작 | 신규/변경 | 채널 | 시그니처 |
|---|---|---|---|
| 곁에 둘 쪽지 고정/해제 | **신규** | `memos:setPin` | `setPin(memoId, projectId, pinned: boolean) => Promise<void>` |
| 재진입 한 장 선정 | **신규** | `memos:pickReentry` | `pickReentry(projectId) => Promise<Memo \| null>` |
| 작품 연결 메모 조회 | **변경(반환 확장)** | `memos:listByProject` | `listByProject(projectId) => Promise<ProjectMemo[]>` (각 메모에 그 작품 `pinned: boolean` 포함) |
| 작품 다음 장면 수정 | **변경(입력 확장)** | `projects:update` | `update(id, patch)` 의 `patch(UpdateProjectInput)` 에 `nextScene?: string` 추가 — **새 채널 불요** |

그 외 기존 채널(`memos:create/list/addLink/removeLink/delete/restore`, projects/documents/settings)은 불변.

## 계약 상세

### `memos.setPin(memoId, projectId, pinned)`

- **전제**: (memoId, projectId) 연결이 존재.
- **동작**: `pinned=true` → 같은 projectId 의 기존 고정 해제 후 대상 고정(작품당 1개, 한 트랜잭션). `pinned=false` → 대상 고정 해제.
- **반환**: `void`. (renderer 는 optimistic 갱신 후 필요 시 재조회)
- **멱등**: 이미 같은 상태면 no-op.

### `memos.pickReentry(projectId)`

- **동작**: FR-023 우선순위(고정 → 최근 연결 → 최근 캡처)로 그 작품의 곁 쪽지 1장 선정. soft delete 제외.
- **반환**: `Memo | null`(연결 메모가 하나도 없으면 null → renderer 는 빈 재진입 안내).

### `memos.listByProject(projectId)` (반환 확장)

- **변경**: 반환 원소 타입 `Memo` → `ProjectMemo`(= `Memo & { pinned: boolean }`). `pinned` 은 그 projectId 기준.
- **호환**: 집필 서랍(MemoPanel)·고정 토글이 pinned 를 읽는다. 기존 호출부는 추가 필드 무시 가능(비파괴 확장).

## CHANNELS 추가

```ts
// contract.ts CHANNELS 에 추가
memosSetPin: "memos:setPin",
memosPickReentry: "memos:pickReentry",
```

## registerHandlers / preload

- `registerHandlers.ts`: `ipcMain.handle(CHANNELS.memosSetPin, (_e, memoId, projectId, pinned) => store.memos.setPin(...))`, `memosPickReentry → store.pickReentryMemo(projectId)`.
- `preload.ts`: `window.electronAPI.memos.setPin / pickReentry` 노출, `listByProject` 반환 타입 갱신.
- renderer 타입(`global.d.ts` 또는 contract 공유)도 동기화.

### `projects.update(id, { nextScene })` (입력 확장)

- **변경**: `UpdateProjectInput` 에 `nextScene?: string` 추가. `projectRepository.update` 의 SET 절·`Project.nextScene` 함께 갱신. 기존 호출부(메타 수정)는 nextScene 생략 시 기존값 유지.
- **저장**: `projects.next_scene` 에 영속(FR-027). 작품 벽 카드/재진입 한 장이 `projects.list`/`get` 으로 읽어 표시.

## 계약 테스트 (main, Vitest node)

- `memoRepository.test.ts`: setPin → 작품당 1개 유지(다른 고정 해제), removeLink 시 고정 소멸, listByProject pinned 반영.
- `store.test.ts`: pickReentryMemo 우선순위(고정 > 최근연결 > 최근캡처) + soft delete 제외 + 연결 없음 → null.
- `projectRepository.test.ts`: update 로 nextScene 저장/조회, 미지정 시 기존값 유지, create 기본값 ''.
