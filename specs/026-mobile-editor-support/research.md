# Research: iOS contenteditable 입력 어댑터

## Decision 1 — iOS 입력 = contenteditable + composition/beforeinput

**선택**: iOS(WebKit)는 contenteditable 요소에 입력을 받고 `compositionstart/update/end` + `beforeinput`(inputType) 이벤트로 DocModel에 반영한다.

**근거**: caniuse 검증(2026-06) — EditContext는 iOS WebKit 전 버전 미지원. CodeMirror(자체 렌더 에디터 대표)도 모바일 입력 모델 기본이 contenteditable이며 IME·접근성이 contenteditable에서 우수. hidden textarea proxy는 모바일 IME 깨짐(중국어 입력 사례) — 한글도 위험해 기각.

**대안 기각**: hidden textarea(모바일 IME 문제) / 전면 contenteditable 통일(데스크탑 EditContext 무회귀 깨짐 위험) — 플랫폼 분기로 데스크탑 보존.

## Decision 2 — EditContext ↔ contenteditable 이벤트 매핑

기존 `CustomEditor.tsx` EditContext 결합부를 어댑터 인터페이스로 추상화하고, contenteditable 어댑터가 동일 콜백을 만족한다.

| 자체 엔진이 필요로 하는 것 | EditContext(데스크탑) | contenteditable(iOS) |
|---|---|---|
| 텍스트 삽입/치환 | `textupdate`(updateRangeStart/End, text) | `beforeinput` insertText/insertCompositionText + composition |
| IME 조합 추적 | `compositionstart`/`end` | `compositionstart`/`update`/`end` |
| 모델→입력소스 텍스트 동기 | `ec.updateText(0, len, buffer)` | contenteditable textContent 동기(또는 proxy 재설정) |
| 모델→입력소스 선택 동기 | `ec.updateSelection(a, b)` | DOM Selection/Range 설정 |
| 편집키(Enter/Backspace 등) | host `keydown`(자체 처리) | `beforeinput` insertParagraph/deleteContentBackward 등 inputType 분기 |
| 복사/잘라내기/붙여넣기 | host `copy/cut/paste`(공통) | host `copy/cut/paste`(공통, 어댑터 무관) |

**핵심 차이**: EditContext는 텍스트(`textupdate`)와 편집키(`keydown`)가 분리. contenteditable은 `beforeinput`의 `inputType`이 둘을 통합(insertText/insertParagraph/deleteContentBackward/…). → contenteditable 어댑터는 `beforeinput`을 inputType별로 분기해 기존 model.ts 연산(insertText/splitBlock/mergeWithPrev/deleteRange)으로 라우팅하고, 대부분 `e.preventDefault()`로 브라우저 기본 DOM 편집을 막아 **모델이 단일 진실**이 되게 한다.

## Decision 3 — contenteditable과 자체 직접 렌더의 캐럿 충돌

**문제**: 자체 엔진은 캐럿·선택을 직접 그린다(`caretToScreen`/`screenToCaret`/`selectionRects`). contenteditable은 브라우저가 캐럿·선택을 관리 → 이중 캐럿/선택 위험.

**방향(PoC로 확정)**: contenteditable을 **입력 수집 전용 표면**으로 쓰고(텍스트는 자체 렌더가 표시), 브라우저 기본 캐럿은 숨기거나(`caret-color: transparent`) 오프스크린/투명 처리한다. = 기존 EditContext가 "보이지 않는 입력 컨텍스트"였던 것과 같은 역할을 contenteditable이 맡는 구조. 단, IME 조합 표시(밑줄 친 조합 글자)는 contenteditable이 보여줘야 자연스러울 수 있어, **PoC에서 (a) 완전 투명 proxy vs (b) 조합 중에만 표시** 중 한글 IME가 정확한 쪽을 실측 결정.

## Decision 4 — 받침 재조합(025 IME 4케이스) 재현

기존 025가 EditContext에서 해결한 4케이스(빠른 타자 / 조합 중 mark 토글 / 한자 변환 / Backspace 자모 분해)를 contenteditable `compositionupdate`/`beforeinput(insertCompositionText)` 기반으로 재현한다. EditContext에서 쓴 워크어라운드(조합 중 `setSel` 억제로 받침 재조합 보호)에 해당하는 처리를 contenteditable composition 흐름에 맞춰 적용.

**미확정(PoC·실기기 검증 필수)**: contenteditable의 iOS 한글 IME 조합 이벤트 순서·정확성. 자동화로 완전 검증 불가 → 사용자 실기기 dogfooding이 최종 게이트.

## Decision 5 — 반응형(헤더 가로 overflow)

`b/layout.tsx` 헤더 nav가 모바일 폭에서 반응형 처리 없이 가로로 넘쳐 body 가로 스크롤(왼쪽 슬라이드) 유발. 모바일에서 메뉴를 접거나(드로어/오버플로) 가로 스크롤 가능 영역으로 격리하고, 필요 시 컨테이너 `overflow-x` 제어. BStudioShell·stage는 기존 880px 분기 위에서 점검.
