# Phase 1 Contracts: IPC (logs.* / sessions.*)

기존 `desktop/electron/ipc/contract.ts` 의 `ElectronAPI` 타입 + `CHANNELS` 상수 + `registerHandlers.ts` 핸들러 + `preload.ts` 노출 + `src/global.d.ts` 동기 패턴을 따른다. 신규 의존성·외부 네트워크 없음(전부 로컬 IPC).

## 1. `ElectronAPI` 추가 네임스페이스 (`contract.ts`)

```ts
logs: {
  /** 기록 화면 카드 집계(작품별 진척 소스 + 최신 기록 + 총 작업 시간). */
  list: () => Promise<LogCard[]>;
  /** 아코디언 펼침 시 그 작품의 누적 기록 메모 전체(최신순). */
  listByProject: (projectId: string) => Promise<ProjectLog[]>;
};
sessions: {
  /** 집필 진입 시 작업 시작(작품당 열린 세션 1개 보장). */
  start: (projectId: string) => Promise<void>;
  /** 화면 이탈/작품 전환 시 자동 종료(30초 미만 폐기). */
  end: (projectId: string) => Promise<void>;
  /** "작업 종료" 버튼 — 세션 종료 + 기록 메모 추가(트랜잭션, 짧아도 보존). */
  endWithLog: (projectId: string, body: string) => Promise<void>;
};
```

타입 import: `LogCard`, `ProjectLog` from `../db/types`.

## 2. `CHANNELS` 추가 (`contract.ts`)

```ts
logsList:          "logs:list",
logsListByProject: "logs:listByProject",
sessionsStart:     "sessions:start",
sessionsEnd:       "sessions:end",
sessionsEndWithLog:"sessions:endWithLog",
```

## 3. 핸들러 결선 (`registerHandlers.ts`)

| 채널 | Store 호출 | 반환 |
|---|---|---|
| `logs:list` | `store.listLogCards()` | `LogCard[]` |
| `logs:listByProject` | `store.logs.listByProject(projectId)` | `ProjectLog[]` |
| `sessions:start` | `store.sessions.start(projectId)` | void |
| `sessions:end` | `store.sessions.endOpen(projectId, now)` | void |
| `sessions:endWithLog` | `store.endSessionWithLog(projectId, body)` | void |

> `sessions:end` 의 `now` 는 main 시계(R5). `endWithLog` 의 시각도 Store 트랜잭션 내 생성.

## 4. preload 노출 (`preload.ts`)

`contextBridge.exposeInMainWorld("electronAPI", { ... })` 에 `logs`/`sessions` 추가. 각 메서드는 `ipcRenderer.invoke(CHANNELS.xxx, ...args)`.

## 5. renderer 타입 동기 (`src/global.d.ts`)

`Window.electronAPI` 타입에 `logs`/`sessions` 반영(`ElectronAPI` 인용). 빌드 게이트(`tsc --noEmit`)가 계약 불일치 검출.

## 6. 호출 측 결선 요약

| 호출 위치 | IPC | 시점 |
|---|---|---|
| `App.tsx` effect 진입 | `sessions.start` | `screen==="write" && activeProject` |
| `App.tsx` effect cleanup | `sessions.end` | 화면 전환·작품 전환 |
| `main.ts` `before-quit` | (main 직접) `store.endAllOpenSessions(now)` | 앱 종료 — IPC 아님 |
| `main.ts` `whenReady` | (main 직접) `store.closeDangling()` | 앱 시작 — IPC 아님 |
| `WriteStudioScreen` "작업 종료" 모달 저장 | `sessions.endWithLog` | 명시 종료 |
| `LogScreen` mount | `logs.list` | 기록 화면 진입 |
| `LogCard` 아코디언 펼침 | `logs.listByProject` | 펼침 시 lazy |

## 7. 계약 테스트

- `registerHandlers` 핸들러가 각 채널을 Store 메서드에 올바로 위임하는지(반환·인자 전달).
- 시스템 경계(DB) 만 실제, Store 는 in-memory sqlite 로 통합 검증(기존 테스트 패턴).
