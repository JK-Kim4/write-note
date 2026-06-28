# Tasks: 공유 사용성 개선 (Share UX)

**Feature**: 047-share-ux | **Branch**: `047-share-ux` | **Date**: 2026-06-28

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/share-ux-api.md](./contracts/share-ux-api.md) · [quickstart.md](./quickstart.md)

신규 BE 도메인 0(046 재사용 + `share_comment.read_at` 1컬럼 V29). 읽음·집계 단위=작품(projectId). additive-only. BE 선행 → FE 후행.

TDD(룰 §5): BE 집계·bulk read·소유검증 + FE 순수 헬퍼(shareGrouping)는 Red-Green. 팝오버·헤더·시각·포커스는 dogfooding 게이트(§14·§25).

---

## Phase 1: Setup

- [ ] T001 브랜치 `047-share-ux` 베이스 정합 확인 — `git log --oneline HEAD..origin/develop` 로 누락 커밋(보안·공개경로) 점검(룰 §18). 없으면 진행.

---

## Phase 2: Foundational (BE R1) — 모든 US 전제 (BLOCKING)

읽음 컬럼·집계·읽음 endpoint. US1(공유중·unread 표시)·US2(받은 피드백)·US3(읽음) 모두 이 BE additive 위에서 동작.

- [ ] T002 V29 마이그레이션 작성 `backend/src/main/resources/db/migration/V29__add_share_comment_read_at.sql` — `read_at TIMESTAMPTZ NULL` 추가 + 부분 인덱스 `idx_share_comment_unread (project_id) WHERE read_at IS NULL`(data-model.md 기준). 로컬 dev DB 미적용(Testcontainers IT 한정).
- [ ] T003 [P] `ShareComment` 엔티티에 `readAt: Instant?`(`@Column(name="read_at")`) 추가 `backend/src/main/kotlin/com/writenote/entity/ShareComment.kt`. `@PrePersist` 무변경.
- [ ] T004 [P] DTO additive `backend/src/main/kotlin/com/writenote/model/response/ShareResponses.kt` — `SharedWorkMeta.unreadCommentCount: Int = 0`, `AuthorCommentResponse.readAt: Instant? = null`, 신규 `MarkCommentsReadResponse(markedRead: Int)`.
- [ ] T005 `ShareCommentRepository` 확장 `backend/src/main/kotlin/com/writenote/repository/ShareCommentRepository.kt` — `UnreadCountRow` projection + `countUnreadByProjectIds(projectIds)` group-by + `@Modifying markReadByProjectId(projectId, now): Int`(data-model.md 쿼리).
- [ ] T006 [US3] BE 테스트(먼저) `backend/src/test/.../ShareCommentServiceTest`(또는 IT) — `markReadForProject` 안읽은 행만 read_at 채움·이미 읽은 건 무변경·반환 수 정확 / 타 작품 → `COMMENT_FORBIDDEN` / `countUnreadByProjectIds` 작품별 정확·읽음 후 0. RED 확인.
- [ ] T007 [US3] `ShareCommentService.markReadForProject(userId, projectId)` 구현 `backend/src/main/kotlin/com/writenote/service/ShareCommentService.kt` — `projectRepository.findByIdAndUserId` 소유 검증(실패 `COMMENT_FORBIDDEN`) → `markReadByProjectId(projectId, Instant.now())` → `MarkCommentsReadResponse(markedRead)`. `listForAuthor` 매핑에 `readAt = comment.readAt` 동봉. T006 GREEN.
- [ ] T008 BE 테스트(먼저) `listMine` unread 집계 — 같은 작품 여러 링크면 각 SharedWorkMeta 동일 값·댓글 0이면 0. RED 확인.
- [ ] T009 `ShareService.listMine` 에 unread 집계 주입 `backend/src/main/kotlin/com/writenote/service/ShareService.kt` — 스냅샷 projectId 들 모아 `countUnreadByProjectIds` 1쿼리 → `SharedWorkMeta.unreadCommentCount` 채움(N+1 회피). T008 GREEN.
- [ ] T010 [US3] `ShareCommentController` 에 `POST /api/projects/{projectId}/comments/read` 추가 `backend/src/main/kotlin/com/writenote/controller/ShareCommentController.kt` — `@AuthenticationPrincipal` 작가, `Result.success(markReadForProject(...))`. (contracts §1)
- [ ] T011 046 공유/댓글 기존 IT 무회귀 확인 + BE 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN.

**Checkpoint**: BE additive 완료 — FE 라운드 진입 가능. (배포는 Polish 단계에서 BE 선행)

---

## Phase 3: User Story 1 - 작품/시리즈 화면에서 직접 공유 (Priority: P1) 🎯 MVP

**Goal**: 작가가 작품 목록/시리즈에서 마이페이지로 가지 않고 그 자리에서 1:N 공유 링크를 만들고 관리.

**Independent Test**: 작품 카드 공유 버튼 → 링크 생성 → 주소 복사 → 다시 열어 링크 목록 + 새 링크 추가. 시리즈도 동일.

- [ ] T012 [P] [US1] FE API 타입 확장 `frontend/src/lib/api/share.ts` — `SharedWorkMeta`(또는 해당 타입)에 `unreadCommentCount`, `AuthorCommentResponse` 에 `readAt` 추가. 기존 `listMyShareLinks`/`createShareLink`/`revokeShareLink` 재사용(046 무변경).
- [ ] T013 [P] [US1] 순수 헬퍼 `frontend/src/lib/share/shareGrouping.ts` + 테스트(먼저, Red-Green) — `linksForTarget(links, targetType, targetId)`(대상별 필터), `activeLinkCount`(공유 중·N), `unreadByProject`(작품 단위 dedup 합산), 작품/시리즈 그룹핑. RTL 아닌 순수 단위.
- [ ] T014 [US1] `SharePopover` 신규 `frontend/src/components/share/SharePopover.tsx` — 작품/시리즈 공용. 대상 링크 0개면 "공유 링크 만들기"(그 시점 본문 고정 안내), 1개+면 시점별 링크 목록(주소·복사·받은 피드백·끄기/다시 켜기) + "새 공유 링크 만들기". 시리즈는 공개 작품 선택(`PublicWorkPicker` 재사용). 바깥클릭·ESC 닫기. 목업 `docs/research/2026-06-28-share-entry-points-mockup.html` 기준.
- [ ] T015 [US1] `DraggableWorkCard` 공유 진입점 `frontend/src/components/library/DraggableWorkCard.tsx` — 편집·보관·삭제와 나란히 "공유" 버튼 + `SharePopover` 연결 + 활성 링크 1개+면 "● 공유 중 · N"(좌상단). `stopDrag`·카드 클릭 진입 무회귀.
- [ ] T016 [US1] `CategoryTile` 공유 진입점 `frontend/src/components/library/CategoryTile.tsx` — ⋯ 메뉴에 "공유" 추가(편집/공유/삭제) + `SharePopover`(시리즈) + 활성 링크 1개+면 "● 공유 중 · N".
- [ ] T017 [US1] FE 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(RSC 경계). dogfooding = quickstart R3 전항.

**Checkpoint**: 작품/시리즈에서 직접 공유 동작(독립 MVP).

---

## Phase 4: User Story 2 - 헤더 공유 관리 메뉴로 모아보기 (Priority: P2)

**Goal**: 헤더 최상위 "공유"로 한 번에 진입, 받은 피드백 + 작품/시리즈별 링크 그룹을 한곳에서.

**Independent Test**: 헤더 "공유" 클릭 → `/shares` → 받은 피드백 맨 위 + 작품/시리즈별 그룹. `/mypage/shares` redirect.

- [ ] T018 [P] [US2] 헤더 nav 공유 칩 `frontend/src/app/(main)/layout.tsx` — `NAV_ITEMS` 에 `{ href: "/shares", label: "공유", Icon: <lucide 아이콘> }` 6번째 추가(기존 `NAV_CHIP` 패턴).
- [ ] T019 [P] [US2] `/mypage/shares → /shares` redirect `frontend/next.config.*` — 037 `redirects()` 선례 패턴. 라우트 구조 변경 후 `rm -rf .next` 재생성(룰 typescript §라우트 캐시).
- [ ] T020 [US2] 마이페이지 사이드바에서 "공유 관리" 항목 제거 `frontend/src/app/(main)/mypage/`(MypageSidebar SECTIONS). 다른 항목 무회귀.
- [ ] T021 [US2] `(main)/shares/page.tsx` 신규 + `ShareLinkManager` 재구성 `frontend/src/components/share/ShareLinkManager.tsx` — 받은 피드백(맨 위, `unreadByProject`>0 작품/시리즈) + 작품/시리즈별 그룹(1:N 링크, `shareGrouping` 재사용). **생성 폼 제거**(생성은 작품/시리즈 진입점). 빈 상태 = 화면 컨텍스트 유지 오버레이(룰 typescript §빈 상태). `useAuthGuard` 적용.
- [ ] T022 [US2] FE 게이트 — lint·typecheck·test·build. dogfooding = quickstart R2 전항.

**Checkpoint**: 헤더 공유 관리 허브 동작.

---

## Phase 5: User Story 3 - 받은 피드백 읽음 관리 (Priority: P3)

**Goal**: "피드백 보기"를 열면 그 작품 묶음 전체 읽음 → "받은 피드백 N"이 안 읽은 수만 가리킴.

**Independent Test**: 새 피드백 N건 → "피드백 보기" 열고 닫기 → 받은 피드백 집계 0 → 다시 열어도 새 것 아님 → 새 댓글 도착 시 다시 집계.

- [ ] T023 [P] [US3] 읽음 mutation `frontend/src/lib/api/share.ts` + `frontend/src/lib/query/useShareComments.ts` — `markCommentsRead(projectId)` → `POST /api/projects/{projectId}/comments/read`, onSuccess 시 `["share","links","mine"]`(또는 해당 키) + 인박스 쿼리 invalidate(안 읽은 수 갱신).
- [ ] T024 [US3] `AuthorCommentInbox` 읽음 처리 `frontend/src/components/share/AuthorCommentInbox.tsx` — 인박스 열릴 때(마운트/조회 성공 후) `markCommentsRead(projectId)` 1회 호출(열면 그 묶음 전체 읽음). 안 읽은 항목(`readAt == null`) 시각 강조. 읽음은 삭제 아님(전체 열람 유지).
- [ ] T025 [US3] 관리 화면·팝오버 안 읽은 수 표기 연결 `frontend/src/components/share/ShareLinkManager.tsx`·`SharePopover.tsx` — "받은 피드백 N"(unread) + 0이면 "확인할 새 피드백 없음" 안내(관리 화면). 읽음 처리 후 invalidate 로 N 감소 반영.
- [ ] T026 [US3] FE 게이트 — lint·typecheck·test·build. dogfooding = quickstart R4 전항.

**Checkpoint**: 받은 피드백 읽음 누적 방지 동작.

---

## Phase 6: Polish & 배포

- [ ] T027 통합 회귀 dogfooding(quickstart §통합 회귀) — 046 공개 열람(비로그인) 무회귀(read_at 미노출)·대상 삭제 보존·기존 링크/피드백 손실 0(기존 댓글 안 읽음 시작).
- [ ] T028 서브에이전트 코드 리뷰(BE additive·FE 경계·보안: 읽음 endpoint 소유 검증·read_at 공개 미노출).
- [ ] T029 배포 — BE 선행(OCI blue-green, V29 Flyway 자동) → FE 후행(Vercel). 사용자 컨펌 시(external-infra-safety §1). authed dogfooding(로그인 뒤·시각, §19).

---

## Dependencies & 실행 순서

- **Phase 2(BE Foundational)는 모든 FE 스토리의 BLOCKING 전제** — unread 집계·read_at·읽음 endpoint.
- US1(P1, MVP) · US2(P2) · US3(P3)는 Phase 2 완료 후 대체로 독립. 단:
  - US2/US3 가 US1 의 `shareGrouping`(T013)·`SharePopover`(T014) 일부 재사용 → T013·T014 를 US1 에서 먼저.
  - 구현 순서 권장(plan 라운드): **Phase 2 → US1(작품 진입점·MVP) → US2(헤더 관리) → US3(읽음)**. US2 를 먼저 하려면 T013(shareGrouping)만 선행하면 됨.
- 배포(T029)는 BE(Phase 2) 선행 후 FE 누적분 후행 — additive 라 구 FE 무손상이나 FE 가 unread/read_at 사용하므로 BE 먼저.

## 병렬 기회

- Phase 2: T003·T004 [P](다른 파일). T002(SQL)도 독립.
- US1: T012·T013 [P]. US2: T018·T019 [P]. US3: T023 [P] 후 T024·T025.

## MVP 범위

**Phase 2(BE) + Phase 3(US1)** = 작품/시리즈에서 직접 1:N 공유. 가장 강조된 접근성 문제를 해결하는 최소 독립 산출물.
