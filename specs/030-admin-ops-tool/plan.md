# Implementation Plan: 운영 툴 (Admin Ops Tool) v1

**Branch**: `030-admin-ops-tool` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/030-admin-ops-tool/spec.md` + 설계 문서 `docs/superpowers/specs/2026-06-21-admin-ops-tool-design.md`

## Summary

솔로 운영자용 경량 운영 툴. 신규 `Announcement` 엔티티 1개를 추가해 (a) 공개 GET 으로 사용자 앱(홈 배너 + `/notice`)에 노출하고, (b) 별도 Next.js 어드민 앱에서 공지 CRUD·회원 조회·사용 현황 통계를 제공한다. 회원·통계는 기존 `User`/`WorkSession`/`Project` 데이터를 읽기 전용으로 집계한다. 관리자 인증은 기존 JWT 를 재사용하되 `/api/admin/**` 경로에 **`principal.email == ADMIN_EMAIL`(환경변수)** 를 검사하는 커스텀 AuthorizationManager 로 단일 관리자만 통과시킨다(User 스키마 변경 없음).

## Technical Context

**Language/Version**: Backend = Kotlin 2.2 / Spring Boot 4.0.6 on Java 24 toolchain. Frontend(본 앱 + 어드민 앱) = TypeScript 5.9 / Next.js 16.2.6 (App Router) / React 19.2

**Primary Dependencies**: Spring Web/Security/Data JPA/Validation, Flyway, PostgreSQL. Frontend = React Query, (어드민) shadcn/ui + recharts(차트)

**Storage**: PostgreSQL — 신규 테이블 `announcements` 1개(Flyway V16). 회원·통계는 기존 `users`/`work_sessions`/`projects` 조회

**Testing**: Backend = JUnit5 + AssertJ + MockK(단위), Spring Boot Test + Testcontainers(통합). Frontend = Vitest + RTL

**Target Platform**: 웹. 본 앱 = Vercel(기존 write-note 프로젝트). 어드민 앱 = 신규 Vercel 프로젝트. 백엔드 = OCI Docker

**Project Type**: web — 백엔드 1 + 프론트 2(사용자 앱 `frontend/`, 어드민 앱 `admin-site/`)

**Performance Goals**: 운영자 본인 트래픽 수준(동시 사용자 1). 통계 집계 쿼리는 회원 수 ~수천 규모에서 즉시 응답

**Constraints**: 회원 응답에 비밀번호 등 비밀값 절대 미포함(FR-010). `/api/admin/**` 는 단일 관리자만(FR-015/016). 공개 GET `/api/announcements` 는 비인증 허용

**Scale/Scope**: 신규 엔티티 1, 공개 endpoint 2, 어드민 endpoint ~7, 어드민 화면 4, 본 앱 추가 면 2(배너 + `/notice`) + 문의 링크 1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `.specify/memory/constitution.md` **부재** — 정식 constitution 게이트 없음. 대신 프로젝트 룰(CLAUDE.md + `.claude/rules/*`)을 게이트로 적용:
  - **TDD(글로벌 §5)**: 백엔드 매핑·인가·집계는 Red→Green. 엔티티/마이그레이션/DTO/설정은 §5-5 완화.
  - **Mock 경계(Classist)**: 내부 collaborator mock 금지 — DB 는 Testcontainers 통합으로 검증.
  - **보안(external-infra-safety)**: 로컬/IT DB 만 적용, prod 마이그레이션 컨펌. 비밀값 미노출.
  - **RSC 경계**: 어드민 폼/훅 컴포넌트 `'use client'` + 작성 직후 `pnpm build`.
  - **fetch status 분기 error.code 기준**(typescript/code-quality).
- ✅ 위반 없음(아래 Complexity Tracking 비움). 단, **모노레포 두 번째 Next.js 앱 추가**는 의도된 구조 확장(설계 A안)으로 정당함 — research.md §4 참조.

## Project Structure

### Documentation (this feature)

```text
specs/030-admin-ops-tool/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정·근거(관리자 인증/어드민 앱 형태/집계 쿼리/차트)
├── data-model.md        # Phase 1 — Announcement 엔티티 + V16 마이그레이션 + 회원/통계 조회 모델
├── quickstart.md        # Phase 1 — 로컬 구동·검증 절차
├── contracts/           # Phase 1 — API 계약(공개 2 + 어드민 7)
│   ├── public-announcements.md
│   ├── admin-announcements.md
│   ├── admin-users.md
│   └── admin-stats.md
└── checklists/requirements.md   # spec 품질 체크리스트(완료)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/Announcement.kt                # 신규 — Character.kt 패턴
├── repository/AnnouncementRepository.kt  # 신규 — JpaRepository + 메서드명 쿼리
├── service/
│   ├── AnnouncementService.kt            # 신규 — 공지 CRUD(+공개 조회)
│   └── AdminStatsService.kt              # 신규 — 회원/통계 집계(읽기 전용)
├── controller/
│   ├── AnnouncementController.kt         # 신규 — 공개 GET 2개
│   ├── admin/AdminAnnouncementController.kt  # 신규 — CRUD
│   ├── admin/AdminUserController.kt          # 신규 — 회원 조회 2개
│   └── admin/AdminStatsController.kt         # 신규 — 통계 2개
├── dto/  (또는 각 controller 인접)        # Request/Response DTO
└── config/
    ├── SecurityConfig.kt                 # 수정 — 공개 GET permitAll + /api/admin/** access(adminOnly)
    └── AdminAuthorizationManager.kt      # 신규 — principal.email == ADMIN_EMAIL 검사

backend/src/main/resources/
├── db/migration/V16__create_announcements.sql   # 신규
└── application.yml + application-local/prod.yml  # 수정 — app.admin.email 키

frontend/src/                              # 사용자 앱(기존)
├── app/(main)/page.tsx                    # 수정 — 홈 상단 공지 배너 삽입
├── app/(main)/notice/page.tsx            # 신규 — 공지 목록
├── app/(main)/notice/[id]/page.tsx       # 신규 — 공지 상세
├── components/AnnouncementBanner.tsx     # 신규(client)
├── lib/api/announcements.ts              # 신규 — apiFetch 래퍼
├── lib/query/useAnnouncements.ts         # 신규 — React Query 훅
└── app/(main)/layout.tsx (또는 footer)    # 수정 — "문의하기" 외부 링크

admin-site/                                # 신규 — 별도 Next.js 앱(별도 Vercel 프로젝트)
├── package.json / next.config.ts / tsconfig.json
├── src/app/login/page.tsx                # 관리자 로그인
├── src/app/(admin)/dashboard/page.tsx    # 통계
├── src/app/(admin)/announcements/...     # 공지 관리(목록+폼)
├── src/app/(admin)/users/...             # 회원 조회(목록+상세)
└── src/lib/api/client.ts                 # frontend/ client.ts 패턴 재사용(X-WriteNote-Client)
```

**Structure Decision**: 기존 `backend/` + `frontend/`(사용자 앱)에 더해 **`admin-site/`(어드민 앱)** 를 모노레포에 신설. 어드민 앱은 `download-site/`(정적 HTML, 빌드 없음)와 달리 **완전한 Next.js 앱**(빌드 필요)이며, Vercel 에서 Root Directory=`admin-site` 인 별도 프로젝트로 배포(설계 A안). 백엔드는 단일 모듈에 `controller/admin/` 하위 패키지로 어드민 컨트롤러 격리.

## 구현 단계 (User Story 우선순위 정합)

> 각 단계는 독립 배포 가능. 배포 순서는 단계 내에서 **BE 선행 → FE 후행**.

- **Phase A (US1, P1) — 공지**: 백엔드(Announcement 엔티티+V16+공개 GET 2+어드민 CRUD+admin 가드) → 사용자 앱(홈 배너 + `/notice` 목록·상세) + 어드민 앱(로그인 + 공지 관리 화면) + "문의하기" 링크(US4 동시). **이 단계만으로 운영 툴 MVP 성립.**
- **Phase B (US2, P2) — 회원 조회**: 백엔드(`/api/admin/users` 목록·검색·상세, 비밀값 제외 DTO) → 어드민 앱 회원 화면.
- **Phase C (US3, P3) — 통계**: 백엔드(`/api/admin/stats/summary`·`signups`) → 어드민 앱 대시보드(카운트 카드 + 30일 추이 차트).

어드민 앱 Vercel 프로젝트 최초 설정은 Phase A 에서 1회 수행(이후 git push 자동배포).

## Complexity Tracking

> 위반 없음 — 비움.
