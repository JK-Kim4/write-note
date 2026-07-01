# Tasks: 공유 페이지 고도화 (Share Enhancements)

**Branch**: `050-share-enhancements` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Design**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/share-enhancements-api.md) · [quickstart.md](./quickstart.md)

## 개요

046/047 위 additive 확장. **BE 선행 → FE 후행**. TDD(§5): 행위 IT/vitest는 Red-first(각 impl task 바로 앞의 test task). 타입/DTO/마이그레이션은 §5-5 예외.
- 마이그레이션 V31(share_reaction)·V32(share_comment 앵커 nullable). 로컬 DB 적용은 사용자 컨펌(external-infra-safety).
- 신규 에러코드 1: REACTION_EMOJI_INVALID(400).
- **US1(P1)** 작가 맥락 뷰 / **US2(P2)** 비로그인 로그인 / **US3(P2)** 반응·전체 의견 / **US4(P3)** 종이.

경로 규약: BE=`backend/src/main/kotlin/com/writenote/`, BE test=`backend/src/test/kotlin/com/writenote/`, FE=`frontend/src/`.

---

## Phase 1: Setup

- [ ] T001 베이스 정합 확인 — `git log --oneline HEAD..origin/develop` 비었는지 + 046/047(V27~V29)·V30 포함 확인, 로컬 DB 기동(`docker compose up -d --wait postgres`). 브랜치 `050-share-enhancements` 확인. (룰 §18/§26)

---

## Phase 2: Foundational (BE 공유 — US1·US3 선행 블로킹)

*반응 데이터 모델·집계 읽기·댓글 앵커 nullable은 US1(집계 표시)·US3(반응 생성) 양쪽이 의존.*

- [ ] T002 [P] 마이그레이션 `backend/src/main/resources/db/migration/V31__create_share_reaction.sql` — `share_reaction` 테이블 + UNIQUE(share_snapshot_id,anchor_block_index,anchor_start,anchor_length,emoji,reactor_id) + idx(share_snapshot_id) + FK(share_snapshot_id→share_snapshot ON DELETE CASCADE). (data-model §1)
- [ ] T003 [P] 마이그레이션 `.../migration/V32__share_comment_anchor_nullable.sql` — anchor_block_index/anchor_start/anchor_length DROP NOT NULL. (data-model §2)
- [ ] T004 [P] `entity/ShareReaction.kt` 신규 — data-model §1 필드/컬럼 매핑.
- [ ] T005 `entity/ShareComment.kt` 앵커 3필드 `Int`→`Int?` (전체 의견 대비). (data-model §2)
- [ ] T006 `repository/ShareReactionRepository.kt` 신규 — 스냅샷별 group-by 집계 쿼리(anchor,emoji→count) + 본인 반응 조회(mine) + 토글용 findBy·delete. N+1 회피 단일 그룹 쿼리.
- [ ] T007 `model/response/ShareResponses.kt` — `ReactionAggregate`·`AuthorSnapshotFeedbackResponse` 신규, `SharedWorkResponse.reactions` 추가, `CommentResponse`/`AuthorCommentResponse` 앵커 `Int?`. `model/request/ShareRequests.kt` — `CreateReactionRequest` 신규, `CreateCommentRequest` 앵커 `Int?`. (data-model §3)
- [ ] T008 [P] `error/ShareErrorCode.kt` — `REACTION_EMOJI_INVALID`(400) 추가 + `ALLOWED_EMOJIS`(❤️👍😮😢🔥) 상수(service 또는 상수 파일).
- [ ] T009 [P] IT `backend/src/test/kotlin/com/writenote/service/ShareReactionAggregateIT.kt`(Red-first) — 집계 정확성: 다회원 같은 구간/이모지 count 합산 · 다른 이모지 별개 · viewer mine 반영 · 비로그인 mine=false.
- [ ] T010 `service/ShareReactionService.kt` 신규(집계부) — `aggregate(snapshotId, viewerId?): List<ReactionAggregate>` 구현(T009 GREEN). AnchorValidator·BodyCipher 미필요(집계는 읽기).

**Checkpoint**: 반응 집계 읽기 + 앵커 nullable 스키마 준비 → US1·US3 진입 가능.

---

## Phase 3: US1 — 작가용 피드백 맥락 뷰 (Priority: P1) 🎯 MVP

**Goal**: 공유 관리 화면에서 링크별 "받은 피드백"→그 스냅샷 전문+전체 댓글+반응 집계를 우측 패널로.
**Independent Test**: 댓글 달린 링크의 맥락 뷰 진입→전문 하이라이트·패널 클릭 구간 이동·스냅샷 단위 분리·진입 시 그 링크만 읽음·비소유 차단.

### BE
- [ ] T011 [P] [US1] IT `.../service/AuthorSnapshotFeedbackIT.kt`(Red-first) — 소유자 200(전체 댓글+집계, **비활성 링크도**) / 비소유 403 SHARE_FORBIDDEN / 링크·스냅샷 없음 404 / 전체 의견(null 앵커) 포함.
- [ ] T012 [P] [US1] IT `.../service/MarkSnapshotReadIT.kt`(Red-first) — 그 스냅샷만 read_at 채움, 같은 작품 다른 링크 unread 유지.
- [ ] T013 [US1] `service/ShareCommentService.kt`(또는 ShareService) `authorSnapshotFeedback(linkId,projectId,ownerId)` — findByIdAndOwnerId(비소유 403)→BodyCipher 복호+전체 댓글+`ShareReactionService.aggregate` → `AuthorSnapshotFeedbackResponse`. (T011 GREEN)
- [ ] T014 [US1] `service/ShareCommentService.kt` `markReadBySnapshotId(linkId,projectId,ownerId)` — 소유 검증 후 그 스냅샷 read_at. (T012 GREEN)
- [ ] T015 [US1] `controller/ShareController.kt` — `GET /api/share-links/{linkId}/works/{projectId}/feedback` + `POST /api/share-links/{linkId}/works/{projectId}/comments/read`. (contracts N1·N4)

### FE
- [ ] T016 [P] [US1] `lib/api/share.ts` — `getAuthorFeedback(linkId,projectId)`·`markSnapshotCommentsRead(linkId,projectId)` + 타입 `ReactionAggregate`·`AuthorSnapshotFeedback`.
- [ ] T017 [P] [US1] `lib/query/useShares.ts`·`useShareComments.ts` — `useAuthorFeedback(linkId,projectId)`·`useMarkSnapshotRead()`.
- [ ] T018 [US1] `components/share/AuthorFeedbackView.tsx` 신규 — 전문(읽기)+하이라이트 항상 표시 + 우측 패널(닉네임·인용·내용·시각·안읽음) + 항목 클릭 스크롤+반짝. 목업 `2026-07-01-share-author-feedback-view-mockup.html` 안 B.
- [ ] T019 [US1] `components/share/ShareLinkManager.tsx` — 링크별 "받은 피드백 N"→`AuthorFeedbackView`(스냅샷 단위). 진입 시 `useMarkSnapshotRead`.
- [ ] T020 [US1] dogfooding(quickstart R3) — 하이라이트·패널 이동·1:N 분리·읽음·비소유 차단·종이(US4 후 재확인).

**Checkpoint**: US1 독립 동작 = MVP.

---

## Phase 4: US2 — 비로그인 방문자 로그인 (Priority: P2) — FE only

**Goal**: 공개 페이지 로그인 진입점 + 로그인 후 그 공유 페이지 복귀.
**Independent Test**: 로그아웃 상태 공유 페이지→로그인→같은 페이지 복귀(이메일·카카오).

- [ ] T021 [P] [US2] vitest `frontend/src/lib/share/returnTo.test.ts`(Red-first) — `saveReturnTo`/`consumeReturnTo`: `/shared/` prefix만 허용·그 외 null·소비 후 제거.
- [ ] T022 [US2] `lib/share/returnTo.ts` 신규 — save/consume + `/shared/` prefix 검증(open-redirect 차단). (T021 GREEN)
- [ ] T023 [US2] `app/shared/layout.tsx` 헤더 "로그인" 버튼 + `components/share/CommentLayer.tsx` 본문 CTA·비로그인 드래그 유도 → 클릭 시 `saveReturnTo(현재경로)` 후 `/auth/login` 이동.
- [ ] T024 [US2] `app/entering/page.tsx`(및 홈 진입) — 마운트 시 `consumeReturnTo()` 있으면 `router.replace(그 경로)`(없으면 기존 홈 흐름).
- [ ] T025 [US2] dogfooding(quickstart R2 로그인) — 이메일·카카오 각각 그 공유 페이지 복귀 · 조작된 returnTo 안전.

---

## Phase 5: US3 — 이모지 반응 + 전체 의견 (Priority: P2)

**Goal**: 공개 반응 집계(토글) + 구간 미지정 전체 의견(작가 전용).
**Independent Test**: 회원이 구간 이모지 토글로 개수 증감·모든 열람자 개수 표시·하단 전체 의견(앵커 null) 작가 전용.

### BE
- [ ] T026 [P] [US3] IT `.../service/ShareReactionToggleIT.kt`(Red-first) — add→count1 / 중복 add 멱등 / remove→0 / 다른 회원 별개 / emoji 화이트리스트 밖 400 REACTION_EMOJI_INVALID / 앵커 무효 400 COMMENT_ANCHOR_INVALID / 비회원 401.
- [ ] T027 [P] [US3] IT `.../service/GeneralCommentIT.kt`(Red-first) — 앵커 셋 다 null 저장(작가 전용 노출) / 부분 null 400 / 기존 구간 댓글 회귀 없음 / 공개 열람 응답 reactions embed mine.
- [ ] T028 [US3] `service/ShareReactionService.kt` add/remove — unique 멱등, `AnchorValidator`(스냅샷) 재사용, emoji 화이트리스트, 비회원 401. (T026 GREEN)
- [ ] T029 [US3] `service/ShareCommentService.kt` createComment 앵커 null 허용 — 셋다null=전체/셋다값=검증/부분null=400. (T027 GREEN)
- [ ] T030 [US3] `controller/ShareReactionController.kt` 신규 — `POST`/`DELETE /api/shared/{token}/works/{projectId}/reactions`. `controller/ShareController.kt` getSharedWork 응답에 `reactions`(viewer mine) embed. (contracts N2·N3·C1)
- [ ] T031 [US3] `controller/ShareCommentController.kt` — CreateCommentRequest nullable 앵커 수용(전체 의견). (contracts C2)

### FE
- [ ] T032 [P] [US3] `lib/api/share.ts` — `addReaction`/`removeReaction`(token,projectId,input) + `createComment` 앵커 optional + 타입.
- [ ] T033 [P] [US3] vitest `frontend/src/lib/share/reactionAggregate.test.ts`(Red-first) + `lib/share/reactionAggregate.ts` — 낙관적 토글 집계 갱신 순수 헬퍼(mine 반영·count 증감).
- [ ] T034 [US3] `lib/query/useShareReactions.ts` 신규 — `useAddReaction`/`useRemoveReaction`(낙관적, `useSharedWork` 캐시 집계 갱신).
- [ ] T035 [US3] `components/share/CommentLayer.tsx` — 구간 선택 이모지 툴바(❤️👍😮😢🔥 토글) + 반응 개수 모든 열람자 표시 + 하단 "작품 전체에 한마디"(앵커 null). 목업 `...comment-enhancements-mockup.html`.
- [ ] T036 [US3] `components/share/AuthorFeedbackView.tsx` — 구간별 반응 집계 표기 + 전체 의견 구획(US1 뷰 확장, FR-016).
- [ ] T037 [US3] dogfooding(quickstart R4) — 이모지 증감·다른 계정 공개 집계·전체 의견 작가 전용·글댓글 회귀·겹침 표기.

---

## Phase 6: US4 — 종이 위의 글 (Priority: P3) — FE only

**Goal**: 공유 열람·작가 뷰를 흰 종이 위 글로 + 다크 대응.
**Independent Test**: 공유 열람·작가 뷰 흰 종이/어두운 바깥(집필 화면 동일)·다크 가독.

- [ ] T038 [US4] `components/share/SharedReader.tsx` — 하드코딩 색 `#1f2937`→토큰(`--w-ink`/`--w-ms-page` 계열), 종이 내부 여백. (다크 대응)
- [ ] T039 [US4] `components/share/SharedWorkView.tsx` + `AuthorFeedbackView.tsx` — 종이 컨테이너(`--w-ms-page` 페이지 + `--w-ms-outer` 바깥 + 그림자·여백). 목업 `...paper-layout-mockup.html` 안 1.
- [ ] T040 [US4] dogfooding — 라이트/다크/한글 종이(공유 열람 + 작가 뷰).

---

## Phase 7: Polish & 회귀

- [ ] T041 회귀 가드(FR-020) — 046/047 무손상: 공유 생성·on/off·삭제·5개 제한·공개 열람 200·작가 전용 텍스트 댓글·읽음·모달 portal. grep: 구 `SharedWorkResponse`/`CreateCommentRequest` 소비처 무손상.
- [ ] T042 전체 게이트 — BE `ktlint(main+test)·checkstyle·test·build` / FE `lint·typecheck·test·build`. (§작업실행지침 포어그라운드)
- [ ] T043 배포 순서 문서 확인 — BE 선행(V31·V32)→FE. 배포 시 046/047(V27~V29) 동반 운영 첫 적용, `git log main..develop` 범위 확정(finish-work·별도 요청 시).

---

## Dependencies

- **Phase 1 → Phase 2**: Setup 후 BE 진입.
- **Phase 2 (Foundational) → US1·US3**: 반응 집계/앵커 nullable이 US1(집계 표시)·US3(반응·전체의견) 선행.
- **US2·US4 = FE only** — Phase 2 무관(BE 미의존), 언제든 병렬 진행 가능(조기 dogfooding).
- **US3 → US1 보강**: US1의 반응 집계 표기(T036)는 US3 반응 도메인 완료에 의존. (US1 코어 T011~T020은 집계 embed만으로 독립.)
- **배포**: 모든 BE(Phase 2·US1 BE·US3 BE) 선행 → FE 후행.

## Parallel 예시

- Phase 2: T002·T003·T004·T008 [P] 동시(서로 다른 파일).
- US1: T011·T012 IT [P] / T016·T017 FE 데이터계층 [P].
- US3: T026·T027 IT [P] / T032·T033 [P].
- 스토리 병렬: US2(FE)·US4(FE)는 BE 라운드와 무관하게 병렬 착수 가능.

## Implementation Strategy (라운드 = 배포 단위)

- **R1 BE**(Phase 2 + US1 BE T011~T015 + US3 BE T026~T031): 모든 BE 먼저(선행 배포). IT GREEN.
- **R2 FE**(US4 T038~T040 + US2 T021~T025): BE 무관, 조기 dogfooding.
- **R3 FE**(US1 FE T016~T020): 작가 맥락 뷰.
- **R4 FE**(US3 FE T032~T037): 반응·전체 의견.
- **MVP = US1**(P1) 단독으로도 "작가가 공유 글+피드백을 맥락으로 확인" 가치 완결.
