# Phase 0 Research: 빠른 메모 캡처 + Inbox

설계는 작업 지시서(`docs/superpowers/specs/2026-06-05-desktop-phase5-memo-capture-design.ko.md`)에서 브레인스토밍으로 확정됨. 본 문서는 그 결정을 구현 관점에서 정리하고 코드베이스 정합을 확인한다. NEEDS CLARIFICATION 없음.

## R1. Soft delete 컬럼 전략

- **Decision**: `memos`에 nullable `deleted_at TEXT` 추가. 삭제 = `deleted_at`에 ISO 시각 기록, 복원 = `NULL`. 조회는 `list()`에서 `WHERE deleted_at IS NULL`.
- **Rationale**: 별도 boolean 플래그보다 "언제 삭제됐는지"를 함께 보존 → 향후 보관함/정리 정책 확장 여지. 기존 `captured_at`/`created_at`/`updated_at`이 모두 TEXT(ISO)라 타입 일관.
- **Alternatives**: `is_deleted INTEGER` 플래그(시각 정보 손실) / 행 물리 삭제(되돌리기 불가 — D1 결정 위반).
- **코드 정합**: `memoRepository.ts`의 `list()`는 현재 `SELECT * FROM memos ORDER BY captured_at DESC`. 여기에 WHERE 추가. `toMemo` row 매핑에 `deleted_at` 포함.

## R2. 스키마 마이그레이션 (v2 → v3)

- **Decision**: `schema.ts`의 `SCHEMA_VERSION`을 3으로 올리고, ① 신규 DB는 `CREATE TABLE memos` 정의에 `deleted_at TEXT` 포함, ② 기존 DB는 `PRAGMA user_version < 3` 분기에서 `PRAGMA table_info(memos)`로 컬럼 부재 확인 후 `ALTER TABLE memos ADD COLUMN deleted_at TEXT`.
- **Rationale**: 기존 v2 `genre` 추가가 정확히 같은 패턴(`schema.ts:50-57`). 검증된 경로 재사용. nullable 컬럼이라 기존 행에 DEFAULT 불필요(NULL = 미삭제).
- **Alternatives**: 전체 재생성(데이터 손실) 기각.
- **주의**: STRICT 테이블에 nullable TEXT 컬럼 ADD는 node:sqlite에서 허용(genre는 NOT NULL DEFAULT였고, deleted_at은 nullable이라 더 단순).

## R3. IPC 계약 확장 (delete / restore)

- **Decision**: `contract.ts`의 `ElectronAPI.memos`에 `delete(id) => Promise<boolean>`, `restore(id) => Promise<Memo | null>` 추가 + `CHANNELS.memosDelete`/`memosRestore`. `registerHandlers.ts`·`preload.ts`에 결선. `global.d.ts`는 contract 재노출이라 자동.
- **Rationale**: 기존 `memos.create/list/link`와 동형. `link`가 이미 `Memo | null` 반환 패턴이라 `restore`도 동일. `delete`는 `projects.delete`처럼 `boolean`.
- **Alternatives**: 단일 `setDeleted(id, bool)` 토글 — 의미가 흐려져 호출부 가독성 저하. 분리 채택.

## R4. 상대시간 표시 — 공용 추출

- **Decision**: `projectView.ts`의 `formatLastEdited`(일단위 오늘/어제/N일 전/N주 전)를 `src/lib/relativeDate.ts`의 `formatRelativeDay(iso, now)`로 추출. `projectView`와 신규 `memoView`가 공유.
- **Rationale**: inbox 메모도 동일 일단위 라벨 필요(spec Assumptions). 복제 대신 단일 출처. `projectView.test.ts`가 경계(오늘/어제/주)를 보호하므로 추출 후에도 행위 동일.
- **Alternatives**: `memoView`에 복제 — surgical하나 표시 규칙 2벌. 추출이 장기 유지보수 우위(Complexity Tracking에 정당화).
- **TDD**: `relativeDate.test.ts`로 경계 테스트 먼저 → 추출 → `projectView.test.ts` GREEN 유지 확인.

## R5. 메모 view 매핑 + 연결 작품 이름

- **Decision**: `src/lib/memoView.ts`에 `toInboxMemoView(memo, projectTitleById, now)` 신설. 출력 = `{ id, body, dateLabel, linkedProjectId, linkedProjectTitle }`. `linkedProjectTitle`은 `Map<string,string>`(projects.list로 구성)에서 조회, 없으면 `null`.
- **Rationale**: `projectView.toProjectCardView` 패턴 동일(도메인→view, 순수 함수, now 주입). 연결 작품 제목은 메모 도메인에 없으므로 inbox가 `projects.list`를 함께 조회해 맵 주입.
- **Alternatives**: repository에 JOIN 쿼리 추가 — 도메인 경계 흐려짐(메모 repo가 project 의존). renderer 조합 채택.
- **엣지**: `linkedProjectId`가 있으나 맵에 없음(작품이 사라짐) → `linkedProjectTitle = null`(미연결로 표시). spec Edge Case 정합.

## R6. 상태 관리 — 화면 자체 fetch + 모달 새로고침 브리지

- **Decision**: `MemoInboxScreen`이 `memos.list` + `projects.list`를 자체 fetch(기존 `ProjectsScreen.load()` 패턴). App은 `memoRefresh` 카운터를 들고 모달 캡처 성공 시 증가 → inbox가 `useEffect([refresh])`로 재조회.
- **Rationale**: `ProjectsScreen`이 이미 자체 fetch + mutation 후 `await load()` 재조회 패턴(`ProjectsScreen.tsx:37-51`). 일관 유지. 모달은 화면 밖(App `captureOpen`)이라 교차 갱신만 브리지 필요.
- **Alternatives**: App이 메모 목록 상태 통째 소유(Phase 4 document 패턴) — `ProjectsScreen` 패턴과 불일치 + App 비대. 기각.
- **인라인 입력란**: inbox 내부 캡처는 화면 자체 상태라 캡처 후 로컬 `load()` 직접 호출(브리지 불요).

## R7. Soft delete UX — 되돌리기 토스트

- **Decision**: `Toast.tsx` 신설(우선 inbox 전용 단일 토스트). 삭제 = 낙관적으로 로컬 목록에서 제거 + `memos.delete(id)` + 토스트 표시(메시지 + 되돌리기). 되돌리기 = `memos.restore(id)` + 재조회 + 토스트 닫기. 토스트는 일정 시간(기본 5초) 후 `setTimeout`으로 자동 소멸.
- **Rationale**: 흔한 undo 패턴. 낙관적 제거로 즉시 반응. 데이터는 `deleted_at` 보존이라 restore 안전.
- **Alternatives**: 삭제 확인 모달(ProjectsScreen 작품 삭제 방식) — 메모는 가볍고 자주 지우므로 모달은 마찰 과다. undo 토스트가 D1 결정.
- **엣지(연속 삭제)**: 토스트는 "가장 최근 삭제 1건"만 대상(단일 토스트 상태). 새 삭제가 오면 이전 토스트 대체.
- **타이머 정리**: 컴포넌트 unmount / 화면 이탈 시 `clearTimeout`(메모리 누수·잘못된 setState 방지).

## R8. 빈 본문 가드 / 캡처 연결 규칙

- **Decision**: `body.trim() === ""`이면 저장 안 함(모달·인라인 공통). 캡처 시 `linkedProjectId = activeProject?.id ?? null`.
- **Rationale**: spec FR-003/FR-004. `QuickCapture`는 App의 `activeProject`에서 id를 prop으로 받음.
- **코드 정합**: App에 이미 `activeProject: { id, title } | null` 상태 존재(`App.tsx:30`). `QuickCapture`에 `activeProjectId` prop 추가.

## 코드베이스 정합 확인 (구현 진입 전 grep 의무 — agent-workflow §6)

implement 직전 재확인할 항목:
- `memoRepository.ts` `list()` 시그니처 / `toMemo` 매핑 필드
- `schema.ts` `SCHEMA_VERSION` 현재 값(2) + v2 ALTER 분기 위치
- `contract.ts` `CHANNELS` 네이밍 컨벤션(`memosCreate` 등 camelCase)
- `App.tsx` `activeProject`·`captureOpen`·`MemoInboxScreen` props 현황
- `types.ts` `InboxMemo`/`Memo` 현재 정의(더미 필드)
