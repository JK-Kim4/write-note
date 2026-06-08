# Phase 0 Research — Web 포팅 Front 이식 (015)

코드 실측 근거로 plan 단계 설계 미지수를 확정한다. 형식: **Decision / Rationale / Alternatives**.

조사 출처(실측): desktop `src/components/Editor.tsx`·`pageLayout.ts`·`styles/app.css`·`ipc/contract.ts`·`App.tsx`, frontend `package.json`·`src/lib/api/client.ts`·`next.config.ts`·`src/app/*`·`AGENTS.md`, 014 `contracts/ipc-rest-mapping.md`.

---

## R1. 데이터 계층 — web `electronAPI` shim + React Query 래핑

- **Decision**: desktop `ElectronAPI` 인터페이스(`ipc/contract.ts`)와 **동일 형태의 web 구현체**(`webElectronApi`)를 frontend 에 두고, 각 메서드를 `apiFetch`(client.ts)로 014 REST endpoint 에 매핑한다. 화면은 이 shim 을 호출(설계 §3 — 화면은 구현을 모름). 서버 상태 캐시·무효화가 필요한 곳은 **React Query 훅**(`useQuery`/`useMutation`)이 shim 메서드를 호출하도록 얇게 감싼다.
- **Rationale**: 설계 §3(인터페이스 경계 유지) + 005 자산(client.ts·React Query) 재사용을 동시 충족. desktop 화면을 최소 수정으로 이식(데이터 호출부만 `window.electronAPI` → `webElectronApi`/훅 치환). `apiFetch` 가 이미 Result envelope·401 refresh·409 conflict 처리.
- **Alternatives**: (a) 화면을 React Query 네이티브로 전면 재작성 — desktop 화면 이식 이점 상실, 비용↑(기각). (b) shim 만 쓰고 React Query 미사용 — 캐시·중복요청 제어 상실(부분 채택: 단순 단발 호출은 shim 직접, 목록·상세는 훅).

## R2. 라우팅 — resource-based URL (006 교체)

- **Decision**: desktop screen-state(`"projects"|"write"|"memo"|"log"|"contact"`)를 App Router URL 로 변환:
  - `/` → 작품 벽(ProjectsScreen)
  - `/projects/[id]/write` → 집필실(WriteStudioScreen, 작품별 딥링크)
  - `/memos` → 곁쪽지 책상(MemoInboxScreen)
  - `/logs` → 집필 기록(LogScreen)
  - `/contact` → 문의(ContactScreen)
  기존 006 라우트(`/`·`/write`·`/memos`)는 이식 화면으로 교체, `/logs`·`/contact`·`/projects/[id]/write` 신설.
- **Rationale**: 딥링크·뒤로가기(FR-004/005). 작품별 집필실은 `projectId` 를 path 에 둬 새로고침·공유 가능. 기존 006 `/write?` 단일 화면 대비 작품 단위 URL 이 web 관례 정합.
- **Alternatives**: desktop 평면 구조 그대로(`/write` + 쿼리 projectId) — 딥링크 약함(기각). 쿼리스트링 screen 파라미터 유지 — App Router 이점 미활용(기각).

## R3. 진짜 페이지 분할 이식 (최대 리스크 — PoC 선증명)

- **Decision**: desktop `Editor.tsx` + `pageLayout.ts`(순수 계산) + `app.css` 의 `.prose`(column-width/height/`column-wrap:wrap`)·`.paper`·`.sheet` 규칙을 frontend 로 이식. 컴포넌트는 **`'use client'`**(useEditor·ResizeObserver·BubbleMenu·mousedown). `useEditor({ immediatelyRender: false })`(desktop 이미 설정 — SSR 안전). **plan 첫 실행 = PoC**: Next 브라우저에 이 에디터만 얇게 띄워 column-wrap 페이지 분할 + 한글이 동작함을 dogfooding 확인(작업 규율 §10, 핵심 선증명).
- **Rationale**: `column-wrap` 은 표준 CSS이나 (a) SSR/hydration 시 본문 높이 미상 → 페이지 수는 클라 ResizeObserver 로만 계산(첫 페인트 client 경계), (b) 브라우저별 column 동작 차이가 미검증 리스크(설계 §10). 기하 계산(LINE_PX·PAGE_STRIDE_PX 줄 정수배)은 순수 함수라 그대로 이식 가능.
- **Alternatives**: 페이지 분할 재구현(canvas/측정 기반) — desktop 검증 자산 폐기(기각). SSR 에서 페이지 수 추정 — 높이 미상으로 불가(기각).

## R4. 한글 IME — `view.composing` 패턴 그대로

- **Decision**: desktop `Editor.tsx:54` 의 `if (e.view.composing) return`(조합 중 부모 갱신 억제) 패턴을 그대로 이식. 이식 후 PoC 0-1 4케이스(빠른 타자/조합 중 서식/한자 변환/Backspace 분해) **브라우저 dogfooding** 재검증(typescript/code-quality HARD-GATE).
- **Rationale**: TipTap 버전 정합(desktop·frontend 모두 `@tiptap/*@^3.23.5`)이라 동작 동일 기대. 그러나 IME 는 dogfooding 영역(자동 테스트 한계).
- **Alternatives**: 없음(검증된 패턴 유지).

## R5. 폰트 / 한글 fallback chain

- **Decision**: 기존 frontend `layout.tsx` 의 `next/font`(Noto Serif KR·Nanum Myeongjo, `subset: ['latin']`) + 시스템 fallback chain 재사용. 집필실 본문 글꼴(desktop "고운바탕 18px")은 fallback chain 으로 근사하고 라이트/다크·iOS/Android dogfooding 검증.
- **Rationale**: `next/font` 한국어 subset 미지원(code-quality 기록) — `subset: ['latin']` + 시스템 폰트 fallback 의존이 기존 결론. 폰트 추가/변경 시 dogfooding cadence 의무.
- **Alternatives**: 한글 웹폰트 직접 호스팅 — 용량·로딩 비용(베타 범위 밖, 후속).

## R6. 작업 세션 종료 트리거 (spec Q1 확정)

- **Decision**: 세션 종료 = **(1) 집필실 라우트 이탈**(컴포넌트 unmount/route change) + **(2) 탭·창 닫기**(`pagehide`/`visibilitychange→hidden` 중 종료형, `navigator.sendBeacon` 으로 best-effort `POST .../work-sessions/end`). 백그라운드 탭 전환만으로는 종료하지 않음. 시작 = 집필실 진입 시 `start`.
- **Rationale**: spec Q1(라우트 이탈 + 탭 닫기). `sendBeacon` 은 unload 중에도 전송 보장. 종료 신호 유실은 014 서버 dangling 정리가 backstop. desktop "화면/앱 이탈 시 종료"에 최근접.
- **Alternatives**: visibilitychange 종료 포함 — 잠깐 탭 전환에 30s 폐기 빈발(기각, Q1). route 이탈만 — 탭 닫기 시간 과대 집계(기각).

## R7. 로컬 설정 보관 — 기존 zustand preferences 재사용

- **Decision**: 보기 설정(테마·줌·줄노트·집필 모드)은 기존 `stores/preferences.ts`(zustand persist, localStorage `writenote.preferences.v1`) 재사용. desktop `settings.get/set`(IPC)는 web 에서 서버 동기화하지 않고 localStorage 로 매핑.
- **Rationale**: UI 표시 설정은 기기 로컬 성격. 기존 frontend 자산 재사용. 실제 집필 데이터만 서버(설계 §1).
- **Alternatives**: 서버 동기화 설정 — backend 확장 필요(범위 밖, 후속).

## R8. electron 전용 호출 교체

- **Decision**: `shell.openExternal(url)` → `window.open(url, '_blank', 'noopener')`. `platform`(preload) → `navigator.userAgent`/`navigator.platform`. `contact.send` 첨부 메타(앱버전·OS)는 web 컨텍스트(`navigator`·빌드 버전)에서 생성해 기존 문의 endpoint 로 전송.
- **Rationale**: desktop 전용 IPC 의 web 등가 교체(설계 §5). 문의 메타는 main 첨부 대신 web 에서 구성.
- **Alternatives**: 없음(직접 교체).

## R9. AGENTS.md Next 16 docs 게이트 — 경로 실재 확인 완료

- **Decision**: `frontend/AGENTS.md` 가 "라우트/코드 작성 전 `node_modules/next/dist/docs/` 정독" 지시. 본 시점 **해당 디렉토리 존재 확인됨**(002 회귀와 달리). 라우팅/page·layout 작성 task 전 관련 Next 16 가이드 정독을 task 에 명시.
- **Rationale**: agent-workflow-discipline §5(본질 정의 문서 실재 검증). 002 에서 부재 회귀 → 이번엔 실재 확인.
- **Alternatives**: 없음.

## R10. 테스트 전략

- **Decision**: 데이터 계층(shim·React Query 훅)·매핑·컴포넌트 동작은 **Vitest + RTL + msw**(HTTP 경계 mock)로 자동화. **페이지 분할·한글 IME 4케이스·폰트 fallback 은 브라우저 dogfooding**(수동, 프로젝트 HARD-GATE — 자동 테스트 한계). RSC server/client 경계는 작성 직후 `pnpm build` 로 검증(code-quality HARD-GATE — lint 만으론 미검출).
- **Rationale**: msw 로 014 응답을 mock 해 화면·shim 단위 검증. 시각·IME·폰트는 PoC 0-1·dogfooding cadence 가 SoT. Playwright E2E 는 미설치(package.json) → 골든패스는 dogfooding 으로 대체.
- **Alternatives**: 페이지분할 자동 시각 회귀 테스트 — 인프라 과설치(베타 범위 밖).

## R11. 구현 순서 (PoC 선증명 → projects 풀스택 → 복제)

1. **PoC(US1 첫 task)**: Next `'use client'` 에디터로 column-wrap 페이지 분할 + 한글 입력 브라우저 dogfooding (핵심 선증명, §10).
2. **US1 projects 풀스택**: webElectronApi(projects·documents) + 작품 벽 + 집필실 라우트 + 자동저장(409) + 라우팅 골격.
3. **US2 memos** → **US3 logs/sessions** → **US4 contact** 복제.
- 각 단계 RSC 경계 build + 관련 dogfooding. 006 화면은 대체 화면 랜딩 시 폐기.
- **Rationale**: 설계 §5(projects 풀스택 먼저) + §10(핵심 미증명 시 광범위 이식 금지).
