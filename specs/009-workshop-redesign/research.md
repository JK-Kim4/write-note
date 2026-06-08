# Phase 0 Research — 작업실 디자인 고도화

설계 진입 전 해소해야 할 결정들. 각 항목: Decision / Rationale / Alternatives.

---

## R1. "다음 장면" 데이터 출처 (FR-002, FR-027) — 사용자 확정: 직접 입력

**Decision (2026-06-06 사용자 확정, 목업 `next-scene-options.html` B안)**: "다음에 쓸 장면"은 **작가가 직접 적고 수정하는 작품 단위 속성**으로 저장한다. `projects` 테이블에 `next_scene TEXT NOT NULL DEFAULT ''` 컬럼을 신설(스키마 v5, 고정 `pinned` 와 같은 마이그레이션에 묶음). 작품 벽 카드와 재진입 한 장에 표시하고 거기서 편집한다. 비어 있으면 빈 상태.

**Rationale**: 사용자가 목업으로 두 방향(곁쪽지 대체 vs 직접 입력)을 비교한 뒤 직접 입력을 선택. "다음에 뭘 쓸지"를 작가가 의도적으로 남기는 것이 재진입 안도감의 핵심이라는 판단. 곁 쪽지(고정)와는 별개의 정보로 분리.

**Alternatives (기각)**:
- 곁에 둘 쪽지(고정)로 대체 → 입력/스키마 최소였으나, "다음 장면"과 "곁에 둘 자료"는 작가에게 다른 의미. 사용자가 직접 입력을 명시 선택.
- 마지막 문장에서 자동 추론 → 미작성 미래라 불가능.

**범위 영향**: 데이터 확장이 고정(`memo_projects.pinned`) 1건 → 고정 + `projects.next_scene` 2건. project 레이어(schema/projectRepository/projects.update IPC) 변경 + backend 테스트 추가.

---

## R2. "마지막 문장" 추출 (FR-001, US1/US2)

**Decision**: `Document.plainText` 의 마지막 비어있지 않은 문장(문장부호 또는 줄바꿈 기준 마지막 조각)을 파생해 표시한다. 저장하지 않는다(읽기 시 파생). 본문이 비면 빈 상태 문구("아직 첫 문장을 기다리는 중" 등)로 대체. 신규 순수 함수 `src/lib/lastSentence.ts` 로 분리해 단위 테스트.

**Rationale**: `documents.plain_text` 가 이미 존재(저장됨). 별도 저장 없이 파생 가능. 순수 함수라 TDD 단위 테스트 용이(한국어 문장부호 `.`/`?`/`!`/`…`/줄바꿈 처리).

**Alternatives**: `body_json`(TipTap JSON) 파싱 → 무겁고 구조 의존. `plainText` 가 더 단순. 기각.

---

## R3. 곁에 둘 쪽지 고정 — 데이터 모델 (US6, FR-024~026)

**Decision**: 스키마 v5 — `memo_projects` 에 `pinned INTEGER NOT NULL DEFAULT 0` 추가(0/1). 작품당 1개 고정(FR-026)은 **set 시 같은 project_id 의 다른 행 pinned=0 후 대상 행 pinned=1** 를 한 트랜잭션으로. 연결 해제(removeLink) 시 행이 삭제되므로 고정도 자동 소멸(FR-025).

**Rationale**: 고정은 (memo, project) 쌍 속성 → 연결 테이블이 정확한 위치. `ON DELETE CASCADE`/행 삭제로 FR-025 자동 충족. boolean 1컬럼이라 마이그레이션 최소(ALTER ADD COLUMN, 기존 v2~v4 패턴과 동일).

**Alternatives**: `memos` 에 `pinned_project_id` → 메모가 여러 작품에 연결될 때 작품별 독립 고정 불가(FR-025 위반). 기각. 별도 `pins` 테이블 → 과설계(1컬럼으로 충분). 기각.

---

## R4. 재진입 한 장 선정 로직 (FR-023)

**Decision**: backend use-case `store.pickReentryMemo(projectId): Memo | null`. 우선순위:
1. 그 작품에 연결된 메모 중 `memo_projects.pinned = 1` (고정),
2. 없으면 `memo_projects.created_at` 최신(최근 연결),
3. 없으면 그 작품 연결 메모 중 `memos.captured_at` 최신(최근 캡처).
soft delete(`memos.deleted_at IS NOT NULL`) 메모는 후보에서 제외.

**Rationale**: 선정은 데이터 질의라 renderer 보다 backend 가 정확·테스트 용이(MemoRepository 쿼리 + store use-case). FR-023 우선순위를 SQL `ORDER BY pinned DESC, mp.created_at DESC` + 별도 캡처 fallback 로 표현. soft delete 제외로 Edge Case 충족.

**Alternatives**: renderer 에서 listByProject 받아 JS 정렬 → 가능하나 로직 분산·중복. backend 단일 출처가 깔끔. 기각.

---

## R5. `--scrap` 토큰 (쪽지 면, FR-011)

**Decision**: DESIGN.md 토큰에 `--scrap`/`--scrap-edge`/`--scrap-ink` 신설. light 는 종이(`--paper` ≈ oklch 0.985)와 구분되는 옅은 크림옐로 계열(예: `--scrap: oklch(0.945 0.045 92)`), dark 는 채도 낮춘 변형(예: `oklch(0.32 0.03 92)`). 쪽지 본문은 `--ink`/`--ink-soft`. **정확값은 구현 시 대비 검증 후 확정** — 본문 대비 ≥4.5:1.

**Rationale**: 메모 쪽지는 "포스트잇/쪽지" 면으로 종이와 시각 구분 필요. 기존 우드/종이/잉크 팔레트와 충돌 없는 따뜻한 옐로. 신규 토큰 3개로 한정(핀/서랍/잉크 방울은 기존 `--accent`/`--surface`/`--hairline` 재사용).

**Alternatives**: `--paper` 재사용 → 쪽지와 종이가 안 구분돼 "흩어진 쪽지" 느낌 약화. 기각. HEX 하드코딩 → 토큰 SoT 위반, 다크 미대응. 기각.

---

## R6. 집필 control 통합 형태 (FR-007)

**Decision**: 확대축소/줄노트/테마/자동저장을 titlebar 의 **단일 "보기" 트리거 → 팝오버 메뉴**로 통합. 기존 `LinkPopover` 의 팝오버 패턴(backdrop + Escape 닫기)을 재사용해 일관성 확보. 저장 상태·글자수는 팝오버 밖 titlebar 상시.

**Rationale**: 드롭다운보다 팝오버가 기존 컴포넌트(LinkPopover)·코드 패턴과 정합. 단일 트리거로 "첫 화면 조작 요소 1개"(SC-002) 달성.

**Alternatives**: 가장자리 접힘 패널 → 공간 차지·여닫기 모션 부담. 드롭다운 네이티브 → 스타일 한계. 팝오버 채택.

---

## R7. 빠른 메모 모달 hardening (US4, FR-016~019)

**Decision**:
- **focus trap**: 모달 mount 시 textarea 자동 focus, Tab/Shift+Tab 이 모달 내부 순환(첫↔마지막 요소 wrap).
- **focus restore**: open 직전 `document.activeElement` 저장 → close 시 복귀.
- **초안 보존**: 내용이 있는 상태로 닫기(Escape/backdrop) 시도 시 즉시 폐기하지 않음 — 확인하거나 초안 유지(구현 시 둘 중 단순한 쪽: 내용 있으면 닫기 무시하고 명시적 "버리기"만 폐기).
- **잉크 한 방울**: Rail 버튼을 잉크 방울 아이콘 + 라벨("잉크 한 방울"/"메모 남기기")로.
- **현재 작품 연결**: 기존 `captureMemo(linkProjectId)` 유지(집필 중 activeProject 자동연결).

**Rationale**: critique P2 + QA 후속. focus trap/restore 는 표준 모달 접근성. 초안 보존은 "글 흐름 끊김 방지" 제품 가치 직결.

**Alternatives**: 전역 단축키 → 비범위(핸드오프). 자동 임시저장(localStorage 초안) → 과설계, 모달 내 보존으로 충분. 기각.

---

## R8. 접근성 — 대비/focus (US5, FR-020~021)

**Decision**:
- 대비: `--faint`(보조/placeholder)·`--muted` 사용처를 점검해 본문급은 `--ink-soft` 이상으로, placeholder 는 `--muted` 이상으로 상향. 라이트·다크 양면 ≥4.5:1.
- focus: 전역 `:focus-visible { outline: none }` 를 제거하고, 컴포넌트별 명시적 `box-shadow` focus ring(`--accent-soft`) 부여. 최소한 QuickCapture/LinkPopover/삭제·고정 토글/Toast action.

**Rationale**: critique 의 실측 지적(--faint on --surface-sunken ≈2.33:1). 전역 outline 제거가 키보드 사용자 위치 상실의 근원.

**Alternatives**: 전역 outline 복원만 → 작업실 톤과 불일치(네이티브 파란 outline). 컴포넌트별 ring 이 톤 유지 + 접근성. 채택.

---

## 미해결 → 전부 해소

위 R1~R8 로 spec 의 [NEEDS CLARIFICATION] 및 plan Technical Context unknown 모두 해소. R1(다음 장면)은 범위 영향이 있어 plan 보고에서 사용자에게 명시 surfacing.
