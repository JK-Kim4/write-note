# 핸드오프 — 015 Web 포팅 Front 이식 (세션 인계)

**작성:** 2026-06-08 | **브랜치:** `015-web-port-frontend` (014 기반) | **최신 커밋:** `e9bdbb4`

다음 세션이 이 문서만 읽고 이어서 작업할 수 있도록 현재 상태·실행법·다음 할 일·함정을 정리한다.

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

**US2 곁쪽지 (다음 우선):** 집필실 우측 **곁쪽지 서랍**(MemoPanel) + **메모 책상**(`/memos`, 006 폐기·교체) + 빠른 캡처(QuickCapture) + 고정(014 pin)
**US3 기록+작업세션:** **작업 세션 추적**(집필실 진입 start / 라우트 이탈·탭 닫기 end, R6) + **작업 종료+기록** 버튼 + **기록 화면**(`/logs`, 미존재) + 재진입 한 장(ReentryCard)
**US4 문의:** `/contact`(미존재) — ContactScreen 이식 + `shell.openExternal`→`window.open`
**기타:** 카드 **"마지막 문장"** placeholder(R6 — 작품별 document 본문 파생 미연동) · 보기메뉴 풀버전(테마·자동저장 토글) · auth 화면 desktop화(범위 밖) · Rail "메모/기록/문의" → 현재 006/404

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

**US2(곁쪽지)부터** — `tasks.md` T020~T026. 메모 shim(listByProject/setPin/addLink/removeLink) + 메모 책상(`/memos` 교체, `desktop/src/screens/MemoInboxScreen.tsx`) + 집필실 곁쪽지 서랍(`desktop/src/components/MemoPanel.tsx`·`QuickCapture.tsx`). 014 곁쪽지 endpoint: `GET /api/projects/{id}/memos`(pinned), `PUT /api/projects/{id}/memos/{memoId}/pin`.
