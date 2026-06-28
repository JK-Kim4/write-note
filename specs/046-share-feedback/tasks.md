# Tasks: 공유하기 — 공유 링크 + 위치 지정 피드백

**Feature**: 046-share-feedback | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

조직 = **라운드 기반**(프로젝트 관례 + BE선행→FE후행 배포 규칙). [US] 라벨로 user story 매핑. TDD = 검증·인가·앵커는 순수/IT 테스트 선행. BE 검증 = **Testcontainers**(로컬 dev DB 미적용). 각 라운드 끝 게이트.

> 경로 컨벤션: BE = `backend/src/{main,test}/kotlin/com/writenote/...`, FE = `frontend/src/...`. cwd 절대경로/subshell 격리(룰30).

---

## Phase 1: Setup

- [ ] T001 implement 진입 직전 정합 검증(룰6): `grep -rl "BodyCipherService\|AuthenticatedPrincipal\|findByIdAndUserId" backend/src/main/kotlin` 로 시그니처·소유검증 패턴 재확인 + `ls backend/src/main/resources/db/migration | tail` 로 최신 V26 확인(다음 V27).
- [ ] T002 기존 에러코드 enum 패턴 확인: `AuthErrorCode.kt` 1개 Read 해 code/httpStatus/defaultMessage 시그니처 + `GlobalExceptionHandler` 변환부 확인(ShareErrorCode 동형 작성 위함).

---

## Phase 2: Foundational

라운드 간 공유 차단 의존 없음(각 라운드 self-contained). 별도 foundational 작업 없음 — R1 이 도메인 기반을 함께 생성.

---

## Phase 3: R1 — BE 공유 링크 + 스냅샷 + 공개 읽기 [US1, US4] [CORE §10]

**Goal**: 작품 공유 링크 생성 → 스냅샷 동결 → 비로그인 공개 읽기(owner키 복호) → revoke. 첫 dogfoodable 코어.
**Independent Test**: 링크 생성 → 비로그인 GET 공개 읽기 → 원문 수정 후 불변 → revoke 후 404.

### 마이그레이션 · 엔티티 · repo
- [ ] T003 [US1] V27 마이그레이션 작성 `backend/src/main/resources/db/migration/V27__create_share_links_and_snapshots.sql` (share_link + share_snapshot, data-model.md §V27. **작성만 — 로컬 미적용**).
- [ ] T004 [P] [US1] `entity/ShareLink.kt` (id·token·targetType·targetId·ownerId·isActive·createdAt).
- [ ] T005 [P] [US1] `entity/ShareSnapshot.kt` (id·shareLinkId·projectId·titleSnapshot·bodySnapshot·createdAt).
- [ ] T006 [P] [US1] `repository/ShareLinkRepository.kt` (findByToken·findByIdAndOwnerId·findByOwnerIdOrderByCreatedAtDesc).
- [ ] T007 [P] [US1] `repository/ShareSnapshotRepository.kt` (findByShareLinkId·findByShareLinkIdAndProjectId).

### 에러코드 · 토큰
- [ ] T008 [P] [US1] `error/ShareErrorCode.kt` (SHARE_LINK_NOT_FOUND 404·SHARE_TARGET_NOT_FOUND 404·SHARE_TARGET_INVALID 400·SHARE_FORBIDDEN 403, contracts/security-and-errors.md). 기존 enum 동형.
- [ ] T009 [P] [US1] 공유 토큰 생성기 `service/ShareTokenGenerator.kt` (SecureRandom base62 32자, ApiTokenHasher 패턴 — 단 원문 저장). **단위 테스트 선행**: 길이·문자집합·유일성 경향.

### 서비스 (TDD)
- [ ] T010 [US1] **테스트 선행** `service/ShareServiceTest.kt`(단위/IT): 작품 공유 생성→스냅샷 동결, 소유검증(타인 작품 403), 잘못된 target 400, revoke→isActive=false, 미존재/비활성 토큰 동형 404.
- [ ] T011 [US1] `service/ShareService.kt`: `createWorkShareLink`(소유검증 → document.body ciphertext 복사로 스냅샷 동결, BodyCipher 재암호화 불필요·R-2), `revoke`, `listMine`, `getPublicView(token)`, `getSharedWork(token, projectId)`(활성검증 → decryptToPlain(ownerId, body_snapshot) 평문 반환). T010 GREEN까지.

### DTO · 컨트롤러 · 보안
- [ ] T012 [P] [US1] request/response DTO: `CreateShareLinkRequest`, `ShareLinkResponse`, `SharedViewResponse`, `SharedWorkResponse`, `SharedWorkMeta` (contracts/share-api.md, shareUrl 파생).
- [ ] T013 [US1] `controller/ShareController.kt`: POST `/api/share-links`, PATCH `/api/share-links/{id}`, GET `/api/share-links/mine`, GET `/api/shared/{token}`, GET `/api/shared/{token}/works/{projectId}`. nullable principal(공개 GET). Result envelope.
- [ ] T014 [US1] `config/SecurityConfig.kt` 수정: `/api/shared/**` GET·POST permitAll 추가(contracts/security-and-errors.md, 기존 permitAll 블록 동형).
- [ ] T015 [US1] **IT** `controller/ShareControllerIT.kt`(Testcontainers): 공개 GET 비로그인 200·복호 본문, revoke 후 404, 잘못된 토큰 404, 소유 아닌 생성 403, 스냅샷 불변(원문 수정 후 공개 본문 동일).

### R1 게이트
- [ ] T016 [US1] **게이트(포어그라운드)**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` GREEN. 회귀 grep: 기존 테이블 변경 0.

**Checkpoint**: R1 = 공유+스냅샷+공개읽기+revoke 자동 GREEN. (코어 dogfooding은 §19 별도 수동 게이트.)

---

## Phase 4: R2 — BE 위치 지정 댓글(작가 전용 비공개) + optional auth [US2]

**Goal**: 회원 텍스트 구간 댓글(작가 전용) + optional auth 회원 식별 + 작가 인박스.
**Independent Test**: 회원 댓글 작성 → 작가 전체 조회·타인 미노출 → 비로그인 401 → 본인만 삭제.

- [ ] T017 [US2] V28 마이그레이션 `backend/src/main/resources/db/migration/V28__create_share_comments.sql` (share_comment, data-model.md §V28. CHECK 제약 포함. 작성만).
- [ ] T018 [P] [US2] `entity/ShareComment.kt`.
- [ ] T019 [P] [US2] `repository/ShareCommentRepository.kt` (findBySnapshotIdAndAuthorId·findByProjectIdIn[작가 인박스]·findByIdAndAuthorId).
- [ ] T020 [P] [US2] ShareErrorCode 확장: COMMENT_UNAUTHENTICATED 401·COMMENT_NOT_FOUND 404·COMMENT_FORBIDDEN 403·COMMENT_ANCHOR_INVALID 400.
- [ ] T021 [US2] **테스트 선행** `service/ShareCommentServiceTest.kt`: 앵커 범위 검증(블록 인덱스·start+length ≤ 블록 길이 → 초과 400), 작성(회원·활성링크), 삭제 본인만(타인 403), 작가 인박스 소유검증, 가시성(요청자 본인 댓글만 vs 작가 전체).
- [ ] T022 [US2] 앵커 검증 순수 헬퍼 `service/AnchorValidator.kt`(스냅샷 PM JSON 블록 파싱 → 인덱스·구간 범위 판정). **순수 TDD**.
- [ ] T023 [US2] `service/ShareCommentService.kt`: create(활성+회원+앵커검증), deleteOwn, listMineOnSnapshot, listForAuthor(projectId, 소유검증). T021 GREEN까지.
- [ ] T024 [P] [US2] DTO: `CreateCommentRequest`, `CommentResponse`, `AuthorCommentResponse`(authorNickname=users.nickname 재사용).
- [ ] T025 [US2] `controller/ShareCommentController.kt`: POST `/api/shared/{token}/works/{projectId}/comments`(nullable principal→null이면 401), DELETE `/api/share-comments/{id}`(authenticated), GET `/api/projects/{projectId}/comments`(작가).
- [ ] T026 [US2] ShareController.getSharedWork 수정: 응답 comments = 요청자 본인 것만(회원이면), 비로그인 빈 배열(R-3).
- [ ] T027 [US2] **IT** `controller/ShareCommentControllerIT.kt`: 회원 댓글 작성, 비로그인 POST 401, 회원 A·B 교차 가시성(서로 미노출, 작가 전체 — SC-009), 본인만 삭제, 앵커 초과 400, 만료토큰 공개경로 401 엣지.
- [ ] T028 [US2] **게이트(포어그라운드)**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` GREEN.

**Checkpoint**: R2 = 댓글 작가전용 비공개 + optional auth 자동 GREEN.

---

## Phase 5: R3 — BE 시리즈 공유 + 공개 작품 선택 + 대상 삭제 수명주기 [US3, US4]

**Goal**: 시리즈 공유·공개작품 선택(추가 시점 스냅샷)·대상 삭제 시 링크 비활성+보존.
**Independent Test**: 시리즈 일부 공개 → 선택분만 노출·새 작품 미자동 → 대상 삭제 → 링크 비활성+스냅샷 보존.

- [ ] T029 [US3] **테스트 선행** ShareServiceTest 확장: createSeriesShareLink, setPublicWorks(추가분 스냅샷 동결·제거분 삭제·시리즈 소속 검증), 새 작품 미자동노출.
- [ ] T030 [US3] ShareService 확장: `createSeriesShareLink`, `setPublicWorks(linkId, projectIds)`, getPublicView 시리즈 분기(공개 작품 목록). T029 GREEN.
- [ ] T031 [US3] ShareController: PUT `/api/share-links/{id}/works` 추가(SetPublicWorksRequest).
- [ ] T032 [US4] **테스트 선행** 삭제 훅 테스트: 작품 삭제→관련 링크 isActive=false+스냅샷·댓글 보존, 시리즈 삭제 동형.
- [ ] T033 [US4] `ProjectService.deleteProject`·`CategoryService.delete` 에 ShareLink 비활성 훅 추가(BoardRepository.clearOwner 선례 — ShareLinkRepository.deactivateByTarget). T032 GREEN. **기존 삭제 동작 회귀 가드**.
- [ ] T034 [US3] **IT** 확장: 시리즈 공개 read 목록, 대상 삭제 보존.
- [ ] T035 [US3] **게이트(포어그라운드)**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN(BE 전체 빌드).

**Checkpoint**: BE 완료(R1~R3) GREEN. **여기서 BE 선행 배포 가능 지점**(FE 후행).

---

## Phase 6: R4 — FE 공유 관리 UI + 작가 댓글 인박스 [US1, US3, US4, US2-author]

**Goal**: 공유 링크 생성·끄기·목록·공개작품 선택 + 작가 댓글 모아보기·위치 이동.
**Independent Test**: 게이트 + dogfooding(생성·끄기·선택·인박스 이동).

- [ ] T036 [US1] `lib/api/share.ts`: fetch 래퍼(client.ts 경유, error.code 분기). createShareLink·revoke·setPublicWorks·listMine·authorComments·deleteComment.
- [ ] T037 [P] [US1] `lib/query/useShares.ts` (useShareLinksMine·useCreateShareLink·useRevokeShareLink·useSetPublicWorks, React Query invalidate).
- [ ] T038 [P] [US2] `lib/query/useShareComments.ts` (useAuthorComments·useDeleteComment).
- [ ] T039 [US1] `components/share/ShareLinkManager.tsx` ('use client'): 공유 링크 목록·생성(작품/시리즈)·끄기·URL 복사.
- [ ] T040 [US3] `components/share/PublicWorkPicker.tsx`: 시리즈 공개 작품 선택 UI(setPublicWorks).
- [ ] T041 [US2] `components/share/AuthorCommentInbox.tsx`: 작가 댓글 모아보기 + 항목 선택→해당 작품/위치 이동.
- [ ] T042 [US1] 진입점 결선: 작품/시리즈 메뉴 또는 마이페이지에 공유 관리 진입(기존 라우트에 additive).
- [ ] T043 **게이트(포어그라운드, cwd=frontend)**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN. RSC 경계 build 검출.

**Checkpoint**: R4 자동 게이트 GREEN. (UI dogfooding = §19 별도.)

---

## Phase 7: R5 — FE 공개 공유 페이지 + 회원 댓글 작성(텍스트 구간) [US1, US2]

**Goal**: 비로그인 읽기전용 스냅샷 렌더(noindex) + 회원 텍스트 구간 댓글.
**Independent Test**: 게이트 + dogfooding(비로그인 읽기·noindex·회원 구간 댓글·자기 댓글만·작가 인박스 이동).

- [ ] T044 [US1] 공개 라우트 `app/shared/[token]/page.tsx` (+ `works/[projectId]/page.tsx`): SharedViewResponse 조회, noindex 메타(`robots: noindex`), 비로그인 접근.
- [ ] T045 [US1] `components/share/SharedReader.tsx`: 스냅샷 bodyJson → `printLayout.relayout`/`renderRuns` 정적 읽기 전용 렌더(편집 불가). pmConvert 로 bodyJson→DocModel.
- [ ] T046 [US2] 텍스트 구간 선택 → 앵커 파생 `lib/share/anchorFromSelection.ts` (렌더된 스냅샷에서 문단 인덱스 + 문단 내 start·length 도출). **순수 TDD**(선택 범위→앵커 매핑).
- [ ] T047 [US2] `components/share/CommentLayer.tsx`: optional auth(로그인 회원만 입력 UI), 구간 하이라이트, 댓글 작성/삭제, **요청자 자기 댓글만 표시**(가시성).
- [ ] T048 [US2] `lib/query/useShareComments.ts` 확장: useCreateComment(공개 토큰 경로), 낙관 갱신.
- [ ] T049 **게이트(포어그라운드, cwd=frontend)**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN.

**Checkpoint**: R5 자동 게이트 GREEN. FE 완료.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T050 [P] 회귀 grep: 기존 테이블 변경 0, 공개 read 타인 댓글 누설 0(코드 경로 확인), 토큰 원문 노출 로그 0.
- [ ] T051 quickstart.md 전항 dogfooding 체크리스트 준비(§19·§25 — 사용자 확인 후 통과 단정).
- [ ] T052 서브에이전트 보안 리뷰: 공개 read 복호·댓글 가시성 인가·optional auth·토큰·앵커 검증 집중(contracts/security-and-errors.md 불변식 5항).

---

## Dependencies & 실행 순서

- **라운드 순차**: R1(T003-016) → R2(T017-028) → R3(T029-035) → [BE 배포 가능] → R4(T036-043) → R5(T044-049) → Polish(T050-052).
- **라운드 내 병렬 [P]**: 엔티티·repo·DTO·에러코드는 서로 독립([P]). 서비스는 repo 의존, 컨트롤러는 서비스 의존(순차).
- **TDD 게이트**: T010·T021·T022·T029·T032·T046 = 테스트 선행(Red) → 구현(Green).
- **배포 순서(HARD-GATE)**: BE(R1~3) 선행 → FE(R4~5) 후행.

## Parallel 예시
- R1: T004·T005·T006·T007·T008·T009·T012 동시 가능(다른 파일). T010→T011→T013→T014→T015 순차.
- R2: T018·T019·T020·T024 동시. T021→T022→T023→T025 순차.

## MVP 범위
- **MVP = R1**(US1 공유+스냅샷+공개읽기 + US4 revoke). 단독으로 "내 글을 비로그인에게 보여준다" 가치 완결.
- 증분: +R2(피드백 순환) +R3(시리즈) +R4/R5(FE).

## 검증 한계 (§19)
"구현 완료" = 자동 게이트(Testcontainers IT + vitest + build) GREEN + 서브에이전트 리뷰. **로그인 뒤·시각 dogfooding(quickstart)은 별도 수동 게이트** — 자동 GREEN을 authed 정합 증거로 단정 안 함.
