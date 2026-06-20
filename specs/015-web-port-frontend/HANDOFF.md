# 핸드오프 — 015 Web 포팅 Front 이식 (세션 인계)

**작성:** 2026-06-08 | **갱신:** 2026-06-09 | **브랜치:** `015-web-port-frontend` (014 기반) | **최신 커밋:** `17501af`

다음 세션이 이 문서만 읽고 이어서 작업할 수 있도록 현재 상태·실행법·다음 할 일·함정을 정리한다.

> **2026-06-09 진행:** US2(곁쪽지)·US3(기록+세션)·US4(문의)·Polish **구현 완료·커밋**(`b5f78b4`→`a8903cd`→`121555a`→`17501af`). tasks **38/44**. 게이트 GREEN(lint clean·typecheck·test 65·build), 014 E2E 스모크 통과(US2·US3), US별 서브에이전트 검토 2회. **잔여=브라우저 시각 dogfooding + 아래 보류 결정.** 상세는 §3·§8.

---

## 1. 큰 그림 (어디까지 왔나)

마스터 설계 `docs/superpowers/specs/2026-06-08-desktop-to-web-port-design.ko.md` — desktop(Electron) 검증 제품을 web 서비스로 포팅. 4개 하위 작업:

| 하위 작업 | 상태 |
|---|---|
| **1. backend 확장 (014)** | ✅ **완료·커밋**(`d6ffd95`) — next_scene·pinned·project_logs·work_sessions + endpoint. ⚠️ V7 마이그레이션 운영(Supabase) 적용은 **미실행**(로컬 테스트 DB엔 테스트로 적용됨) |
| **2. front 이식 (015)** | 🟡 **진행 중** — PoC + Foundational + **US1(작품 벽·집필실) 완료**. US2~US4 미착수 |
| 3. 추가 기능 (등장인물 UI·모바일 캡처·.db 가져오기) | ⬜ 베타 이후 |
| 4. 런칭 (Vercel + Render) | ⬜ |

**015 tasks 진행률: 15/44** (`specs/015-web-port-frontend/tasks.md`). PoC(T001~4)·Foundational(T005~7)·US1 데이터·화면(T009~17).

---

## 2. ✅ 실제로 동작하는 것 (US1, 014 실연동)

- **작품 벽**(`/` = `app/page.tsx`): 목록·새 작품·열기·삭제·"다음 장면" 인라인 저장
- **집필실**(`/projects/[id]/write`): 문서 로드 → **진짜 페이지 분할 + 한글 IME + 자동저장(800ms)** + 409 충돌 다이얼로그
- **디자인 = desktop 1:1**: `desktop-app.css`(전역) + Rail + Titlebar + work-wall/ProjectWallCard + PaperEditor 종이
- 인증(005 재사용), 데이터 계층(projects·documents shim + React Query 훅)

검증: `pnpm typecheck/lint/test(60)/build` GREEN. 서브에이전트 검토 2회 통과(create 에러·conflict reload race 수정).

## 3. ❌ 아직 안 된 것 (다음 세션 작업)

**US2~US4 + Polish 구현은 완료**(위 2026-06-09 진행). 남은 것은 **브라우저 시각 dogfooding**과 **보류 결정**:

**브라우저 dogfooding (자동 불가 — 사용자 영역):**
- T041 폰트/한글 전 화면(라이트/다크 + iOS Safari·Android Chrome 한글 본문 fallback)
- T043 골든패스(미로그인→로그인 redirect SC-006 가드는 배선 확인됨 / 캡처→서랍→고정→연결→필터 / 세션→종료+기록→기록화면 / 문의 전송·카카오)
- T016/T018/T019 (US1 잔여 — Rail/ViewMenu·RTL·연동 dogfooding)

**보류 결정 (surface 됨, 사용자/후속):**
- **곁쪽지 삭제+되돌리기** → 백엔드 soft-delete+restore 별도 트랙([[03-ISSUES]] **ISSUE-026**). 현재 책상에 삭제 버튼 없음(보류).
- **문의 CORS 미검증** → 브라우저→formsubmit.co cross-origin, 배포 전 실브라우저 확인([[03-ISSUES]] **ISSUE-027**). 실패해도 graceful `ok:false`.
- **전역 캡처 중복** → 006 `QuickCaptureModal`(providers, ⌘+N)이 내 Rail "잉크 한 방울"(QuickCapture)과 캡처 경로 2개 공존. 통합/⌘+N 마이그레이션 결정 필요(내 orphan 아니라 자동삭제 안 함).
- **legacy 006 라우트** `/projects/new`·`/projects/[id]`·`/projects/[id]/edit`(006 프로젝트 CRUD, Rail 미링크) + `/write`·`/write/preview` 정리 — 내 orphan 아닌 006 leftover.
- 카드 **"마지막 문장"**: 작품 벽 카드는 placeholder 유지(`projects.listCards` lastSentenceSource:""). **기록 화면 LogCard 는 `extractPlainText`로 파생 연동됨**(R6 부분 해소).
- 보기메뉴 풀버전(ViewMenu 테마·자동저장 토글, T016) 미이식 — 집필실 Titlebar 는 minimal(줄노트·줌·작업종료·서랍).

---

## 4. 실행법 (로컬 dogfooding)

```bash
# 1. DB
docker compose up -d --wait postgres
# 2. backend (014 API) — 별도 터미널
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'   # :8080
# 3. frontend — 별도 터미널
cd frontend && pnpm install && pnpm dev                                    # :3000
```
- **dogfood 계정**(로컬 테스트 DB, 이메일 인증 완료): `dogfood@writenote.local` / `Dogfood1234!`
- 로그인: http://localhost:3000/auth/login → 작품 벽(`/`)
- ⚠️ backend `/actuator/health` 503은 **메일 health indicator**(로컬 SMTP 없음) 때문 — **API는 정상**(무시)
- 신규 계정 필요 시: `POST /api/auth/signup/email` → backend 로그의 `[MAIL] verify link` 토큰 → `POST /api/auth/verify-email` (mail mode=log)

## 5. 검증 cadence (HARD-GATE)

- **데이터 계층(shim·매핑)** = TDD: Vitest + msw(`@/test/msw/server`), HTTP 경계만 mock
- **페이지 분할·한글 IME·폰트** = 브라우저 **dogfooding**(자동 테스트 한계)
- **RSC server/client 경계** = `pnpm build`로만 검출 → 화면 작성 직후 의무 (`.claude/rules/typescript/code-quality.md`)
- 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

---

## 6. 핵심 패턴 (US2~US4 복제용)

**데이터 계층 추가 (도메인별):**
1. `lib/electron-api/<domain>.ts` — desktop `electronAPI.<domain>` 시그니처를 `apiFetch`(`lib/api/client.ts`)로 014 endpoint 에 매핑. 계약: `specs/015-web-port-frontend/contracts/web-electron-api.md`
2. `lib/electron-api/<domain>.test.ts` — msw 매핑 테스트 (RED→GREEN)
3. `lib/electron-api/index.ts` 에 도메인 추가
4. `lib/query/use<Domain>.ts` — useQuery/useMutation + 키·무효화 (`useProjects.ts` 참고)

**화면 이식:** `desktop/src/screens/*` 마크업을 `app/.../page.tsx`(`'use client'`)로, `window.electronAPI.x()` → shim/훅 치환, desktop CSS 클래스 그대로(이미 `desktop-app.css` 전역). 셸은 `<Rail/>` + `.main > <Titlebar/> + .screen-body`.

**재사용 자산:** `hooks/useAutoSave.ts`(006, 자동저장+409) · `components/editor/ConflictDialog.tsx` · `components/editor/PaperEditor.tsx` · `components/workspace/{Rail,Titlebar,ProjectWallCard}.tsx` · `lib/{projectView,lastSentence}.ts`

**desktop 원본 위치:** 화면 `desktop/src/screens/`, 컴포넌트 `desktop/src/components/`(MemoPanel·QuickCapture·LogCard·ReentryCard·ViewMenu·Dock), IPC 계약 `desktop/electron/ipc/contract.ts`, 뷰 타입 `desktop/electron/db/types.ts`, 스타일 SoT `desktop/src/styles/app.css`

---

## 7. 함정 / 주의 (실측 기반)

- **Next 16**: params 는 `useParams<{id:string}>()`(client). 라우트 작성 전 `frontend/node_modules/next/dist/docs/` 정독(AGENTS.md, 현재 **존재 확인됨**)
- **desktop-app.css 전역**: 클래스 비스코프(`.main/.studio/.editor-scroll/.paper/.prose/.work-wall` 등). 다크 = `.dark`(frontend 테마 정합으로 치환함). PoC(`/poc/write`)만 scoped `paper-editor.css` 사용(throwaway — 정식화 시 제거)
- **ID 타입**: 014 `Long`→web `number` (desktop UUID `string` 아님)
- **006 잔재**: `/memos`·`/projects/[id]`·`/write`(legacy)·`/projects/new` 는 아직 006. US2~ 진행 시 해당 라우트 교체·정리(`app/page.tsx`는 이미 작품 벽으로 교체됨)
- **lastSentence**: `projects.listCards()` 가 `lastSentenceSource:""` placeholder → 카드 마지막문장 미표시. R6 = 작품별 document 본문 파싱(N+1) 후속 결정
- **작업 세션 종료 트리거**(spec Q1 확정): 라우트 이탈 + 탭 닫기(`pagehide`→`navigator.sendBeacon`), 백그라운드 가시성 제외. dangling 은 014 서버 스케줄러가 backstop
- **listProjects size:100** 하드코딩(베타 한계, 주석 있음)
- **Bash cwd 드리프트**: 명령마다 `cd frontend`/`cd backend` 명시
- **backend 변경 금지**(015 범위) — 계약 부족 발견 시 별도 트랙 surfacing
- **migration V7 운영 적용**: 미실행. Supabase/Render 적용은 사용자 컨펌(external-infra-safety §1)

---

## 8. 다음 세션 시작점

**US1~US4 + Polish 구현 완료.** 다음 후보(사용자 결정 영역):

1. **브라우저 dogfooding** (가장 우선) — `pnpm dev`(:3000) + dogfood 계정 로그인 후 §3 "브라우저 dogfooding" 항목 전수 확인(한글 폰트·페이지분할·캡처/고정/연결/필터·세션/기록·문의·미로그인 redirect). 발견 시 fix.
2. **보류 결정 처리** (§3) — 전역 캡처 중복(QuickCaptureModal↔Rail) 통합 / legacy 006 라우트 정리 / 곁쪽지 삭제 백엔드 트랙(ISSUE-026) / 문의 CORS 검증(ISSUE-027).
3. **하위작업 3** — 등장인물 UI·모바일 캡처·로컬 `.db` 가져오기(베타 이후).
4. **하위작업 4** — Vercel(front) + Render(backend) 런칭 + V7 마이그레이션 운영 적용(Supabase, 사용자 컨펌).

**커밋 체인:** `e9bdbb4`(US1)→`b5f78b4`(US2)→`a8903cd`(US3)→`121555a`(US4)→`17501af`(Polish). 미push(원격 동기는 사용자 결정 — push 시 sync-vault hook 발화).
