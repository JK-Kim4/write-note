# Phase 0 Research: 038 홈 카드 + 다크모드

조사 근거는 develop(`f497951`) 기준 워크트리 코드 직접 확인(Explore 2회 + 직접 grep/read).

## US1 — 홈 작품 카드 데이터 가용성

**Decision**: 시리즈명(`categoryName`)만 백엔드 additive 보강, 나머지 표시값은 기존 응답 재사용.

**Rationale (코드 근거)**:
- 프론트 `ProjectCard`(`frontend/src/lib/types/domain.ts:13-22`)와 백엔드 `ProjectCardResponse`(`backend/.../model/response/ProjectCardResponse.kt:11-41`)에 이미 존재: `title`, `categoryId`(시리즈 식별자), `lastSentenceSource`(마지막 작성 평문), `documentUpdatedAt`(최종 수정일), `createdAt`(생성일), `totalDurationMs`(총 집필 시간).
- **없는 것은 `categoryName`뿐** — `categoryId`만 있어 카드에 시리즈 "이름"을 못 보여줌.
- 총 집필 시간은 `ProjectService.listCards()`가 `workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(...)` 합산으로 이미 제공(타임워치). 신규 조회 0.
- 호버 말풍선 패턴은 `/library`의 `DraggableWorkCard.tsx:73-79`에 이미 존재(`group-hover:visible` + `formatDate(createdAt)` + `formatDurationKo(totalDurationMs)`) → 홈 카드에 동일 패턴 재사용.

**Alternatives considered**:
- 카드 응답에 `categoryName`을 안 넣고 프론트가 별도 카테고리 목록을 조회해 조인 → 추가 요청·복잡도. 기각(서버가 카드 조립 시 이미 category 접근 가능).

**N+1 회피**: `listCards()`가 여러 작품을 처리하므로, 등장하는 `categoryId` 집합을 모아 카테고리를 **일괄 조회**해 id→name 맵으로 매핑한다(작품마다 개별 조회 금지). 미분류(categoryId null)는 name null → 프론트 "미분류".

## US1 — "더 보기" 표시 조건

**Decision**: `selectDashboard`는 others 전체를 계속 반환하고, 표시는 page에서 `others.slice(0, 2)`. "더 보기"는 `others.length > 2`일 때만 노출, 목적지 `/library`.

**Rationale**: 정렬 로직(`dashboardView.ts:selectDashboard`)은 순수함수로 유지(테스트 용이). 개수 제한·"더 보기"는 표시 레이어(page) 책임. 작품 ≤ 3개(=others ≤ 2)면 모두 보이므로 "더 보기" 숨김(FR-011, AS#5).

## US2 — 다크모드가 새 디자인에 미적용인 근본원인

**Decision (확정 사실)**: 토글 메커니즘은 정상. 새 디자인(B)이 고정 Tailwind 색상을 써서 `.dark`에 무반응.

**근거**:
- `useThemeEffect`(`ThemeToggle.tsx:36-46`) → `document.documentElement.classList.toggle("dark", isDark)` 정상. `providers.tsx:22`에서 호출.
- `tokens.css :root.dark`(64-82행)가 `--w-canvas/parchment/ink/hairline/accent` 등을 다크 톤으로 재정의 — 다크 CSS 존재.
- `globals.css @theme inline`에 의미색 토큰 매핑 존재: `--color-canvas`=`--w-canvas`, `--color-ink`, `--color-parchment`, `--color-hairline`, `--color-accent` → 이들은 `.dark`에서 자동 전환.
- **그러나** B 디자인 컴포넌트는 의미색 토큰(`bg-canvas`/`text-ink`)을 안 쓰고 고정 gray 계열을 씀. 분포(홈+마이페이지+b): `text-gray-400`×39, `border-gray-200`×36, `bg-white`×30, `text-gray-600`×21, `text-gray-900`×20, … (gray/white 계열 다수). `dark:` variant 사용 0건, `var(--w-*)`/의미색 토큰 사용 0건.
- 다크가 실제 보이는 화면 = A 디자인(집필실 `ManuscriptGrid` 등 `var(--w-*)` 기반).

**함의**: 단순 버그가 아니라 새 디자인의 다크 미지원(의도적 "라이트 고정", `PreferencesSections.tsx:78` 주석). 사용자 결정 = **새 디자인 전체 다크 지원(목업 선행)**.

## US2 — 다크 전환 접근

**Decision**: (1) 목업으로 다크 팔레트·회색 계조 매핑 확정 → (2) `tokens.css`에 다크 회색 계조 토큰 보강 + `@theme` 의미색 확장 → (3) 새 디자인 컴포넌트의 고정 gray/white를 **의미색 토큰 기반**으로 치환(가능한 곳) + 토큰화 어려운 잔여는 `dark:` variant.

**Rationale**:
- 의미색 토큰화는 `.dark`에서 자동 전환되어 유지보수가 좋다(`tokens.css` 다크 변수 재사용).
- 단, 현재 다크 변수는 surface/ink/hairline 중심이라 **중간 회색 계조(gray-400/500/600 등 보조 텍스트·테두리)**의 다크 대응이 부족 → 목업에서 그 계조를 디자인하고 토큰으로 보강해야 함. 그래서 **목업 게이트가 필수**(색만 보고는 계조 결정 불가).
- 전면 `dark:` variant 나열(접근 B 단독)은 ~270곳 × 다크값이라 누락·비일관 위험. 의미색 토큰 우선이 비용·일관성 우위.

**Alternatives considered**:
- 라이트 전용 유지 + 토글 제거(작은 작업) → 사용자가 다크 지원을 선택해 기각.
- 핵심 화면만 다크 → 화면 간 불일치(다크인데 일부만 라이트) UX 저하로 기각, 전체 지원 선택됨.

**Risk / 검증**:
- 시각 결과는 단위테스트로 미보장(CLAUDE.md §14) → 라이트/다크 양쪽 + 한국어 본문 1문단 dogfooding(폰트·대비·계조). 대비(AA) 점검.
- 색상 치환은 로직·구조 불변(surgical) — 텍스트/데이터 무손실.
