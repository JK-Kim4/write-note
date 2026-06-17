# Feature Specification: 모바일 집필 지원 (iOS 입력 + 반응형)

**Feature Branch**: `026-mobile-editor-support`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "모바일 대응 라운드 — iOS 본격 집필 가능 에디터 + 모바일 버그 fix. 데스크탑 Chromium 전용 자체 에디터를 iOS(WebKit)에서도 동작하게 하고, 모바일 반응형 버그를 고친다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - iOS에서 한글 집필 (Priority: P1)

아이폰·아이패드(iOS) 작가가 집필실에 들어가 한글을 타이핑하면 글자가 정확히 입력되고, 한글 IME 조합(받침이 다음 글자로 넘어가는 재조합, 한자 변환 등)이 데스크탑과 동일하게 동작한다. 현재는 iOS에서 입력 자체가 되지 않는다.

**Why this priority**: 이 라운드의 양보불가 핵심. "iOS에서 글이 안 써진다"가 작업의 근본 동기이며, 이것이 안 되면 나머지(편집 기능·반응형)는 의미가 없다.

**Independent Test**: iOS Safari로 집필실에 진입해 한글 한 문단을 입력 → 정확히 표시되고 받침 재조합이 올바른지 실기기로 확인하면 단독 검증된다.

**Acceptance Scenarios**:

1. **Given** iOS Safari 집필실, **When** 한글을 타이핑, **Then** 입력한 글자가 정확히 화면에 표시되고 문서 모델에 반영된다
2. **Given** 조합 중인 한글 글자, **When** 다음 자모를 입력, **Then** 받침이 올바르게 재조합된다(예: "갑"+ㅏ → "가바"가 아니라 의도대로 분해/조합 — 025의 4케이스: 빠른 타자/조합 중 mark/한자 변환/Backspace 분해)
3. **Given** 데스크탑 Chrome, **When** 기존처럼 타이핑, **Then** 기존 동작이 그대로 유지된다(무회귀)

---

### User Story 2 - iOS에서 데스크탑과 동일한 편집 (Priority: P2)

iOS에서 캐럿 이동, 선택/드래그, 편집키(Backspace·Delete·Enter·Shift+Enter 소프트 줄바꿈), 마크(굵게·기울임·밑줄·취소선), 블록(제목 H1~3·인용·글머리표/번호 목록·구분선), 실행취소/다시실행, 복사·잘라내기·붙여넣기(서식 보존), 목차 점프, 자동저장, 페이지 분할이 데스크탑(크롬) 에디터와 동일하게 동작한다.

**Why this priority**: 입력만 되고 편집(선택·서식·블록 등)이 안 되면 반쪽짜리다. 데스크탑에 이미 구현된 전 기능을 iOS에서 best-effort로 동일하게 제공한다.

**Independent Test**: iOS에서 각 편집 동작(선택→굵게, Enter 분할, 목록 전환, 붙여넣기 등)을 수행해 데스크탑과 동일 결과가 나오는지 확인한다.

**Acceptance Scenarios**:

1. **Given** iOS에서 텍스트 선택, **When** 굵게 토글, **Then** 선택 구간만 굵게(데스크탑과 동일)
2. **Given** iOS 캐럿이 문단 중간, **When** Enter, **Then** 블록이 분할되고 캐럿이 새 블록 머리로
3. **Given** iOS에서 서식 있는 텍스트 복사 후 붙여넣기, **Then** 서식(마크·블록)이 보존된다
4. **Given** iOS에서 편집, **When** 자동저장 주기 도달, **Then** 데스크탑과 동일하게 저장되고 버전 충돌 없음

---

### User Story 3 - 모바일 반응형 (Priority: P3)

모바일 화면 폭에서 헤더·에디터·셸이 깨지지 않는다. 특히 상단 메뉴바가 화면 폭을 넘쳐 좌우로 슬라이드되는(가로 스크롤) 문제가 해결된다.

**Why this priority**: 입력과 독립적인 모바일 UX 결함. 입력이 되어도 레이아웃이 깨지면 사용성이 나쁘다.

**Independent Test**: 모바일 폭(예: 360~430px)에서 집필실 및 주요 화면을 열어 가로 스크롤이 없고 헤더가 화면 안에 들어오는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 모바일 폭 화면, **When** 집필실(및 홈/작품/메모 등 B 화면) 진입, **Then** 헤더 메뉴가 화면 폭 안에 들어오고 좌우 가로 스크롤이 없다
2. **Given** 모바일에서 화면을 좌우로 밀어봄, **When** 슬라이드 시도, **Then** 콘텐츠가 옆으로 밀리지 않는다(가로 overflow 없음)

---

### Edge Cases

- iOS에서 IME 조합 중에 블록 전환(제목↔본문)이나 페이지 경계를 넘으면 조합이 깨지지 않아야 한다.
- 입력 환경 감지(데스크탑 EditContext vs iOS 대체 경로)가 잘못되면? → 기능 감지(EditContext 지원 여부) 기준으로 분기하며, 미지원이면 대체 경로를 쓴다.
- iOS 대체 입력 표면과 자체 엔진이 직접 그리는 캐럿/선택이 충돌(이중 캐럿 등)하지 않아야 한다.
- contenteditable로 재현이 어려운 데스크탑 기능이 있으면 best-effort로 최대한 구현하고, 불가한 부분은 명시 보고한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 iOS(EditContext 미지원 환경)에서 한글을 포함한 텍스트 입력을 지원해야 한다(MUST)
- **FR-002**: iOS 입력의 한글 IME 조합 정확성(받침 재조합/빠른 타자/한자 변환/Backspace 분해 — 025의 4케이스)을 보장해야 한다(MUST)
- **FR-003**: 데스크탑(EditContext 지원 환경)의 기존 입력 동작은 변경되지 않아야 한다(무회귀, MUST) — 기존 자동화 테스트가 GREEN으로 유지된다
- **FR-004**: iOS에서 캐럿 이동·선택·드래그가 데스크탑과 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-005**: iOS에서 편집키(Backspace·Delete·Enter·Shift+Enter 소프트 줄바꿈)가 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-006**: iOS에서 마크(굵게·기울임·밑줄·취소선)가 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-007**: iOS에서 블록(제목 H1~3·인용·글머리표/번호 목록·구분선)이 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-008**: iOS에서 실행취소/다시실행이 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-009**: iOS에서 복사·잘라내기·붙여넣기(서식 보존)가 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-010**: iOS에서 목차 점프·자동저장·페이지 분할이 동일하게 동작해야 한다(best-effort, SHOULD)
- **FR-011**: 모바일 폭에서 헤더의 가로 overflow(좌우 슬라이드)가 없어야 한다(MUST)
- **FR-012**: 모바일 폭에서 에디터·셸 레이아웃이 깨지지 않아야 한다(MUST)
- **FR-013**: best-effort 항목 중 iOS에서 구현 불가하거나 데스크탑과 차이가 남는 부분은 명시 보고해야 한다(MUST)
- **FR-014**: iOS 입력이 동작하게 된 후, 기존 임시 안내 배너(iOS 미지원 안내)는 제거하고, 핀치 줌 제한(minimum-scale)은 반응형 정리 후 유지/제거를 재검토해야 한다(MUST)

### Key Entities *(데이터 관련 시 포함)*

- **입력 경로(Input Source)**: 실행 환경에 따라 달라지는 입력 수집 메커니즘. 데스크탑은 기존 경로, iOS(미지원 환경)는 대체 경로. 두 경로 모두 동일한 문서 모델·렌더·페이지 분할을 공유한다.
- **DocModel(문서 모델)**: 기존 자체 엔진의 문서 표현(텍스트 버퍼 + 블록 속성 + 마크). 입력 경로와 무관하게 동일하다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: iOS Safari 실기기에서 한글 문단 입력이 100% 성공한다(현재 0%)
- **SC-002**: 한글 IME 4케이스(025)가 iOS에서 정확히 동작한다
- **SC-003**: 데스크탑 기존 에디터 자동화 테스트가 무회귀로 통과한다(현 545+ 테스트 GREEN 유지)
- **SC-004**: iOS에서 데스크탑 에디터의 편집 기능이 best-effort로 동일하게 동작하며, 구현 가능/불가 기능 목록이 보고된다
- **SC-005**: 모바일 폭 화면에서 좌우 가로 스크롤(왼쪽 슬라이드)이 발생하지 않는다
- **SC-006**: 모바일 화면에서 헤더·에디터·셸 레이아웃 깨짐이 없다

## Assumptions

- iOS의 모든 브라우저는 WebKit 기반이며 데스크탑 입력에 쓰는 EditContext를 지원하지 않는다(caniuse 검증, 2026-06). 따라서 iOS는 대체 입력 경로가 필요하다.
- 안드로이드 Chrome은 EditContext를 지원해 이미 입력이 되므로, 입력 신규 작업은 iOS만 대상이다(안드로이드는 반응형만 적용).
- 입력 경로 분기는 브라우저 종류 추측이 아니라 기능 감지(EditContext 지원 여부)로 한다.
- 데스크탑 입력 경로(EditContext)는 그대로 유지하며 무회귀가 필수다.
- iOS 한글 IME 정확성은 자동화로 완전히 검증할 수 없고 실기기 dogfooding으로 최종 확인한다(사용자 몫).
- iOS 대체 입력은 contenteditable 기반이 적합하다(CodeMirror도 모바일은 contenteditable 기본, hidden textarea는 모바일 IME에 문제 — 검증). 단, 자체 엔진의 문서 모델·직접 렌더·페이지 분할 로직은 재사용한다.
- 백엔드 변경은 없다.
- 기존 임시 패치(루트 viewport minimum-scale=1 핀치줌 차단, iOS 안내 배너)는 이 라운드 결과에 따라 재검토된다.
