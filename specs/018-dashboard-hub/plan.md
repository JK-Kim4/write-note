# Implementation Plan: 대시보드 허브 (재진입 허브)

**Branch**: `feat/studio-three-panel` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-dashboard-hub/spec.md` (설계 SoT: `docs/superpowers/specs/2026-06-10-dashboard-hub-design.md` v2)

## Summary

`/`를 작가 홈(대시보드)으로 교체하고 기존 작품 벽을 `/library`로 옮긴다. 대시보드 = ① 인사+날짜 ② 이어서 쓰기(최근작 최대 타일: 제목·마지막 문장·다음 장면·"N시간 전 저장 · N자 · 총 N시간 M분") ③ 작품 미니 카드 ④ 최근 곁쪽지 2장. 전부 읽기 전용 + 진입 동작만.

기술 접근(research.md 확정):
- **선행 격차 해소**: `listCards()`를 `logs.list()` 패턴(작품별 [document, work-sessions/total] 병렬 fetch, N+1)으로 채워 `lastSentenceSource`·`wordCount`·`docUpdatedAt`·`totalDurationMs`를 공급 — 대시보드와 작품 벽(US4)이 한 데이터 경로로 동작. **백엔드 변경 0.**
- **최근작 선정** = `docUpdatedAt` 내림차순(동률 시 id 내림차순) — 순수함수 `lib/dashboardView.ts`.
- **`/library?new=1`** = `useSearchParams` + Suspense 경계 — 기존 `auth/verify/page.tsx` 전례 패턴 그대로.
- **날짜·상대시간** = 클라 마운트 후 표시(hydration mismatch 회피). 곁쪽지 상대 날짜는 기존 `formatRelativeDay`, 저장 상대시각은 신규 시간 단위 포맷터.

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19.2 / Next.js 16(App Router)

**Primary Dependencies**: React Query(`@tanstack/react-query`) · 기존 `apiFetch` 클라이언트 · 기존 webElectronApi shim. 신규 패키지 0

**Storage**: N/A(영속 변경 없음). 모든 표시값은 기존 백엔드 조회의 클라 파생·집계(014 R6)

**Testing**: Vitest + React Testing Library(행위 중심), 순수함수 단위 테스트. HTTP/어댑터 경계만 mock(기존 `electron-api/*.test.ts` 패턴)

**Target Platform**: 웹(Next.js, Vercel). `desktop-app.css` 웜 톤 작업실

**Project Type**: Web frontend(백엔드 무변경)

**Performance Goals**: 카드 집계 N+1(작품별 2 조회)은 베타 작품 소수 전제 + `projectKeys.cards()` 캐시 공유로 화면 이동 시 재호출 없음

**Constraints**: 백엔드 변경 0 · 게이미피케이션/자동 생성 배제(PRODUCT.md 원칙 4 v2 — 누적 작업시간은 조용한 텍스트 한 토막만) · WCAG 2.1 AA · 한국어 1차 · 신규 화면 `'use client'` + 작성 직후 `pnpm build` · 기존 무관 부채(`documents.test.ts` typecheck 1건 · 집필 page lint 1건) 불변

**Scale/Scope**: 화면 1 신규(대시보드) + 1 이동(작품 벽→/library) + Rail 재편. 신규 컴포넌트 ~2 + 순수함수 모듈 1, 변경 4 파일(`electron-api/projects.ts`·`types/domain.ts`·`Rail.tsx`·집필 page 1줄) + CSS 추가

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재점검.*

`.specify/memory/constitution.md`는 채워지지 않은 템플릿(placeholder)이다. 따라서 017과 동일하게 프로젝트 de-facto 게이트 = `CLAUDE.md` + `.claude/rules/`를 적용한다:

| 게이트 | 상태 |
|---|---|
| 추측 금지(코드 사실 확인) | ✅ `listCards` placeholder(`projects.ts:39`)·`AuthMeResponse`(이름 없음)·work-sessions endpoint 4종(`/total`뿐, 기간 집계 없음)·`useSearchParams`+Suspense 전례(`auth/verify`)·테스트 분포(`projects.test.ts` 존재, 벽/Rail 테스트 부재) 전부 grep·Read 완료 |
| 본질 문서 정합(룰 §5) | ✅ `frontend/AGENTS.md` 인용 경로 `node_modules/next/dist/docs/` **현재 존재 확인**(002 때 부재→현 존재). `use-search-params.md` 실재 — implement 진입 시 정독 게이트(quickstart) |
| 표시값 출처 명시(룰 §9) | ✅ 타일별 [저장 입력/파생 표시] 분류 + 데이터 경로를 design §2·data-model에 명시. 구현 중 데이터 경로 신설 결정 없음 |
| Surgical Changes | ✅ 벽 페이지는 내용 불변 이동(`git mv` + `?new=1` 최소 추가). `MemoPanel`·집필실·기존 훅 불변. 집필 page 변경 1줄(`push("/library")`) |
| TDD(순수함수 먼저) | ✅ `dashboardView`(선정·정렬·포맷) RED→GREEN 우선, `listCards` 집계 테스트 선작성, 그다음 RTL |
| RSC 경계(HARD-GATE) | ✅ 대시보드·library page `'use client'` + `useSearchParams`는 Suspense 경계. 작성 직후 `pnpm build` |
| 백엔드 변경 0 | ✅ 기존 조회 endpoint만 사용(목록·문서·total·메모). 기간 집계는 범위 밖(후속 spec) |
| 제품 원칙(원칙 4 v2·anti-ref) | ✅ 게이미피케이션·자동 인용구 배제 유지. 작업시간은 메타 줄 텍스트 한 토막(0이면 숨김) |
| 접근성 AA / 한국어 | ✅ 대비·키보드 진입·reduced-motion·한국어 카피 명시(spec FR-016) |
| 양보불가 핵심 우선(룰 §10) | ✅ US1(홈에서 최근작 이어서 쓰기) = P1 = 첫 dogfoodable 슬라이스가 재진입 핵심을 직접 실행 |

**위반 없음** — Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/018-dashboard-hub/
├── plan.md              # 본 파일
├── spec.md              # /speckit-specify 산출
├── research.md          # Phase 0 — 데이터 경로·정렬·시간 포맷·searchParam·hydration 결정
├── data-model.md        # Phase 1 — ProjectCard 확장/DashboardView 파생/쿼리 키
├── quickstart.md        # Phase 1 — 게이트·TDD 순서·시각 검증
├── contracts/
│   └── client-contracts.md   # listCards·dashboardView·컴포넌트 prop·라우트 계약(외부 API 신규 없음)
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(PASS)
└── tasks.md             # /speckit-tasks 산출(아직)
```

### Source Code (repository root)

```text
frontend/src/
├── app/
│   ├── page.tsx                          # 교체 — 대시보드(신규 홈, 'use client'+useAuthGuard+.app 셸)
│   ├── library/
│   │   └── page.tsx                      # 신규(이동) — 기존 ProjectsWallPage 내용 불변 + ?new=1 create 진입(Suspense)
│   └── projects/[id]/write/page.tsx      # 변경(1줄) — 에러 시 "작품 벽으로" push("/library")
├── components/
│   ├── dashboard/
│   │   ├── ResumeCard.tsx                # 신규 — ② 이어서 쓰기 타일(표시 전용, props만)
│   │   └── WorkMiniCard.tsx              # 신규 — ③ 작품 미니 카드(표시 전용)
│   └── workspace/
│       └── Rail.tsx                      # 변경 — "홈" 항목 신설 + "작품" href/match → /library
├── lib/
│   ├── dashboardView.ts                  # 신규 순수함수 — selectDashboard(정렬·선정) + formatRelativeTime(시간 단위)
│   ├── electron-api/projects.ts          # 변경 — listCards: 작품별 [document, total] 병렬 fetch 채움
│   └── types/domain.ts                   # 변경 — ProjectCard 에 wordCount·docUpdatedAt·totalDurationMs 추가
└── styles/desktop-app.css                # 추가 — .dash-*/.resume*/.work-card*(대시보드)/.memo-card* (웜 토큰 계승, 목업 이관)

테스트:
├── lib/dashboardView.test.ts             # 신규 — 선정·정렬·동률·포맷·빈 배열 (TDD 선행)
├── lib/electron-api/projects.test.ts     # 확장 — listCards 집계(기존 파일·기존 mock 패턴)
├── app/page.test.tsx                     # 신규 — 대시보드 RTL(4블록·빈 상태·진입 동작)
├── app/library/page.test.tsx             # 신규 — ?new=1 create 모드 진입 1건(벽 자체는 기존 동작 보존 확인)
└── components/dashboard/*.test.tsx       # 신규 — ResumeCard/WorkMiniCard 행위
```

**Structure Decision**: 기존 web frontend 단일 구조 유지. 대시보드는 `components/dashboard/` 신설로 격리, 데이터 확장은 기존 shim(`electron-api/projects.ts`) 내부에서만 — 화면은 동일 인터페이스(`useProjectCards`)를 그대로 소비한다(015 설계 §3의 "화면은 구현을 모른다" 보존). 곁쪽지 카드는 마크업이 단순해 대시보드 page 내 직접 구성(컴포넌트 분리는 과설계).
