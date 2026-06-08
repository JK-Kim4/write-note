---
description: "Task list — Web 포팅 Front 이식 (015)"
---

# Tasks: Web 포팅 — Front 이식 (하위 작업 2)

**Input**: Design documents from `/specs/015-web-port-frontend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/web-electron-api.md

**Tests**: 데이터 계층(shim 매핑·상태 전이)은 TDD HARD-GATE(Vitest+msw, 시스템 경계만 mock). 컴포넌트는 RTL 행위 테스트. **페이지 분할·한글 IME 4케이스·폰트 fallback 은 브라우저 dogfooding**(자동 테스트 한계, 프로젝트 HARD-GATE).

**Organization**: Story 단위(US1~US4). 경로는 `frontend/` 기준. 이식 원본은 `desktop/src/`.

**공통 규약(전 태스크)**:
- 인터랙티브/hook/ResizeObserver 컴포넌트 = `'use client'`, 작성 직후 `pnpm build`로 RSC 경계 검증(code-quality HARD-GATE)
- 데이터 호출은 `webElectronApi` shim(또는 React Query 훅) 경유 — 화면은 fetch 를 모름(설계 §3)
- ID 타입: 014 `Long` → web `number`(desktop UUID `string` 가정 코드 이식 시 조정)
- 라우트/page·layout 작성 전 `node_modules/next/dist/docs/` 관련 Next 16 가이드 정독(AGENTS.md, R9)
- 빌드/테스트 포어그라운드 실행

---

## Phase 1: Setup & 핵심 PoC (페이지 분할 + 한글 선증명 — 작업 규율 §10)

**Purpose**: 광범위 화면 이식 **이전** 최대 리스크(진짜 페이지 분할 + 한글 IME 가 Next 브라우저에서 동작)를 먼저 증명.

- [x] T001 [P] PoC 에디터 이식 — `desktop/src/components/Editor.tsx`·`pageLayout.ts` 를 `frontend/src/components/editor/Editor.tsx`·`pageLayout.ts` 로 이식(`'use client'`, `useEditor({immediatelyRender:false})` 유지, `view.composing` IME 가드 유지)
- [x] T002 [P] PoC 스타일 이식 — `desktop/src/styles/app.css` 의 `.prose`(column-width/height/`column-wrap:wrap`/gap)·`.paper`·`.sheet`·`.page-num` 규칙을 `frontend/src/styles/editor.css`(또는 globals) 로 이식
- [x] T003 PoC 라우트 — `frontend/src/app/(poc)/poc/write/page.tsx`(`'use client'`) 에 Editor 만 띄우는 임시 화면
- [x] T004 **PoC 브라우저 dogfooding GATE** — `pnpm dev` 후 브라우저에서: (a) 26줄 초과 한글 본문 → 페이지(원고지) 단위 분할 렌더, (b) 한글 IME 4케이스(빠른 타자/조합 중 bold 토글/한자 변환/Backspace 분해 — `docs/poc/0-1-tiptap-korean.md` SoT), (c) 라이트/다크 한글 폰트 fallback. **통과해야 US1 진입.** 실패 시 column-wrap 대안 별도 트랙 surfacing

**Checkpoint**: 핵심 동작 브라우저 증명 완료 → 본 이식 진입 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 Story 가 쓰는 데이터 계층·타입·라우팅 골격. **⚠️ US1~US4 착수 전 완료 필수.**

- [x] T005 [P] 뷰 모델 타입 이식 — `frontend/src/lib/types/domain.ts` 에 `Project`/`Document`/`Memo`/`ProjectMemo`/`ProjectLog`/`WorkSession`/`LogCard`/`ProjectCard`(desktop `db/types.ts` 기반, ID `number`)
- [x] T006 webElectronApi shim 골격 — `frontend/src/lib/electron-api/index.ts` + 도메인별 모듈(projects/documents/memos/logs/sessions/contact/shell/settings) 빈 구조 + `apiFetch`(client.ts) 결선 패턴. 인터페이스는 desktop `ipc/contract.ts` `ElectronAPI` 시그니처와 동일(설계 §3, contracts/web-electron-api.md)
- [x] T007 [P] React Query 훅 골격 — `frontend/src/lib/query/` 에 shim 메서드를 감싸는 useQuery/useMutation 패턴(키 컨벤션, 무효화 헬퍼). 기존 `QueryProvider` 재사용
- [ ] T008 라우팅 골격 + 가드 — `frontend/src/app/` 에 `/projects/[id]/write`·`/logs`·`/contact` 라우트 뼈대 + 보호 라우트에 005 `useAuthGuard("requireAuth")` 결선(data-model §3 라우트 맵). `pnpm build`로 RSC 경계 검증

**Checkpoint**: shim·훅·라우팅·타입 기반 완료 — Story 착수 가능.

---

## Phase 3: User Story 1 — 작품 벽 → 집필실 (페이지 분할 + 한글 집필) (Priority: P1) 🎯 MVP

**Goal**: projects 도메인을 backend(014)→shim→화면→연동까지 풀스택 관통. 작품 벽·집필실·자동저장·라우팅.

**Independent Test**: 로그인→작품 생성(작품 벽)→집필실(`/projects/[id]/write`)→한글 본문+페이지 분할→자동저장→새로고침 보존→뒤로가기.

### Tests for US1 (TDD — 데이터 계층 RED 먼저)

- [x] T009 [P] [US1] shim 매핑 테스트(msw) `frontend/src/lib/electron-api/projects.test.ts` — projects.list/get/create/update(nextScene)/delete 가 014 endpoint 호출·응답 매핑(Result unwrap) 검증
- [x] T010 [P] [US1] shim 매핑 테스트(msw) `frontend/src/lib/electron-api/documents.test.ts` — getByProject/update + 409 ConflictError 흐름(client.ts 재사용) 검증

### Implementation for US1

- [x] T011 [US1] shim projects 도메인 — `frontend/src/lib/electron-api/projects.ts`(list/listCards/get/create/update/delete → contracts 매핑, listCards 클라 집계) → T009 GREEN
- [x] T012 [US1] shim documents 도메인 — `frontend/src/lib/electron-api/documents.ts`(getByProject/update, 409 처리) → T010 GREEN
- [x] T013 [P] [US1] React Query 훅 — `frontend/src/lib/query/useProjects.ts`·`useDocument.ts`(목록/상세 useQuery, 생성/수정/삭제·자동저장 useMutation + 무효화)
- [x] T014 [US1] 작품 벽 화면 이식 — `desktop/src/screens/ProjectsScreen.tsx` → `frontend/src/app/page.tsx`(`'use client'`, 작품 카드 목록 + 새 작품 inline, nextScene 등 표시, 006 home 교체)
- [x] T015 [US1] 집필실 화면 이식 — `desktop/src/screens/WriteStudioScreen.tsx` → `frontend/src/app/projects/[id]/write/page.tsx`(`'use client'`, Editor(Phase1) + 자동저장 + ViewMenu/Rail). 작품별 딥링크, 006 `/write` 교체
- [ ] T016 [P] [US1] 보조 컴포넌트 이식 — `desktop/src/components/Rail.tsx`·`ViewMenu.tsx` → `frontend/src/components/`(좌측 네비·보기 설정, 설정은 zustand preferences R7)
- [x] T017 [US1] 자동저장 충돌 처리 — 문서 저장 409 시 ConflictError 안내 UI(006 패턴 참고, client.ts 재사용)
- [ ] T018 [US1] `pnpm build`(RSC 경계) + 컴포넌트 RTL 테스트(작품 벽 목록/생성 행위)
- [ ] T019 [US1] **US1 연동 dogfooding** — 로그인→작품 생성→집필실→한글 본문 페이지 분할→자동저장→새로고침 보존→뒤로/앞으로(SC-001/002/003/005)

**Checkpoint**: projects 풀스택 관통 완료. 패턴 확립 — 이후 도메인 복제.

---

## Phase 4: User Story 2 — 곁쪽지 (Priority: P2)

**Goal**: 집필실 서랍 + 곁쪽지 책상 + 고정(작품당 1개) + 연결/필터.

**Independent Test**: 곁쪽지 캡처→서랍 표시→고정 전환(작품당 1개)→책상 연결/필터.

### Tests for US2

- [x] T020 [P] [US2] shim 매핑 테스트(msw) `frontend/src/lib/electron-api/memos.test.ts` — listByProject(pinned)/setPin(014 pin)/create/curation(addLink·removeLink) 매핑 검증

### Implementation for US2

- [x] T021 [US2] shim memos 도메인 — `frontend/src/lib/electron-api/memos.ts`(create/list/listByProject/setPin/addLink/removeLink/pickReentry/delete/restore → contracts 매핑) → T020 GREEN
- [x] T022 [P] [US2] React Query 훅 — `frontend/src/lib/query/useMemos.ts`(작품별 메모/미분류 useQuery, 고정·연결 useMutation + 무효화)
- [x] T023 [US2] 곁쪽지 책상 이식 — `desktop/src/screens/MemoInboxScreen.tsx` → `frontend/src/app/memos/page.tsx`(`'use client'`, 필터/큐레이션/연결, 006 `/memos` 교체)
- [x] T024 [P] [US2] 집필실 서랍 이식 — `desktop/src/components/MemoPanel.tsx`·`QuickCapture.tsx` → `frontend/src/components/`(서랍 곁쪽지 목록 + 고정 + 빠른 캡처)
- [x] T025 [US2] `pnpm build` + 컴포넌트 RTL(고정 토글/연결 행위)
- [x] T026 [US2] **US2 dogfooding** — 캡처→서랍→고정(작품당 1개 전환)→책상 연결/필터(SC-004)

**Checkpoint**: US1+US2 동작.

---

## Phase 5: User Story 3 — 집필 기록 + 작업 세션 (Priority: P3)

**Goal**: 작업 세션 추적(진입 start / 라우트 이탈·탭 닫기 end) + 종료+기록 + 기록 화면 카드.

**Independent Test**: 집필실 진입 세션 시작→"작업 종료+기록"→기록 화면 카드(최근 기록·누적 시간). 탭 닫기 sendBeacon 종료.

### Tests for US3

- [x] T027 [P] [US3] shim 매핑 테스트(msw) `frontend/src/lib/electron-api/sessions.test.ts`·`logs.test.ts` — sessions.start/end/endWithLog(014), logs.listByProject + LogCard 클라 집계(latest+total+wordCount) 검증

### Implementation for US3

- [x] T028 [US3] shim sessions/logs 도메인 — `frontend/src/lib/electron-api/sessions.ts`·`logs.ts`(start/end/endWithLog, listByProject, LogCard 집계 → contracts) → T027 GREEN
- [x] T029 [US3] 세션 라이프사이클 결선 — 집필실(`/projects/[id]/write`) 진입 시 `sessions.start`, **라우트 이탈 시 + 탭 닫기(`pagehide`→`navigator.sendBeacon`) 시 `sessions.end`**(R6, FR-019). `frontend/src/components/editor/` 또는 전용 훅
- [x] T030 [P] [US3] 기록 화면 이식 — `desktop/src/screens/LogScreen.tsx` → `frontend/src/app/logs/page.tsx`(`'use client'`, 작품별 LogCard: 최근 기록 + 누적 작업 시간 + 마지막 문장 클라 파생)
- [x] T031 [US3] "작업 종료+기록" UI — 집필실에서 endWithLog 호출(기록 한 줄 + 세션 종료)
- [x] T032 [US3] `pnpm build` + RTL(기록 카드 렌더/endWithLog 행위)
- [x] T033 [US3] **US3 dogfooding** — 세션 시작→종료+기록→기록 화면 카드→탭 닫기 종료 확인(SC-004)

**Checkpoint**: US1~US3 동작.

---

## Phase 6: User Story 4 — 문의 + electron 전용 교체 (Priority: P4)

**Goal**: 문의 화면 + `shell.openExternal`→`window.open` + 문의 메타 web 생성 + settings localStorage.

**Independent Test**: 문의 폼 전송(web 메타)→카카오 링크 새 탭.

### Tests for US4

- [x] T034 [P] [US4] shim 매핑 테스트(msw) `frontend/src/lib/electron-api/contact.test.ts` — contact.send 가 문의 endpoint 호출 + web 메타 첨부 검증

### Implementation for US4

- [x] T035 [US4] shim contact/shell/settings — `frontend/src/lib/electron-api/contact.ts`(send + navigator·빌드버전 메타), `shell.ts`(`window.open(url,'_blank','noopener')`), `settings.ts`(localStorage/zustand preferences) → T034 GREEN
- [x] T036 [US4] 문의 화면 이식 — `desktop/src/screens/ContactScreen.tsx` → `frontend/src/app/contact/page.tsx`(`'use client'`, 이메일 폼 + 카카오 링크 `window.open`)
- [x] T037 [US4] `pnpm build` + RTL(문의 폼 제출/외부 링크 행위)
- [x] T038 [US4] **US4 dogfooding** — 문의 전송 + 카카오 링크 새 탭

**Checkpoint**: US1~US4 전부 동작.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T039 [P] 006 폐기 화면 제거 — 대체 완료된 기존 화면(`/write` 구버전 등) 및 사용 안 하는 006 컴포넌트 정리(내 이식이 만든 orphan만, surgical)
- [ ] T040 계약 검증 — `contracts/web-electron-api.md` ✅/♻️ 행이 실제 결선과 일치(SC-004/005, 공백 0). 결선 중 014 endpoint 신설 필요 발견 시 별도 트랙 surfacing(백엔드 = 범위 밖)
- [ ] T041 폰트/한글 dogfooding(전 화면) — 라이트/다크 + iOS Safari·Android Chrome 한글 본문 fallback(SC-002, FR-022)
- [ ] T042 전체 게이트(최종) — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] T043 quickstart.md DoD 검증 — 미로그인 리다이렉트(SC-006) 포함 골든패스 dogfooding
- [ ] T044 vault `~/obsidian/write-note/02-PROGRESS.md` 갱신(하위 작업 2 완료) + 이슈 `03-ISSUES.md`

---

## Dependencies & Execution Order

### Phase 의존
- **Phase 1(PoC, T001~T004)**: 즉시. **T004 dogfooding GATE 통과 전 US 착수 금지**(§10)
- **Phase 2(Foundational, T005~T008)**: PoC 후. 모든 Story 의 shim·타입·라우팅 전제
- **US1(P1)**: Foundational 후. MVP. 패턴 확립
- **US2·US3·US4**: US1 패턴 위에 복제. US3 는 US1 집필실(세션 결선 위치) 의존
- **Polish(Phase 7)**: 전 Story 후

### 권장 순서 (research §R11)
PoC → US1(projects 풀스택) → US2(memos) → US3(logs/sessions) → US4(contact) → Polish. 각 Story 끝에 `pnpm build` + dogfooding, 최종 T042 전체 게이트.

### Story 내 (TDD + RSC)
shim 매핑 테스트(msw, RED) → shim 구현(GREEN) → React Query 훅 → 화면 이식(`'use client'`) → `pnpm build`(RSC) → 컴포넌트 RTL → 연동 dogfooding.

### Parallel 기회
- T001·T002(에디터·스타일), T005·T007(타입·훅 골격), 각 Story 의 shim 테스트·보조 컴포넌트([P])는 다른 파일이라 병렬
- 같은 파일(예: shim index, 집필실 page) 수정은 직렬

---

## Parallel Example: US1
```text
# shim 매핑 테스트 동시 작성(다른 파일):
T009 projects.test.ts
T010 documents.test.ts
# 보조 컴포넌트·훅 병렬:
T013 useProjects/useDocument 훅
T016 Rail·ViewMenu 이식
```

---

## Implementation Strategy

### MVP First
PoC(T001~T004) → Foundational(T005~T008) → US1(T009~T019) → **STOP & VALIDATE**: 브라우저에서 핵심 집필 흐름 dogfooding → 데모 가능.

### Incremental
PoC → Foundational → US1(MVP) → US2 → US3 → US4 → Polish. 각 Story 독립 dogfooding 후 다음.

---

## Notes
- [P] = 다른 파일·무의존. [Story] = 추적용
- **PoC GATE(T004)**: 핵심 미증명 시 US 착수·다수 커밋 금지(§10)
- 페이지분할·IME·폰트 = dogfooding(자동 테스트 한계), 데이터 계층 = TDD(msw)
- RSC 경계는 `pnpm build`로만 검출 — 화면 작성 직후 의무(code-quality HARD-GATE)
- subagent 위임 시: 작성 직후 `pnpm build` 명시 / verbose·tool_uses cap(agent-workflow-discipline §4)
- backend(014) 변경 금지 — 계약 소비만. 필요 발견은 surfacing
- 각 태스크/논리 그룹 후 커밋
