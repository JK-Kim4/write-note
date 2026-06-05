# Desktop Phase 5 — 빠른 메모 캡처 + Inbox (작업 지시서)

> **용도:** 본 문서는 `speckit-specify` 입력 brief(SDD, Spec-Driven Development)다. 브레인스토밍으로 확정한 설계를 담는다. 이 문서를 근거로 `specs/NNN-phase-5-memo-capture-inbox/`의 spec → plan → tasks → implement 를 생성한다.
>
> **메타**
> - Phase: 5 / 8 (Desktop MVP 트랙, Electron 로컬 우선 앱)
> - 작성일: 2026-06-05
> - 기준 브랜치: `develop` (Phase 4 merge `ee503ab`)
> - 상위 SoT: `PRODUCT.md`(전략) · `docs/DESIGN.md`(비주얼) · `docs/phase/05-memo-capture-inbox/README.md` · vault `02-PROGRESS.md`
> - 브레인스토밍 확정: 2026-06-05 (soft delete 방식 + 되돌리기 토스트 + 캡처 진입점 2개 결선)

---

## 1. 목표

떠오른 메모를 **최소 마찰로 캡처**하고, **inbox에서 모아 보고 정리**할 수 있게 한다. 캡처는 active project가 있으면 기본 연결되고, 없으면 미연결로 남는다.

Phase 7까지 끝나면 "실사용 가능한 프로토타입"이며, 메모 캡처는 그 핵심 입력 흐름이다.

---

## 2. 배경 — 현재 코드 상태 (실측)

### 2-1. 이미 완성된 backend (Phase 2 산출, 결선 확인됨)

| 레이어 | 파일 | 상태 |
|---|---|---|
| Repository | `desktop/electron/db/memoRepository.ts` | ✅ `create` / `getById` / `list`(captured_at DESC) / `link` |
| Store | `desktop/electron/db/store.ts` | ✅ `store.memos` 노출 |
| IPC handler | `desktop/electron/ipc/registerHandlers.ts` | ✅ `memos:create/list/link` 등록 |
| IPC contract | `desktop/electron/ipc/contract.ts` | ✅ `memos.{create,list,link}` 타입 + 채널 |
| preload | `desktop/electron/preload.ts` | ✅ `window.electronAPI.memos.*` 노출 |
| 스키마 | `desktop/electron/db/schema.ts` | ✅ `memos` 테이블(STRICT). `linked_project_id` → `ON DELETE SET NULL` |
| 도메인 타입 | `desktop/electron/db/types.ts` | ✅ `Memo { id, body, capturedAt, source, linkedProjectId, createdAt, updatedAt }` |

→ **저장/조회/연결 경계는 이미 동작.** Phase 5는 주로 **renderer 결선 + soft delete 추가**다.

### 2-2. 더미 상태인 UI (결선 대상)

| 컴포넌트 | 현재 | 비고 |
|---|---|---|
| `desktop/src/components/QuickCapture.tsx` | textarea 미제어, 저장 버튼이 `onClose`만 호출 | IPC 미결선 |
| `desktop/src/screens/MemoInboxScreen.tsx` | `MEMOS` 하드코딩 배열, form `preventDefault`만 | IPC 미결선 |
| `desktop/src/components/MemoPanel.tsx` | 하드코딩 | **Phase 6 영역 — 본 Phase에서 건드리지 않음** |

### 2-3. 발견된 갭

- **soft delete 메서드 부재**: `MemoRepository`에 `delete`/`restore` 없음, IPC `memos.delete`/`memos.restore` 없음 → 본 Phase에서 신설.
- **연결 작품 이름 표시 부재**: 도메인은 `linkedProjectId`만 보유. 작품 제목 표시는 `projects.list`와 `id → title` 매핑 필요.

---

## 3. 확정된 설계 결정 (브레인스토밍 2026-06-05)

| # | 결정 | 근거 |
|---|---|---|
| D1 | **삭제는 soft delete + 즉시 숨김 + 되돌리기 토스트.** 삭제 시 목록에서 바로 사라지고 하단에 "되돌리기" 토스트가 잠깐 뜬다. 토스트가 사라지면 앱 내 복구 경로 종료(데이터는 `deleted_at`으로 보존). | soft delete를 택한 의도(실수 삭제 방지)를 살리되 복구 UI는 최소 |
| D2 | **캡처 진입점 2개 모두 결선.** ① 좌측 Rail 캡처 버튼 → `QuickCapture` 모달(여러 줄, 전역) ② inbox 상단 인라인 입력란(한 줄, 메모 보다 바로 추가). 둘 다 `memos.create` 호출 | 두 입력 성격이 다르고(길게 vs 짧게) 결선 비용이 작음 |
| D3 | **상태 관리 = 화면 자체 fetch + 모달 캡처용 새로고침 브리지.** inbox가 `memos.list`/`projects.list`를 자체 호출(기존 `ProjectsScreen` 패턴 일관). App이 `memoRefresh` 카운터를 들고, 모달 캡처 성공 시 올리면 inbox가 재조회 | 기존 `ProjectsScreen` 자체-fetch 패턴과 일관 + 화면 밖 모달의 교차 갱신 해결 |

---

## 4. 사용자 스토리

- **US1 — 빠른 캡처:** 작가로서, 어느 화면에서든 떠오른 생각을 모달에 본문만 입력해 저장하고 싶다. 그래야 흐름이 끊기지 않는다.
- **US2 — Inbox 확인:** 작가로서, 캡처한 메모를 최신순으로 모아 보고 "전체/미연결"로 걸러 보고 싶다.
- **US3 — 정리(삭제·복구):** 작가로서, 필요 없는 메모를 지우되 실수로 지웠을 때 바로 되돌리고 싶다.
- **US4 — 작품 연결 표시:** 작가로서, active project에서 캡처한 메모가 그 작품에 연결돼 있음을 inbox에서 보고 싶다.

---

## 5. 기능 요구사항 (FR)

### 캡처
- **FR-1** 모달(`QuickCapture`)은 본문(body)만 입력해도 저장된다. 빈 본문은 저장하지 않는다.
- **FR-2** 캡처 시 active project가 있으면 `linkedProjectId`로 기본 연결, 없으면 `null`(미연결)로 저장한다.
- **FR-3** inbox 상단 인라인 입력란도 본문 한 줄로 저장한다(같은 연결 규칙 적용).
- **FR-4** 모달 캡처 성공 시 모달이 닫히고, inbox가 열려 있으면 새 메모가 반영된다.

### Inbox
- **FR-5** inbox는 삭제되지 않은 메모를 **captured_at 최신순**으로 보여준다.
- **FR-6** "전체 / 미연결" 필터를 제공한다. "미연결"은 `linkedProjectId == null`만 보여준다.
- **FR-7** 각 메모는 본문 · 상대 날짜 라벨 · 연결 상태(연결 작품 제목 또는 "미연결")를 표시한다.

### 삭제 / 복구 (soft delete)
- **FR-8** 메모 삭제 시 목록에서 즉시 제거하고 `deleted_at`을 채운다(하드 삭제 아님).
- **FR-9** 삭제 직후 "되돌리기"가 가능한 토스트를 약 5초간 띄운다. 되돌리면 `deleted_at`을 비워 복원하고 목록에 다시 나타난다.
- **FR-10** 삭제된 메모는 `list()`에서 제외된다(inbox 어떤 필터에서도 보이지 않음).

### 연결 표시
- **FR-11** 연결된 메모는 작품 제목을 표시한다(`projects.list`로 `linkedProjectId → title` 매핑, 일치 작품 없으면 미연결로 처리).

---

## 6. 설계 상세

### A. Backend — soft delete

| 변경 | 내용 |
|---|---|
| `schema.ts` | 스키마 v2 → **v3**. `memos`에 `deleted_at TEXT`(nullable) 추가. 기존 v2 `genre` ALTER 패턴과 동일하게 `PRAGMA user_version` 분기에서 `ALTER TABLE memos ADD COLUMN deleted_at TEXT`. 신규 DB는 `CREATE TABLE` 정의에 컬럼 포함 |
| `memoRepository.ts` | ① `list()`에 `WHERE deleted_at IS NULL` 추가 ② `softDelete(id)` = `UPDATE memos SET deleted_at=? WHERE id=?` ③ `restore(id)` = `UPDATE memos SET deleted_at=NULL WHERE id=?`. `create`/`getById`/`link`은 유지 |
| IPC 결선 | `contract.ts`에 `memos.delete(id)`·`memos.restore(id)` 타입 + `CHANNELS.memosDelete`/`memosRestore` 추가 → `registerHandlers.ts` 핸들러 → `preload.ts` 노출. `global.d.ts`는 contract 재노출이라 자동 전파 |

### B. View 매퍼 — `src/lib/memoView.ts` (신설)

`src/lib/projectView.ts`의 `toProjectCardView` 패턴 그대로. 도메인 `Memo` → inbox 표시 view:
- `dateLabel`: `captured_at` 기준 상대 라벨(오늘/어제/N일 전/N주 전). `projectView`의 일단위 포맷과 동일 — **공용 함수 추출 여부는 plan 단계에서 판단**(기본값: surgical하게 `memoView` 내부에 동일 로직, `projectView`는 건드리지 않음).
- `linkedProjectTitle`: 인자로 받은 `id → title` 맵에서 조회(미연결/미존재 시 `null`).

### C. UI 결선

| 컴포넌트 | 작업 | 보존 |
|---|---|---|
| `QuickCapture.tsx` | textarea 제어 상태 + `activeProjectId` prop + `onCaptured` 콜백. 저장 시 `memos.create({ body, linkedProjectId })` → `onCaptured()` → 닫기. 빈 본문 가드 | 모달 외관·Escape 닫기 유지 |
| `MemoInboxScreen.tsx` | 더미 `MEMOS` 제거 → `memos.list` + `projects.list` 자체 fetch → `memoView` 매핑. 전체/미연결 필터를 실데이터로. 인라인 입력란 `memos.create` 결선. 삭제 버튼 + 토스트. `refresh` prop 의존 재조회 | 레이아웃·필터 세그먼트·우측 패널 외관 유지 |
| `MemoPanel.tsx` | **변경 없음**(Phase 6) | — |

### D. soft delete UX — 토스트

- 메모 카드에 삭제 버튼 추가 → 낙관적으로 로컬 목록에서 제거 + `memos.delete(id)` 호출 + 하단 토스트("메모를 삭제했어요 · 되돌리기").
- 되돌리기 → `memos.restore(id)` + 재조회 + 토스트 닫기.
- 토스트 약 5초 후 자동 소멸. 이후 앱 내 복구 경로 종료(데이터는 `deleted_at`으로 보존).
- `Toast.tsx` 신설(우선 inbox 전용, 단순한 단일 토스트로 시작).

### E. App.tsx 결선

- `memoRefresh` 카운터 state 추가.
- `QuickCapture`에 `activeProjectId={activeProject?.id ?? null}` + `onCaptured={() => setMemoRefresh(n => n + 1)}` 전달.
- `MemoInboxScreen`에 `refresh={memoRefresh}` 전달(useEffect 의존성으로 재조회).

### F. 타입 정리 — `src/types.ts`

- inbox view 타입(`InboxMemo`)을 `memoView` 출력에 맞게 조정: `linkedProjectTitle: string | null` + `dateLabel`. (UI 전용 더미 필드 정리)
- `MemoPanel`이 쓰는 `Memo`(tag 보유) 타입은 Phase 6 영역이라 **유지**.

### G. 검증 / 품질 게이트

- **TDD(HARD-GATE)**: `memoRepository.test.ts`(softDelete가 list 제외 / restore 복원 / captured_at 정렬), `schema.test.ts`(v3 마이그레이션 + 기존 DB 업그레이드), `memoView.test.ts`(도메인→view 매핑 · 연결 제목 · 상대시간 경계).
- **컴포넌트**: `ProjectsScreen.test.tsx` 패턴을 참고해 `MemoInboxScreen` 행위 테스트(getByRole/getByText 우선).
- **게이트**: `node_modules/.bin/{vitest,tsc,vite}` 직접 실행, **포어그라운드**(CLAUDE.md 작업 실행 지침). Node 24.14.0 + corepack pnpm 8.15.5.

---

## 7. 스코프 경계

### 포함 (Phase 5)
- 캡처(모달 + inbox 인라인) · 기본 연결 · inbox 목록/필터 · soft delete + 되돌리기 토스트 · 연결 작품 **표시**.

### 제외 (범위 밖)
- 모바일 캡처 · 전역 단축키 필수 · 태그 · 이유 노트 · 메모 검색 · 다중 프로젝트 연결 · 메모 pin · 세션 노트.

### Phase 6으로 미룸 (혼동 방지)
- inbox 카드의 "연결하기" 칩 **클릭으로 연결/해제하는 동작**은 Phase 6(Memo Linking + Side Panel). Phase 5는 **캡처 시 기본 연결**과 **연결 상태 표시**만. 칩은 표시 전용(클릭 동작 비활성 또는 no-op).
- Write Studio의 `MemoPanel`(연결 메모 side panel) 결선도 Phase 6.

---

## 8. 완료 기준 (Acceptance, 검증 가능)

1. 모달에서 본문만 입력해 저장하면 inbox 최신순 맨 위에 나타난다.
2. active project가 선택된 상태에서 캡처한 메모는 그 작품에 연결돼 inbox에서 작품 제목이 보인다. active project가 없으면 "미연결"로 남는다.
3. "미연결" 필터는 미연결 메모만 보여준다.
4. 메모를 삭제하면 목록에서 즉시 사라지고, 되돌리기 토스트로 복원하면 다시 나타난다. 토스트가 사라진 뒤에는 삭제 상태가 유지된다(데이터는 DB에 `deleted_at`으로 남음).
5. 앱을 재시작해도 캡처한 메모(삭제 안 된 것)는 복원되고, 삭제한 메모는 보이지 않는다.
6. TDD/typecheck/build GREEN, Phase 1~4 회귀 0.

---

## 9. 영향 파일 (예상)

### 신설
- `desktop/src/lib/memoView.ts` (+ `.test.ts`)
- `desktop/src/components/Toast.tsx`

### 수정
- `desktop/electron/db/schema.ts` (v3 마이그레이션) + `schema.test.ts`
- `desktop/electron/db/memoRepository.ts` (list 필터 / softDelete / restore) + `memoRepository.test.ts`
- `desktop/electron/ipc/contract.ts` · `registerHandlers.ts` · `preload.ts` (memos.delete/restore)
- `desktop/src/components/QuickCapture.tsx`
- `desktop/src/screens/MemoInboxScreen.tsx` (+ 신규 `.test.tsx` 고려)
- `desktop/src/App.tsx` (memoRefresh 브리지 + 모달 prop)
- `desktop/src/types.ts` (InboxMemo view 타입)

> ⚠️ 영향 파일·시그니처는 작성 시점 기준 추측을 포함한다. `speckit-implement` 진입 직전 실제 코드 grep으로 정합 확인(agent-workflow-discipline §6).

---

## 10. 리스크 / 회귀 가드

| 리스크 | 가드 |
|---|---|
| **preload 결선 회귀** (Phase 3 재발 이력) | renderer가 새 IPC(`memos.delete/restore`)를 처음 호출하므로 `window.electronAPI.memos.delete` 존재 1회 smoke test (agent-workflow §8) |
| **한글 IME** | `QuickCapture`는 단순 `<textarea>`(TipTap 아님)라 PoC 0-1 4케이스 의무는 아니나, dogfooding에서 조합 입력 확인 |
| **마이그레이션 회귀** | 기존 v2 DB(genre만 있는)에서 v3 ALTER가 `deleted_at` 추가하는지 `schema.test.ts`로 검증 |
| **soft delete 누락 분기** | `list()` 필터를 빠뜨리면 삭제 메모가 노출 → repository 테스트로 보호 |
| **lint** | backend(electron) 영역은 해당 없음(TS). frontend 결선 후 `pnpm build`(RSC 아님, Vite)로 typecheck 게이트 |

---

## 11. 다음 단계 (SDD 흐름)

1. `speckit-specify` — 본 문서를 입력 brief로 `specs/NNN-phase-5-memo-capture-inbox/spec.md` 생성.
2. `speckit-plan` → `speckit-tasks` → `speckit-implement`.
3. Phase 완료 후: dogfooding(캡처·필터·삭제·복구·재시작 복원) → develop merge → vault `02-PROGRESS.md` 갱신.
