---
description: "Task list — 011 관리자 문의·의견 보내기 (Desktop)"
---

# Tasks: 관리자 문의·의견 보내기 (Desktop)

**Input**: `specs/011-desktop-contact-feedback/` (plan.md, spec.md, research.md, data-model.md, contracts/ipc-and-formsubmit.md)

> 전송 서비스 = **Formsubmit**(research R1 실측 확정). main 호출 + `Referer` 헤더. 성공 판정 `success === "true"`(문자열). Web3Forms 는 main 차단으로 폐기.

**Tests**: 포함(TDD). 프로젝트 `CLAUDE.md` §5 Red-Green-Refactor + 설계 문서 §테스트 가 명시 요구. 단 §5-5 예외(타입 선언·인터페이스·상수·thin glue)는 완화한다.

**Organization**: 사용자 스토리(P1~P3)별 phase. MVP = Phase 1+2 (Foundational) + Phase 3 (US1).

## Path Conventions

Electron desktop-app — `desktop/electron/`(main, node) + `desktop/src/`(renderer, jsdom). 검증: `cd desktop && pnpm test`(Vitest: renderer + main 2 projects) · `pnpm typecheck`(`tsc --noEmit`). **신규 디렉토리/런타임 의존성 없음.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 변경 전 회귀 기준선 확보(SC-007).

- [ ] T001 변경 전 baseline 확인 — `cd desktop && pnpm test && pnpm typecheck` 가 모두 GREEN 임을 기록(회귀 비교 기준).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 IPC 타입 surface + 화면 enum. 순수 타입/인터페이스 추가이므로 TDD 완화(§5-5). US1~US3 진입 전 완료 필수.

- [ ] T002 [P] `desktop/src/types.ts` — `Screen` union 에 `"contact"` 추가 (`"projects" | "write" | "memo" | "log" | "contact"`).
- [ ] T003 [P] `desktop/electron/ipc/contract.ts` — `ContactInput = { email: string; body: string }` · `ContactResult = { ok: boolean }` 타입 추가; `ElectronAPI` 에 `contact: { send: (input: ContactInput) => Promise<ContactResult> }` · `shell: { openExternal: (url: string) => Promise<void> }` 추가; `CHANNELS` 에 `contactSend: "contact:send"` · `shellOpenExternal: "shell:openExternal"` 추가. (contracts §1)
- [ ] T004 `desktop/electron/preload.ts` — `electronAPI.contact.send` · `electronAPI.shell.openExternal` 를 화이트리스트(`ipcRenderer.invoke`)로 노출. (T003 의 타입/CHANNELS 의존, contracts §2)

**Checkpoint**: `pnpm typecheck` GREEN — IPC 타입 정합. (핸들러/화면 미구현 상태라 `pnpm test` 는 아직 ContactScreen 부재로 무관)

---

## Phase 3: User Story 1 — 인앱으로 의견 보내기 (Priority: P1) 🎯 MVP

**Goal**: Rail 최하단 진입점 → 전용 화면 → 메일 폼 본문 입력 → 보내기 → Formsubmit 전송 → 감사 안내 + 폼 초기화. 회신 이메일은 선택(비면 익명), 본문 비면 비활성, 메타(앱 버전·OS·시각) 자동 첨부.

**Independent Test**: 진입점 클릭 → 본문 입력 → 보내기 → 감사 안내까지 단독 검증(`ContactScreen.test.tsx` + `contactSender.test.ts`). 이것만으로 "의견이 전달된다" 가치 완결 = MVP.

### 전송 모듈 (main, node) — TDD

- [ ] T005 [US1] `desktop/electron/contactSender.test.ts` 작성(RED) — `buildContactPayload(input, meta)` 매핑 검증: (a) `email` 빈 문자열/공백 → payload 에 `email` 키 **생략**(익명), (b) `email` 값 있음 → 포함, (c) `message` 에 본문 + 메타 푸터(앱 버전·OS·전송 시각) 포함, (d) `_subject`·`_captcha:"false"` 상수 채워짐. (data-model §매핑 규칙)
- [ ] T006 [US1] `desktop/electron/contactSender.ts` 작성(GREEN) — `ContactMeta` 타입, `FORMSUBMIT_ENDPOINT`/`CONTACT_SUBJECT`/`CONTACT_REFERER` 상수(플레이스홀더), `buildContactPayload` 순수 함수 구현. T005 통과. (contracts §4, research R3/R4/R5)
- [ ] T007 [US1] `desktop/electron/contactSender.test.ts` 에 `sendContact` 성공 케이스 추가(RED) — global `fetch` mock: HTTP 200 + body `{"success":"true"}` → `{ ok: true }`; 요청에 `Referer`/`Accept` 헤더 포함 확인. (`fetch` = 시스템 경계 mock, §5-2)
- [ ] T008 [US1] `desktop/electron/contactSender.ts` 에 `sendContact(input, meta)` 구현(GREEN) — `buildContactPayload` → `fetch(FORMSUBMIT_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json","Referer":CONTACT_REFERER}, body: JSON.stringify(payload) })` → R2 판정(**HTTP 200 AND `success === "true"` 문자열**) → `{ ok }`. T007 통과. (contracts §5, research R2)

### IPC 핸들러 결선 (main) — glue(§5-5 완화)

- [ ] T009 [US1] `desktop/electron/ipc/registerHandlers.ts` — `contact:send` 핸들러 등록: `app.getVersion()` · `process.platform` · `new Date().toISOString()` 로 메타 수집해 `sendContact(input, meta)` 호출. `electron` import 에 `app` 추가. (contracts §3, research R5)

### 화면 + 진입점 (renderer) — TDD

- [ ] T010 [P] [US1] `desktop/src/components/Rail.test.tsx` — 최하단 문의 진입점 클릭 시 `onNavigate("contact")` 호출 검증 추가(RED). (행위 기준 RTL)
- [ ] T011 [US1] `desktop/src/components/Rail.tsx` — `ITEMS` 에 `{ key: "contact", label: "문의", icon: <봉투/말풍선> }` 5번째로 추가(GREEN, 최하단 배치). T010 통과. (research R7)
- [ ] T012 [US1] `desktop/src/screens/ContactScreen.test.tsx` 작성(RED) — (a) 빈 본문 시 [보내기] 비활성, (b) 본문 입력 후 보내기 → `electronAPI.contact.send({ email, body })` 호출(성공 mock) → "보내주셔서 감사합니다" 인라인 안내 노출 + 폼 초기화. `vi.stubGlobal("electronAPI", { contact:{send}, shell:{openExternal}, … })`. (contracts §6, research R6)
- [ ] T013 [US1] `desktop/src/screens/ContactScreen.tsx` 작성(GREEN) — 상단 안내 한 줄 + 메일 폼(회신 이메일 input[placeholder "답장받을 이메일 (선택)"] + 본문 textarea + [보내기]) + 간단한 이메일 형식 검증(입력 시) + 성공 시 인라인 `role="status"` 안내 + 폼 초기화. 빈 본문 → 보내기 비활성. T012 통과. (data-model 상태 전이, FR-003~010)
- [ ] T014 [US1] `desktop/src/App.tsx` — `initialParam("screen", […])` allowed 배열에 `"contact"` 추가 + `screen === "contact"` 시 `<ContactScreen />` 렌더 분기 추가(import 포함). (FR-002)

**Checkpoint**: `pnpm test`(contactSender + ContactScreen + Rail GREEN, 기존 회귀 0) + `pnpm typecheck` GREEN. → **MVP 동작**: 진입점→폼→전송→감사. (실제 전송은 Formsubmit 엔드포인트 플레이스홀더라 dogfooding 시 실 해시 필요)

---

## Phase 4: User Story 2 — 카카오 오픈채팅으로 문의 (Priority: P2)

**Goal**: 문의 화면의 "카카오톡 오픈채팅으로 문의" 버튼 → 기본 브라우저로 오픈채팅 URL 열기. 폼과 독립.

**Independent Test**: 문의 화면에서 카카오 버튼 클릭 → `shell.openExternal(kakaoUrl)` 호출(폼 상태 불변) 단독 검증.

**Dependency**: US1 의 ContactScreen + IPC 노출(Phase 2) 위에 얹는다(US2 → US1).

- [ ] T015 [US2] `desktop/electron/ipc/registerHandlers.ts` — `shell:openExternal` 핸들러 등록: `http(s)` scheme 만 허용(`/^https?:\/\//i`) 후 `shell.openExternal(url)`. `electron` import 에 `shell` 추가. (contracts §3, research R8)
- [ ] T016 [US2] `desktop/src/screens/ContactScreen.test.tsx` 에 케이스 추가(RED) — 구분선 아래 "카카오톡 오픈채팅으로 문의" 버튼 클릭 → `electronAPI.shell.openExternal` 가 카카오 URL 로 호출됨, 그리고 폼 입력값 불변. (FR-013/014)
- [ ] T017 [US2] `desktop/src/screens/ContactScreen.tsx` — 구분선 + 카카오 버튼 추가, `KAKAO_OPENCHAT_URL` 상수(플레이스홀더, renderer) 정의 후 클릭 시 `electronAPI.shell.openExternal(KAKAO_OPENCHAT_URL)`. T016 통과. (research R8)

**Checkpoint**: `pnpm test` GREEN. 카카오 채널 동작(실 URL 은 dogfooding 시 필요).

---

## Phase 5: User Story 3 — 전송 실패 시 의견 보존·재시도 (Priority: P3)

**Goal**: 전송 실패(오프라인/서비스 장애) → "전송 실패, 잠시 후 다시 시도" 안내 + 작성 내용 보존 + 재시도. 전송 중 버튼 로딩·비활성(중복 전송 방지).

**Independent Test**: 전송 실패 mock → 실패 안내 + 본문/이메일 보존 확인; 전송 진행 중 버튼 비활성 확인.

**Dependency**: US1 의 contactSender + ContactScreen 위에 얹는다(US3 → US1).

- [ ] T018 [US3] `desktop/electron/contactSender.test.ts` 에 실패 케이스 추가(RED→GREEN) — `fetch` mock: 비-200 응답 → `{ ok: false }`, `fetch` reject(오프라인) → `{ ok: false }`(예외를 잡아 false 반환). 필요 시 T008 구현 보강. (research R2, FR-012)
- [ ] T019 [US3] `desktop/src/screens/ContactScreen.test.tsx` 에 케이스 추가(RED) — (a) `contact.send` 가 `{ok:false}`/reject → 실패 안내(`role="status"`) 노출 + 본문·회신 이메일 **보존**(초기화 안 됨), (b) 전송 진행 중 [보내기] 비활성(중복 호출 차단). (FR-011/012, data-model 상태 전이)
- [ ] T020 [US3] `desktop/src/screens/ContactScreen.tsx` — `sending` 상태(버튼 로딩·비활성) + 실패 시 error 인라인 안내 + 폼 내용 보존(성공일 때만 reset) 구현. T019 통과.

**Checkpoint**: `pnpm test` GREEN. 실패 복원력 동작.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T021 전체 회귀 게이트 — `cd desktop && pnpm test && pnpm typecheck` GREEN 확인(T001 기준선 대비 회귀 0, SC-007).
- [ ] T022 R6 확정 — `pnpm dev` 실 엔드포인트로 회신 이메일 넣어 1회 전송 → 수신 메일에서 **답장 시 그 주소로 가는지**(회신 매핑) 확인. `email` 필드로 부족하면 `_replyto` 보강. (research R6, 추측 금지 잔여 해소)
- [ ] T023 dogfooding — `quickstart.md` 수동 체크리스트 수행(라이트/다크, 익명/회신, 메타 첨부, 오프라인 실패 보존, 카카오 열림). 실 Formsubmit 해시 + 카카오 URL 채운 뒤. 결과를 vault `02-PROGRESS.md` 에 반영(`/sync-vault`).

---

## Dependencies & Execution Order

```
Phase 1 (T001) → Phase 2 Foundational (T002,T003 [P] → T004)
                       │
                       ▼
        Phase 3 US1 (MVP): T005→T006→T007→T008 (sender),
                           T009 (handler),
                           T010→T011 (rail), T012→T013 (screen), T014 (app)
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   Phase 4 US2 (T015→          Phase 5 US3 (T018; T019→T020)
   T016→T017)                  ※ US2·US3 는 US1 완료 후 독립 병렬 가능
                       │
                       ▼
        Phase 6 Polish (T021 → T022 → T023)
```

- **US1 → US2, US1 → US3**: US2/US3 는 US1 이 만든 `ContactScreen`·`contactSender` 를 확장한다(같은 파일 수정이므로 US2/US3 간에도 `ContactScreen.tsx` 직렬).
- Foundational(T002~T004) 은 모든 스토리의 blocking 선행.

## Parallel Opportunities

- **Phase 2**: T002(`types.ts`) ∥ T003(`contract.ts`) — 다른 파일. (T004 는 T003 의존)
- **Phase 3 내부**: 전송 모듈(T005~T008, `contactSender.ts`) 와 Rail(T010~T011, `Rail.tsx`) 은 다른 파일이라 병렬 가능. ContactScreen(T012~T013) 은 IPC 타입(Phase 2) 완료 후. T009(handler) 는 T006/T008(sender) 의존.
- **US2 ∥ US3**: US1 완료 후 두 스토리 병렬 진입 가능하나, 둘 다 `ContactScreen.tsx` 를 수정하므로 그 파일 편집은 직렬화 필요(T016/T017 ↔ T019/T020).

## Implementation Strategy

1. **MVP 우선**: Phase 1+2+3(US1) 까지가 최소 출시 단위 — 인앱 의견 전송이 동작한다(설계 §10 핵심 기능 우선 정합: 첫 dogfoodable 산출물이 곧 핵심 "의견 전송").
2. **증분 전달**: US2(카카오) → US3(실패 복원력) 순으로 얹는다. 각 phase checkpoint 에서 `pnpm test` GREEN 유지.
3. **TDD 규율**: 로직(contactSender)·행위(ContactScreen/Rail)는 테스트 우선(RED→GREEN). 타입/인터페이스/상수/thin glue(contract·preload·types·registerHandlers)는 §5-5 완화.
4. **준비물 게이트**: 실 Formsubmit 엔드포인트(해시)·카카오 URL 은 사용자 준비물(quickstart). 부재 시 빌드/테스트는 통과하나 실 전송·열기는 dogfooding(T022/T023) 에서 검증.
