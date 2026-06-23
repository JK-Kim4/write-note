# Implementation Plan: 작품 카테고리 분류 (모음)

**Branch**: `032-project-categories` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-project-categories/spec.md`

## Summary

작품 페이지(`/library`)에 폴더형 분류 "모음(category)"을 도입한다. 작품은 최대 1개 모음에 속하고(`projects.category_id` nullable, NULL=미분류), 모음을 "폴더 타일"로 보여 열고 들어가는 드릴인 + 카드를 타일로 드래그해 분류한다. N뎁스(모음 안 모음) 설계를 `parent_id` 컬럼으로 보유하되 v1 은 앱레벨 1뎁스 강제. 기존 작품은 NULL 로 자동 미분류(무손실). 백엔드는 `categories` 테이블(V20) + 모음 CRUD 4 엔드포인트 + 작품 이동 전용 엔드포인트 + 응답 `categoryId` 추가, 프론트는 `@dnd-kit`(기존 의존성) 드릴인 UI. 신규 에러코드 0(404/400 재사용). 배포 BE 선행 → FE 후행.

## Technical Context

**Language/Version**: Kotlin 2.2 / Java 24 toolchain (BE), TypeScript 5.9 / React 19.2 / Next.js 16.2.6 (FE)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation), Flyway; React Query, Zustand, `@dnd-kit/core·sortable·utilities`(이미 설치, ExportDialog 검증됨)

**Storage**: PostgreSQL — 신규 `categories` 테이블 + `projects.category_id`(V20)

**Testing**: JUnit5 + AssertJ + MockK + Testcontainers(BE), Vitest + RTL(FE)

**Target Platform**: 웹앱(Vercel FE + OCI BE), 데스크탑 Electron 공유

**Project Type**: web (frontend + backend 분리)

**Performance Goals**: 베타 작품·모음 소수 전제. 카테고리 목록/카드 페이지네이션 없음. projectCount 는 group-by 1쿼리(N+1 금지)

**Constraints**: 신규 에러코드 0(409 회귀 방지); 기존 `PATCH /api/projects/{id}` 계약 무변경(전용 이동 엔드포인트); 기존 작품 무손실(NULL=미분류); 마이그레이션 적용은 사용자 컨펌

**Scale/Scope**: BE 신규 엔티티 1 + 엔드포인트 5(모음 4 + 이동 1) + 마이그레이션 V20; FE `/library` 재구성 + 훅 5 + dnd

## Constitution Check

*GATE: Phase 0 이전 통과 필수, Phase 1 이후 재확인.*

`.specify/memory/constitution.md` 는 미작성 템플릿(placeholder)이다 → 형식 게이트 없음. 대신 프로젝트 `CLAUDE.md` + `.claude/rules/*` 를 실질 게이트로 적용:

- **추측 금지(HARD-GATE)**: 실제 코드(Project/Service/Controller/Repository/Mapper/마이그레이션) 정독 후 plan 작성 — 시그니처·패턴 정합 확인 완료. ✅
- **TDD(§5)**: R1/R2 모두 Red-Green-Refactor. Mock 은 시스템 경계만(DB=Testcontainers). ✅ (tasks 단계 구체화)
- **단순성(§2)**: 조인 테이블 대신 컬럼 1개, 전용 엔드포인트로 PATCH 모호 회피, 신규 에러코드 0. ✅
- **외부 인프라 안전**: 마이그레이션 작성 OK / 적용은 컨펌. subagent 위임 시 로컬 DB 적용 금지 명시 + 완료 후 실제 상태 확인(§13). ✅
- **배포 순서**: BE 선행 → FE 후행 명시(R-10). ✅
- **lint 정합**: BE 위임 시 `ktlintFormat` main+test 양쪽 / FE 위임 시 작성 직후 `pnpm build`(RSC 경계). ✅

위반 없음 → Phase 0/1 진행 가능.

## Project Structure

### Documentation (this feature)

```text
specs/032-project-categories/
├── plan.md              # 본 파일
├── spec.md              # 명세(사용자 컨펌 반영)
├── research.md          # Phase 0 — 설계 결정 R-1~R-11
├── data-model.md        # Phase 1 — Category/Project 확장/V20
├── contracts/
│   └── categories-api.md # Phase 1 — 엔드포인트 5 + 응답 확장
├── quickstart.md        # Phase 1 — 라운드/게이트/dogfooding
└── tasks.md             # /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/Category.kt                       # 신규
├── entity/Project.kt                        # + categoryId
├── repository/CategoryRepository.kt          # 신규
├── repository/ProjectRepository.kt           # (필요 시 projectCount projection)
├── service/CategoryService.kt                # 신규
├── service/ProjectService.kt                 # + moveCategory
├── controller/CategoryController.kt          # 신규
├── controller/ProjectController.kt           # + PATCH /{id}/category
├── mapper/ProjectMapper.kt                   # + categoryId
├── mapper/CategoryMapper.kt                  # 신규
├── model/request/CreateCategoryRequest.kt    # 신규
├── model/request/UpdateCategoryRequest.kt    # 신규
├── model/request/MoveProjectCategoryRequest.kt # 신규
└── model/response/{ProjectResponse,ProjectCardResponse,CategoryResponse}.kt # 확장/신규
backend/src/main/resources/db/migration/
└── V20__create_categories_and_project_category.sql # 신규

frontend/src/
├── app/(main)/library/page.tsx               # 드릴인 재구성
├── components/library/                        # 모음 타일/경로/카드 메뉴(dnd) — 분리 권장
├── hooks/ (또는 기존 위치)                     # useCategories 등 5 훅
└── lib/api (client)                           # 카테고리/이동 호출

docs/research/2026-06-22-project-categories-interactions.html # 인터랙션 비교 PoC(완료)
```

**Structure Decision**: 기존 web(frontend+backend 분리) 구조 그대로. BE 는 Project 도메인 패턴(entity/repository/service/controller/mapper/model)을 그대로 미러해 Category 추가. FE 는 `/library` 재구성 + `components/library/` 로 모음 타일·드릴인·dnd 컴포넌트 분리(page.tsx 비대화 방지, 자동저장/세션 등 무관).

## 핵심 설계 (research.md 요약)

| # | 결정 | 근거 |
|---|---|---|
| R-1 | 폴더형 1:N — `projects.category_id` nullable | 사용자 컨펌, 단순, 기존 NULL=미분류 |
| R-2 | 모음 삭제 = FK `ON DELETE SET NULL` | FR-007 작품 무손실, DB 강제 |
| R-3 | 이동 = 전용 `PATCH /projects/{id}/category` | 기존 PATCH null=미변경과 충돌 회피 |
| R-4 | `GET /categories`(독립) + projectCount | 빈 모음 표시 |
| R-5 | 응답에 categoryId 추가 | FE 그룹핑, additive 하위호환 |
| R-6 | `parent_id` 보유 + 앱레벨 1뎁스 강제 | FR-010 N뎁스 설계, SC-005 |
| R-7 | 신규 에러코드 0(404/400) | 409 회귀 방지 |
| R-8 | `@dnd-kit` 재사용 | 신규 의존성 0 |
| R-9 | 드릴인 = `?folder=<id>` URL | 재진입 보존 |
| R-10 | BE 선행 → FE 후행 | additive 계약 |
| R-11 | 보관 작품 category 보존, 그룹표시는 활성만 | 범위 경계 |

## User Story → 구현 매핑

- **US1 (P1) 생성·배정·표시**: V20 + Category 생성/목록 + 이동 엔드포인트 + 응답 categoryId / FE 루트 타일·드릴인 표시 + 드래그·⋯ 배정. → MVP. C 패턴은 드릴인 자체가 표시라 US3 의 "탐색"을 일부 포함.
- **US2 (P2) 관리**: 이름변경(PATCH)·삭제(DELETE, 작품→미분류)·모음 간 이동(⋯ 메뉴/루트 드래그).
- **US3 (P3) 탐색**: 드릴인 경로(breadcrumb), 빈 모음/빈 미분류 empty state, 모바일 반응형. (아코디언 "접기"는 C 에서 드릴인으로 대체)

## Phase 0/1 산출물

- Phase 0: [research.md](./research.md) — NEEDS CLARIFICATION 0(명세 단계 해소), 기술 결정 R-1~R-11.
- Phase 1: [data-model.md](./data-model.md), [contracts/categories-api.md](./contracts/categories-api.md), [quickstart.md](./quickstart.md).

## Complexity Tracking

위반 없음 — 신규 테이블 1·컬럼 1·엔드포인트 5(전부 표준 CRUD/액션), 신규 의존성·에러코드 0. 별도 정당화 불요.

## 다음 단계

`/speckit-tasks` — 위 라운드(R1 BE / R2 FE)를 TDD 순서의 의존성 정렬 tasks.md 로 분해.
