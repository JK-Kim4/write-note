# Implementation Plan: 공유 페이지 고도화 (Share Enhancements)

**Branch**: `050-share-enhancements` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/050-share-enhancements/spec.md` + 요구사항 정의서 `docs/superpowers/specs/2026-07-01-share-enhancements-design.md` + 승인 목업 4종 `docs/research/2026-07-01-share-*-mockup.html`.

## Summary

046(공유 링크·불변 스냅샷·공개 열람·작가 전용 위치 댓글)/047(헤더 공유 메뉴·관리 허브·읽음) 위에 4개 갭을 additive로 해소한다.
1. **작가용 피드백 맥락 뷰(P1)**: 한 공유 링크(스냅샷)의 전문 + 받은 피드백 전부 + 반응 집계를 작가 권한으로 한 번에 주는 신규 조회(`GET /api/share-links/{linkId}/works/{projectId}/feedback`) + FE 우측 패널 뷰.
2. **비로그인 로그인 복귀(P2)**: FE 전용 — 로그인 진입점 신설 + `localStorage` 복귀지 저장→로그인 후 소비(`/shared/` prefix 검증). BE 0.
3. **댓글 고도화(P2)**: (a) 신규 `share_reaction`(V31) + 공개 집계(공개 열람 응답에 embed) + 토글 endpoint (b) `share_comment` 앵커 nullable화(V32)로 전체 의견.
4. **종이 레이아웃(P3)**: FE 전용 — 공유 열람·작가 뷰를 흰 종이(`--w-ms-page`) 위 글로 + 본문 색 토큰화(다크).

배포 = **BE 선행 → FE 후행**. 046/047(V27~V29) 미배포라 본 작업 배포 시 V27~V29 + V31/V32 운영 첫 적용.

## Technical Context

**Language/Version**: Kotlin 2.2 (BE, Java 24 toolchain) · TypeScript 5.9 / React 19.2 / Next.js 16 (FE)
**Primary Dependencies**: Spring Boot 4.0.6 (Web·Security·Data JPA·Validation) · React Query · Zustand · TipTap 미사용(자체 렌더 `printLayout` 재사용)
**Storage**: PostgreSQL (Flyway). 신규 `share_reaction`(V31) + `share_comment` 앵커 nullable(V32). 최신 = V30.
**Testing**: JUnit5+AssertJ+MockK+Testcontainers (BE, 로컬 DB 미적용) · Vitest+RTL (FE) · 인증뒤·시각 dogfooding(§19)
**Target Platform**: 웹(Vercel FE + OCI BE). 데스크톱 폐기.
**Project Type**: web (frontend/ + backend/)
**Performance Goals**: 반응 집계·작가 피드백 조회 N+1 회피(그룹 집계 1쿼리). 공개 열람 응답 추가 필드는 기존 1회 fetch에 embed(추가 round-trip 0).
**Constraints**: additive(스키마 파괴 0·기존 계약 무변경) · 스냅샷 불변·작가 전용 비공개(글 댓글) 유지 · 앵커 BE↔FE 평탄화 정합(룰 §32) · 반응만 공개
**Scale/Scope**: 개인 작가 규모. 공유당 피드백 수십 건. 신규 endpoint 3~4 + 변경 2 + 마이그레이션 2 + FE 컴포넌트 ~6.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` = **빈 템플릿**(플레이스홀더). 프로젝트 governance = `CLAUDE.md` + `.claude/rules/*` 준용. 적용 게이트:

- **추측 금지 / 단정 금지(HARD)**: 본 plan은 실제 코드 시그니처 조사(공유 도메인 11항목 실측) 근거. ✅
- **additive·surgical(§3)**: 046/047 계약 무변경, 신규 컬럼/테이블/필드만. 앵커 nullable화는 기존 non-null 데이터 무손상(제약 완화 방향). ✅
- **TDD(§5)**: BE 행위(반응 토글 멱등·집계·작가 피드백 authz·전체 의견 nullable 앵커 검증·읽음 스냅샷 스코프) = IT. FE 순수(returnTo 검증·집계 파생) = vitest. 시각·앵커 DOM = dogfooding 게이트(§14/§25). ✅
- **mock 경계(§5-2)**: DB/HTTP만 mock, 내부 collaborator mock 금지. ✅
- **에러코드 최소(§typescript client.ts)**: 신규 = REACTION_EMOJI_INVALID(400) 1개. 나머지 재사용(COMMENT_UNAUTHENTICATED 401·COMMENT_ANCHOR_INVALID 400·SHARE_FORBIDDEN 403). ✅
- **배포 방향 의존(HARD)**: BE 선행(새 조회·계약을 먼저 받아들임)→FE 후행(호출). ✅

**위반 없음** → Phase 0 진행.

## Project Structure

### Documentation (this feature)

```text
specs/050-share-enhancements/
├── plan.md              # (이 파일)
├── spec.md              # /speckit-specify 산출
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   └── share-enhancements-api.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
backend/src/main/kotlin/com/writenote/
├── entity/ShareReaction.kt                 # 신규
├── entity/ShareComment.kt                  # 앵커 3필드 Int→Int?
├── repository/ShareReactionRepository.kt   # 신규(집계·토글)
├── service/ShareReactionService.kt         # 신규(토글·집계·앵커검증)
├── service/ShareCommentService.kt          # +authorSnapshotFeedback·전체의견·스냅샷 읽음
├── controller/ShareController.kt           # +GET .../feedback, 공개 응답에 reactions
├── controller/ShareCommentController.kt     # 댓글 nullable 앵커 수용
├── controller/ShareReactionController.kt    # 신규(POST/DELETE reactions)
├── error/ShareErrorCode.kt                 # +REACTION_EMOJI_INVALID
├── model/request/ShareRequests.kt          # CreateCommentRequest 앵커 optional·CreateReactionRequest
├── model/response/ShareResponses.kt        # +ReactionAggregate·AuthorSnapshotFeedbackResponse·SharedWorkResponse.reactions
backend/src/main/resources/db/migration/
├── V31__create_share_reaction.sql          # 신규
└── V32__share_comment_anchor_nullable.sql  # 신규

frontend/src/
├── app/shared/layout.tsx                   # 헤더 로그인 진입점(비로그인)
├── app/shared/[token]/works/[projectId]/page.tsx
├── components/share/SharedReader.tsx        # 종이 스타일·색 토큰화
├── components/share/SharedWorkView.tsx      # 종이 컨테이너
├── components/share/CommentLayer.tsx        # 반응 툴바·전체 의견·비로그인 로그인 유도
├── components/share/AuthorFeedbackView.tsx  # 신규(작가 맥락 뷰·우측 패널)
├── components/share/ShareLinkManager.tsx    # "받은 피드백"→맥락 뷰 진입
├── lib/api/share.ts                         # +getAuthorFeedback·addReaction·removeReaction·markSnapshotRead·createComment 앵커 optional
├── lib/query/useShares.ts / useShareComments.ts / useShareReactions.ts(신규)
├── lib/share/returnTo.ts(신규 순수)         # 복귀지 저장·검증(/shared/ prefix)
└── app/entering/page.tsx                    # 복귀지 소비(로그인 후)
```

**Structure Decision**: 기존 web(backend/+frontend/) 구조. 공유 도메인 파일에 additive 확장 + 신규 반응 도메인. 데스크톱 미러 없음(web 전용).

## Phase 요약

- **Phase 0 research.md** — 설계 결정 8건(작가 뷰 조회 형태·반응 집계 위치·토글 방식·전체 의견 nullable·returnTo·이모지 화이트리스트·읽음 스코프·종이 토큰) 근거·대안.
- **Phase 1 data-model/contracts/quickstart** — 엔티티·마이그레이션·DTO·에러코드·엔드포인트 계약·dogfooding.
- **Phase 2 tasks.md** — `/speckit-tasks`가 R1 BE→R2 FE(종이·로그인)→R3 FE(작가 뷰)→R4 FE(반응·전체 의견) 라운드로 생성.

## Complexity Tracking

*Constitution 위반 없음 — 비움.*
