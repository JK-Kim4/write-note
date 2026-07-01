# 048 카드 관리 — US6 이어가기 핸드오프 (2026-07-01 체크포인트)

컨텍스트 포화로 세션 전환. **US1~US5(카드 관리 탭)까지 완료·게이트 GREEN·dogfooding 확정**. 남은 것 = **US6(집필 화면 카드 뷰)** + 마무리.

## 브랜치 / 상태
- 브랜치: `048-card-management` (develop `cab0580` 기반).
- 이 체크포인트로 **전부 커밋됨**(24파일: specs·목업·BE·FE·CLAUDE.md).
- **로컬 dev Postgres 에 V30 적용됨**(Flyway 30). 추가 마이그레이션 없음. (테스트 DB = 로컬 공유 Postgres, Testcontainers 아님 — BE 테스트가 V30 적용 + unique-email 픽스처 커밋. rule 7-4.)
- develop·main 미merge, 미배포.

## 완료 (US1~US5, 자동 게이트 GREEN + 사용자 dogfooding 확정)
**BE** — `/api/cards` 유저 스코프 6엔드포인트:
- V30(`cards.user_id` NOT NULL 백필 + `board_id` nullable + `idx_cards_user`), `Card` 엔티티(userId·boardId?), `CardTypes`(공유 종류검증), `CardRepository`(findByIdAndUserId·findByUserIdOrderByCreatedAtDescIdDesc)·`LinkRepository`(findBySourceCardIdInOrTargetCardIdIn), `CardService`(listMine·createStandalone·getCard·editCard·deleteCard·setCardBoard + `boardInfoFor` = board→작품/시리즈 owner 라벨), `CardController`, DTO `CardItemResponse`(boardId·boardName·**ownerType·ownerLabel**·body·type·linkCount·createdAt·updatedAt), `BoardService.createCard` 가 user_id 채움(회귀 가드).
- 테스트: BoardServiceTest 35·CardServiceTest 11·CardControllerIT 7·**전체 110 클래스 GREEN**(보드 흐름 무회귀).

**FE** — `/boards` 하위 [보드|카드] 탭:
- `lib/api/cards`·`lib/electron-api/cards`·`lib/query/useCards`(cross-cache invalidate), `components/cards/`(`cardFilter`+test·`CardTile`(작품/시리즈 owner 칩)·`CardDetailSheet`(useModalDismiss)·`CardManager`(소속/종류 라벨 필터·검색·독립생성·삭제경고)), `boards/page.tsx` 탭.
- 게이트: typecheck·lint·**785 테스트**·build GREEN.
- dogfooding 확정(2026-07-01): 필터 두 축 라벨 + 카드 작품/시리즈 칩 반영 후 사용자 승인.

## 남은 것 (다음 세션)
1. **US6 집필 화면 카드 뷰 (T045~T047, FE 전용·신규 BE 0)**:
   - `components/b/writingCardGroups.ts` (+ `.test.ts`): `GET /api/cards`(전량) + `GET /boards/reference?projectId=`(그 작품 보드 id 집합) 를 FE 결합·필터 → **이 작품 보드 → 상위 시리즈 보드 → 독립** 3단 그룹, 각 그룹 `createdAt` 내림차순. (다른 작품에만 속한 카드 제외.)
   - `components/b/BoardReferencePanel.tsx` 에 `[보드 | 카드]` 토글 + 카드 뷰(그룹 렌더, `CardTile` 재사용) + 카드 열기(열람 중심) + 빈 상태.
   - 설계 SoT: `specs/048-card-management/spec.md`(US6·FR-019/019a) · `research.md`(D9) · `quickstart.md`(R4) · 목업 `docs/research/2026-07-01-writing-card-view-mockup.html`(사용자 승인).
2. **T050** 집필 화면 dogfooding(US6 구현 후).
3. **T051** 배포: BE 선행(V30) → FE. 배포 전 `git fetch origin && git log HEAD..origin/develop`(rule 18) + 운영 Flyway 확인(rule 22).
4. **T052** 고아 memo FE 코드(`lib/api/memo.ts`·`lib/query/useMemos.ts`·`lib/memoView.ts`·`lib/electron-api/memos.ts`) 정리 = 03-ISSUES 후보(범위 밖, surfacing만).

## 재개 방법
1. `git checkout 048-card-management` (또는 워크트리 확인).
2. 스택: `docker compose up -d --wait postgres` → `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`(:8080) → `cd frontend && pnpm dev`(:3000).
3. `localhost:3000` → 로그인 → 보드 → `[카드]` 탭으로 US1~5 확인 후 US6 착수.
4. 게이트: BE `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`(V30 이미 적용, 신규 마이그레이션 0) / FE `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. tasks 진척: `specs/048-card-management/tasks.md` (46/52 완료, 미완 = T045~T047 US6 · T050 dogfooding · T051 배포 · T052 surfacing).

## 구현 중 발견(문서에 반영됨)
- 테스트 DB = 로컬 공유 Postgres(Testcontainers 아님). `application-test.yml` 실측.
- DTO 이름 충돌 회피: `CreateStandaloneCardRequest`/`EditCardRequest`/`SetCardBoardRequest`(기존 `BoardRequests` 의 CreateCardRequest/UpdateCardRequest 와 충돌). 응답 `CardItemResponse.kt`(ktlint 단일클래스=파일명).
- 진입점=`/boards` 하위 탭(신규 top-level 라우트·NAV 없음). 목록 그리드·정렬 생성일 내림차순·검색/필터 FE 클라.
