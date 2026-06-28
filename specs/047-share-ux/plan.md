# Implementation Plan: 공유 사용성 개선 (Share UX)

**Branch**: `047-share-ux` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-share-ux/spec.md`

## Summary

046 공유 기능의 진입점을 재배치하고(마이페이지 하위 → 헤더 최상위 + 작품/시리즈 화면 직접 생성), 받은 피드백에 읽음 관리를 더한다. **신규 백엔드 도메인은 없다** — 기존 046 `share_link`/`share_snapshot`/`share_comment`를 재사용하고, `share_comment`에 `read_at` 컬럼 1개만 추가(V29)한다. 1:N(작품/시리즈당 공유 링크 여러 개)은 기존 BE 모델 그대로 유지하고 진입점 UX만 1:N에 맞춘다.

기술 접근:
- **읽음·집계 단위 = 작품(projectId)**. 기존 작가 인박스가 projectId 단위(`ShareCommentService.listForAuthor` / `findByProjectIdInOrderByCreatedAtDesc`)라 정합. read_at은 댓글 행에 채우되 "피드백 보기를 열면 그 작품의 안 읽은 댓글 전체 읽음" 처리.
- **안 읽은 수 집계**: `listMine`이 스냅샷의 projectId들을 모아 `share_comment` group-by 일괄 집계(N+1 회피) → `SharedWorkMeta.unreadCommentCount`(additive).
- **읽음 처리 endpoint**: `POST /api/projects/{projectId}/comments/read`(소유 작가만, bulk update).
- FE: 헤더 nav 공유 칩 / `(main)/shares` 라우트 + `ShareLinkManager` 재구성 / 신규 `SharePopover`(작품·시리즈 공용) / `DraggableWorkCard`·`CategoryTile` 진입점 / `AuthorCommentInbox` 읽음 / `/mypage/shares→/shares` redirect + 마이페이지 공유 항목 제거.

## Technical Context

**Language/Version**: Kotlin 2.2 (Spring Boot 4.0.6, Java 24 toolchain) / TypeScript 5.9 (Next.js 16 App Router, React 19.2)

**Primary Dependencies**: Spring Web/Security/Data JPA/Validation, Flyway / React Query, Zustand, Tailwind 4

**Storage**: PostgreSQL (기존 046 3테이블 재사용 + `share_comment.read_at` 1컬럼 추가, V29)

**Testing**: JUnit 5 + AssertJ + MockK + Testcontainers(BE) / Vitest + RTL(FE)

**Target Platform**: Web (Vercel FE / OCI Compute BE)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: 안 읽은 피드백 집계는 목록 조회에 1쿼리 추가(group-by, N+1 회피). 사용자 체감 영향 없음.

**Constraints**: 기존 046 동작(불변 스냅샷·작가 전용 피드백·활성 링크만 공개·대상 삭제 보존) 무변경. additive-only(컬럼 1개·필드 additive·endpoint 신규), 기존 응답 호환.

**Scale/Scope**: 솔로 작가 단위(작품 수십, 작품당 공유 링크 소수, 피드백 소수). 대량 트래픽 가정 없음.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`는 빈 템플릿(placeholder)이다. 본 프로젝트는 `CLAUDE.md` + `.claude/rules/*`를 헌법으로 준용한다. 관련 게이트:

- **추측 금지(HARD-GATE)**: 본 plan은 046 코드(ShareService·ShareCommentService·엔티티·DTO·V27/V28)를 직접 읽고 작성. 읽음 단위(projectId)는 기존 인박스 단위 실측에 근거.
- **TDD(§5)**: 읽음 집계·bulk update·소유 검증·FE 순수 로직(대상별 링크 필터·작품 단위 unread 합산)은 Red-Green. 팝오버·헤더·시각은 dogfooding 게이트(§14·§25).
- **외부 인프라 안전**: V29는 작성·리뷰만, 로컬 DB 적용은 Testcontainers IT 한정(external-infra-safety). 운영 미적용.
- **배포 순서**: BE 선행(read_at·집계·읽음 endpoint는 FE가 보내기 전 받아들이게) → FE 후행. additive라 구 FE 무손상.
- **공용 fetch 분기(client.ts)**: 신규 에러코드 없음(읽음 처리 실패는 소유 검증 403/404 기존 코드 재사용) → status 분기 추가 없음.
- **코드 품질**: Kotlin(ktlint·checkstyle)·TS(typecheck·lint·build RSC 경계) 게이트.

위반 없음 → Phase 0 진행 가능.

## Project Structure

### Documentation (this feature)

```text
specs/047-share-ux/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 읽음 단위·집계 방식·진입점 결정
├── data-model.md        # Phase 1 — read_at + DTO additive
├── quickstart.md        # Phase 1 — dogfooding 체크리스트
├── contracts/           # Phase 1 — endpoint 계약(읽음 처리 + 응답 additive)
│   └── share-ux-api.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/main/
├── resources/db/migration/
│   └── V29__add_share_comment_read_at.sql        # 신규
└── kotlin/com/writenote/
    ├── entity/ShareComment.kt                    # readAt 필드 추가
    ├── repository/ShareCommentRepository.kt       # 안읽은 group 집계 + bulk read update
    ├── service/ShareCommentService.kt             # markReadForProject + listForAuthor readAt 동봉
    ├── service/ShareService.kt                    # listMine unread 집계 → SharedWorkMeta
    ├── controller/ShareCommentController.kt        # POST .../comments/read
    └── model/response/ShareResponses.kt           # SharedWorkMeta.unreadCommentCount, AuthorCommentResponse.readAt (additive)

frontend/src/
├── app/(main)/
│   ├── layout.tsx                                 # NAV_ITEMS 공유 칩 추가
│   ├── shares/page.tsx                            # 신규 — 공유 관리(ShareLinkManager 호스트)
│   └── mypage/ (sidebar)                          # "공유 관리" 항목 제거
├── components/
│   ├── share/SharePopover.tsx                     # 신규 — 작품/시리즈 공용 1:N 공유 팝오버
│   ├── share/ShareLinkManager.tsx                 # 재구성(받은 피드백 맨 위 + 작품/시리즈 그룹, 생성 폼 제거)
│   ├── share/AuthorCommentInbox.tsx               # 열 때 읽음 처리 + 안읽은 강조
│   ├── library/DraggableWorkCard.tsx              # 공유 버튼 + 공유 중 표시
│   └── library/CategoryTile.tsx                   # ⋯ 메뉴 공유 + 공유 중 표시
├── lib/
│   ├── api/share.ts                               # markCommentsRead + 응답 타입 확장
│   ├── query/useShares.ts / useShareComments.ts   # 읽음 mutation + unread invalidate
│   └── share/shareGrouping.ts                     # 신규 — 대상별 링크 필터·작품 단위 unread 합산(순수)
└── next.config (redirects)                        # /mypage/shares → /shares (037 선례)
```

**Structure Decision**: 기존 046 파일에 additive 변경 + 신규 FE 컴포넌트(SharePopover) + 순수 헬퍼(shareGrouping). 백엔드는 신규 도메인 0.

## 라운드 분해 (구현 순서)

| 라운드 | 범위 | US | 게이트 |
|---|---|---|---|
| **R1 (BE)** | V29 read_at + 엔티티 + repository(안읽은 group 집계·bulk read) + `markReadForProject`(소유 검증) + `POST /comments/read` + `listMine` unread 집계 + `AuthorCommentResponse.readAt` additive | US3 토대 | ktlint·checkstyle·test·build GREEN, Testcontainers IT |
| **R2 (FE 진입점·관리)** | 헤더 nav 공유 칩 + `(main)/shares` 라우트 + redirect + 마이페이지 공유 제거 + `ShareLinkManager` 재구성(받은 피드백 맨 위 + 작품/시리즈 그룹, 생성 폼 제거) | US2 | typecheck·lint·test·build, dogfooding |
| **R3 (FE 작품/시리즈 진입점)** | `SharePopover`(작품/시리즈 공용) + `DraggableWorkCard`·`CategoryTile` 진입점 + 공유 중 표시 + `shareGrouping` 순수 헬퍼 | US1 | 위 게이트 + dogfooding |
| **R4 (FE 읽음)** | `AuthorCommentInbox` 열 때 읽음 처리 + 안읽은 강조 + unread 집계 표시(관리화면·팝오버) | US3 마감 | 위 게이트 + dogfooding |

BE 선행(R1) → FE(R2~R4). FE 라운드는 BE additive 위에서 동작. 각 라운드 게이트 GREEN + 서브에이전트 리뷰, authed dogfooding(로그인 뒤·시각)은 별도 수동 게이트(§19).

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
