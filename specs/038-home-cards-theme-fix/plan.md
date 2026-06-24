# Implementation Plan: 홈 작품 카드 개선 + 마이페이지 테마 토글(다크모드) 지원

**Branch**: `worktree-038-home-cards-theme-toggle` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/038-home-cards-theme-fix/spec.md`

## Summary

서로 독립적인 두 사용성 개선.

- **US1 (P1) 홈 작품 카드 개선**: 메인 홈(`/`)에서 "이어서 쓰기" 제외 작품 카드를 최대 2개로 제한 + 초과 시 "더 보기" → 작품 보관함(`/library`). 각 카드에 시리즈명·최종 수정일을 추가하고, 호버 시 생성일·총 집필 시간을 표시한다. 데이터는 대부분 이미 응답에 존재하며(`lastSentenceSource`·`docUpdatedAt`·`createdAt`·`totalDurationMs`), **시리즈명(`categoryName`)만 백엔드 additive 보강**이 필요하다.
- **US2 (P2) 새 디자인 다크모드 지원**: 테마 토글 메커니즘(`useThemeEffect` → `:root.dark` 토글, `tokens.css :root.dark` 다크 변수)은 정상이나, 새 디자인(B 디자인: 홈·마이페이지 등)이 **고정 Tailwind 색상**(`bg-white`·`text-gray-*`)을 써서 `.dark` 토글에 반응하지 않는다. 새 디자인 전체를 다크 대응으로 전환한다. **다크 팔레트·계조를 목업으로 먼저 확정(게이트)** 후 구현한다.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router) — 프론트. Kotlin 2.2 / Spring Boot 4.0.6 — 백엔드(US1 시리즈명 보강만).

**Primary Dependencies**: React Query(서버 상태), Zustand(로컬 UI·`usePreferences`), Tailwind CSS 4(`@theme inline` 토큰), 자체 디자인 토큰(`src/styles/tokens.css`).

**Storage**: PostgreSQL(US1 시리즈명은 기존 `categories` 테이블 조회, 마이그레이션 0). 테마는 기존 `user_settings`(변경 0).

**Testing**: Vitest + RTL(프론트), JUnit5 + AssertJ + Testcontainers(백엔드). 시각/렌더 정합은 dogfooding 게이트(테스트로 미보장 — CLAUDE.md §14).

**Target Platform**: 웹(데스크톱 우선, 호버 인터랙션). Vercel(FE) + OCI(BE).

**Project Type**: web (frontend + backend).

**Performance Goals**: 홈 카드 호버 정보 1초 이내 표시(SC-003), 테마 전환 1초 이내(SC-004). 신규 조회 경로 0(US1 데이터 재사용).

**Constraints**: additive only — 신규 마이그레이션 0, 신규 에러코드 0, 기존 응답·정렬 기준 불변. US2는 텍스트/데이터 무손실(색상만 변경).

**Scale/Scope**: 베타 규모(작품 소수). US1 = 카드 컴포넌트 + 백엔드 1필드. US2 = 새 디자인 전 화면 색상 전환(고정 gray 계열 ~270곳, 목업 선행).

## Constitution Check

`.specify/memory/constitution.md`는 빈 템플릿이므로 **프로젝트 CLAUDE.md 룰을 헌법으로 준용**(기존 spec들과 동일 정책).

| 게이트 | 적용 | 상태 |
|---|---|---|
| 추측 금지(HARD-GATE) | US2 근본원인을 코드로 규명(고정 Tailwind 색상). 다크 팔레트는 목업으로 확정 후 진행 | ✅ 통과 — 추측 영역 없음 |
| TDD(테스트 있는 작업) | US1 백엔드 시리즈명 매핑·카드 정렬/slice·"더 보기" 조건 = 단위 테스트 선행. US2 색상은 시각 → dogfooding | ✅ 적용 |
| Surgical changes | US1은 카드 컴포넌트·DTO 1필드. US2는 색상 클래스 치환에 한정(로직·구조 불변) | ✅ |
| 생성물 테스트 한계(§14) | US2 다크는 단위테스트로 시각 미보장 → 목업+dogfooding 게이트 명시 | ✅ |
| 배포 순서 방향 의존 | US1 = BE 선행(categoryName)→FE. US2 = FE 단독(BE 0) | ✅ |
| additive 안전 | 신규 마이그레이션·에러코드 0, 응답 additive | ✅ |

위반 없음 → Phase 0 진행.

## Project Structure

### Documentation (this feature)

```text
specs/038-home-cards-theme-fix/
├── plan.md              # 본 파일
├── spec.md              # 명세(확정)
├── research.md          # Phase 0 — US2 다크 전환 접근, US1 데이터 재사용 결정
├── data-model.md        # Phase 1 — ProjectCard categoryName 보강, 테마 변경 없음
├── contracts/           # Phase 1 — 카드 응답 categoryName additive 계약
│   └── project-cards.md
├── quickstart.md        # Phase 1 — 검증 절차(US1 카드/US2 목업·다크 dogfooding)
└── checklists/
    └── requirements.md  # spec 품질 체크(통과)
```

### Source Code (영향 파일 — 실제 경로)

```text
backend/src/main/kotlin/com/writenote/
├── model/response/ProjectCardResponse.kt     # categoryName 필드 additive 추가
└── service/ProjectService.kt                 # listCards(): categoryId→name 매핑(N+1 회피 일괄 조회)
backend/src/test/kotlin/com/writenote/
└── service/ProjectServiceTest(또는 IT)        # 시리즈명 매핑·미분류 null 테스트

frontend/src/
├── lib/types/domain.ts                        # ProjectCard.categoryName 추가
├── lib/dashboardView.ts                       # selectDashboard: others 전체 유지 + 표시 2개 slice 정보
├── app/(main)/page.tsx                        # others 2개 표시 + "더 보기"(>2) → /library
├── components/b/dashboard/BWorkMiniCard.tsx   # 시리즈명·최종 수정일·호버(생성일·총집필시간) 추가
├── components/b/dashboard/BResumeCard.tsx     # (필요 시) 일관 정보 표시
└── (US2) 새 디자인 색상 전환 대상:
    ├── styles/tokens.css                      # 다크 중간 계조(gray 대응) 토큰 보강(목업 확정 후)
    ├── app/globals.css                        # @theme 의미색 토큰 확장(필요 시)
    └── components/b/**, components/mypage/**   # 고정 gray/white → 의미색 토큰 또는 dark: variant 치환
docs/research/
└── 2026-06-24-bdesign-dark-mockup.html        # US2 다크 팔레트·계조 목업(게이트)
```

**Structure Decision**: 웹(frontend+backend) 기존 구조 유지. US1은 백엔드 1필드 + 프론트 카드 컴포넌트. US2는 프론트 단독(색상 토큰·컴포넌트 치환), 목업으로 디자인 확정 후 착수.

## Phasing & 배포 순서

- **US1 R1 (BE 선행)**: `ProjectCardResponse.categoryName` 추가 + `ProjectService.listCards()` 시리즈명 일괄 매핑 + 테스트 GREEN. (FE가 없어도 기존 응답 호환 — additive)
- **US1 R2 (FE 후행)**: `ProjectCard` 타입·카드 컴포넌트(시리즈명/최종 수정일/호버) + 2개 제한 + "더 보기". categoryName 없으면 "미분류" fallback.
- **US2 M1 (목업 게이트)**: 새 디자인 다크 목업(`docs/research/...html`) → 사용자 확인. **승인 전 구현 착수 금지.**
- **US2 M2 (FE 단독 구현)**: 목업 확정 팔레트로 tokens.css 다크 계조 보강 + 새 디자인 색상 치환 → dogfooding(라이트/다크 양쪽 + 한국어 본문, CLAUDE.md 한국어 검증 cadence).

US1과 US2는 독립 — 병렬 가능하나, US2는 목업 게이트가 선행 의존.

## Complexity Tracking

위반 없음 — 비움.
