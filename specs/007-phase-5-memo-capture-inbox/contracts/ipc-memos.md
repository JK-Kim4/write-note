# Contract: 메모 IPC (`window.electronAPI.memos`)

renderer ↔ Electron main 경계. `desktop/electron/ipc/contract.ts`가 단일 출처(preload·main·global.d.ts 공유). renderer는 DB에 직접 접근하지 않고 이 화이트리스트 채널만 사용한다.

## 기존 (Phase 2, 변경 없음)

| 메서드 | 채널 | 시그니처 | 동작 |
|---|---|---|---|
| `create` | `memos:create` | `(CreateMemoInput) => Promise<Memo>` | 메모 저장. `linkedProjectId` 없으면 미연결 |
| `list` | `memos:list` | `() => Promise<Memo[]>` | **삭제되지 않은** 메모를 captured_at DESC로 반환 (※ `deleted_at IS NULL` 필터는 본 Phase에서 추가) |
| `link` | `memos:link` | `(id, projectId \| null) => Promise<Memo \| null>` | 연결 변경(연결/해제 **동작 UI는 Phase 6**, 채널은 기존) |

`CreateMemoInput`:
```ts
{ body: string; source?: string; linkedProjectId?: string | null; capturedAt?: string }
```

## 신규 (본 Phase)

| 메서드 | 채널 | 시그니처 | 동작 |
|---|---|---|---|
| **`delete`** | `memos:delete` | `(id: string) => Promise<boolean>` | soft delete — `deleted_at`에 현재 시각 기록. 성공 시 true |
| **`restore`** | `memos:restore` | `(id: string) => Promise<Memo \| null>` | `deleted_at`을 NULL로 복원. 복원된 Memo 반환(없으면 null) |

### 계약 규칙
- `delete`는 행을 물리 삭제하지 않는다(되돌리기 보장).
- `restore` 직후 그 메모는 `list()` 결과에 다시 포함된다.
- 존재하지 않는 id: `delete` → false, `restore` → null (예외 던지지 않음).

### 결선 지점 (구현 시 4파일)
1. `contract.ts`: `ElectronAPI.memos`에 `delete`/`restore` + `CHANNELS.memosDelete`/`memosRestore`(camelCase 컨벤션).
2. `registerHandlers.ts`: `ipcMain.handle(CHANNELS.memosDelete, (_e, id) => store.memos.softDelete(id))` 등.
3. `preload.ts`: `delete: (id) => ipcRenderer.invoke(CHANNELS.memosDelete, id)` 등.
4. `global.d.ts`: 변경 불요(contract 재노출).

### 테스트 계약
- `memoRepository.test.ts`: softDelete 후 `list()`에서 제외 / restore 후 재포함 / 영향 없는 id 처리 / captured_at DESC 정렬 유지.
- preload smoke(quickstart): renderer에서 `typeof window.electronAPI.memos.delete === "function"` 1회 확인.
