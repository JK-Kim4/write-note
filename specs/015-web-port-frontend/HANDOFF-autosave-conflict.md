# 핸드오프 — 자동저장 거짓 충돌 버그 (미해결)

**작성:** 2026-06-09 | **브랜치:** `015-web-port-frontend` | **최신 커밋:** `b7bc951`

집필실(`/projects/[id]/write`) 자동저장이 거짓 409 충돌을 반복하고, 충돌 후 저장이 동결되는 버그. **3회 수정 시도 모두 실패.** 다음 세션이 이 문서만 읽고 이어서 디버깅할 수 있도록 정리한다.

> ⚠️ 본 버그가 해결될 때까지 015 는 **dogfooding 불가**(핵심 집필 흐름이 깨짐). 최우선.

---

## 1. 증상 (사용자 dogfooding)

- 집필실에서 한글 본문을 입력하면 **"문서가 다른 곳에서 변경되었습니다"(ConflictDialog)가 반복 출현**. 스크린샷의 메시지: "현재 열린 문서보다 최신 버전(v1)이 서버에 있습니다."
- **작성한 내용이 저장되지 않음.** (충돌이 한 번 나면 `useAutoSave` 의 `conflictRef=true` 가 이후 자동저장을 전부 차단 → 저장 동결. 두 증상은 같은 뿌리.)
- 단일 편집 세션(다른 기기/탭 없음)에서도 재발.

---

## 2. 재현

1. backend(`:8080`) + dev(`:3000`) 기동, dogfood 로그인(`dogfood@writenote.local` / `Dogfood1234!`).
2. 작품 "가가가"(projectId **1131**, documentId **540**) 열기 → `/projects/1131/write`.
3. 한글 본문 입력(연속 타자) → 잠시 후 ConflictDialog 출현, 저장 안 됨.

---

## 3. 근본 원인 분석 (현재까지 — 미확정)

### 확정된 사실
- **백엔드 버전 계약은 정상.** `GET /api/projects/{id}/document` → version 안정적. `PUT /api/documents/{id}` with 일치 version → 성공·version+1. 불일치 → 409 `DOCUMENT_VERSION_CONFLICT`. (curl 재현 확인.)
- 즉 버그는 **프론트가 stale(낮은) version 으로 PUT** 하는 데 있다. 서버가 더 높으면 409.
- **재현 테스트로 한 가지 메커니즘 박음**(`frontend/src/hooks/useAutoSave.test.ts` 의 "version 회귀" 테스트): `useAutoSave` 의 version-prop-sync effect 가 `syncedVersion` 을 **현재보다 낮은 version 으로 되돌리면** 다음 저장이 stale → 거짓 409. → 전진-only 가드로 그 테스트는 GREEN.

### 🔑 미해결 핵심 단서 (계측 로그에서 관찰)
임시 미들웨어(`src/middleware.ts`)가 찍은 `[DBG-DOC]` 로그에서, **단일 편집 세션 중 document GET(refetch)이 PUT 들 사이에 반복 발생**:
```
GET  /api/projects/1131/document   (최초 로드)
PUT  /api/documents/540
PUT  /api/documents/540
GET  /api/projects/1131/document   ← 편집 중 refetch!
PUT  /api/documents/540
GET  /api/projects/1131/document   ← 또 refetch!
PUT  /api/documents/540
```
**`refetchOnWindowFocus`/`refetchOnReconnect` 를 껐는데도 편집 중 document GET 이 ~1초마다 반복**된다. 이 GET 들이 (서버가 막 PUT 으로 올라간 직후라도) version 을 prop 으로 다시 먹이고, 그 사이 in-flight PUT 과 경합하면 stale version 저장 → 409.

**→ 다음 세션의 1순위 질문: 편집 중 document 쿼리(`useProjectDocument`, queryKey `["document","byProject",projectId]`)를 무엇이 반복 refetch 시키는가?**

후보 가설(미검증):
- (a) 집필실 컴포넌트가 편집 중 **반복 remount** → `refetchOnMount` 가 매번 GET. 무엇이 remount 시키나? (부모 key 변동 / Rail 의 `QuickCapture` 조건부 렌더 / `now=useMemo` 등 내 US2·US3 추가분 의심)
- (b) 무언가 document 쿼리를 **invalidate**. (단, 내 코드엔 documentKeys invalidate 없음 — 확인 필요. `onSaved` 의 `setQueryData` 는 invalidate 아님)
- (c) React StrictMode(dev) 의 이펙트 이중 발화가 GET/PUT 을 증식. (단 StrictMode 는 mount 1회 — 반복 GET 설명 약함)
- (d) **동시 PUT 경합**: 로그에 PUT 가 ~1초 간격 연속 → debounce(800ms)가 매 타자마다 reset 안 되고 여러 저장이 겹쳐 in-flight `syncedVersionRef` 가 stale 인 채 발사. `useAutoSave` 에 in-flight 가드(`isSavingRef`) 부재.

---

## 4. 시도한 수정 (3회, 모두 실패)

| 커밋 | 가설 | 변경 | 결과 |
|---|---|---|---|
| `6e8fd65` | 창 포커스 refetch 가 version 리셋 | `useProjectDocument` 에 `refetchOnWindowFocus:false` (+이후 `refetchOnReconnect:false`) | 실패(트리거만 일부 차단) |
| `21ddc5c` | version-sync 가 syncedVersion 을 회귀시킴 | version-sync **전진-only 가드** + 재현 테스트 | 실패(다른 경로로 재발) |
| `b7bc951` | 자동저장이 캐시 version 미갱신 → stale 재사용 | `useAutoSave` `onSaved` 콜백 → write page 가 `setQueryData` 로 캐시(version/wordCount/body) 갱신 | 실패(여전히 재발) |

`6e8fd65` 에 Rail "집필" 네비 수정(`lib/lastProject` localStorage)도 포함 — 이건 별개 버그(전역 활성작품 없음)로, 자동저장과 무관.

**왜 검증이 꼬였나(중요):** `pnpm dev` 가 떠 있는 동안 `pnpm build` 를 여러 번 돌려 `.next` 가 오염됐고, **이전 세션의 옛 dev 서버(다른 pid)가 계속 `:3000` 서빙**, HMR 도 hook 변경을 완전 반영 못 함 → 초반 "수정해도 그대로" 피드백이 stale 서버 기준이었다. 이후 `.next` 비우고 dev 완전 재시작했으나 그 뒤에도 재발 → 코드는 live 인데 미해결. **다음 세션은 dev 서버가 `:3000` 단독(옛 프로세스 없음)인지 `lsof -iTCP:3000 -sTCP:LISTEN` 으로 먼저 확인. 빌드/테스트는 dev 끄고 실행(`.next` 경합 회피).**

---

## 5. 디버그 계측 (재사용)

- `frontend/src/middleware.ts` — 모든 document GET/PUT 을 `[DBG-DOC] <method> <path> @ <epoch ms>` 로 **dev 서버 콘솔**에 로깅. dev 로그 파일 = `/tmp/wn-frontend.log`(기동 방식에 따라 경로 다름).
- 읽기: `grep "DBG-DOC" /tmp/wn-frontend.log | tail -60` (재현 직후).
- **버전 자체는 미로깅**(미들웨어가 body 소비 시 프록시 깨짐 우려로 method/path/시각만). 버전까지 보려면: 브라우저 DevTools Network 탭에서 실패한 `PUT /api/documents/540` 의 **Request payload `version`** 과 **409 Response 의 `currentVersion`** 2개 숫자 확인이 가장 확실. 또는 `lib/api/document.ts saveDocument` 에 임시 `console.log` (브라우저 콘솔).
- **해결 후 `src/middleware.ts` 삭제 + 임시 로그 제거.**

---

## 6. 관련 파일

| 파일 | 역할 |
|---|---|
| `frontend/src/hooks/useAutoSave.ts` | 자동저장(debounce·409·version 동기화·onSaved). **버그 핵심 후보** |
| `frontend/src/hooks/useAutoSave.test.ts` | 행위 테스트 + version 회귀 재현 테스트(6 tests) |
| `frontend/src/app/projects/[id]/write/page.tsx` | 집필실. `useProjectDocument` + `useAutoSave` 결선, body/version/editorKey 흐름, onSaved |
| `frontend/src/lib/query/useDocument.ts` | document 쿼리(refetch 옵션) |
| `frontend/src/lib/api/document.ts` | `getProjectDocument`/`saveDocument` (PUT `/api/documents/{id}` `{body,version}`) |
| `frontend/src/lib/api/client.ts` | 409 → `ConflictError`(`error.code==="DOCUMENT_VERSION_CONFLICT"`만) |
| `frontend/src/components/editor/PaperEditor.tsx` | TipTap onUpdate → onChange(setBody). IME 가드 `view.composing` |
| `frontend/src/middleware.ts` | **임시 디버그 로깅(삭제 대상)** |

---

## 7. 다음 세션 권장 절차 (systematic-debugging)

1. **dev 서버 단독 확인** + 재현 1회 → `[DBG-DOC]` 로그로 GET/PUT 패턴 + **DevTools Network 로 실패 PUT 의 version vs currentVersion 2숫자** 확보(추측 금지, 관찰 먼저).
2. **편집 중 document GET 이 왜 반복되나** 규명(§3 단서 a~d). React DevTools Profiler/`why-did-you-render` 또는 `useProjectDocument` 에 임시 로그로 fetch 발생 원인(mount? invalidate?) 추적.
3. 원인 확정 후 수정 + **재현 테스트로 박기**(실제 컴포넌트 통합 테스트 권장: 실제 write page 를 msw 로 렌더해 mount→타자→PUT 시퀀스 관찰. auth guard mock 필요).
4. **회귀 검증**: `useAutoSave.test.ts` GREEN 유지 + 실제 브라우저 dogfooding(연속 타자·창 전환·페이지 재진입에 충돌 0, "저장됨" 유지).
5. 해결 후 `middleware.ts` 삭제, 임시 로그 제거, 본 문서 §해결 기록 후 `03-ISSUES` 갱신.

### 보강 후보 (원인과 별개로 강건성)
- `useAutoSave` **in-flight 저장 가드**(`isSavingRef`): 저장 진행 중엔 새 저장을 큐잉, 끝난 뒤 dirty 면 재저장 — 동시 PUT 경합(§3-d) 차단. 기존 5 테스트 깨지지 않게 주의(debounceMs=0 경로).
- 집필 중 document 쿼리를 아예 **편집 세션 동안 고정**(첫 로드 후 refetch 완전 차단, autosave 가 단일 source of truth, 교차기기 충돌만 409). 단 §3 의 반복 GET 출처를 먼저 규명해야 근본 해결.

---

## 8. 015 전체 맥락

자동저장 버그를 제외하면 015(Web 포팅 front)는 **US1~US4 + Polish 구현 완료**(tasks 38/44, 게이트 GREEN). 잔여 = 본 버그 + 브라우저 시각 dogfooding + 보류 결정([[03-ISSUES]] ISSUE-026 곁쪽지 삭제 / ISSUE-027 문의 CORS / 전역 QuickCaptureModal 중복 / legacy 라우트). 전체 인계 = `specs/015-web-port-frontend/HANDOFF.md`.
