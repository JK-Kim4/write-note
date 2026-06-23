# Implementation Plan: 시리즈 중심 재구성 (챕터 제거 + 메타데이터 시리즈 종속화)

**Branch**: `033-series-restructure` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/033-series-restructure/spec.md`

## Summary

032에서 도입한 **시리즈**(코드상 category) 위에서 정신 모형을 "시리즈=책 / 작품=장"으로 정렬한다. 세 축의 변경:

1. **챕터 제거** — `documents` 1:N(챕터) 구조를 작품 1:1 본문으로 회귀(실데이터상 다중 본문 0건이라 단순 회귀). 챕터 목록/생성/순서/삭제/복구/제목 endpoint·UI 제거.
2. **출판 메타데이터 시리즈 종속** — 판형·출판방식·장르·줄거리를 시리즈(Category) 단위로 이동. 작품은 시리즈 값을 적용받고 개별 설정 불가. 미분류·미설정 시 시스템 기본값 fallback. 작품 응답은 BE가 해석한 **effective 판형/출판방식**을 내려줘 집필실·내보내기가 단일 경로로 읽는다.
3. **메타 정리 + 두 층위 목표 분량** — 톤·문체·세계관·다음 장면은 화면 노출만 제거(데이터 보존). 시리즈 총 목표 분량(하위 작품 글자수 합산 진척) 신규 + 작품 단위 목표 분량 유지.

기술 접근: BE는 **additive 우선**(Category 컬럼 추가·Project 응답 확장)으로 무손실을 보장하고, 제거는 코드 레벨(endpoint/UI)에서 수행해 스키마 파괴를 피한다. 통합은 `buffer` 브랜치에 032와 함께 모아 검증 후 develop으로 내보낸다.

## Technical Context

**Language/Version**: Kotlin 2.2 (backend, Java 24 toolchain) / TypeScript 5.9 + React 19.2 (frontend)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation) + Flyway / Next.js 16.2 App Router + React Query + Zustand + 자체 EditContext 에디터 엔진(024~)

**Storage**: PostgreSQL (self-managed OCI). 최신 마이그레이션 = **V20** (`create_categories_and_project_category`). 본 기능은 V21~ 추가.

**Testing**: JUnit 5 + AssertJ + MockK + Testcontainers (backend) / Vitest + RTL (frontend)

**Target Platform**: 웹 (Vercel 프론트 + OCI 백엔드). 데스크톱/모바일 동일 코드베이스.

**Project Type**: web (backend + frontend 분리)

**Performance Goals**: 해당 없음 (사용자 규모 소수, dogfooding 단계). 시리즈 진척 집계는 작품 word_count 합산 1쿼리.

**Constraints**: 본문 텍스트 무손실(FR-003) · 톤류 데이터 보존(FR-014) · 신규 status/에러코드 0 지향 · 외부 DB 쓰기는 사용자 컨펌(external-infra-safety).

**Scale/Scope**: 현 운영 데이터 = 작품 6, 활성 본문 6(다중 본문 0), 시리즈/작품-시리즈 관계는 R0에서 재확인. 변경 영역 = BE 엔티티 3·컨트롤러 2·마이그레이션 1~2 / FE 작품·시리즈 폼·집필실·작품카드·내보내기.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`는 **빈 템플릿(미작성)**이다. 따라서 게이트는 프로젝트 `CLAUDE.md` + `.claude/rules/` 의 HARD-GATE 룰을 준용한다:

| 게이트 | 본 plan의 준수 |
|---|---|
| 무손실(텍스트·톤류 데이터) | additive 우선 — 챕터 제거는 endpoint/UI 레벨, 스키마 컬럼은 보존(DROP 안 함). 톤류 컬럼 보존. **PASS** |
| TDD (Red-Green-Refactor) | 매핑·effective 판형 해석·진척 집계·마이그레이션은 행위 단위 테스트 선행. **PASS** |
| 외부 인프라 안전 | V21~ 마이그레이션은 **작성·리뷰만**, 로컬/운영 적용은 사용자 컨펌. 운영 DB는 읽기 조회만. **PASS** |
| Mock 경계 (Classist) | 시스템 경계(DB)만 Testcontainers, 내부 collaborator mock 금지. **PASS** |
| 신규 에러코드/status 최소 | 신규 status·에러코드 0 지향(시리즈 메타는 기존 검증 재사용). **PASS** |
| surgical change | 챕터 제거 외 인접 코드 미개선, 031/032 자산 재사용. **PASS** |

**위반 없음** → Phase 0 진입 가능.

## Project Structure

### Documentation (this feature)

```text
specs/033-series-restructure/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 설계 결정(1:1 회귀 방식, 메타 위치, effective 해석, 진척, 배포순서)
├── data-model.md        # Phase 1 — 엔티티·마이그레이션(V21~) 변경
├── quickstart.md        # Phase 1 — 라운드별 검증 시나리오
├── contracts/           # Phase 1 — API 계약 변경(Category/Project/Document)
└── tasks.md             # Phase 2 (/speckit-tasks 산출, 본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/
│   ├── Category.kt          # +paperSize +layoutMode +genre +synopsis +targetLength (nullable)
│   ├── Project.kt           # 톤류·판형·장르·줄거리 컬럼 보존(미사용 전환), targetLength 유지
│   └── Document.kt          # 1:1 본문(앱레벨), sort_order/deleted_at 컬럼은 보존
├── controller/
│   ├── CategoryController.kt # CRUD 메타 필드 확장 + 시리즈 진척 응답
│   ├── ProjectController.kt  # 응답에 effective 판형/출판방식, 생성 시 메타 입력 제거
│   └── DocumentController.kt # 챕터 endpoint(목록/생성/순서/삭제/복구/제목) 제거, 단일 본문 조회·저장만
├── service/                 # CategoryService/ProjectService/DocumentService 동반 수정
├── model/{request,response} # Create/Update/Response DTO 확장·정리
├── mapper/                  # CategoryMapper/ProjectMapper effective·진척 매핑
└── resources/db/migration/
    ├── V21__add_series_metadata_to_categories.sql   # Category 메타 컬럼
    └── V22__(옵션) document_single_body_guard.sql    # 1:1 보강(research 결정 따름)

frontend/src/
├── app/(main)/library/page.tsx          # 작품 생성 폼 간소화
├── app/(main)/works/[id]/page.tsx       # 집필실 진입 — effective 판형 주입
├── components/library/{LibraryBoard,CategoryTile}.tsx  # 시리즈 생성·편집 메타 폼
├── components/{ProjectFormModal}        # 작품 폼: 판형·장르·줄거리·톤류 입력 제거
├── components/b/BStudioShell.tsx        # 챕터 관리 UI 제거, effective 판형
├── components/editor/ChapterList.tsx    # 제거
├── components/custom-editor/*           # effective 판형 결선
├── components/export/*                  # effective 판형 사용
├── lib/api/{categories,document}.ts     # 챕터 호출 제거, 시리즈 메타·진척 호출
├── lib/query/{useCategories,useDocument}.ts
└── types/api.ts                         # CategoryResponse·ProjectResponse 타입 확장
```

**Structure Decision**: 기존 web(backend+frontend) 구조를 그대로 사용한다. 신규 디렉토리 없음. 031(판형/출판방식 정의)·032(시리즈 category) 자산 위에 additive 확장 + 챕터 제거.

## 라운드 분해

각 라운드는 독립 dogfoodable. 우선순위는 spec User Story(P1>P2>P3)와 정렬.

| 라운드 | 범위 | US | BE/FE | 배포 의존 |
|---|---|---|---|---|
| **R0** | 운영 데이터 재확인(시리즈·작품-시리즈·soft-deleted 본문 분포) — 마이그레이션 전제 확정 | — | 읽기 조회 | 없음 |
| **R1** | 챕터 제거 — DocumentController 챕터 endpoint 제거 + 단일 본문 경로 일원화 / FE ChapterList·BStudioShell 챕터 UI 제거, 작품 1본문 집필 | US1(P1) | BE+FE | FE 선행(챕터 호출 중단)→BE 후행(endpoint 제거). buffer 동시 검증 |
| **R2** | 판형·출판방식 시리즈 종속 — Category 메타 컬럼(V21) + effective 판형 응답 + 집필실/내보내기 결선 + 미분류 fallback / 시리즈 폼 판형·출판방식 입력, 작품 폼서 제거 | US2·US3(P1·P2) | BE+FE | BE 선행(응답 additive)→FE 후행 |
| **R3** | 장르·줄거리 시리즈 이동 + 톤류 UI 제거 — Category genre/synopsis + 작품 카드/폼 정리(톤류 데이터 보존) | US2·US5·US6(P1·P3) | BE+FE | BE 선행→FE 후행 |
| **R4** | 두 층위 목표 분량 — 시리즈 총 목표(Category.targetLength) + 하위 작품 글자수 합산 진척 / 시리즈 폼 총목표, 작품 폼 작품목표 유지 | US4(P2) | BE+FE | BE 선행→FE 후행 |

> **배포 경로**: 본 작업은 `buffer` 통합 브랜치에 모아 032와 함께 검증 후 develop으로 한 번에 내보낸다. 따라서 라운드 간 BE/FE 순서 의존은 buffer 내에서 함께 충족되며, 최종 prod 배포는 BE·FE 동시 반영이라 순서 위험이 완화된다. 단 라운드 내 검증 시 R1만 "제거"라 FE 호출 중단을 BE endpoint 제거보다 먼저 확인한다.

## Complexity Tracking

> Constitution Check 위반 없음 — 본 섹션 비움.

해당 없음.
