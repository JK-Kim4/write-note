# Implementation Plan: 출판 방식 선택 기반 에디터 레이아웃 (종이/웹) + 종이 출판 판형

**Branch**: `031-publish-layout-modes` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/031-publish-layout-modes/spec.md`

## Summary

작품(Project)에 **출판 방식(`layoutMode`: `paper`/`web`)** 속성을 추가한다. 작품 생성 시 작가가 강제로 선택하고, 양방향 전환을 허용한다. `paper`(종이 출판)는 기존 페이지 분할 집필실 + **출판 판형 4종(신국판/국판/46판/문고판)**을 ISO 4종과 병행 제공하고 실측 분량을 근사한다. `web`(웹 출판)은 페이지 분할을 우회한 **연속 표시 경로**와 글자수 지표를 제공한다. 텍스트 모델(`DocModel`)이 렌더 방식과 독립이라 전환·판형 변경 시 텍스트 무손실이 성립한다.

기존 자체 에디터(`CustomEditor`)의 좌표계가 이미 실측 mm 기반이고 029 페이지 넘김 뷰가 머지돼 있어, 종이 판형은 프리셋 주입으로 달성된다. 가장 불확실한 부분은 웹 연속 표시 경로(페이지 분할 전제 코드 우회)이며 R2에서 PoC 선행한다.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router) — frontend; Kotlin 2.2 / Spring Boot 4.0.6 on Java 24 — backend

**Primary Dependencies**: 자체 EditContext 에디터(`components/custom-editor/*`), React Query, Zustand; Spring Data JPA, Flyway

**Storage**: PostgreSQL — `projects` 테이블에 `layout_mode` 컬럼 추가(V17), `paper_size` CHECK 제약 확장(V18)

**Testing**: Vitest + RTL(frontend), JUnit5 + AssertJ + Testcontainers(backend). 자체 에디터 렌더/좌표계는 dogfooding 게이트(한국어 IME 4케이스 포함)

**Target Platform**: 웹(Vercel FE + OCI BE). 데스크탑 Chrome 주력 + iOS Safari(모바일 transform:scale 분기 보존)

**Project Type**: Web application (frontend + backend)

**Performance Goals**: 판형 변경·모드 전환 시 즉시 리플로우(체감 지연 없음). 긴 웹 작품의 연속 렌더가 멈춤 없이 동작

**Constraints**: 텍스트 무손실(전환/판형 변경), 기존 작품 작동 보존(`layout_mode='paper'` 마이그레이션), 자동저장·버전토큰(016)·챕터(022) 무회귀

**Scale/Scope**: 솔로 베타 규모. 작품 수십~수백 건. 변경 파일 — 백엔드 ~8개(엔티티/DTO 3/서비스/매퍼/마이그레이션 2), 프론트 ~12개(생성·수정 폼/API 타입/geometry/CustomEditor 렌더 분기/글자수 헬퍼/설정·집필실 select)

## Constitution Check

*프로젝트 constitution(`.specify/memory/constitution.md`)은 placeholder 템플릿 상태 → 실제 게이트는 프로젝트 `CLAUDE.md` + `.claude/rules/*`로 대체.*

| 게이트 | 적용 | 본 plan 의 준수 |
|---|---|---|
| 추측 금지 (HARD-GATE) | ✅ | 렌더 파이프라인·생성흐름·마이그레이션 번호를 코드 grep 으로 확정 후 작성 |
| TDD (Red-Green-Refactor) | ✅ | 순수 헬퍼(글자수 카운트, 판형 프리셋 분량 계산, layoutMode 검증)는 테스트 우선. 에디터 렌더 분기는 dogfooding 게이트 |
| Surgical Changes | ✅ | layout/measure/geometry 핵심 함수는 시그니처 확장(분기 플래그·marginMm)만, 레거시 `pageLayout.ts` 미접촉 |
| RSC 경계 (Next 16) | ✅ | 폼/select 변경 컴포넌트는 이미 `'use client'`. 신규 모드 select 작성 직후 `pnpm build` |
| 한국어 IME 회귀 검증 | ✅ | 에디터 렌더 경로 변경(웹 연속) → IME 4케이스 dogfooding 의무(R2/R3 게이트) |
| 외부 스토어 쓰기 컨펌 | ✅ | 마이그레이션 작성은 OK, 적용(`flywayMigrate`)은 사용자 컨펌. 로컬 dev DB 적용 금지(IT/Testcontainers만) |
| 양보불가 핵심 우선(§10) | ✅ | "진짜 페이지 분할"은 `paper` 모드로 보존. 첫 dogfoodable 산출물이 핵심을 건드림(R1 모드 선택 → R2/R3 즉시 실환경) |
| 1:1→1:N 차원 재사용(§12) | ✅ | 모드/판형이 작품(Project) 단위 → 챕터 전환 시 `key={documentId}` 세션 리마운트 패턴 유지 점검 |

**게이트 위반 없음.** Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/031-publish-layout-modes/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 모드 렌더 전략/판형 프리셋/글자수/마이그레이션 결정
├── data-model.md        # Phase 1 — Project.layoutMode + paperSize enum + 판형 프리셋
├── contracts/
│   └── projects-api.md  # Phase 1 — create/update/response 계약 변화 + 검증값
├── quickstart.md        # Phase 1 — dogfooding 검증 시나리오
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # Phase 2 — /speckit-tasks 산출 (본 명령 비생성)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/Project.kt                       # + layoutMode 필드
├── model/request/CreateProjectRequest.kt   # + layoutMode (강제 선택은 FE, BE nullable→기본 paper)
├── model/request/UpdateProjectRequest.kt   # + layoutMode
├── model/response/ProjectResponse.kt       # + layoutMode
├── mapper/ProjectMapper.kt                 # + layoutMode 매핑
└── service/ProjectService.kt               # validatedLayoutMode + ALLOWED_LAYOUT_MODES + ALLOWED_PAPER_SIZES 확장
backend/src/main/resources/db/migration/
├── V17__add_projects_layout_mode.sql       # 신규 컬럼 + CHECK(paper/web), 기존 'paper'
└── V18__extend_projects_paper_size.sql     # paper_size CHECK 제약 8종으로 교체

frontend/src/
├── lib/api/projects.ts                     # CreateProjectInput/UpdateProjectInput + layoutMode
├── types/api.ts                            # ProjectResponse + layoutMode
├── app/(main)/library/page.tsx             # 생성·수정 폼: layoutMode 강제 선택 + 판형 8종
├── components/b/BStudioShell.tsx           # 집필실: 모드별 UI 분기(판형 select는 paper만) + 판형 8종
├── components/custom-editor/
│   ├── geometry.ts                         # 판형 4종 추가 + 판형별 (fontSize/margin) 프리셋 + 연속 기하
│   ├── layoutEngine.ts                     # layout() 연속(미분할) 분기
│   ├── printLayout.tsx                     # relayout() 모드 전달
│   ├── CustomEditor.tsx                    # 렌더 분기(연속 vs 페이지) + 좌표계 어댑터
│   └── charCount.ts                        # 신규: DocModel 글자수(공백 포함/제외)
└── app/(main)/settings/page.tsx            # (전역 기본 판형 옵션 8종 — 선택적)
```

**Structure Decision**: 기존 web app 구조(`frontend/` + `backend/`)에 surgical 확장. 자체 에디터는 `components/custom-editor/` 내부 분기로 한정하고 레거시 `components/editor/pageLayout.ts`는 건드리지 않는다. 모드/판형은 작품(Project) 단위 속성으로 백엔드에 영속.

## 구현 라운드 (상세 분해는 /speckit-tasks)

- **R1 — 데이터 모델 + 모드 선택/전환** (US1, US4 토대): `layoutMode` 컬럼/DTO/서비스 + `library` 생성 폼 강제 선택 + 작품 설정 양방향 전환. 백엔드 선행→프론트 후행(BE가 새 필드 받은 뒤 FE가 전송).
- **R2 — 웹 연속 표시 경로** (US3): 가장 불확실. **PoC 선행** — `layout(measured, ∞)` 단일 페이지 + CustomEditor 렌더/좌표계 연속 분기를 작은 범위로 먼저 dogfood(한국어 IME 4케이스 + 캐럿/선택/스크롤). 통과 후 결선.
- **R3 — 판형 4종 + 실측 조판 + zoom** (US2, paper 한정): `geometry.ts` 판형 프리셋 + `paper_size` 확장 + 신국판 원고지 3.5매 앵커 검증 + `userZoom` 재사용 가독성.
- **R4 — 분량 지표** (US2·US3 마감): `charCount.ts`(웹=글자수) + 종이=페이지/원고지 매수. 홈 카드·집필실 표시.

배포 순서(HARD-GATE): R1·R3·R4 = BE 선행→FE 후행(BE 가 새 키 받아들인 뒤 FE 전송). R2 = FE 단독(BE 무변경).

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
