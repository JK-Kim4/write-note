# Implementation Plan: 대시보드 허브 (재진입 허브)

**Branch**: `feat/studio-three-panel` | **Date**: 2026-06-10 (v3) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-dashboard-hub/spec.md` (설계 SoT: `docs/superpowers/specs/2026-06-10-dashboard-hub-design.md` **v3** — 백엔드 확장 포함, 이전 plan 산출물 폐기 후 재생성)

## Summary

`/`를 작가 홈(대시보드)으로 교체하고 작품 벽을 `/library`로 옮긴다. 대시보드 5블록 = ① 인사+날짜 ② 이어서 쓰기(최근작: 제목·마지막 문장·다음 장면·"N시간 전 저장 · N자 · 총 N시간 M분") ③ "이번 주 집필 시간" 한 줄(전체 작품 합) ④ 작품 미니 카드 ⑤ 최근 곁쪽지 2장. 전부 읽기 전용.

**백엔드 확장 2종**(v3, 사용자 결정):
- **BE-1 기간 합계**: `GET /api/work-sessions/total?from=&to=` — 사용자 전체 작품 횡단, `from ≤ startedAt < to`인 종료 세션 합.
- **BE-2 카드 집계**: `GET /api/projects/cards` — 활성 작품 전량 + `wordCount`·`documentUpdatedAt`·`totalDurationMs` 동봉(기존 목록 endpoint 불변).

**프론트 데이터 경로**: `listCards()` = 카드 endpoint 1회 + 작품별 문서 병렬 N회(마지막 문장 파생 원료만 — 클라 파생 유지, 사용자 결정) → 작품 벽 마지막 문장 placeholder 격차(US6)도 함께 해소. 최근작 = `documentUpdatedAt` 내림차순(동률 시 id 내림차순).

## Technical Context

**Language/Version**: [BE] Kotlin 2.2 + Spring Boot 4.0.6 (Web·Security·Data JPA·Validation), Java 24 toolchain / [FE] TypeScript 5.9 + React 19.2 / Next.js 16(App Router)

**Primary Dependencies**: [BE] 기존 스택만(신규 의존성 0) / [FE] React Query · 기존 `apiFetch`·webElectronApi shim(신규 패키지 0)

**Storage**: PostgreSQL — **스키마 변경 0**(기존 projects·documents·work_sessions의 읽기 집계만). 마이그레이션 없음

**Testing**: [BE] JUnit 5 + AssertJ + MockK(단위) + Spring Boot Test/Testcontainers(IT — 기존 패턴) / [FE] Vitest + RTL(행위 중심), HTTP 경계만 mock

**Target Platform**: 웹(Vercel FE + Render BE). `desktop-app.css` 웜 톤 작업실

**Project Type**: Web full-stack(BE 읽기 endpoint 2 + FE 화면 재편)

**Performance Goals**: 카드 데이터 = 요청 1(집계) + N(문서, 병렬 — 마지막 문장용. v2안 2N에서 축소). BE 집계는 쿼리 3회 고정(작품·문서·세션 일괄 — SQL N+1 금지)

**Constraints**: 기존 조회 계약 불변(FR-013) · 게이미피케이션 시각화 배제(원칙 4 v2 — 시간은 조용한 텍스트 2곳) · WCAG 2.1 AA · 한국어 1차 · 신규 화면 `'use client'` + 작성 직후 `pnpm build` · 빌드/테스트 포어그라운드 · 기존 무관 부채(`documents.test.ts`·집필 page lint) 불변

**Scale/Scope**: [BE] 컨트롤러 1 신규 + 1 메서드 추가, 서비스 2 메서드, 리포지토리 derived/JPQL 3, DTO 1 / [FE] 화면 1 신규 + 1 이동, 컴포넌트 2, 순수함수 모듈 1, 훅 1, 변경 ~6 파일 + CSS

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재점검.*

`.specify/memory/constitution.md`는 채워지지 않은 템플릿(placeholder) — 017 전례대로 de-facto 게이트 = `CLAUDE.md` + `.claude/rules/`:

| 게이트 | 상태 |
|---|---|
| 추측 금지(코드 사실 확인) | ✅ BE: `Project.userId`(직접 소유)·`Document`(1:1 unique, wordCount/updatedAt 저장)·`WorkSession`(userId 없음 — 작품 경유 격리)·기존 총시간=서비스 Kotlin 합산·`WorkSessionController`가 작품 경로 고정(횡단은 신규 컨트롤러 필요) 전부 Read 완료. FE: listCards placeholder·useSearchParams Suspense 전례·테스트 분포 확인 완료 |
| 본질 문서 정합(룰 §5) | ✅ `frontend/AGENTS.md` 인용 `node_modules/next/dist/docs/` 존재 + `use-search-params.md` 실재 — implement 시 정독(quickstart 게이트) |
| 표시값 출처 명시(룰 §9) | ✅ 타일별 [저장 입력/파생] 분류 + endpoint·필드 경로를 design §2·data-model에 명시 |
| Surgical Changes | ✅ 기존 `GET /api/projects`·`/{projectId}/work-sessions/total` 불변(신규 추가만). 벽 페이지 내용 불변 이동. `MemoPanel`·집필실 불변. 집필 page 변경 1줄 |
| TDD(Red-Green-Refactor) | ✅ BE 서비스 단위·컨트롤러 IT 선작성(기간 경계·소유권·0 응답), FE 순수함수(`dashboardView`)→shim→RTL 순. mock은 시스템 경계만, `any()` matcher 금지 |
| Kotlin/Spring 정합 | ✅ 생성자 주입 · 읽기 2종 `@Transactional(readOnly = true)` · Controller→Service→Repository 방향 · annotation 배열 인자 `[X::class]` · ktlint main+test 양쪽 |
| RSC 경계(HARD-GATE) | ✅ 대시보드·library `'use client'` + Suspense 경계, 작성 직후 `pnpm build` |
| 제품 원칙(원칙 4 v2·anti-ref) | ✅ 시간 표시 = 조용한 텍스트 2곳(누적 메타·이번 주 한 줄, 0이면 숨김). 게이지·그래프·streak 배제 유지 |
| 접근성 AA / 한국어 | ✅ 대비·키보드·reduced-motion·한국어 카피(spec FR-021) |
| 양보불가 핵심 우선(룰 §10) | ✅ US1+US2(P1) = 첫 dogfoodable 슬라이스가 재진입 핵심(홈 타일→1클릭 집필)을 직접 실행 |

**위반 없음** — Complexity Tracking 불필요. (Phase 1 설계 후 재점검 — 동일 결론: 신규 외부 계약 2종은 contracts/backend-api.md로 명세, 스키마·기존 계약 무변경.)

## Project Structure

### Documentation (this feature)

```text
specs/018-dashboard-hub/
├── plan.md              # 본 파일 (v3)
├── spec.md              # v3 재생성본
├── research.md          # Phase 0 — BE 집계 전략·횡단 컨트롤러·주간 규약 + FE 결정(구 plan에서 유효 승계)
├── data-model.md        # Phase 1 — ProjectCardResponse/기간 합계/FE 뷰 모델
├── quickstart.md        # Phase 1 — BE·FE 게이트·TDD 순서·시각 검증
├── contracts/
│   ├── backend-api.md        # BE-1·BE-2 요청/응답/규약 (신규 외부 계약)
│   └── client-contracts.md   # FE 내부 모듈 계약(listCards·dashboardView·컴포넌트·라우트)
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(PASS)
└── tasks.md             # /speckit-tasks 산출(아직)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── controller/
│   ├── WorkSessionTotalController.kt     # 신규 — GET /api/work-sessions/total?from=&to= (작품 횡단 — 기존 컨트롤러는 작품 경로 고정이라 분리)
│   └── ProjectController.kt              # 변경 — GET /api/projects/cards 메서드 추가(기존 목록 불변)
├── service/
│   ├── WorkSessionService.kt             # 변경 — rangeTotalDurationMs(userId, from, to) 추가
│   └── ProjectService.kt                 # 변경 — listCards(userId) 추가(작품·문서·세션 3쿼리 일괄 조립 — SQL N+1 금지)
├── repository/
│   ├── WorkSessionRepository.kt          # 변경 — 사용자 횡단 기간 조회(JPQL join projects) + projectId IN 종료 세션 조회
│   └── DocumentRepository.kt             # 변경 — findByProjectIdIn(집계용 일괄)
└── model/response/
    └── ProjectCardResponse.kt            # 신규 — ProjectResponse 필드 + wordCount·documentUpdatedAt·totalDurationMs

backend/src/test/kotlin/com/writenote/    # 서비스 단위 + 컨트롤러 IT — 기존 패턴 준수, TDD 선작성

frontend/src/
├── app/
│   ├── page.tsx                          # 교체 — 대시보드('use client'+useAuthGuard+.app 셸)
│   ├── library/page.tsx                  # 신규(이동) — 기존 벽 내용 불변 + ?new=1(Suspense)
│   └── projects/[id]/write/page.tsx      # 변경(1줄) — 에러 버튼 push("/library")
├── components/
│   ├── dashboard/ResumeCard.tsx          # 신규 — ② 타일(표시 전용, props만)
│   ├── dashboard/WorkMiniCard.tsx        # 신규 — ④ 미니 카드(표시 전용)
│   └── workspace/Rail.tsx                # 변경 — "홈" 신설 + "작품"→/library
├── lib/
│   ├── dashboardView.ts                  # 신규 순수 — selectDashboard·formatRelativeTime·startOfWeekMonday
│   ├── query/useSessions.ts              # 신규 — useWeeklyTotal(주 시작 캐시 키)
│   ├── electron-api/projects.ts          # 변경 — listCards = GET /api/projects/cards 1회 + 문서 N병렬(마지막 문장 원료)
│   ├── electron-api/sessions.ts          # 변경 — rangeTotal(from, to) 추가
│   ├── api/projects.ts                   # 변경 — listProjectCards 어댑터(신규 endpoint 호출)
│   └── types/domain.ts · types/api.ts    # 변경 — ProjectCard 필드 / ProjectCardResponse 타입
└── styles/desktop-app.css                # 추가 — .dash-*/.resume*/.work-card*(대시보드)/.memo-card*/이번 주 한 줄

frontend 테스트: lib/dashboardView.test.ts(신규) · electron-api/projects.test.ts(확장) ·
components/dashboard/*.test.tsx(신규) · app/page.test.tsx(신규) · app/library/page.test.tsx(신규)
```

**Structure Decision**: BE는 기존 레이어(Controller→Service→Repository) 그대로 — 횡단 합계만 신규 컨트롤러(`/api/work-sessions` 베이스). FE는 화면이 `useProjectCards()` 동일 인터페이스를 소비(015 "화면은 구현을 모른다" 보존), 데이터 경로 변경은 shim 내부에서만. 곁쪽지 카드·인사·빈 상태·"이번 주" 한 줄은 대시보드 page 직접 구성(컴포넌트 분리 과설계).
