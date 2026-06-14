# Implementation Plan: 챕터(Chapter) — 작품 1:N 본문 구조

**Branch**: `022-chapters` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-chapters/spec.md`

**설계 SoT**: `docs/superpowers/specs/2026-06-11-chapters-design.ko.md` (V14 마이그레이션 정정 반영) · 계획 `docs/plan/04-web-launch-v1-plan.md §Round 2.5`

## Summary

작품(project) 1 : 본문(document) 1 인 현 구조를 **작품 1 : 챕터 N** 으로 확장한다. 신규 테이블 없이 기존 `documents` 테이블을 재사용 — `project_id` UNIQUE 제약을 제거하고 `sort_order`·`deleted_at` 두 컬럼을 추가한다(V14). 기존 본문은 `sort_order=0` 1번 챕터로 무손실 편입된다. 백엔드는 챕터 목록/생성/순서/삭제(soft-delete)/복구 5개 endpoint 와 대시보드 카드 합산 집계를 제공하고, 프론트는 A형·B형 집필실 좌측 패널에 챕터 목록·전환 UI 를, 016 문서 id 단위 자동저장 세션을 그대로 재사용해 챕터별 격리 자동저장을 얹는다.

## Technical Context

**Language/Version**: Kotlin 2.2 (backend) / TypeScript 5.9 + React 19.2 (frontend)

**Primary Dependencies**: Spring Boot 4.0.6 (Web + Security + Data JPA + Validation), Flyway / Next.js 16.2.6 App Router, TipTap, React Query, Zustand

**Storage**: PostgreSQL (로컬 dev DB — Supabase 운영 적용은 Round 4 D1 일괄). 기존 `documents` 테이블 1:N 확장(V14)

**Testing**: JUnit 5 + AssertJ + MockK + Spring Boot Test (backend) / Vitest + RTL + msw (frontend)

**Target Platform**: 웹 (Vercel 프론트 + Render 백엔드, 본 라운드는 로컬 dev)

**Project Type**: web application (frontend + backend 모노레포)

**Performance Goals**: 대시보드 카드 집계 N+1 금지(작품 수 무관 고정 쿼리 수). 챕터 목록 조회 본문 제외(메타만) 전송량 절약

**Constraints**: 한국어 IME 조합 중 챕터 전환 무유실(016 회귀 영역). 활성 챕터 최소 1개 불변식. 챕터는 자기 작품에만 속함(다대다 금지)

**Scale/Scope**: BE 5 endpoint + 카드 집계 재설계 + V14 마이그레이션 + 엔티티 확장 / FE A형·B형 집필실 양쪽 챕터 목록·전환·삭제. 추정 5~7.5 dev-day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 템플릿 미작성 상태 → **프로젝트 룰(`.claude/rules/`) + CLAUDE.md HARD-GATE 를 게이트로 대체**한다.

| 게이트 | 출처 | 본 기능 적용 |
|---|---|---|
| TDD Red-Green-Refactor | CLAUDE.md §5 | BE 챕터 동작·집계, FE 전환·삭제 모두 실패 테스트 선행 |
| Mock 경계(시스템 경계만) | CLAUDE.md §5-2 | 내부 collaborator mock 금지. msw(HTTP)·시계만 |
| 외부 DB 쓰기 컨펌 | `external-infra-safety.md` | V14 **작성·리뷰 OK / 적용(flywayMigrate)은 사용자 컨펌**. 로컬 dev DB 한정 |
| 409 분기 = error.code 기준 | `typescript/code-quality.md` HARD-GATE | `LAST_CHAPTER_UNDELETABLE` 를 status 단독 분기 금지, `error.code` 로 |
| Kotlin annotation 배열 인자 | `kotlin/code-quality.md` | `@Transactional(rollbackFor = [Exception::class])` 배열 brackets |
| RSC 경계(`'use client'`) | `typescript/code-quality.md` HARD-GATE | 챕터 목록·삭제 버튼(onClick) 컴포넌트 client 의무, 작성 직후 `pnpm build` |
| 한국어 IME 검증 cadence | `typescript/code-quality.md` | 챕터 전환 = 에디터 재마운트 경로 신설 → PoC 0-1 4케이스 재사용 |
| 마이그레이션 버전 정합 | 본 plan | V14 (현 최신 V13 실측 확인). 설계의 V9 표기는 정정 완료 |

**게이트 위반 없음** — 신규 추상화/4번째 프로젝트/우회 mock 없음. Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/022-chapters/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정/근거/대안
├── data-model.md        # Phase 1 — V14 마이그레이션 + Document 엔티티 확장
├── quickstart.md        # Phase 1 — 로컬 검증 절차
├── contracts/           # Phase 1 — 챕터 5 endpoint + 카드 집계 변경 계약
│   └── chapters-api.md
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트(완료)
└── tasks.md             # Phase 2 (/speckit-tasks — 본 명령 미생성)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/
│   └── Document.kt                      # [수정] project_id unique 제거 + sortOrder/deletedAt 추가
├── repository/
│   └── DocumentRepository.kt            # [수정] 단수 findByProjectId → 목록/활성필터/정렬 메서드
├── service/
│   ├── DocumentService.kt               # [수정] 목록/생성/순서/삭제/복구 + 마지막챕터 가드
│   └── ProjectService.kt                # [수정] listCards 챕터 합산 집계
├── controller/
│   └── DocumentController.kt            # [수정] 기존 4 endpoint 파일(실측) — 단수 getDocumentByProject 제거 + 목록/생성/순서/삭제/복구 추가 + getDocumentById 삭제챕터 404. ProjectController 불변
├── components/documents/
│   └── ChapterReorderValidator.kt       # [신설] CharacterReorderValidator 패턴 복제
├── error/ErrorCode.kt                   # [수정] LAST_CHAPTER_UNDELETABLE 추가
└── (dto/response)                        # [수정] 챕터 목록 메타 DTO, ProjectCardResponse 불변

backend/src/main/resources/db/migration/
└── V14__documents_chapters.sql          # [신설] UNIQUE 해제 + sort_order + deleted_at + 인덱스

frontend/src/
├── app/projects/[id]/write/page.tsx     # [수정] A형 좌패널 2단(챕터목록+아웃라인) + ?chapter 전환
├── app/b/works/[id]/page.tsx            # [수정] B형 동일
├── components/editor/
│   ├── ChapterList.tsx                  # [신설] presentational 챕터 목록(A·B 공용)
│   └── StudioOutline.tsx                # [불변] 아웃라인
├── lib/electron-api/index.ts            # [수정] documents shim: list/create/reorder/remove/restore/get
├── lib/api/client.ts                    # [수정] LAST_CHAPTER_UNDELETABLE error.code 분기
├── lib/query/useDocument.ts             # [수정] useProjectChapters + useChapterDocument
├── hooks/useDocumentSession.ts          # [불변] 문서 id 단위 세션 재사용
└── lib/draftStore.ts                    # [불변] wn:draft:doc:{documentId} 키
```

**Structure Decision**: Option 2 (web application). 모노레포 `backend/`(Kotlin/Spring) + `frontend/`(Next.js). 신규 테이블·신규 도메인 없이 기존 Document 도메인을 확장하므로 디렉토리 구조 변경 없음 — 기존 파일 surgical 수정 + 신규 ChapterReorderValidator·ChapterList 2개만 추가.

## Complexity Tracking

> 게이트 위반 없음 — 비움.
