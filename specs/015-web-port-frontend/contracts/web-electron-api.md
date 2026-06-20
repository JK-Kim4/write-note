# Contract — web `electronAPI` 구현체 ↔ 014 REST

desktop `desktop/electron/ipc/contract.ts` 의 `ElectronAPI` 인터페이스를 frontend 가 **동일 시그니처**로 구현(`webElectronApi`)한다. 화면은 이 객체(또는 이를 감싼 React Query 훅)만 호출하고 구현(fetch)을 모른다(설계 §3). 모든 호출은 `apiFetch`(client.ts) 경유 — Result envelope unwrap·401 refresh·409 conflict 자동.

범례: ✅ 014 endpoint 직접 · 🧩 클라 조립 · ♻️ 기존 backend · 🔁 electron 대체.

## projects
| 메서드 | 구현 |
|---|---|
| `create(input)` | ✅ `POST /api/projects` |
| `list()` | ♻️ `GET /api/projects`(+nextScene) |
| `listCards()` | 🧩 `GET /api/projects` + 작품별 document(wordCount)·`logs/latest`·`work-sessions/total` + 마지막문장 클라 파생(014 R6) |
| `get(id)` | ♻️ `GET /api/projects/{id}` |
| `update(id, patch)` | ✅ `PATCH /api/projects/{id}`(nextScene 포함) |
| `delete(id)` | ♻️ `DELETE /api/projects/{id}` |

## documents
| `getByProject(projectId)` | ♻️ `GET /api/projects/{id}/document`(기존 DocumentController) |
| `update(id, patch)` | ♻️ `PUT/PATCH …/document` — 409 시 `ConflictError`(client.ts 기존, 자동저장 충돌) |

## memos
| `create(input)` | ♻️ `POST /api/memos` + linkProjectId 시 `PUT …/curation`(아래 구현주 1) |
| `list()` | ♻️ `GET /api/memos` |
| `listByProject(projectId)` | ✅ `GET /api/projects/{id}/memos`(014, pinned 포함) |
| `setPin(memoId, projectId, pinned)` | ✅ `PUT /api/projects/{projectId}/memos/{memoId}/pin`(014) |
| `addLink/removeLink` | ♻️ `GET /api/memos/{id}` + `PUT …/curation`(선언적 전체상태로 차이 반영) |
| `pickReentry` | 🧩 `listByProject` 의 pinned 1장 파생(US3 ReentryCard용) |
| `delete/restore` | ⛔ **보류** — 백엔드 영구삭제만·restore 부재(아래 구현주 2 / vault ISSUE-026) |

**구현주(015 실측):**
1. **캡처는 작품을 연결하지 않는다** — `POST /api/memos` 는 `activeProjectAtCapture`(맥락)만 기록하고 `memo_projects` 링크를 만들지 않는다(`MemoService.captureDesktop` 실측). 따라서 `create({linkProjectId})` 가 작품 서랍(listByProject)에 나타나려면 shim 이 캡처 후 `curation` 으로 연결한다(백엔드 변경 없이 shim 합성).
2. **delete/restore 보류** — desktop 책상은 soft-delete + "되돌리기"(Toast)인데 014/006 `DELETE /api/memos/{id}` 는 영구삭제이고 restore endpoint 가 없다. 본 계약의 `restore → ♻️ 기존 endpoint` 가정은 오류. 사용자 결정으로 책상 삭제 기능 보류, 백엔드 soft-delete 별도 트랙(vault ISSUE-026).

## logs
| `listByProject(projectId)` | ✅ `GET /api/projects/{id}/logs`(014) |
| `list()`(LogCard[]) | 🧩 작품 목록 × `logs/latest` + `work-sessions/total` + document wordCount + 마지막문장 파생 |

## sessions
| `start(projectId)` | ✅ `POST /api/projects/{id}/work-sessions/start`(014) |
| `end(projectId)` | ✅ `POST …/work-sessions/end`(014) — 라우트 이탈 시 + 탭 닫기 `sendBeacon`(R6) |
| `endWithLog(projectId, body)` | ✅ `POST …/work-sessions/end-with-log`(014) |

## contact / shell / settings (electron 대체)
| `contact.send(input)` | 🔁 Formsubmit ajax 직접 POST(desktop contactSender 의 web 판본) + web 메타(navigator·빌드버전). ⚠️ 브라우저 CORS 미검증(vault ISSUE-027) |
| `shell.openExternal(url)` | 🔁 `window.open(url, '_blank', 'noopener')` |
| `settings.get/set(key)` | 🔁 localStorage(보기 설정은 zustand preferences, R7) |

> contact 는 백엔드 문의 endpoint 가 없어 desktop 과 동일하게 외부 Formsubmit 으로 직접 보낸다("기존 문의 endpoint" = Formsubmit). desktop 의 server-side `Referer` 트릭은 브라우저 자동전송으로 불필요. 브라우저 cross-origin CORS 허용 여부는 배포 전 실브라우저 검증 필요(ISSUE-027).

## 계약 검증 게이트 (SC-004/005)
- 본 표의 ✅/♻️ 행이 실제 014 endpoint 와 1:1 결선되고, 🧩 조립이 작품별 카드 표시값을 채워야 한다.
- 결선 중 014 endpoint 신설/시그니처 변경이 필요하면 = 014 계약 공백 → 별도 트랙 surfacing(백엔드 변경은 본 작업 범위 밖, 015 회고 §어긋남).
- ID 타입: 014 `Long` → web `number`. desktop `string`(UUID) 가정 코드 이식 시 타입 조정 의무.
