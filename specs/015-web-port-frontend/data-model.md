# Data Model — Web 포팅 Front 이식 (015)

본 작업은 **새 영속 엔티티를 만들지 않는다.** 모든 데이터는 014 backend 소유이며, front 는 014 REST 계약을 통해 조회·갱신한다. 본 문서는 (1) 클라이언트 뷰 모델, (2) web `electronAPI` shim ↔ 014 endpoint 매핑, (3) URL 라우트 맵을 정의한다.

---

## 1. 클라이언트 뷰 모델 (desktop `db/types.ts` 형태 유지)

desktop renderer 가 쓰던 타입을 frontend 로 이식해 화면 props 계약을 유지한다. ID 는 014 가 `Long` 이므로 web 에서 `number`(또는 string 직렬화) — desktop 의 `string`(UUID) 가정과 다름에 유의(이식 시 타입 조정).

| 뷰 모델 | 필드(요지) | 출처(014) |
|---|---|---|
| `Project` | id, title, genre, targetLength, nextScene, … | `GET /api/projects`, `GET /api/projects/{id}` |
| `ProjectCard` | Project + lastSentenceSource(파생) | `GET /api/projects` + document(아래) + 클라 파생 |
| `Document` | id, projectId, bodyJson, plainText, wordCount, version | `GET /api/projects/{id}/document`(기존) |
| `Memo` / `ProjectMemo`(+pinned) | id, body, capturedAt, tags, pinned | `GET /api/memos`, `GET /api/projects/{id}/memos`(014) |
| `ProjectLog` | id, projectId, body, createdAt | `GET /api/projects/{id}/logs`(014) |
| `LogCard` | project + wordCount + latestLog + totalDurationMs + lastSentence(파생) | 014 logs/latest·work-sessions/total + document + 클라 파생(R6 of 014) |
| `WorkSession` | id, projectId, startedAt, endedAt | 014 work-sessions/* |

- **파생값(클라 조립, 014 R6)**: `lastSentenceSource`(마지막 문장) = document `plainText`/bodyJson 에서 클라 파생(backend `plainText` 부재). `LogCard`/`ProjectCard` 집계 = 작품 목록 × 작품별 latestLog/total/wordCount + 파생.
- **검증**: 입력 검증(작품 title 길이·로그 body 등)은 014 가 권위. front 는 즉시 피드백용 보조 검증만.

## 2. web `electronAPI` shim ↔ 014 endpoint 매핑 (contracts/web-electron-api.md 가 정본)

desktop `ipc/contract.ts` 의 `ElectronAPI` 27 채널 중 본 범위 도메인을 `apiFetch` 호출로 구현. 상세는 contracts. 요지:

| shim 메서드 | 014 호출 |
|---|---|
| `projects.list/listCards/get/create/update/delete` | `/api/projects*`(+nextScene), 카드 집계는 클라 조립 |
| `documents.getByProject/update` | `/api/projects/{id}/document`(기존) |
| `memos.*`(create/list/listByProject/setPin/addLink/removeLink/…) | `/api/memos*`, `/api/projects/{id}/memos`, `PUT …/pin`(014) |
| `logs.list/listByProject` | `/api/projects/{id}/logs(+latest)`(014) + 클라 집계 |
| `sessions.start/end/endWithLog` | `POST /api/projects/{id}/work-sessions/*`(014) |
| `contact.send` | 기존 문의 endpoint + web 메타 |
| `shell.openExternal` | `window.open`(electron 대체) |
| `settings.get/set` | localStorage(zustand preferences, R7) |

## 3. URL 라우트 맵 (FR-004, R2)

| URL | 화면(desktop 출처) | 보호 | 비고 |
|---|---|---|---|
| `/` | 작품 벽(ProjectsScreen) | requireAuth | 006 home 교체 |
| `/projects/[id]/write` | 집필실(WriteStudioScreen) | requireAuth | 신설(작품별 딥링크), 006 `/write` 교체 |
| `/memos` | 곁쪽지 책상(MemoInboxScreen) | requireAuth | 006 `/memos` 교체 |
| `/logs` | 집필 기록(LogScreen) | requireAuth | 신설 |
| `/contact` | 문의(ContactScreen) | requireAuth | 신설 |
| `/auth/*` | 로그인·회원가입 등 | requireAnon | 005 재사용(변경 없음) |

- **상태 전이**: 작품 벽에서 작품 열기 → `/projects/[id]/write` push. 집필실 이탈(다른 라우트) → 세션 end(R6). 뒤로/앞으로 = App Router history(FR-005).
- **가드**: 보호 라우트는 005 `useAuthGuard("requireAuth")`. 미로그인 → `/auth/login`(FR-007).

## 4. 로컬 상태 (서버 비영속)

| 상태 | 보관 | 출처 |
|---|---|---|
| 보기 설정(테마·줌·줄노트·집필 모드) | localStorage(zustand `preferences`) | R7, 기존 frontend |
| UI 토글(서랍 열림·스크롤 위치) | 메모리(zustand `ui`) | 기존 frontend |
| 서버 데이터 캐시 | React Query 캐시 | R1 |

신규 영속 엔티티 0. 014 backend 스키마 변경 0(소비만).
