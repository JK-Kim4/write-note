# Implementation Plan: 공지사항 고정 슬롯 + 최신 슬롯

**Branch**: `049-announcement-pinned-latest` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/049-announcement-pinned-latest/spec.md`

## Summary

홈(메인) 상단 공지 영역을 **고정 슬롯 1건 + 최신 슬롯 1건** 두 개로 구분 노출한다. 핵심 재구성: 공지 도메인(030 운영 툴)에 `isPinned`(고정)·`publishedAt`(공개일) 필드와 고정 우선 쿼리가 **이미 존재**하나 메인 화면에 배선된 적이 없어 — 지금은 고정을 켜도 메인에 아무 효과가 없다. 따라서 **스키마·마이그레이션·신규 에러코드 0**.

기술 접근:
- **BE(선행)**: 두 슬롯 선택·중복 방지(dedup)를 전부 서버측에서 처리하는 전용 공개 조회 `GET /api/announcements/home` → `{ pinned, latest }` 신규. 기존 요약 DTO/목록 endpoint 무변경(additive). 요약 응답에 `isPinned` 를 **붙이지 않는다**(두 슬롯을 이름으로 구분해 내려주므로 프론트가 고정 여부 플래그로 pick 할 필요 없음).
- **FE(후행)**: 홈 배너 컴포넌트를 고정+최신 두 배너로 재구성 + 색을 기존 teal(파랑) → 브랜드 테라코타(붉은)로 정합(FR-011). 시각 SoT = 승인된 목업.

배포 순서 = **BE 선행 → FE 후행**(FE 가 신규 `/home` 을 호출하므로 BE 가 먼저 나가야 함; 반대면 404).

## Technical Context

**Language/Version**: Kotlin 2.2 / Spring Boot 4.0.6 on Java 24 (BE) · TypeScript 5.9 / Next.js 16 (App Router) / React 19 (FE)

**Primary Dependencies**: Spring Web·Data JPA (BE, 기존) · React Query·Zustand (FE, 기존). 신규 의존성 0.

**Storage**: PostgreSQL — 기존 `announcements` 테이블 재사용. **마이그레이션 없음**(필드 `is_pinned`·`published_at`·`is_published`·`created_at` 모두 존재).

**Testing**: JUnit5 + Spring Boot Test(MockMvc) — `AnnouncementControllerIT` 패턴 재사용(BE). Vitest + RTL(FE). 시각(색·라이트/다크·한글)은 dogfooding 게이트(rule 14).

**Target Platform**: 웹(Vercel FE + OCI BE). 데스크톱 앱 폐기 → electron 미러 없음(web 전용).

**Project Type**: web (frontend + backend)

**Performance Goals**: 홈 진입 시 공지 노출 지체 없음(체감 1초 이내, SC-004). 단일 조회로 N+1 회피(고정 pick 1쿼리 + top-2 공개 1쿼리 = 상수 쿼리).

**Constraints**: additive-only(구 프론트/구 API 무손상). 신규 에러코드 0. SecurityConfig 변경 0(실측: 라인 78 `GET /api/announcements`,`/api/announcements/*` permitAll 이 `/home` 커버).

**Scale/Scope**: 공지 수십~수백 건 규모. 변경 파일 ≈ BE 4~5(repo·service·DTO·controller·IT) + FE 3~4(api·hook·banner·test).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 빈 템플릿 → 프로젝트 관행대로 **CLAUDE.md 룰을 게이트로 준용**한다.

| 룰 | 판정 |
|---|---|
| 절대 추측 금지 (HARD-GATE) | PASS — 엔티티·컨트롤러·서비스·repo·SecurityConfig·IT·FE 배너를 실측 후 설계. 미확인 없음. |
| Simplicity / Surgical | PASS — 전용 endpoint 1개 + repo 메서드 1개. 요약 DTO·목록 endpoint·어드민·스키마 무변경. |
| TDD (§5) | PASS — BE 두 슬롯 pick/dedup 은 행위 → IT(MockMvc)로 Red-Green(both/고정만/최신만/없음/dedup/다중고정/미공개제외). FE 배너 render 는 vitest(행위), 시각은 dogfooding. |
| external-infra-safety | PASS — 쓰기 0(신규 read 쿼리만). 마이그레이션 0. 로컬 DB 쓰기·`.env` Read 없음. |
| 배포 순서(방향 의존) | PASS — BE 가 신규 계약(`/home`) 제공, FE 가 소비 → BE 선행→FE 후행 명시. |
| 신규 에러코드/보안 경로 | PASS — 신규 에러코드 0. `/home` 은 기존 permitAll 커버(SecurityConfig 무변경). |

위반 없음 → Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/049-announcement-pinned-latest/
├── plan.md              # 본 파일
├── spec.md              # 확정 스펙 (FR-001~011)
├── research.md          # Phase 0 — endpoint 형태 결정·대안 기각
├── data-model.md        # Phase 1 — 기존 엔티티 재사용 + 파생(read model) 로직
├── contracts/
│   └── announcements-home.md   # GET /api/announcements/home 계약
├── quickstart.md        # Phase 1 — 검증 절차(게이트 + dogfooding 체크리스트)
└── checklists/requirements.md  # spec 품질 체크리스트(작성됨)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── repository/AnnouncementRepository.kt        # + findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc()
├── service/AnnouncementService.kt              # + getHome(): HomeAnnouncementsResponse
├── model/response/AnnouncementResponse.kt      # + HomeAnnouncementsResponse(pinned?, latest?)
└── controller/AnnouncementController.kt        # + GET /home
backend/src/test/kotlin/com/writenote/controller/
└── AnnouncementControllerIT.kt                 # + /home 시나리오 테스트

frontend/src/
├── lib/api/announcements.ts                    # + getHomeAnnouncements(): {pinned, latest}
├── lib/query/useAnnouncements.ts               # + useHomeAnnouncements() (useLatestAnnouncement 는 배너 교체 후 미사용 → 내 변경이 만든 orphan 제거)
├── components/AnnouncementBanner.tsx           # 재구성: 고정+최신 두 배너, 테라코타 색, 세로 적층
└── components/AnnouncementBanner.test.tsx      # 신규(또는 기존 옆) — render 행위 테스트
```

**Structure Decision**: 기존 web 구조(backend/ + frontend/) 그대로. 신규 라우트·NAV 항목·페이지 없음(홈 배너 내부 재구성). `docs/research/2026-07-01-announcement-pinned-latest-mockup.html` = 시각 SoT.

## 설계 결정 (핵심)

### D1. 두 슬롯 노출 = 전용 조회 `GET /api/announcements/home` (FR-010 해소)

`{ pinned: Summary?, latest: Summary? }` 반환. 서버가 pick + dedup 을 전담:
- `pinned` = 공개+고정 중 공개일 최신 1건(없으면 null).
- `latest` = 공개 중 공개일 최신, 단 `pinned` 와 동일 id 면 그다음 공개 1건(없으면 null).

**대안 기각**: 요약 DTO 에 `isPinned` 추가 후 프론트가 top-N 목록에서 pick — 기각. 고정 공지는 "항상 고정"이라 **공개일이 오래돼 top-N 밖일 수 있어** 목록 fetch 로는 고정을 신뢰성 있게 못 집는다(중대 결함). 서버측 전용 조회가 정본. (research.md 상세)

### D2. dedup·"최신" 기준

- 중복 방지는 D1 서버측. FE 는 받은 두 값 렌더만.
- "최신" = 공개일(`publishedAt`) 내림차순(spec Assumptions — 사용자 "등록순" 표현이나 공개일 해석, 목록 정렬과 정합).

### D3. 시각(FR-005/011) = dogfooding 확정 (2026-07-01)

최신 = 기존 운영 **teal pill 유지**(색 무변경) / 고정 = **앰버(amber)** 채운 카드 + 좌측 금빛 바 + 채운 「고정」 배지 + 진한 제목. 최신(청록)과 고정(앰버)이 다른 색상이라 한눈에 갈림. 두 슬롯 다 **고정 밝은 배경 + 고정 어두운 텍스트(teal-800/amber-900)**로 라이트·다크 가독(Tailwind 고정 shade, 테마 무관). 시각 검증 = dogfooding(완료).

### 기존 dead code

`AnnouncementRepository.findFirstByIsPublishedTrueOrderByIsPinnedDescPublishedAtDesc()` 는 미사용(단일 배너 고정 우선 설계 잔재)이며 본 기능으로 **명백히 대체**된다. surgical 원칙상 삭제는 사용자 컨펌 영역 — 기본은 잔존, 제거 원하면 R1 에 포함. (research.md 기록)

## Phase 0 / 1 산출물

- **Phase 0**: [research.md](./research.md) — endpoint 형태·dedup·색상 정합 결정과 기각 대안.
- **Phase 1**: [data-model.md](./data-model.md)(기존 엔티티 + 파생 read model), [contracts/announcements-home.md](./contracts/announcements-home.md)(조회 계약), [quickstart.md](./quickstart.md)(검증 절차).

## 구현 라운드 (Phase 2 = /speckit-tasks 에서 분해)

- **R1 BE(선행)**: repo 메서드 + `getHome()` + `HomeAnnouncementsResponse` + `GET /home` + IT. 게이트: `ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`.
- **R2 FE(후행)**: `getHomeAnnouncements` + `useHomeAnnouncements` + `AnnouncementBanner` 재구성(테라코타·고정/최신) + vitest. 게이트: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Dogfooding: 목업 상태 전항(둘다/고정만/최신만/없음) + 라이트/다크 + 한글 + 클릭→상세.

## Complexity Tracking

위반 없음 — 비움.
