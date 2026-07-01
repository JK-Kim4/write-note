# Phase 0 Research: 공지 고정·최신 슬롯

모든 항목 실측 근거(코드 인용) 기반. NEEDS CLARIFICATION 잔여 0.

## R-1. 현재 상태 (why now)

- `Announcement` 엔티티(`entity/Announcement.kt`)에 `isPublished`·`isPinned`·`publishedAt`·`createdAt` 존재.
- `AnnouncementRepository` 에 `findFirstByIsPublishedTrueOrderByIsPinnedDescPublishedAtDesc()`(고정 우선 배너 1건) 존재하나 **어디서도 호출 안 됨**(grep: 정의·주석뿐).
- 홈 배너(`components/AnnouncementBanner.tsx`)는 `useLatestAnnouncement()` → `listAnnouncements({size:1})` → `content[0]`(공개일 최신 1건)만 렌더. **고정 로직 미반영**.
- 결론: 고정을 켜도 메인에 효과 0. 본 기능이 그 배선을 완성 + 두 슬롯화 + 색 정합.

## R-2. 결정 — 두 슬롯 노출 방식

**Decision**: 전용 공개 조회 `GET /api/announcements/home` → `{ pinned: Summary?, latest: Summary? }`. pick·dedup 전부 서버측.

**Rationale**:
- 고정 공지는 성격상 **공개일이 오래된 경우가 흔하다**("항상 고정"). 따라서 공개일 내림차순 목록의 top-N 에 고정이 **없을 수 있다**. 프론트가 목록 fetch 로 고정을 집으면 오래된 고정을 놓치는 **정확성 결함**.
- 서버는 고정 전용 쿼리(`...AndIsPinnedTrue...`)로 나이와 무관하게 고정을 정확히 집는다.
- 두 슬롯을 이름(pinned/latest)으로 분리해 내려주면 프론트는 렌더만 — 비즈니스 로직(중복 방지·최신 고정 선택) 누수 없음.

**구현 스케치**:
```
pinned = repo.findFirstByIsPublishedTrueAndIsPinnedTrueOrderByPublishedAtDesc()  // Optional
topTwo = repo.findAllByIsPublishedTrueOrderByPublishedAtDesc(PageRequest.of(0, 2)).content
latest = topTwo.firstOrNull { it.id != pinned?.id }   // top-2 면 dedup 충분
return HomeAnnouncementsResponse(pinned?.toSummary(), latest?.toSummary())
```
- top-2 로 충분: 겹침은 "고정이 곧 공개일 최신"일 때만 발생 → 2번째가 커버. 고정이 top-2 밖이면 topTwo[0] 이 곧 latest(고정과 다름).

**Alternatives considered**:
- (기각) 요약 DTO 에 `isPinned` 추가 + FE top-N pick — 위 정확성 결함(오래된 고정 누락) + 비즈니스 로직 FE 누수.
- (기각) 기존 `findFirst...IsPinnedDesc...` 재사용 — 단일 배너용(고정 or 최신 1건)이라 "둘 다"를 못 준다.
- (기각) 목록 endpoint 에 `pinnedOnly` 필터 파라미터 추가 — 두 번 호출 + FE dedup 필요, 계약 복잡. 전용 endpoint 가 단순.

## R-3. SecurityConfig — 공개 경로 커버 (실측)

`config/SecurityConfig.kt:78` — `.requestMatchers(HttpMethod.GET, "/api/announcements", "/api/announcements/*").permitAll()`.
- `/api/announcements/*` 의 `*` 는 단일 세그먼트 매칭 → `/api/announcements/home` 커버. **SecurityConfig 변경 0**.
- 라우팅 충돌: `@GetMapping("/home")`(리터럴)는 `@GetMapping("/{id}")`(패턴)보다 Spring 이 우선 매칭 → `id="home"` 오해석 없음.

## R-4. dedup·정렬 기준

- **Decision**: 두 슬롯 모두 `publishedAt` 내림차순 기준. dedup 은 서버측(R-2).
- **Rationale**: 기존 공개 목록 정렬(`findAllByIsPublishedTrueOrderByPublishedAtDesc`)과 정합. 사용자 표현 "최신 등록순"이나, 등록 후 나중 공개한 공지가 공개 시점에 최신으로 읽히는 게 자연스러움(spec Assumptions). `publishedAt` 은 공개 전환 시 최초 1회 설정(`AnnouncementService.create`/`update`)이라 공개 공지엔 항상 non-null.
- **주의**: 이론상 `publishedAt` 동률이면 순서 비결정 가능 → 실무상 초 단위 동시 공개 드물고 슬롯 1건이라 영향 미미. 필요 시 `publishedAt DESC, id DESC` 안정화는 tasks 에서 선택(과설계 회피 위해 기본은 현행 정렬 재사용).

## R-5. 색상 정합 (FR-011)

- **Decision**: 공지 배너 색 teal(`border-teal-200 bg-teal-50 text-teal-900`) → 브랜드 테라코타 토큰(`--w-accent #a8542e` / dark `#d48d62`, `--w-accent-soft`, `--w-accent-text`). 고정=채움/최신=테두리 대비.
- **Rationale**: 사용자 결정("공지는 붉은"). 브랜드 주 액센트가 테라코타(tokens.css 주석) → 기존 임의 teal 을 브랜드 정합. 승인 목업이 색·치수 SoT.
- **범위 경계**: `/notice` 목록·상세 페이지의 색 정합은 본 기능 범위 밖(요구=메인 배너). 필요 시 후속.

## R-6. 기존 dead code 처리

- `findFirstByIsPublishedTrueOrderByIsPinnedDescPublishedAtDesc()` = 미사용, 본 기능이 대체. surgical 원칙: 기본 잔존(pre-existing dead), 제거는 사용자 컨펌. tasks 에서 "제거 옵션" 별도 항목.
