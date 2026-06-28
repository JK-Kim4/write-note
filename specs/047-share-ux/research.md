# Research: 공유 사용성 개선 (Share UX)

Phase 0 — spec 의 결정 사항을 046 실제 코드 기준으로 확정한다. 모든 항목 046 코드 직접 확인(추측 아님).

## R-1. 받은 피드백 읽음·집계 단위 = 작품(projectId)

**Decision**: 읽음 처리·안 읽은 수 집계의 단위를 **작품(projectId)**으로 한다. read_at 은 댓글(`share_comment`) 행에 채우되, "피드백 보기를 열면 그 작품의 안 읽은 댓글 전체를 읽음 처리".

**Rationale**:
- 기존 작가 인박스가 이미 projectId 단위다 — `ShareCommentService.listForAuthor(userId, projectId)` → `ShareCommentRepository.findByProjectIdInOrderByCreatedAtDesc`. `share_comment.project_id`(비정규화)와 `idx_share_comment_project` 인덱스 존재(V28).
- 한 작품이 여러 공유 링크(스냅샷)에 걸쳐도, 작가 인박스는 그 작품의 모든 스냅샷 댓글을 projectId 로 모아 본다(046 설계). 따라서 작품 단위가 기존 동작과 정합.
- 사용자 확정: "피드백 보기를 열면 그 묶음 전체 읽음"(스크롤 안 한 항목 포함). 묶음 = 작품.

**Alternatives considered**:
- 스냅샷(링크) 단위 읽음 — 댓글이 `share_snapshot_id` 에 직접 매여 데이터엔 더 친화적이나, 기존 인박스(projectId 단위)를 스냅샷 단위로 재설계해야 해 046 동작을 건드린다(FR-015 위반 위험). 기각.
- 개별 댓글 단위 명시 읽음 — 사용자가 옵션에서 명시 기각("열면 그 묶음 전체 읽음" 선택).

## R-2. 안 읽은 수 집계 = listMine 에서 projectId group-by 일괄

**Decision**: `ShareService.listMine` 이 스냅샷들의 projectId 를 모아 `share_comment` 를 `read_at IS NULL` 기준 group-by 로 일괄 집계하고, 각 `SharedWorkMeta` 에 `unreadCommentCount`(additive) 를 채운다.

**Rationale**:
- `listMine` 은 이미 스냅샷을 `findByShareLinkIdIn` 으로 일괄 조회(N+1 회피) 중. 같은 패턴으로 projectId 들의 안 읽은 수도 1쿼리 group-by 로.
- 관리 화면 "받은 피드백"(작품/시리즈별)·작품 카드·팝오버의 안 읽은 표시가 모두 이 한 응답에서 파생(FE 작품 단위 dedup·합산은 순수 헬퍼 `shareGrouping`).

**Alternatives considered**:
- 별도 unread-summary endpoint — 화면이 어차피 `listMine` 을 부르므로 1콜로 합치는 게 단순. 기각(YAGNI).
- 댓글마다 lazy count — N+1. 기각.

**집계 쿼리**: `SELECT c.projectId, COUNT(c) FROM ShareComment c WHERE c.projectId IN :ids AND c.readAt IS NULL GROUP BY c.projectId` (projection). 같은 작품이 여러 링크에 있으면 각 SharedWorkMeta 에 동일 값 — 작품 단위 집계라 의도된 동작(FE 가 작품 단위로 dedup).

## R-3. 진입점 정보구조 = 헤더 최상위 + 작품/시리즈 직접

**Decision**: 헤더 nav(`(main)/layout.tsx` `NAV_ITEMS`)에 "공유" 칩을 6번째로 추가(`/shares`). 작품 카드(`DraggableWorkCard`)에 공유 버튼, 시리즈 타일(`CategoryTile`) ⋯ 메뉴에 공유. 마이페이지 사이드바의 "공유 관리" 제거. `/mypage/shares` → `/shares` redirect.

**Rationale**: 사용자 승인 목업(`docs/research/2026-06-28-share-entry-points-mockup.html`). 헤더 nav 는 이미 5개(홈·작품·보드·기록·공지) — 동일 패턴(`NAV_CHIP`·lucide 아이콘)으로 6번째 추가. redirect 는 037 `next.config` 선례(`/settings → /mypage/settings`) 재사용.

**Alternatives considered**: 작품 화면 안 탭 / 마이페이지 유지 — 사용자가 헤더 최상위 선택.

## R-4. 1:N(작품/시리즈당 링크 여러 개) — 기존 모델 유지

**Decision**: 기존 BE 1:N 그대로. `share_link` 에 owner/target 유니크 제약 없음(V27 확인), `ShareService.createShareLink` 가 매번 새 토큰+스냅샷 생성. 작품/시리즈 진입점은 `listMine` 을 targetType/targetId 로 FE 필터해 그 대상의 링크 목록을 보인다(신규 조회 endpoint 불필요).

**Rationale**: 사용자가 1:N 명시 확정. BE 변경 0(진입점 UX만 1:N 대응).

## R-5. 신규 에러코드 / status 분기 없음

**Decision**: 읽음 처리 실패는 기존 코드 재사용 — 미소유 작품 읽음 시 `ShareErrorCode.COMMENT_FORBIDDEN`(403, listForAuthor 와 동일 소유 검증). 신규 에러코드 0, `client.ts` status 분기 추가 0.

**Rationale**: 읽음 처리는 "내 작품의 댓글"만 — `projectRepository.findByIdAndUserId` 소유 검증 실패 = 기존 COMMENT_FORBIDDEN. 새 실패 모드 없음.

## R-6. 기존 데이터 호환 — 기존 피드백은 안 읽음으로 시작

**Decision**: V29 `read_at` 은 nullable 추가(기본 NULL). 기존 댓글은 모두 NULL = 안 읽음으로 시작. 작가가 한 번 인박스를 열면 읽음 처리됨.

**Rationale**: additive nullable. 백필 불필요(안 읽음이 기존 댓글의 자연스러운 초기 상태 — 작가가 새로 모아 보게 됨). 운영 데이터 무손실(FR-016).

## 미해결 사항

없음. 모든 spec 결정이 046 코드와 정합 확인됨.
