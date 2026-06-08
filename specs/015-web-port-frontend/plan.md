# Implementation Plan: Web 포팅 — Front 이식 (하위 작업 2)

**Branch**: `015-web-port-frontend` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-web-port-frontend/spec.md`

## Summary

desktop(Electron) renderer 의 검증된 화면(작품 벽·서랍형 집필실·진짜 페이지 분할·곁쪽지·집필 기록·문의)을 web(Next.js 16 App Router)으로 이식한다. 데이터 계층은 desktop `window.electronAPI` 인터페이스를 **동일 시그니처의 web 구현체**(`webElectronApi`, `apiFetch`→014 REST)로 교체하고, 서버 상태는 React Query 로 캐시한다(설계 §3). 인증·HTTP 배관은 frontend 005 자산(client.ts·guard·QueryProvider·프록시) 재사용, 006 화면은 폐기·교체. screen-state 화면전환은 resource-based URL 라우팅으로 변환.

**최우선 리스크 = 진짜 페이지 분할(CSS `column-wrap`) + 한글 IME 가 Next 브라우저에서 동작**. plan 첫 실행을 **PoC dogfooding** 으로 박아 핵심을 선증명한 뒤, projects 도메인 풀스택 관통(US1) → memos/logs/sessions/contact 복제(설계 §5, 작업 규율 §10).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2.4

**Primary Dependencies**: Next.js 16.2.6(App Router), `@tiptap/react`·`@tiptap/pm`·`@tiptap/starter-kit` ^3.23.5(desktop 과 정합), `@tanstack/react-query` ^5, zustand ^5, Tailwind 4. (모두 frontend 기설치 — 신규 의존 0)

**Storage**: 서버(014 REST, PostgreSQL) — front 는 소비만. 로컬 UI 설정 = localStorage(zustand persist)

**Testing**: Vitest + RTL + msw(데이터계층·컴포넌트) / 브라우저 dogfooding(페이지 분할·한글 IME·폰트 — 프로젝트 HARD-GATE). Playwright 미설치 → 골든패스 dogfooding 대체

**Target Platform**: web 브라우저(Vercel 호스팅은 하위 작업 4). 데스크톱·모바일 브라우저 한글 렌더 대상

**Project Type**: Web frontend(Next.js) — 기존 `frontend/` 확장. backend 변경 0(014 계약 소비)

**Performance Goals**: 베타. 페이지 분할 첫 페인트에 레이아웃 점프 없을 것. 카드 집계 N+1(작품별 조회)은 베타 수용(014 R6)

**Constraints**: RSC server/client 경계(이벤트핸들러·hook·ResizeObserver = `'use client'`) — `pnpm build` 검증. `next/font` 한국어 subset 미지원 → 시스템 fallback. AGENTS.md: 라우트 작성 전 `node_modules/next/dist/docs/` 정독(경로 실재 확인됨)

**Scale/Scope**: 화면 5종 이식 + webElectronApi shim + 라우트 6 + React Query 훅. 신규 영속 엔티티 0

## Constitution Check

> `.specify/memory/constitution.md` = 미작성 템플릿. 실질 게이트 = `CLAUDE.md` + `.claude/rules/typescript/code-quality.md`.

| 게이트 | 판정 | 근거 |
|---|---|---|
| 추측 금지/단정 금지 | ✅ | desktop/frontend 코드·의존·docs 경로 실측. Q1 사용자 확정 |
| RSC server/client 경계(HARD-GATE) | ✅ | 인터랙티브 화면·에디터 `'use client'`, 작성 직후 `pnpm build` 검증(R10) |
| TS 코드 품질(any 금지·named export·type 우선) | ✅ | 이식 시 desktop 타입 유지 + ID Long→number 조정 |
| Server state=React Query / Local=zustand | ✅ | R1·R7 — 서버 데이터 React Query, UI 설정 zustand |
| TipTap 한글 IME 회귀(HARD-GATE) | ✅ | view.composing 패턴 유지 + PoC 0-1 4케이스 dogfooding(R4) |
| 폰트 fallback dogfooding(HARD-GATE) | ✅ | next/font subset latin + 시스템 fallback, 라이트/다크·모바일 dogfooding(R5) |
| 본질 정의 문서 실재 검증(agent §5) | ✅ | AGENTS.md `node_modules/next/dist/docs/` 존재 확인(R9) |
| 핵심 선증명(작업 §10) | ✅ | plan 첫 실행 = 페이지 분할+한글 PoC, 광범위 이식은 그 후(R3/R11) |
| 공용 fetch status 분기 error.code(HARD-GATE) | ✅ | 기존 client.ts 409 분기 재사용(신규 status 분기 추가 안 함) |

**위반 없음.** Complexity Tracking 불요.

## Project Structure

### Documentation (this feature)
```text
specs/015-web-port-frontend/
├── plan.md · spec.md · research.md(R1~R11) · data-model.md · quickstart.md
├── contracts/web-electron-api.md   # electronAPI 구현체 ↔ 014 매핑
└── checklists/requirements.md      # 통과
```

### Source Code (frontend/ 확장)
```text
frontend/src/
├── app/
│   ├── page.tsx                      # 작품 벽(ProjectsScreen) — 006 home 교체
│   ├── projects/[id]/write/page.tsx  # 집필실 — 신설(006 /write 교체)
│   ├── memos/page.tsx                # 곁쪽지 책상 — 006 교체
│   ├── logs/page.tsx                 # 집필 기록 — 신설
│   ├── contact/page.tsx              # 문의 — 신설
│   └── (poc)/ 임시 PoC 라우트         # 핵심 선증명 후 제거/정식화
├── lib/
│   ├── api/client.ts                 # 재사용(005, 변경 없음)
│   └── electron-api/                 # 신규 — webElectronApi shim(projects/documents/memos/logs/sessions/contact/shell/settings)
├── lib/query/                        # React Query 훅(shim 래핑)
├── components/editor/                # 이식 — Editor(use client)·pageLayout(순수)·BubbleMenu
├── components/                       # 이식 — MemoPanel·Rail·QuickCapture·ViewMenu 등
├── stores/preferences.ts·ui.ts       # 재사용(R7)
└── styles/                           # .prose/.paper/.sheet column 규칙 이식
```

**Structure Decision**: 기존 frontend 구조(App Router + lib/api + stores) 위에 desktop 화면을 이식. 데이터 호출은 `lib/electron-api/`(shim) + `lib/query/`(훅)로 일원화해 화면이 fetch 를 모르게 한다(설계 §3). 006 화면은 대체 화면이 랜딩하는 시점에 제거.

## Phase 0 — Research
완료 → [research.md](./research.md). R1(shim+React Query)·R2(URL 스킴)·R3(페이지분할 PoC)·R4(IME)·R5(폰트)·R6(세션 트리거)·R7(로컬설정)·R8(electron 대체)·R9(docs 게이트)·R10(테스트)·R11(순서). [NEEDS CLARIFICATION] 0.

## Phase 1 — Design & Contracts
완료:
- [data-model.md](./data-model.md) — 클라 뷰 모델 + shim↔014 매핑 + URL 라우트 맵 + 로컬 상태(신규 엔티티 0)
- [contracts/web-electron-api.md](./contracts/web-electron-api.md) — electronAPI 구현체 계약(✅/♻️/🧩/🔁)
- [quickstart.md](./quickstart.md) — backend+frontend 구동·PoC·검증 cadence·DoD
- Agent context: `CLAUDE.md` SPECKIT 마커를 본 plan 으로 갱신

### Post-Design Constitution Re-check
✅ 재확인 — 설계가 게이트 위반 도입 없음. 신규 backend 의존 0, RSC 경계·IME·폰트 모두 dogfooding/build 게이트로 커버.

## 미해결 / 리스크 (sub-task 경계)
- **페이지 분할 Next 동작**(R3): PoC 로 선검증. column-wrap 부적합 시 대안은 PoC 단계에서 별도 트랙 결정.
- **카드 집계 N+1**(데이터-모델 §1): 베타 수용. 규모 증가 시 014 집계 endpoint 신설 재검토(백엔드 변경 = 범위 밖, surfacing).
- **ID 타입 Long↔string**: desktop UUID 가정 코드 이식 시 number 로 조정(계약 명시).
- **Playwright 부재**: 골든패스 자동화 없음 → dogfooding 의존. 후속에서 E2E 도입 검토.

## 다음 단계
`/speckit-tasks` — 본 plan/contracts/data-model 기반 의존순 tasks.md 생성. **첫 task = 페이지 분할+한글 PoC dogfooding**(§10), 이후 US1 projects 풀스택 → US2~US4. 각 단계 `pnpm build`(RSC) + dogfooding.
