# IPC ↔ REST 계약 매핑 (FR-023 산출물)

desktop `window.electronAPI`(27 IPC 채널, `desktop/electron/ipc/contract.ts`) ↔ web 서버 API 매핑. 하위 작업 2(front 이식)의 **입력 계약** — front 는 `ElectronAPI` 인터페이스를 유지하고 구현만 `ipcRenderer.invoke` → `fetch` 로 교체한다(설계 §3).

범례: ✅ 본 sub-task(014) 신규/확장 · ♻️ 기존 backend 재사용 · 🔜 하위 작업 2 영역(본 sub-task 범위 밖이나 매핑 명시) · 🧩 front 조립(backend 단일 endpoint 없음).

---

## 본 sub-task(014) 직접 대상 채널

| IPC 채널 | 시그니처(desktop) | REST 매핑 | 상태 |
|---|---|---|---|
| `projects:update` | `update(id, patch)` | `PATCH /api/projects/{id}` (+`nextScene`) | ✅ 확장 |
| `memos:setPin` | `setPin(memoId, projectId, pinned)` | `PUT /api/projects/{projectId}/memos/{memoId}/pin` `{pinned}` | ✅ 신규 |
| `memos:listByProject` | `listByProject(projectId) → ProjectMemo[]` | `GET /api/projects/{projectId}/memos` (+`pinned`) | ✅ 신규(FR-009/R7) |
| `logs:listByProject` | `listByProject(projectId) → ProjectLog[]` | `GET /api/projects/{projectId}/logs` | ✅ 신규 |
| `sessions:start` | `start(projectId)` | `POST /api/projects/{projectId}/work-sessions/start` | ✅ 신규 |
| `sessions:end` | `end(projectId)` | `POST /api/projects/{projectId}/work-sessions/end` | ✅ 신규 |
| `sessions:endWithLog` | `endWithLog(projectId, body)` | `POST /api/projects/{projectId}/work-sessions/end-with-log` `{body}` | ✅ 신규 |
| (IPC 없음 — web 추가) | — | `POST /api/projects/{projectId}/logs` `{body}` (독립 기록 생성, Q1) | ✅ 신규 |
| (IPC 없음 — 카드 보조) | — | `GET /api/projects/{projectId}/logs/latest` | ✅ 신규 |
| (IPC 없음 — 카드 보조) | — | `GET /api/projects/{projectId}/work-sessions/total` | ✅ 신규 |

## 집계 채널 — front 조립 (R6)

| IPC 채널 | 시그니처 | 매핑 | 상태 |
|---|---|---|---|
| `logs:list` | `list() → LogCard[]` | front 가 작품별로 조립: `GET /api/projects`(+nextScene) × {`logs/latest` + `work-sessions/total` + document `wordCount` + 클라 파생 `lastSentence`} | 🧩 front 조립 |
| `projects:listCards` | `listCards() → ProjectCard[]` | `GET /api/projects`(+nextScene) + document `wordCount`/`lastSentence`(클라 파생) | 🧩 front 조립 |

> `lastSentence`(desktop `plain_text`)는 backend `Document.plainText` 부재로 front 가 document TipTap JSON(`body`)에서 파생(R6). N+1 우려 시 sub-task 2 에서 집계 endpoint 신설 재검토.

## 기존 backend 재사용 채널 (본 sub-task 변경 없음)

| IPC 채널 | REST | 상태 |
|---|---|---|
| `projects:create` | `POST /api/projects` | ♻️ |
| `projects:list` | `GET /api/projects` | ♻️(+nextScene 노출) |
| `projects:get` | `GET /api/projects/{id}` | ♻️(+nextScene 노출) |
| `projects:delete` | `DELETE /api/projects/{id}` | ♻️ |
| `documents:getByProject` | `GET /api/projects/{id}/document`(기존 DocumentController) | ♻️🔜 |
| `documents:update` | `PUT /api/.../document`(기존) | ♻️🔜 |
| `memos:create` | `POST /api/memos` | ♻️ |
| `memos:list` | `GET /api/memos` | ♻️ |
| `memos:pickReentry` | (기존 memo 조회 조합) | 🔜 |
| `memos:addLink`/`removeLink` | `PUT /api/memos/{id}/curation`(선언적 큐레이션) | ♻️🔜 |
| `memos:delete` | `DELETE /api/memos/{id}` | ♻️ |
| `memos:restore` | (soft delete 복원 — backend 정책 확인 필요) | 🔜 |
| `settings:get`/`set` | (localStorage 또는 신규 — sub-task 2 결정) | 🔜 |
| `contact:send` | (문의 — 설계 §5 web 재설계) | 🔜 |
| `shell:openExternal` | `window.open`(electron 비대상) | 🔜 |

> 🔜 채널은 본 sub-task 014 범위 밖(front 이식/추가 기능). 매핑은 sub-task 2 진입 시 확정. 본 표는 014 가 책임지는 ✅/🧩 행만 보증한다(SC-005: 014 의 4종 기능 결선에 계약 공백 0).

## 계약 검증 게이트 (SC-005)

하위 작업 2 진입 시, 위 ✅ 행 9개 + 🧩 행 2개로 desktop 의 next_scene·pinned·project_logs·work_sessions 4종 기능을 추가 backend 설계 결정 없이 결선 가능해야 한다. 결선 중 backend endpoint 신설/시그니처 변경이 필요하면 = 본 매핑의 공백 → 014 회고 §어긋남 박음(rule §9).
