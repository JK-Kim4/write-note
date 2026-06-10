# Research: 대시보드 허브 (018)

Phase 0 산출. 설계 v2(`docs/superpowers/specs/2026-06-10-dashboard-hub-design.md`)에서 닫힌 결정은 재론하지 않고, plan 단계로 넘어온 미해결 지점만 코드 사실로 확정한다. NEEDS CLARIFICATION 잔여 0건.

## R1. 마지막 문장·메타 데이터 경로 — listCards N+1 채움 (설계 v2 §3 재확정)

- **Decision**: `webElectronApi.projects.listCards()`가 작품별 `[getProjectDocument(id), GET /work-sessions/total]`을 병렬 fetch 해 `lastSentenceSource`(=`extractPlainText(doc.body)`)·`wordCount`·`docUpdatedAt`(=doc.updatedAt)·`totalDurationMs`를 채운다. `ProjectCard` 타입에 3 필드 추가(비파괴 — 기존 소비처는 추가 필드 무시).
- **Rationale**: 현 코드(`electron-api/projects.ts:39`)가 `lastSentenceSource: ""` placeholder — 015 data-model §1("ProjectCard = projects + document fetch + 클라 파생")과 어긋나는 구현 격차로, 작품 벽 마지막 문장이 전부 빈 상태다. `logs.list()`(`electron-api/logs.ts:26`)가 동일 N+1 패턴 전례(작품별 3 조회, 베타 수용). 캐시 키 `projectKeys.cards()` 공유로 대시보드↔벽 이동 시 재호출 없음.
- **Alternatives considered**: (B) 이어서 쓰기 타일만 문서 1건 fetch — 미니 카드·벽 격차 방치, 기각. (C) 대시보드 전용 집계 신설 — 데이터 경로 이원화, 기각.

## R2. 최근작 선정·정렬 규약

- **Decision**: `docUpdatedAt` 내림차순, 동률 시 `id` 내림차순(2차 키). 첫 번째 = 이어서 쓰기, 나머지 = 미니 카드. 순수함수 `selectDashboard(cards)`로 분리(`lib/dashboardView.ts`).
- **Rationale**: "최근에 집필한"의 기준은 본문 저장 시각(`document.updatedAt`)이다 — `project.updatedAt`은 메타(제목·다음 장면) 수정에도 갱신되어 부적합(설계 §2). 동률은 ISO8601 문자열 비교 + id 2차 키로 새로고침 간 결정적(spec Edge Case). `rememberLastProject`(localStorage)는 기기 종속이라 미사용.
- **Alternatives considered**: `project.updatedAt` 정렬(의미 불일치, 기각) · localStorage 마지막 연 작품(기기 간 비일관, 기각).

## R3. 상대 시간 포맷 — 기존 유틸 재사용 + 시간 단위 신규

- **Decision**: 곁쪽지 상대 날짜 = 기존 `formatRelativeDay`(`lib/relativeDate.ts`, "오늘/어제/N일 전") 재사용. 이어서 쓰기 메타의 "N시간 전 저장"은 **시간 단위 신규 순수 포맷터** `formatRelativeTime`(방금/N분 전/N시간 전/N일 전)을 `dashboardView.ts`에 추가. 작업시간 표시는 기존 `formatDuration`(`lib/progress.ts`, 기록 화면과 동일) 재사용 — `totalDurationMs === 0`이면 토막 숨김(spec Edge Case).
- **Rationale**: `formatRelativeDay`는 일 단위 해상도라 "2시간 전 저장"을 표현 못 함(grep 확인). 메모 카드는 일 단위가 적정(기존 책상 화면과 동일 톤).
- **Alternatives considered**: `formatRelativeDay` 확장(기존 소비처 표시 변화 위험 — Surgical 위반, 기각) · `Intl.RelativeTimeFormat` 직접(단위 산정 로직은 어차피 필요, 순수함수가 테스트 용이).

## R4. `/library?new=1` — useSearchParams + Suspense 전례 패턴

- **Decision**: library page는 `'use client'` + 외곽 컴포넌트가 `<Suspense>`로 내부(useSearchParams 호출)를 감싸는 기존 `src/app/auth/verify/page.tsx` 패턴을 그대로 따른다. `?new=1`이면 벽의 `mode` 초기값을 `"create"`로.
- **Rationale**: Next 16 App Router에서 `useSearchParams`는 Suspense 경계 필요 — 코드베이스 전례 2곳(`auth/verify`, `auth/reset-new`) + 공식 문서 `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` **실재 확인**(AGENTS.md 인용 경로 정합 — 002 때 부재했으나 현재 존재. implement 진입 시 해당 문서 정독은 quickstart 게이트).
- **Alternatives considered**: 전역 상태/이벤트로 create 모드 전달(URL 비공유·새로고침 유실, 기각) · 별도 라우트 `/library/new`(벽 페이지 분할 — 이동 범위 확대, 기각).

## R5. 인사 날짜·상대시간의 hydration 정합

- **Decision**: 날짜 줄과 저장 상대시각 등 `new Date()` 의존 표시값은 **클라 마운트 후 렌더**(mount 게이트)한다. 마운트 전엔 해당 텍스트 자리만 비움(레이아웃 시프트 없는 자리 유지).
- **Rationale**: `'use client'` 페이지도 SSR 프리렌더를 거치므로 서버/클라 시계 차이로 hydration mismatch 가능(자정 경계·분 단위). 대시보드 본문 데이터는 어차피 React Query 클라 fetch 후 표시라 마운트 게이트가 자연스럽다.
- **Alternatives considered**: `suppressHydrationWarning`(증상 은폐, 기각) · 서버 시각 주입(백엔드 변경 0 위배, 기각).

## R6. 테스트 전략·기존 분포

- **Decision**: TDD 순서 = (1) `dashboardView.test.ts`(선정·정렬·동률·포맷·빈 배열) → (2) `electron-api/projects.test.ts` 확장(listCards 집계 — **기존 파일 존재**, 기존 mock 패턴 준수) → (3) RTL(`app/page.test.tsx` 신규 — 4블록·빈 상태·진입, `app/library/page.test.tsx` 신규 — `?new=1` 1건, `components/dashboard/*.test.tsx`).
- **Rationale**: 분포 확인 결과 `electron-api/projects.test.ts`·`logs.test.ts` 존재(집계 테스트 전례), 작품 벽 page·Rail 테스트는 **부재** — 벽 이동은 기존 테스트 이동이 아니라 신규 최소 테스트로 보호(이동 자체는 내용 불변이라 행위 보존은 `?new=1`+렌더 스모크로 충분). Rail 변경은 page RTL의 네비 단언으로 커버.
- **Alternatives considered**: 벽 전체 RTL 신설(이동 범위 밖 과보강, 기각 — 행위 변화는 `?new=1`뿐).

## R7. 빈 상태·스타일 재사용

- **Decision**: 작품 0 = 벽의 `.welcome` 블록 클래스 재사용(CSS 존재 확인 `desktop-app.css:1031`) + CTA → `/library?new=1`. 로딩 = `.projects-skel`(:1027) 재사용. 대시보드 신규 클래스(`.dash-*`·`.resume*`·`.work-card*`(대시보드 변형)·`.memo-card*`)는 목업에서 `desktop-app.css`로 이관, 값은 전부 기존 웜 토큰(설계 §6 — 전 토큰 존재 grep 완료).
- **Rationale**: 동일 정서·중복 0. 다크는 `.dark` variant 토큰이 자동 적용.
- **Alternatives considered**: 대시보드 전용 환영 블록 신설(카피·톤 중복, 기각).
