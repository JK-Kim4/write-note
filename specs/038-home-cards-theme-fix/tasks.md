# Tasks: 홈 작품 카드 개선 + 새 디자인 다크모드 지원 (038)

**Feature**: `specs/038-home-cards-theme-fix/` | **Branch**: `worktree-038-home-cards-theme-toggle`

**Input**: plan.md, spec.md, research.md, data-model.md, contracts/project-cards.md, quickstart.md

**테스트 정책**: CLAUDE.md TDD HARD-GATE — 매핑/정렬/조건 등 행위는 테스트 선행(Red→Green). US2 색상(시각)은 단위테스트로 미보장(§14) → 목업 게이트 + 라이트/다크 dogfooding.

**경로 규약**: 백엔드 `backend/src/...`, 프론트 `frontend/src/...` (실제 경로 확인 완료).

**⚠️ implement 진입 직전(CLAUDE.md §6)**: 본 tasks의 파일명/시그니처를 `grep`으로 재확인 후 착수.

---

## Phase 1: Setup

- [X] T001 베이스라인 확인 — 워크트리(`worktree-038-home-cards-theme-toggle`)에서 `cd frontend && pnpm install` 후 `pnpm test` GREEN, `cd backend && ./gradlew test` GREEN 확인(기존 회귀 없음 baseline).

---

## Phase 2: Foundational

US1(홈 카드)과 US2(다크모드)는 서로 독립적이며 공통 차단 전제가 없다. 별도 Foundational 작업 없음 — 각 스토리 단위로 진행.

---

## Phase 3: User Story 1 — 홈 작품 카드 개선 (P1)

**Goal**: "이어서 쓰기" 제외 카드 최대 2개 + "더 보기"→`/library`, 각 카드에 시리즈명·최종 수정일 + 호버 시 생성일·총 집필 시간.

**Independent Test**: 작품 4개+ 계정으로 홈 진입 → 카드 2개 + "더 보기" 노출, 각 카드에 제목·시리즈·마지막 작성·최종 수정일·게이지, 호버 시 생성일·집필시간(quickstart US1).

### R1 — 백엔드 (BE 선행): 시리즈명 additive

- [X] T002 [P] [US1] `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt`(또는 `ProjectServiceIT.kt`)에 **실패 테스트** 추가 — (a) 시리즈에 속한 작품 카드의 `categoryName == 시리즈명`, (b) 미분류(categoryId null) 작품 `categoryName == null`, (c) 같은 시리즈 여러 작품이 모두 같은 이름이며 카테고리 조회가 작품 수에 비례하지 않음(일괄 조회). (Red)
- [X] T003 [US1] `backend/src/main/kotlin/com/writenote/model/response/ProjectCardResponse.kt` 에 `categoryName: String?` 필드 **additive** 추가(기존 필드/순서 불변). contracts/project-cards.md 준수.
- [X] T004 [US1] `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` `listCards()` 에서 등장 `categoryId` 집합을 `CategoryRepository`로 **일괄 조회**해 id→name 맵 구성 후 카드별 `categoryName` 매핑(미분류=null). N+1 금지. → T002 GREEN.
- [X] T005 [US1] 백엔드 검증 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` GREEN (마지막 1회).

### R2 — 프론트 (FE 후행): 카드 표시·개수 제한·더 보기

- [X] T006 [P] [US1] `frontend/src/lib/dashboardView.test.ts` 에 **실패 테스트** 추가 — (a) `selectDashboard` 정렬/others 기존 동작 회귀 없음, (b) 표시용 상위 2개 선택 헬퍼(또는 page 로직 단위) 동작, (c) "더 보기" 노출 조건(others.length > 2 → true, ≤ 2 → false). (Red)
- [X] T007 [P] [US1] `frontend/src/lib/types/domain.ts` `ProjectCard` 에 `categoryName: string | null` 추가(백엔드 응답 정합).
- [X] T008 [US1] `frontend/src/lib/api/projects.ts`(및 필요 시 `electron-api/projects.ts`) 카드 매핑에 `categoryName` 전달 추가(없으면 null).
- [X] T009 [US1] `frontend/src/components/b/dashboard/BWorkMiniCard.tsx` 에 시리즈명(null→"미분류")·최종 수정일 표시 + 호버 말풍선(생성일 `formatDate(createdAt)` + 집필시간 `formatDurationKo(totalDurationMs)`) 추가. `/library` `DraggableWorkCard` 호버 패턴 재사용. 목표 게이지·마지막 작성 내용은 기존 유지(FR-003). 값 0/빈 경우 대체 표현(FR-006).
- [X] T010 [US1] `frontend/src/components/b/dashboard/BResumeCard.tsx` — 일관성 위해 필요한 정보(시리즈/수정일) 표시 점검(이어쓰기 카드 동작 FR-007 불변).
- [X] T011 [US1] `frontend/src/app/(main)/page.tsx` — others 표시를 `slice(0, 2)`로 제한 + `others.length > 2`일 때 카드 영역 아래 "더 보기"(전체 보기) 링크 → `/library`. 작품 ≤ 3개/1개/0개 엣지(AS#5,6) 처리. → T006 GREEN.
- [X] T012 [US1] 프론트 검증 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN(RSC 경계 포함, 마지막 1회).

**Checkpoint US1**: 작품 4개+ 계정 dogfooding(quickstart US1 1~5).

---

## Phase 4: User Story 2 — 새 디자인 다크모드 지원 (P2)

**Goal**: 새 디자인(홈·마이페이지 등)이 다크 선택 시 즉시 다크로 전환. FE 단독(BE 0).

**Independent Test**: 마이페이지 설정 다크 선택 → 홈·마이페이지 즉시 다크, 라이트 복귀 즉시, 새로고침 유지(quickstart US2).

### 게이트 0 — 목업 (구현 전 필수)

- [X] T013 [US2] `docs/research/2026-06-24-bdesign-dark-mockup.html` 작성 — 홈·마이페이지 다크 팔레트 + **회색 계조(gray-400/500/600 등 보조 텍스트·테두리) 다크 대응 매핑** + 대비(AA) 시안. (impeccable 스킬 활용 가능)
- [X] T014 [US2] **사용자 승인 게이트** — T013 목업을 사용자에게 제시·승인 받기. **승인 전 T015+ 색상 치환 착수 금지.**

### 구현 (목업 승인 후, FE 단독)

- [X] T015 [US2] `frontend/src/styles/tokens.css` `:root.dark` 블록에 목업 확정 **다크 회색 계조 토큰** 보강(보조 텍스트·테두리·surface 단계). 라이트 `:root`에 대응 의미색 토큰도 정의.
- [X] T016 [US2] `frontend/src/app/globals.css` `@theme inline` 에 신규 의미색 토큰(예: `--color-text-muted`, `--color-surface`, `--color-border` 등) 매핑 추가(필요 시).
- [X] T017 [P] [US2] 새 디자인 색상 치환 — `frontend/src/components/b/**` 의 고정 gray/white(`bg-white`·`text-gray-*`·`border-gray-*` 등)를 의미색 토큰(`bg-canvas`/`text-ink`/`border-hairline`/신규 토큰) 또는 `dark:` variant 로 치환. 로직·구조 불변(surgical).
- [X] T018 [P] [US2] 새 디자인 색상 치환 — `frontend/src/components/mypage/**`(PreferencesSections·MypageSidebar 등) 동일 치환. `PreferencesSections.tsx:78` "라이트 고정" 주석 갱신/제거.
- [X] T019 [US2] `frontend/src/app/(main)/page.tsx` 및 홈 직접 색상(있다면) 치환 점검 — 홈 전체가 다크 대응되는지.
- [X] T020 [US2] 프론트 검증 — `cd frontend && pnpm lint && pnpm typecheck && pnpm build` GREEN(색상은 시각이라 단위테스트 미보장, 빌드/타입만).

**Checkpoint US2**: 라이트/다크 양쪽 + 한국어 본문 1문단 dogfooding(quickstart US2 1~4, 대비 AA·폰트 fallback).

---

## Phase 5: Polish & Cross-Cutting

- [X] T021 회귀 확인 — 기존 다크 동작 화면(A 디자인 집필실) 무손상, 라이트 외관 무회귀. 홈 진입·이어쓰기·설정 영속 동작 회귀 없음(SC-005).
- [X] T022 전체 게이트 — backend `./gradlew ... test build` + frontend `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 최종 GREEN.

---

## Dependencies & 실행 순서

- **Phase 1(T001)** → 이후 전체.
- **US1(Phase 3)** 와 **US2(Phase 4)** 는 독립 — 병렬 가능. 단:
  - US1 내부: T002(테스트)→T003·T004→T005(BE) **선행** → T006~T011(FE)→T012.
  - US2 내부: **T013→T014(승인 게이트)** 통과 후에만 T015~T020.
- **Phase 5** 는 US1·US2 완료 후.

### 병렬 기회
- T002와 T006(서로 다른 테스트 파일, 다른 스토리) [P].
- T007·T017·T018 등 [P] 표기 = 서로 다른 파일.

## MVP / 증분 전략
- **MVP = US1**(P1) 단독으로 홈 카드 개선 가치 제공·배포 가능(BE 선행→FE).
- **US2**(P2)는 목업 승인 게이트 통과 후 FE 단독 증분. US1과 분리 배포 가능.

## 배포 순서
- US1: 백엔드(categoryName) 선행 배포 → 프론트 후행(없어도 "미분류" fallback).
- US2: 프론트 단독.
