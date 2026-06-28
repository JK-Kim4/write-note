# Implementation Plan: 공유하기 — 공유 링크 + 위치 지정 피드백

**Branch**: `046-share-feedback` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md) (SoT) + [docs/share/share-prd.md](../../docs/share/share-prd.md) (PRD v0.4) + [docs/poc/2026-06-28-block-id-anchoring-poc.md](../../docs/poc/2026-06-28-block-id-anchoring-poc.md)

> **SoT 주의**: clarify 4건이 PRD v0.4 와 divergence. 본 plan 은 **spec 기준**. 차이: (1) 댓글 = 작가 전용 비공개(PRD 는 공유 페이지 노출 뉘앙스), (2) 앵커 = 문단 + 텍스트 구간(PRD 는 블록 인덱스), (3) 대상 삭제 시 보존(PRD §2.3 미정), (4) 댓글 권한 = 활성 링크 + 회원 누구나. PRD 는 후속 v0.5 동기 권장(미차단).

## Summary

작가가 작품/시리즈를 **공유 링크**로 내보내고(공유 시점 **불변 스냅샷** 동결), 비로그인 외부인이 **읽기 전용**으로 열람한다. 로그인 회원은 본문의 **텍스트 구간**을 짚어 **작가에게만 보이는 비공개 댓글**을 남기고, 작가는 모아 본다. 링크 끄기·시리즈 공개작품 선택 포함.

기술 접근: 신규 BE 도메인 3테이블(share_link / share_snapshot / share_comment, V27~V28). 스냅샷 본문 = **owner 키 암호화**(`BodyCipherService` 재사용, 공개 read 시 서버측 복호). **optional auth = `/api/shared/**` permitAll + 컨트롤러 nullable `@AuthenticationPrincipal`**(신규 필터 불필요 — `JwtAuthenticationFilter` 가 토큰 없으면 pass-through, 유효하면 principal 세팅하는 실측 거동 활용). 앵커 = 불변 스냅샷의 (문단 인덱스 + 문단 내 시작·길이). FE = 공유 관리 UI + 공개 공유 페이지(정적 스냅샷 렌더, `printLayout` 재사용) + 텍스트 구간 댓글.

## Technical Context

**Language/Version**: Kotlin 2.2 (BE, Java 24 toolchain) · TypeScript 5.9 / React 19 / Next.js 16 App Router (FE)

**Primary Dependencies**: Spring Boot 4.0.6 (Web/Security/Data JPA/Validation) · React Query · Zustand · 자체 EditContext 에디터(읽기 전용 렌더 = `printLayout`)

**Storage**: PostgreSQL (OCI self-managed, Flyway). 신규 = V27(share_link, share_snapshot) + V28(share_comment). 기존 테이블 변경 0.

**Testing**: BE = JUnit5 + AssertJ + MockK(단위) + Spring Boot Test + **Testcontainers(IT)** — **로컬 dev DB 미적용**(external-infra-safety). FE = Vitest(단위) + dogfooding 게이트(시각/인증 뒤).

**Target Platform**: 웹(데스크탑·모바일 브라우저). FE Vercel, BE OCI.

**Project Type**: Web application (backend/ + frontend/).

**Performance Goals**: 표준 웹 기대치. 공개 read 는 스냅샷 1건 복호 + 정적 렌더(p95 합리적). N+1 회피(목록 일괄 조회).

**Constraints**: 공개 경로가 owner 의 복호화된 본문을 서빙(보안 민감) — 활성 링크 검증 선행 + 스냅샷만 노출. 댓글 가시성 = 작가 전용(인가 엄격). at-rest 평문 0(스냅샷 암호화).

**Scale/Scope**: 솔로 작가~소규모. 5 라운드(BE 3 + FE 2), 신규 ~3테이블·~3엔티티·~2컨트롤러·신규 에러코드 1 enum·FE 공개 라우트 + 관리 UI.

## Constitution Check

*GATE: constitution = 빈 템플릿 → 프로젝트 **CLAUDE.md 룰 준용**(speckit-constitution 미실행).*

| 게이트 | 적용 |
|---|---|
| TDD (§5) | BE 검증·인가·앵커 매핑·라벨 파생 = 순수/IT TDD. 엔티티/마이그레이션/설정 = §5-5 완화. |
| 추측 금지 (금지1) | optional auth 거동·BodyCipher 시그니처·SecurityConfig·principal 실측 완료. tasks 진입 직전 파일명/시그니처 grep(§6). |
| 외부 인프라 안전 | 마이그레이션 **작성만**, 로컬 적용 컨펌 필요 → Testcontainers 로 검증, 로컬 DB 미적용. |
| 빌드/테스트 포어그라운드 | 모든 gradle/vitest 포어그라운드. |
| 배포 순서 | BE 선행(공개 경로·optional auth·암호화 신규 계약) → FE 후행. |
| 보안 민감부 | 공개 read 복호화·댓글 가시성 인가·토큰 검증 = 서브에이전트 리뷰 집중. |

**위반 없음** — Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/046-share-feedback/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 핵심 설계 결정
├── data-model.md        # Phase 1 — V27~28 테이블 + 엔티티
├── contracts/           # Phase 1 — API 계약 + 에러코드 + 보안필터 델타
│   ├── share-api.md
│   ├── comment-api.md
│   └── security-and-errors.md
├── quickstart.md        # Phase 1 — dogfooding 체크리스트
└── tasks.md             # /speckit-tasks 산출(본 명령 아님)
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/            # ShareLink.kt, ShareSnapshot.kt, ShareComment.kt (신규)
├── repository/        # ShareLinkRepository, ShareSnapshotRepository, ShareCommentRepository
├── service/           # ShareService, ShareCommentService (신규)
├── controller/        # ShareController, ShareCommentController (신규)
├── model/
│   ├── request/       # CreateShareLinkRequest, SetPublicWorksRequest, CreateCommentRequest
│   └── response/      # ShareLinkResponse, SharedViewResponse, SharedWorkResponse, CommentResponse
├── error/             # ShareErrorCode.kt (신규 enum)
├── crypto/            # BodyCipherService (재사용)
├── config/            # SecurityConfig.kt (수정 — /api/shared/** permitAll)
backend/src/main/resources/db/migration/
├── V27__create_share_links_and_snapshots.sql (신규)
└── V28__create_share_comments.sql (신규)
backend/src/test/kotlin/com/writenote/  # 단위 + IT(Testcontainers)

frontend/src/
├── app/
│   ├── shared/[token]/                 # 공개 공유 페이지(읽기 전용, noindex)
│   │   ├── page.tsx
│   │   └── works/[projectId]/page.tsx
│   └── (main)/mypage/shares/           # 작가 공유 관리(또는 작품/시리즈 메뉴 진입)
├── components/share/                   # ShareLinkManager, PublicWorkPicker, SharedReader, CommentLayer, AuthorCommentInbox
├── lib/api/                            # share.ts (fetch 래퍼)
├── lib/query/                          # useShares.ts, useShareComments.ts
└── components/custom-editor/printLayout.tsx  # 정적 렌더 재사용(읽기 전용)
```

**Structure Decision**: 기존 web app(backend/ + frontend/) 구조 그대로. 신규 도메인은 기존 컨벤션(controller→service→repository, Result envelope, `findByIdAndUserId` 소유검증, `*ErrorCode` enum) 답습.

## 라운드 분해 (BE 선행 → FE 후행, §10 코어 우선)

> 각 라운드 독립 검증 가능. R1 이 **첫 dogfoodable 코어**(공유+스냅샷+공개 읽기)를 증명(§10).

### R1 — BE: 공유 링크 + 스냅샷 + 공개 읽기 (작품 공유) [CORE]
- V27: `share_link`, `share_snapshot`. 엔티티·repo.
- `ShareErrorCode`(신규): SHARE_LINK_NOT_FOUND(404)·SHARE_LINK_INACTIVE(410 또는 404 동형 안내)·SHARE_TARGET_NOT_FOUND(404)·SHARE_FORBIDDEN(403)·SHARE_TARGET_INVALID(400).
- `ShareService`: `createWorkShareLink`(작품 소유검증 → 그 시점 본문 ciphertext 복사로 스냅샷 동결) · `revoke`(is_active=false) · `listMine` · `getPublicView(token)` · `getSharedWork(token, projectId)`(활성 검증 → 스냅샷 owner 키 복호 → 평문 PM JSON 반환).
- `ShareController`: POST `/api/share-links` · PATCH `/api/share-links/{id}` · GET `/api/share-links/mine` · GET `/api/shared/{token}` · GET `/api/shared/{token}/works/{projectId}`.
- `SecurityConfig`: `/api/shared/**` permitAll(+ HttpMethod 무관).
- 검증(IT/단위): 링크 생성·추측불가 토큰·스냅샷 동결(원문 수정 후 불변)·공개 read 복호·revoke→비활성·잘못된 토큰→안내·소유검증.
- **dogfooding(코어)**: 작품 공유 링크 → 시크릿창 비로그인 읽기 → 원문 수정 후 불변 확인.

### R2 — BE: 위치 지정 댓글(작가 전용 비공개) + optional auth 회원 식별
- V28: `share_comment`(share_snapshot_id·project_id·author_id·anchor_block_index·anchor_start·anchor_length·content·timestamps).
- optional auth: `/api/shared/**` 의 nullable `@AuthenticationPrincipal`. 댓글 POST 는 principal null → 401(UNAUTHENTICATED), 비회원 차단.
- `ShareCommentService`: `create`(활성 링크 + 회원 → 앵커 검증 후 저장) · `deleteOwn`(작성자 본인만) · `listMineOnSnapshot`(공개 read 시 요청자 자기 댓글만) · `listForAuthor(projectId)`(작가 전체 — 소유검증).
- 가시성: 공개 GET shared work 응답에 **요청자 본인 댓글만** 포함(타인 0). 작가 인박스 endpoint 가 전체.
- endpoint: POST `/api/shared/{token}/works/{projectId}/comments` · DELETE `/api/share-comments/{id}` · GET `/api/projects/{projectId}/comments`(작가, authenticated).
- 신규 에러코드: COMMENT_NOT_FOUND(404)·COMMENT_FORBIDDEN(403)·COMMENT_ANCHOR_INVALID(400)·COMMENT_UNAUTHENTICATED(401).
- 검증: 회원 댓글·비로그인 차단·작가 전체 조회·타인 미노출·본인만 삭제·앵커 범위 저장·만료토큰 공개경로 401 엣지.

### R3 — BE: 시리즈 공유 + 공개 작품 선택 + 대상 삭제 수명주기
- `ShareService`: `createSeriesShareLink` · `setPublicWorks(linkId, projectIds)`(PUT `/api/share-links/{id}/works` — 추가분 그 시점 스냅샷 동결, 제거분 스냅샷 삭제) · `getPublicView` 가 시리즈면 공개작품 목록 반환.
- FR-025 대상 삭제 수명주기: `ProjectService.deleteProject`·`CategoryService.delete` 에 훅(보드 `clearOwner` 선례) → 관련 링크 비활성 + 스냅샷·댓글 보존.
- 검증: 시리즈 링크·선택 노출·새 작품 미자동노출·추가시점 스냅샷·대상 삭제→링크 비활성+보존.

### R4 — FE: 공유 관리 UI + 작가 댓글 인박스
- 공유 링크 생성(작품/시리즈)·공개 작품 선택(`PublicWorkPicker`)·끄기·목록(`ShareLinkManager`), 진입점 = 작품/시리즈 메뉴 또는 마이페이지.
- 작가 댓글 인박스(`AuthorCommentInbox`): 모아 보기 + 위치 이동.
- `lib/api/share.ts` + `useShares`/`useShareComments`(React Query).
- 검증: 게이트(typecheck·lint·test·build) + dogfooding(생성·끄기·선택·인박스 이동).

### R5 — FE: 공개 공유 페이지(읽기 전용 스냅샷) + 회원 댓글 작성(텍스트 구간)
- 공개 라우트 `/shared/[token]`(+ `/works/[projectId]`), `noindex` 메타, 비로그인 접근.
- 스냅샷 PM JSON → `printLayout.relayout`/`renderRuns` 정적 읽기 전용 렌더.
- optional auth: 로그인 회원이면 댓글 UI(텍스트 구간 드래그 선택 → 앵커=문단+구간) 노출, 비로그인 숨김. 회원은 자기 댓글만 표시.
- 검증: 게이트 + dogfooding(비로그인 읽기·noindex·회원 댓글 작성/삭제·작가 인박스 이동·다른 회원 미노출).

## 배포 순서 (HARD-GATE)
BE(R1~3) 선행 → FE(R4~5) 후행. 공개 경로 permitAll·optional auth·스냅샷 암호화·신규 계약은 BE 가 먼저 받아들여야 FE 가 호출. 마이그레이션 V27~28 은 BE 배포에 동반(운영 Flyway 자동).

## 리스크 & 완화
- **공개 경로 본문 복호 서빙**(보안 민감): 활성 링크 검증 선행 + 스냅샷만(살아있는 본문 아님) + owner 키 서버측 복호. 서브에이전트 리뷰 집중.
- **댓글 가시성 인가**: 공개 read 가 타인 댓글 누설 금지(요청자 본인만). 작가 인박스만 전체. IT 로 누설 0 검증(SC-009).
- **만료 토큰 공개경로 401 엣지**: 회원이 만료 토큰으로 공개 페이지 접근 시 401(필터 거동). FE 는 만료 시 토큰 미전송/refresh 로 회피. research 기록.
- **앵커 견고성**: 스냅샷 불변이라 문단+구간 영구 안정(POC 정합). 살아있는 에디터 무변경.
- **자율 구현 한계(§19)**: "구현 완료" = 자동 게이트(Testcontainers/vitest) GREEN + 서브에이전트 리뷰. 인증 뒤 dogfooding(로그인·로컬 DB)은 별도 수동 게이트로 명시 — GREEN 을 authed 정합 증거로 단정 안 함.
```
