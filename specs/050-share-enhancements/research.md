# Phase 0 Research: 공유 페이지 고도화

브레인스토밍(ux-mockup 4종 승인)으로 사용자향 결정은 이미 확정. 본 문서는 **구현 방식 결정**을 실측 시그니처 근거로 정리한다. 실측 출처 = 공유 도메인 11항목 조사(ShareComment 앵커 NOT NULL Int / 공개 열람 `/api/shared/{token}/works/{projectId}`→`SharedWorkResponse` / 작가 조회 `/api/projects/{id}/comments`=projectId 단위·소유 전체 / ShareErrorCode 9개 / AnchorValidator 046 H1 재사용).

## D1. 작가용 피드백 맥락 뷰 데이터 공급 — 신규 owner-scoped 조회

- **Decision**: 신규 `GET /api/share-links/{linkId}/works/{projectId}/feedback`(필수 auth, `share_link.owner_id == 요청자` 검증) → `{projectId, title, bodyJson(복호), comments: 그 스냅샷 전체, reactions: 집계}` 한 번에.
- **Rationale**: 작가 뷰는 (a) **비활성 링크(off)도** 열람해야 하고 (b) **본인이 아닌 독자들의 댓글 전부**가 필요하며 (c) 반응 집계까지 한 화면. 단일 authz 호출로 묶는 게 정합적.
- **Alternatives rejected**:
  - 공개 `getSharedWork(token,projectId)` 재사용 → 댓글이 `listMineForSharedWork`=**요청자 본인 것만**(작가가 열면 0건) + `isActive` 게이트로 off 링크 불가. 기각.
  - `authorComments(projectId)` + FE가 `AuthorCommentResponse.shareSnapshotId`로 필터 → projectId 단위라 **여러 링크 댓글이 섞여** FE 필터 필요 + 본문/반응 별도 fetch(round-trip 3). snapshotId 노출도 필요. 기각(다중 왕복).

## D2. 반응 집계 노출 위치 — 공개 열람 응답에 embed

- **Decision**: 공개 `SharedWorkResponse`에 `reactions: List<ReactionAggregate>` 추가(`{anchor 3필드, emoji, count, mine}`). 열람자는 기존 1회 fetch로 개수 + 내가 누른 것까지 받음.
- **Rationale**: 반응은 공개 집계(FR-013)라 모든 열람자가 봐야 하고, 별도 endpoint면 열람마다 추가 round-trip. embed가 최소.
- **Alternatives rejected**: 별도 `GET .../reactions` — 추가 왕복·캐시 이원화. 기각.

## D3. 반응 토글 — POST 추가 / DELETE(쿼리 파라미터) 제거

- **Decision**: `POST .../reactions`(추가, unique로 멱등, body=앵커+emoji) · `DELETE .../reactions?blockIndex=&start=&length=&emoji=`(제거, **body 없음**). FE가 `mine` 상태로 분기.
- **Rationale**: REST 의미 명확 + 멱등(중복 POST는 unique로 무해). **DELETE에 body를 싣지 않음** — 앞단 Caddy/프록시·fetch가 DELETE 바디를 신뢰성 없게 다루는 스멜 회피(리뷰 지적). 앵커 3정수+emoji를 쿼리로.
- **Alternatives rejected**: 단일 토글 POST — 서버가 상태 뒤집기라 동시요청 경합·의미 모호. 기각. / DELETE-with-body — 프록시 스멜. 기각.

## D4. 전체 의견(구간 미지정) — share_comment 앵커 nullable화

- **Decision**: `share_comment` 앵커 3컬럼 `NOT NULL`→nullable(V32), 엔티티 `Int?`, `CreateCommentRequest` 앵커 optional. **셋 다 null = 전체 의견**, 셋 다 값 = 구간 댓글, 섞이면 400. AnchorValidator는 null이면 검증 skip.
- **Rationale**: 기존 도메인·가시성(작가 전용)·인박스·읽음 전부 그대로 재사용. 신규 엔티티 대비 최소. 제약 완화라 기존 데이터 무손상.
- **Alternatives rejected**: 별도 whole-work-comment 엔티티 — 가시성/읽음/인박스 로직 이중화. 기각.

## D5. 비로그인 로그인 복귀 — FE localStorage returnTo (BE 0)

- **Decision**: 로그인 진입 직전 현재 `/shared/...` 경로를 `localStorage`에 저장 → 로그인 도착지(`/entering` 또는 홈)에서 소비해 `router.replace`. 저장·소비 전 **`/shared/` prefix 검증**(open-redirect 차단).
- **Rationale**: 이메일(`LoginForm`→`/entering`)·카카오(OAuth2SuccessHandler→홈) 둘 다 목적지 하드코딩이라 `returnTo` 파라미터 미지원. localStorage는 **같은 origin이라 카카오 왕복에도 생존**, BE 무변경.
- **Alternatives rejected**: OAuth2SuccessHandler에 returnTo 파라미터 — BE 변경 + state 전달 보안 표면 확대. 기각(FE-only로 충분).

## D6. 이모지·에러코드 — 서버 화이트리스트 5종 + 신규 코드 1

- **Decision**: 서버 `ALLOWED_EMOJIS = [❤️,👍,😮,😢,🔥]` 화이트리스트. 반응 앵커 검증 = 기존 `AnchorValidator` 재사용(스냅샷 평탄화 정합, 룰 §32). 신규 에러코드 = **REACTION_EMOJI_INVALID(400)** 1개. 반응 미인증 = `COMMENT_UNAUTHENTICATED(401)` 재사용, 반응 앵커 오류 = `COMMENT_ANCHOR_INVALID(400)` 재사용.
- **Rationale**: 신규 코드 최소(client.ts 분기 최소). 앵커 검증 정본 하나(BE↔FE 평탄화 어긋남 재발 방지).
- **Alternatives rejected**: 반응 전용 코드 3종 신설 — 불필요한 표면. 기각.

## D7. 맥락 뷰 읽음 처리 스코프 — 스냅샷 단위

- **Decision**: 맥락 뷰 진입 시 그 **링크(스냅샷)** 피드백만 읽음. 신규 `POST /api/share-links/{linkId}/works/{projectId}/comments/read` + `markReadBySnapshotId`.
- **Rationale**: `SharedWorkMeta.unreadCommentCount`가 **스냅샷 단위**라, projectId 단위 읽음(기존)으로 처리하면 **같은 작품 다른 링크의 안읽음까지 0**이 되어 부정확. 스냅샷 스코프가 정합.
- **Alternatives rejected**: 기존 projectId 단위 `POST /api/projects/{id}/comments/read` 재사용 — 다중 링크에서 오작동. 기각.

## D8. 종이 레이아웃 — 기존 원고 토큰 재사용 (FE-only)

- **Decision**: 공유 열람(`SharedWorkView`/`SharedReader`)·작가 뷰를 종이 컨테이너로 감쌈 — 종이 `--w-ms-page`, 바깥 `--w-ms-outer`(집필 화면 동일). `SharedReader`의 하드코딩 색 `#1f2937` → 토큰(`--w-ms-page`/`--w-ink` 계열)로 교체 → 다크 대응.
- **Rationale**: 집필 화면과 동일 토큰 재사용으로 일관·다크 자동. 좌표/앵커 로직(printLayout·data-block-index) 무변경, 색·래핑만.
- **Alternatives rejected**: 신규 색 도입 — 집필 화면 불일치 + 다크 재작업. 기각.

## D9. 작가 인박스 공존 — AuthorFeedbackView가 047 AuthorCommentInbox 대체

- **Decision**: 신규 `AuthorFeedbackView`(링크/스냅샷 단위 전문+패널)가 047 `AuthorCommentInbox` 모달을 **대체(retire)**. 관리 화면의 "받은 피드백" 진입은 **링크별 버튼**이 정본 → `AuthorFeedbackView`. 상단 projectId 요약("작품 · N개의 새 피드백")은 그 작품 **링크 그룹으로 스크롤/강조**(모달 오픈 제거) — 다중 링크에서 한 스냅샷으로 못 접는 모호성 회피.
- **Rationale**: 리뷰 지적(두 피드백 UI 공존 방지). 맥락 뷰가 조각 모달의 상위호환(전문+맥락+반응)이라 모달 유지 이유 없음.
- **Alternatives rejected**: 모달 존치 + 맥락 뷰 병행 → 같은 "받은 피드백"이 두 화면. 기각. / 상단 요약이 최신 링크 뷰 자동 오픈 → 다중 링크 시 임의 선택. 기각(그룹 강조가 명확).
- **영향**: `AuthorCommentInbox.tsx` 제거(또는 미사용화), `ShareLinkManager`의 `inboxProject` state·상단 "피드백 보기"→그룹 스크롤로 대체. (US1 범위)

## 미해결(사용자 결정 완료·구현 세부만 남음)

- 작가가 반응자 **개인 신원**을 보는지: v1 = **집계 개수만**(개별 반응자 목록 범위 밖, Assumptions). 재오픈 시 내 반응 상태(`mine`)만 반영.
- 반응·댓글 앵커가 **같은 구간에 겹칠 때** 시각 표기: R4 목업에서 확정(하이라이트 + 반응 칩 병치).
