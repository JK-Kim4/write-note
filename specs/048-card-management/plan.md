# Implementation Plan: 카드 관리 (Card Management)

**Branch**: `048-card-management` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/048-card-management/spec.md`

## Summary

기존 보드 카드(`cards`) 도메인을 확장해, 여러 보드를 가로지르는 **카드 관리 화면**(목록·상세·수정·삭제)과 **보드 없는 독립 카드**(생성·보드 재배정)를 추가한다.

기술 접근(research.md 상세):
- **데이터 모델**: `cards.board_id` 를 nullable 로 바꾸고, 모든 카드에 `cards.user_id`(NOT NULL, `boards.user_id` 에서 백필)를 추가한다(V30, additive/in-place). 소유를 보드 경유가 아닌 카드 단위로 판별 → 독립 카드 성립. "숨은 인박스 보드" 대안은 기각(research §D1).
- **API**: 신규 `CardController` `/api/cards`(유저 스코프 소유 = `card.user_id`) — 목록(cross-board, `boardName`·`linkCount` 동봉·N+1 회피)·생성(독립)·상세·수정·삭제·보드 재배정. 기존 `/api/boards/{boardId}/cards/*`(보드 캔버스)는 **무변경**(additive). 신규 에러코드 0(기존 재사용).
- **배포순서**: BE 선행 → FE 후행(신규 조회/생성 계약을 FE 가 소비).

## Technical Context

**Language/Version**: Kotlin 2.2 (백엔드, Java 24 toolchain) / TypeScript 5.9 + React 19.2 (프론트, Next.js 16 App Router)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation), Flyway / React Query + Zustand, `@xyflow/react`(보드 캔버스, 본 기능은 목록 UI 라 직접 의존 낮음)

**Storage**: PostgreSQL (기존 `cards`/`boards`/`links` 테이블 확장 — V30 마이그레이션)

**Testing**: JUnit 5 + AssertJ + MockK + Testcontainers (BE) / Vitest + RTL (FE)

**Target Platform**: 웹 앱(FE=Vercel, BE=OCI Compute Docker)

**Project Type**: Web application (backend + frontend 분리)

**Performance Goals**: 카드 목록·집계는 N+1 회피(그룹 조회 projection). 솔로 작가 규모라 카드 수 수백 단위 가정(전체 로드, 페이징 미도입 — research §D5).

**Constraints**: 기존 인증·소유 격리(JWT principal.userId) 재사용. 추가 at-rest 암호화 없음(카드 본문은 034 대상 아님 — 보드 카드 현행과 동일 평문). additive 마이그레이션(구 프론트 무손상).

**Scale/Scope**: 신규 BE 파일 소수(CardController/CardService/CardRepository 확장 + 마이그레이션 1) + FE 신규 라우트 `/cards` + 데이터 계층. 5개 User Story(P1 목록 → P4 재배정).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 빈 템플릿이므로(038~047 선례) **효력 게이트 = 프로젝트 `CLAUDE.md` + `.claude/rules/`** 를 준용한다. 관련 게이트:

| 게이트 | 적용 | 상태 |
|---|---|---|
| 추측 금지(금지 1) | 데이터 모델·API·마이그레이션 버전·DTO 를 코드 실측으로 확정(V30, CardController 시그니처, ALLOWED_CARD_TYPES) | PASS |
| 외부 인프라 안전(external-infra-safety) | 마이그레이션 SQL 작성만, 로컬/운영 적용은 컨펌. 운영 Flyway 상태는 배포 전 확인(rule 22) | PASS(적용 보류) |
| 공용 fetch status 분기(code-quality) | 신규 에러코드 0 — 기존 400(BOARD_OWNER_INVALID·ValidationException)·404 재사용. FE `error.code` 분기 신규 status 없음 | PASS |
| 서버 cascade 중복 삭제 금지 | 카드 삭제 시 링크는 DB cascade — FE 가 링크 중복 삭제 안 함(기존 044/046 선례 준용) | PASS |
| TDD(§5) | BE 매핑·검증·재배정 가드·소유격리는 유닛/IT 로 TDD. 마이그레이션·DTO 는 §5-5 예외 | 계획 반영 |
| 표시값 출처 명시(rule 9) | `boardName`·`linkCount` 의 조회 경로를 data-model/contracts 에 명시 | PASS |
| UI/UX 목업 우선(rule 29) | 진입점·목록·상세·생성·재배정·삭제 UI 를 인터랙티브 목업으로 확정 | 충족(2026-07-01 목업 승인) |
| dogfooding 게이트(rule 14/25) | 시각·상호작용은 단위테스트 미보장 → quickstart 전항 사용자 확인 후 통과 단정 | 반영 |
| 배포순서 방향의존 | BE(신규 계약) 선행 → FE 후행 | 반영 |

**위반 없음** — Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/048-card-management/
├── plan.md              # 본 파일
├── spec.md              # 기능 명세(+ 2건 clarify 반영)
├── research.md          # Phase 0 — 데이터 모델·API·에러·N+1 결정
├── data-model.md        # Phase 1 — 엔티티/마이그레이션/DTO
├── contracts/
│   └── cards-api.md     # Phase 1 — /api/cards 계약
├── quickstart.md        # Phase 1 — 검증·dogfooding 체크리스트
└── checklists/
    └── requirements.md  # /speckit-specify 산출(품질 체크)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/Card.kt                      # 확장: userId 추가, boardId nullable
├── repository/CardRepository.kt        # 확장: findByIdAndUserId, findByUserId..., 링크 카운트 projection
├── repository/LinkRepository.kt        # 확장: 카드별 이웃 카운트 grouped projection
├── controller/CardController.kt        # 신규: /api/cards (목록·생성·상세·수정·삭제·재배정)
├── service/CardService.kt              # 신규: 카드 관리 유스케이스(유저 스코프)
├── service/BoardService.kt             # 수정: createCard 가 userId 채움(NOT NULL)
├── service/CardTypes.kt (또는 공유)     # normalizeCardType/ALLOWED 공유(매퍼 중복 회피)
├── model/request/CardRequests.kt       # 신규: CreateCard/UpdateCard/SetCardBoard
└── model/response/CardResponses.kt     # 신규: CardListItem/CardDetail(boardName·linkCount)
backend/src/main/resources/db/migration/
└── V30__add_card_user_and_nullable_board.sql  # 신규

frontend/src/
├── app/(main)/boards/page.tsx          # 수정: 상단 탭 바 [보드 | 카드] + 카드 관리 뷰 마운트(?tab= 등, NAV 무변경)
├── lib/api/cards.ts                    # 신규: /api/cards 클라이언트
├── lib/query/useCards.ts               # 신규: React Query 훅(재배정/삭제 시 useBoardDetail·useBoardsMine invalidate)
├── lib/electron-api/cards.ts           # 신규: electron 미러(패턴 일치)
├── components/cards/*                   # 신규: 카드 그리드 타일·상세 슬라이드오버·독립 생성 폼·재배정·삭제 경고 UI
└── components/b/BoardReferencePanel.tsx # 수정(R4): 참조 패널에 [보드 | 카드] 토글 + 그 작품 카드+독립 카드 그리드
```

**Structure Decision**: 기존 web app(backend + frontend 분리) 구조에 additive. 백엔드는 신규 `CardController`(유저 스코프)로 분리하고 기존 `BoardController`(보드 스코프)는 건드리지 않는다. 프론트는 카드 관리 진입점을 **`/boards` 화면의 하위 탭**([보드 | 카드], 2026-07-01 목업 확정)으로 두어 최상위 NAV·신규 top-level 라우트를 추가하지 않는다. 데이터 계층(`lib/api/cards.ts`·`useCards`)은 `lib/api/boards.ts`·`useBoards` 패턴에 맞춰 신설한다.

## Phase 0: Outline & Research

`research.md` 로 산출(요약):
- **D1 데이터 모델**: board_id nullable + 전 카드 user_id(Option 1) 채택, 인박스 보드 기각.
- **D2 API 표면**: 신규 `/api/cards`(유저 스코프) vs 기존 보드 스코프 재사용 — 신규 채택.
- **D3 소유·마이그레이션 무결성**: user_id 를 모든 insert 경로가 채움(신규 + 기존 `BoardService.createCard`). NOT NULL 함정 방지.
- **D4 linkCount 의미**: 삭제 경고 = "N개 카드와 연결" = distinct 이웃 카드 수. 목록·상세에 동봉(재배정 가드 겸용).
- **D5 페이징/규모**: 솔로 작가 규모 → 전체 로드(페이징 미도입), 정렬 최근 수정순.
- **D6 에러코드**: 신규 0 — 400(BOARD_OWNER_INVALID·ValidationException)·404 재사용.
- **D7 빈 본문**: 백엔드 관대(default ''), "내용 필수"는 FE 생성폼 가드만.
- **D8 고아 메모 코드/라우트**: `/cards` 는 free. 고아 memo FE 파일은 본 기능 범위 밖(별도 정리 트랙 surfacing).

## Phase 1: Design & Contracts

- `data-model.md`: Card 엔티티 확장·V30 마이그레이션·CardListItem/CardDetail DTO·검증 규칙·상태 전이(독립↔보드).
- `contracts/cards-api.md`: `/api/cards` 6 엔드포인트 계약(요청/응답/에러/소유격리).
- `quickstart.md`: 게이트 + dogfooding 체크리스트(라운드별).
- Agent context(`CLAUDE.md` SPECKIT 마커): 본 plan 참조로 갱신.

### 구현 라운드(BE 선행 → FE 후행)

- **R1 BE (GREEN)**: V30 마이그레이션 + Card 엔티티/Repository 확장 + `CardService`/`CardController` + `BoardService.createCard` user_id 채움 + normalizeCardType 공유 + 유닛/IT(소유 격리·재배정 가드·linkCount·독립 카드 생성). 로컬/운영 DB 적용은 컨펌(Testcontainers 검증).
- **R2 FE 데이터 계층**: `lib/api/cards.ts` + `useCards`(목록/상세/생성/수정/삭제/재배정 훅) + electron 미러. 재배정/떼기 성공 시 해당 board `useBoardDetail` + `useBoardsMine` 캐시 invalidate.
- **R3 FE UI (목업 확정 반영 — `docs/research/2026-07-01-card-management-mockup.html`)**: `/boards` 하위 탭 [보드 | 카드] 진입(NAV 무변경). 카드 관리 = **그리드**(종류색 틴트 타일·소속 보드 라벨·연결 배지·최근순) + **우측 슬라이드오버 상세**(종류 변경·본문 수정·소속 보드 재배정·삭제) + 삭제 경고(linkCount "N개의 다른 카드와 연결") + 독립 생성 인라인 폼(본문 필수 FE 가드·IME 조합 가드) + 재배정(연결 있는 카드 잠금) + 빈 상태 오버레이(화면 컨텍스트 유지). dogfooding 게이트(rule 14/25).
- **R4 FE 집필 통합 (FE-only, 신규 BE 0)**: 집필 화면 `BoardReferencePanel` 에 [보드 | 카드] 토글 추가. "카드" 뷰 = `GET /api/cards`(R1, 전체) + `GET /boards/reference`(그 작품 보드 id) 를 FE 에서 필터(card.boardId ∈ 참조 보드 id 집합 또는 독립)해 그리드로 표시. 카드 열기 = R3 상세(슬라이드오버) 재사용. 참조 목적 중심. 집필 화면 참조 패널 [보드 | 카드] 토글 UI 는 목업 게이트(rule 29) 선행. dogfooding(집필 흐름·기존 보드 참조 무회귀).

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
