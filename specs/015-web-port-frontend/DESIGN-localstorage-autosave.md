# 설계 — localStorage 기반 자동저장 재설계 + datetime 버전 토큰

**작성:** 2026-06-09 | **브랜치:** `015-web-port-frontend` | **상태:** 설계 승인 → 구현 계획 대기

집필실(`/projects/[id]/write`) 자동저장의 거짓 409 충돌 버그([[HANDOFF-autosave-conflict]])를 **근본 재설계**로 해결한다. 동시에 사용성(작성분 복구·반응성)을 끌어올리고, 예정된 **비동기 공동 집필**의 토대를 보존한다.

본 설계는 프론트(015) + 백엔드(014) 양쪽을 건드린다.

---

## 1. 배경 — 왜 거짓 충돌이 나는가

거짓 409의 메커니즘은 **"프론트가 stale(낮은) version 으로 PUT" → 서버 version 이 더 높음 → 409**다. 구조적 뿌리는 둘:

- **뿌리 A — version 이 React Query 캐시(서버 상태)에 살아 편집 중 흔들린다.** `QueryProvider` 의 `staleTime` 기본값 0 + `useProjectDocument` 의 `refetchOnMount` 기본값 true 로, 편집 중 끼어든 document GET 의 응답 version 이 `useAutoSave` 의 version prop 으로 되먹여진다(이미 저장으로 추월된 옛 version 이라 다음 PUT 이 stale).
- **뿌리 B — 저장이 in-flight 경합한다.** `useAutoSave` 에 in-flight 가드가 없어, 첫 PUT 이 끝나기 전 다음 debounce 가 같은 `syncedVersionRef` 로 발사되면 뒤엣것이 stale.

3 회 수정 시도(refetch 차단 / 전진-only 가드 / 캐시 setQueryData)는 모두 뿌리를 **부분 완화**에 그쳐 재발했다. 핵심은 **편집 중 version 의 진실원이 분산**되어 있다는 것.

## 2. 목표 / 비목표

**목표**
- 거짓 409 충돌을 **구조적으로 제거**(완화 아님).
- 충돌·크래시·새로고침에도 작성분이 유실되지 않는 **localStorage 복구 안전망**.
- 타자 중 네트워크 왕복 제거로 입력 반응성 향상.
- 예정된 비동기 공동 집필의 **version 기반 충돌 감지 토대 유지**.

**비목표**
- 실시간 동시 편집(구글 독스류 커서·타자 공유, OT/CRDT). → 비동기 공동 집필만 대비.
- 공동 집필 기능 자체의 구현. → 이번엔 토대만, 갈아엎지 않을 방향 정합까지.
- 전역 React Query default options 튜닝. → document 쿼리만 분리, 그 외는 범위 밖.

## 3. 핵심 정책 결정 (인터뷰 확정)

| 결정 | 값 | 근거 |
|---|---|---|
| 동시 편집 모델 | 비동기 공동(번갈아·구간 분담) | version 충돌 감지 유지 필요, 실시간 아키텍처 불필요 |
| version 진실원 | 편집 세션 동안 **autosave 단독 소유** (접근 A) | 뿌리 A 제거 |
| 동기화 시점 | **하이브리드** — 타자 멈춤 1~2초 또는 마지막 sync 후 최대 10초 | 멈추면 빨리 안전, 계속 써도 10초 상한 |
| 복구 UX | **[복구]/[버리기] 배너** | 명시적 사용자 통제 |
| draft 정리 | 동기화 성공 draft 는 **다음 진입 시** 정리 | 동기화 직후 크래시에도 복구 안전망 유지 |
| version 컬럼 타입 | `Int` → **`Instant`(updatedAt 겸용)** | 수정 시각 = 낙관적 잠금 토큰 겸용 |

## 4. 아키텍처

### 4-1. 프론트 (모듈 경계)

```
write/page.tsx
  └─ useDocumentSession(projectId)        // 편집 세션의 단일 진실원 (useAutoSave 대체)
       ├─ 진입 시 1회 서버 로드 (이후 refetch 차단)
       ├─ version(Instant 문자열) 단독 소유
       ├─ draftStore (localStorage CRUD)  // 순수 함수
       ├─ 하이브리드 동기화 스케줄러
       ├─ pagehide flush (sendBeacon)
       └─ 충돌 / 복구 상태 노출
```

- **`lib/draftStore.ts`** (신규, 순수 함수) — 작품별 localStorage draft 읽기/쓰기/삭제. SSR 가드(`typeof localStorage !== "undefined"`)는 `lib/lastProject.ts` 패턴 재사용. React·네트워크 의존 없음 → 단위 테스트 용이.
- **`hooks/useDocumentSession.ts`** (신규, `useAutoSave` 대체) — 편집 세션 라이프사이클 + 동기화 오케스트레이션. version 을 PUT 응답으로만 갱신.
- **편집 중 React Query 분리** — `useProjectDocument` 는 진입 시 1회 로드만(편집 세션 동안 `staleTime: Infinity`). 저장 성공 시 `setQueryData` 로 캐시 동기화(refetch 아님 — 다른 화면 정합용, version 안 흔듦).
- **`useAutoSave` 제거** — 구현 진입 시 `grep -rn "useAutoSave" frontend/src` 로 집필실 외 사용처 확인 후, 없으면 파일·테스트 완전 제거.

### 4-2. 백엔드 (Document 엔티티 + 서비스)

- **`Document.kt`**: `version: Int` 컬럼 **제거**. `updatedAt: Instant` 에 `@Version` 부여. `@PreUpdate` 의 `updatedAt = Instant.now()` **제거**(수동 set 과 `@Version` 충돌 — Hibernate 가 flush 시 자동 set). `createdAt` 의 `@PrePersist` 는 유지.
  - 검증 완료: Hibernate ORM 은 `@Version` 에 `Instant` 정식 지원(`introduction/Entities.adoc`, `OptimisticLockingInstantTest`). numeric 이 typical 권장이나 temporal 도 지원.
- **`DocumentService.performSave`**: 수동 비교 패턴 유지하되 `if (document.updatedAt != request.version)` (Instant 비교). 저장 후 **`flush`** 하여 Hibernate 가 set 한 새 `updatedAt` 을 읽어 응답(정수 `+1` 예측과 달리 datetime 은 다음 값을 예측 불가).
- **API 계약**: `version` 타입 `number` → **ISO8601 문자열**(`DocumentResponse` / `SaveDocumentRequest` / `DocumentSaveResponse`). 409 응답의 `currentVersion` 도 동일하게 문자열(`DocumentConflictException.currentVersion: Int → Instant`, 프론트 `ConflictError.currentVersion` / `ConflictData.currentVersion` / `ConflictDialog` 표시 타입까지 연쇄). 프론트는 version 을 **불투명 토큰**으로 취급(받은 문자열 그대로 비교·저장, 파싱·증감 없음).
- **Flyway `V8__replace_document_version_with_timestamp.sql`**: `documents.version` 컬럼 drop. (작성만 이번에, **적용은 사용자 컨펌** — 외부 DB 안전 룰.)

## 5. 데이터 구조

**localStorage draft** (키: `wn:draft:doc:{documentId}`):

```ts
type DocumentDraft = {
  documentId: number;
  projectId: number;
  body: string;        // TipTap/ProseMirror JSON 직렬화
  baseVersion: string; // 이 draft 가 기반한 서버 version (ISO8601)
  dirty: boolean;      // 미동기화 변경 존재 여부
  updatedAt: number;   // epoch ms (draft 자체 기록 시각, 표시·정리용)
};
```

**메모리 state** (`useDocumentSession` 내부): `body`, `version`(소유, string), `syncStatus`(`idle|syncing|synced|error|conflict`), `conflict`, `recoverable`(복구 배너 노출 여부).

## 6. 데이터 흐름 (세션 라이프사이클)

1. **진입** — 서버 GET 1회 → draft 확인
   - draft 있고 `dirty===true` **&&** `baseVersion===서버version` → **복구 배너** 노출(서버 본문 먼저 로드, 선택 대기)
   - draft 있고 `baseVersion≠서버version` → **충돌 경로**(그 사이 다른 작가 저장)
   - draft 없거나 `dirty===false` → 서버 본문 로드(이전 draft 는 정리)
2. **타자** — `setBody` + `draftStore.write({ dirty:true, baseVersion:소유 version })` (네트워크 없음)
3. **동기화 트리거(하이브리드)** — 멈춤 1~2초 또는 마지막 sync 후 10초 → `saveDocument(id, { body, version })`
   - **200** — `version = res.version`, `draftStore.write({ dirty:false })`, `setQueryData` 캐시 갱신, status=`synced`
   - **409** — status=`conflict`, draft **보존**(유실 방지)
4. **이탈 / 탭 닫기** — `pagehide` 에서 `dirty` 면 `sendBeacon` flush (`useWorkSession` 의 pagehide 패턴 재사용)
5. **복구 배너 [복구]** — draft body 를 에디터에 적용(`editorKey` 증가) / **[버리기]** — `draftStore.clear` + 서버 본문 유지

## 7. 충돌 / 복구 처리

- **409 충돌** — 기존 `ConflictDialog`(덮어쓰기 / 다시 불러오기) 유지. draft 는 보존 → 작성분 유실 없음(현 버그 대비 핵심 개선).
- **복구 배너** — 진입 시 `dirty` draft + version 일치일 때만. version 불일치는 충돌 다이얼로그로 합류.
- **draft 정리** — 동기화 성공 시 즉시 삭제하지 않고 `dirty:false` 로 마크, **다음 진입 시** 정리(동기화 직후 크래시 복구 여지).

## 8. 테스트 전략 (TDD, Red→Green)

- **`draftStore` 단위** — write/read/clear, SSR 가드, 손상 JSON 방어.
- **`useDocumentSession` 행위(msw 로 HTTP 경계만 mock)** — 진입 로드 / 타자→draft 기록 / 하이브리드 트리거→PUT 1회 / 200→version 전진 / **409→conflict + draft 보존** / 복구 배너 분기(version 일치·불일치) / pagehide flush.
- **거짓 충돌 회귀** — "편집 중 서버 GET 이 끼어들어도 version 이 흔들리지 않음" 명시 검증(현 버그 재발 방지).
- **백엔드 `performSave` datetime** — updatedAt 불일치→409, 일치→저장 후 flush 된 새 updatedAt 응답, 동일 updatedAt 재요청 충돌.
- 기존 `useAutoSave.test.ts` 행위 케이스는 `useDocumentSession.test.ts` 로 이관.

## 9. 정리 대상

- 디버그용 `frontend/src/middleware.ts` + `[DBG-DOC]` 로깅 제거.
- `useAutoSave.ts` / `useAutoSave.test.ts` — 사용처 확인 후 제거.

## 10. 리스크 / 트레이드오프

- **datetime `@Version` 동시성 약점** — 같은 시각 해상도 안에 두 PUT 이 들어오면 충돌을 놓칠 수 있다(정수 `+1` 은 구조적으로 불가). 우리 모델은 (a) PUT 이 드물고(멈춤·10초) (b) Postgres timestamp 가 마이크로초 해상도라 실무 위험은 낮음. 정수 대비 이론적 약점으로 기록.
- **동기화 윈도우 유실** — 주기 사이(최대 10초) 브라우저가 죽으면 그 구간은 서버에 없으나 localStorage 에 남아 다음 진입 복구. 다른 기기 반영은 최대 10초 지연(단일 작가·비동기 공동 가정상 수용).
- **localStorage 용량** — 단일 작품 본문은 수십~수백KB 로 5MB 한계 내. 동기화 성공 draft 정리로 누적 방지.
- **다중 탭** — 같은 작품 두 탭 동시 편집 시 draft·version 경합 가능. 1차 구현 범위 밖(비동기 공동 가정), 후속에서 `storage` 이벤트 또는 "다른 탭 편집 중" 안내 검토.

## 11. 미래 정합 — 비동기 공동 집필

version 기반 낙관적 잠금을 유지하므로, 여러 작가가 번갈아·구간 분담으로 한 작품을 쓰는 모델에서 "누가 먼저 바꿨나"를 datetime version 으로 판정할 수 있다. 본 재설계가 그대로 토대가 된다. 실시간 동시 편집으로 확장하려면 별도 아키텍처(WebSocket + CRDT/OT)가 필요하며, 그 전환을 본 설계가 막지 않는다(편집 세션 진실원이 한 곳에 모여 있어 교체 지점이 명확).

---

## 부록 — 관련 파일

| 파일 | 변경 |
|---|---|
| `frontend/src/lib/draftStore.ts` | 신규 |
| `frontend/src/hooks/useDocumentSession.ts` | 신규(`useAutoSave` 대체) |
| `frontend/src/app/projects/[id]/write/page.tsx` | 결선 교체 |
| `frontend/src/lib/query/useDocument.ts` | 편집 중 refetch 차단 |
| `frontend/src/types/api.ts` | `version`·`currentVersion` 타입 number→string |
| `frontend/src/lib/api/client.ts` | `ConflictError.currentVersion` number→string |
| `frontend/src/components/editor/ConflictDialog.tsx` | `currentVersion` 표시 타입 |
| `frontend/src/middleware.ts` | 제거 |
| `frontend/src/hooks/useAutoSave.ts(.test.ts)` | 제거 |
| `backend/.../entity/Document.kt` | version:Int 제거, updatedAt @Version |
| `backend/.../service/DocumentService.kt` | performSave datetime 비교 + flush |
| `backend/.../model/{request,response}/Document*.kt` | version 타입 변경 |
| `backend/.../error/DocumentConflictException.kt` | `currentVersion` Int→Instant |
| `backend/src/main/resources/db/migration/V8__*.sql` | version 컬럼 drop |
