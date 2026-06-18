# Research: iOS 자체 에디터 입력 어댑터

## ⚠️ 최종 결론 (2026-06-18) — iOS 자체에디터 입력 **미지원으로 결정**

iOS 자체에디터 입력은 **두 방식 모두 실패** → **미지원으로 되돌림**(사용자 결정). 데스크탑·안드 Chromium만 자체 에디터 입력(EditContext) 지원. 반응형(US3)만 완료.

1. **contenteditable**(Decision 1·3·4): iOS 한글 IME에서 DOM 재구성 시 IME 상태 orphan → 자모 중복·줄바꿈 소실. PoC 실패 폐기.
2. **hidden textarea 프록시**(Decision 6): 입력(타이핑·IME·줄바꿈·단일탭)은 됐으나, **iOS 네이티브 선택(더블탭·핸들)이 textarea 자체 레이아웃에서 일어나 렌더 페이지와 발산**(블록폰트·페이지분할 불일치). full-size textarea에선 `user-select:none`으로도 억제 불가(실측 확정), caret-앵커 tiny textarea도 dogfooding 중 한계 → **사용자가 iOS 편집 미지원 결정**(Decision 7).

**현 코드 상태**: textarea 어댑터·관련 진단 라우트 제거, iOS(EditContext 미지원)는 "글쓰기 미지원 안내 + 집필실 페이지 차단"(읽기 전용도 아님). 아래 Decision 1~6은 **시도 기록**(따르지 말 것). Decision 5(반응형)만 채택·완료. 상세는 Decision 7.

---

## Decision 1 — iOS 입력 = contenteditable + composition/beforeinput  **[SUPERSEDED 2026-06-18 → Decision 6]**

**선택(폐기됨)**: iOS(WebKit)는 contenteditable 요소에 입력을 받고 `compositionstart/update/end` + `beforeinput`(inputType) 이벤트로 DocModel에 반영한다.

**근거(당시)**: caniuse 검증(2026-06) — EditContext는 iOS WebKit 전 버전 미지원. CodeMirror(자체 렌더 에디터 대표)도 모바일 입력 모델 기본이 contenteditable이며 IME·접근성이 contenteditable에서 우수. hidden textarea proxy는 모바일 IME 깨짐(중국어 입력 사례) — 한글도 위험해 기각.

**실측 결과(2026-06-18)**: 위 근거 중 "contenteditable이 IME에 우수"가 **iOS 한글에서 거짓**으로 판명. iOS 한글 키보드는 조합 이벤트(compositionstart/end)를 안 쏘면서 내부 IME 상태(markedText)를 유지하는데, 우리가 DOM을 재구성하면 그 상태가 orphan 돼 자모 중복("요요")·줄바꿈 소실이 발생. 반대로 "hidden textarea가 모바일 IME에 문제"도 **한글에서는 거짓**(중국어 사례는 한글에 부적용) — CodeMirror 2/5·Monaco가 textarea 프록시로 IME를 네이티브 처리. → Decision 6으로 전환.

## Decision 2 — EditContext ↔ 대체 입력 이벤트 매핑  **(유효 — iOS 열은 Decision 6의 textarea로 대체)**

기존 `CustomEditor.tsx` EditContext 결합부를 **어댑터 인터페이스(`InputAdapter`)로 추상화**하는 결정은 유효하다(실제 `inputAdapter.ts`로 구현). 아래 표의 iOS 열은 당시 contenteditable 가정이며, **실제 iOS 어댑터는 hidden textarea value-diff(Decision 6)** 로 대체됐다.

| 자체 엔진이 필요로 하는 것 | EditContext(데스크탑) | contenteditable(iOS) |
|---|---|---|
| 텍스트 삽입/치환 | `textupdate`(updateRangeStart/End, text) | `beforeinput` insertText/insertCompositionText + composition |
| IME 조합 추적 | `compositionstart`/`end` | `compositionstart`/`update`/`end` |
| 모델→입력소스 텍스트 동기 | `ec.updateText(0, len, buffer)` | contenteditable textContent 동기(또는 proxy 재설정) |
| 모델→입력소스 선택 동기 | `ec.updateSelection(a, b)` | DOM Selection/Range 설정 |
| 편집키(Enter/Backspace 등) | host `keydown`(자체 처리) | `beforeinput` insertParagraph/deleteContentBackward 등 inputType 분기 |
| 복사/잘라내기/붙여넣기 | host `copy/cut/paste`(공통) | host `copy/cut/paste`(공통, 어댑터 무관) |

**핵심 차이**: EditContext는 텍스트(`textupdate`)와 편집키(`keydown`)가 분리. contenteditable은 `beforeinput`의 `inputType`이 둘을 통합(insertText/insertParagraph/deleteContentBackward/…). → contenteditable 어댑터는 `beforeinput`을 inputType별로 분기해 기존 model.ts 연산(insertText/splitBlock/mergeWithPrev/deleteRange)으로 라우팅하고, 대부분 `e.preventDefault()`로 브라우저 기본 DOM 편집을 막아 **모델이 단일 진실**이 되게 한다.

## Decision 3 — contenteditable과 자체 직접 렌더의 캐럿 충돌  **[SUPERSEDED 2026-06-18 → Decision 6]**

**문제**: 자체 엔진은 캐럿·선택을 직접 그린다(`caretToScreen`/`screenToCaret`/`selectionRects`). contenteditable은 브라우저가 캐럿·선택을 관리 → 이중 캐럿/선택 위험.

**방향(PoC로 확정)**: contenteditable을 **입력 수집 전용 표면**으로 쓰고(텍스트는 자체 렌더가 표시), 브라우저 기본 캐럿은 숨기거나(`caret-color: transparent`) 오프스크린/투명 처리한다. = 기존 EditContext가 "보이지 않는 입력 컨텍스트"였던 것과 같은 역할을 contenteditable이 맡는 구조. 단, IME 조합 표시(밑줄 친 조합 글자)는 contenteditable이 보여줘야 자연스러울 수 있어, **PoC에서 (a) 완전 투명 proxy vs (b) 조합 중에만 표시** 중 한글 IME가 정확한 쪽을 실측 결정.

## Decision 4 — 받침 재조합(025 IME 4케이스) 재현  **[SUPERSEDED 2026-06-18 → Decision 6]**

기존 025가 EditContext에서 해결한 4케이스(빠른 타자 / 조합 중 mark 토글 / 한자 변환 / Backspace 자모 분해)를 contenteditable `compositionupdate`/`beforeinput(insertCompositionText)` 기반으로 재현한다. EditContext에서 쓴 워크어라운드(조합 중 `setSel` 억제로 받침 재조합 보호)에 해당하는 처리를 contenteditable composition 흐름에 맞춰 적용.

**미확정(PoC·실기기 검증 필수)**: contenteditable의 iOS 한글 IME 조합 이벤트 순서·정확성. 자동화로 완전 검증 불가 → 사용자 실기기 dogfooding이 최종 게이트.

## Decision 5 — 반응형(헤더 가로 overflow)

`b/layout.tsx` 헤더 nav가 모바일 폭에서 반응형 처리 없이 가로로 넘쳐 body 가로 스크롤(왼쪽 슬라이드) 유발. 모바일에서 메뉴를 접거나(드로어/오버플로) 가로 스크롤 가능 영역으로 격리하고, 필요 시 컨테이너 `overflow-x` 제어. BStudioShell·stage는 기존 880px 분기 위에서 점검.

## Decision 6 — iOS 입력 = hidden textarea 입력 프록시  **[SUPERSEDED 2026-06-18 → Decision 7: 미지원 결정]**

**선택**: iOS(WebKit, EditContext 미지원)는 **자체 엔진 stage를 전체 덮는 투명 hidden `<textarea>`** 를 입력 수집 표면으로 쓴다(`createTextareaAdapter`). textarea가 한글 IME·Enter·캐럿 이동을 **네이티브로 처리**하고, 우리는 그 `value`를 diff해서만 모델에 반영한다(DOM 재구성 안 함 → IME 상태 orphan 없음). 표시는 기존 자체 렌더 엔진이 전담(textarea는 글자·캐럿 모두 투명).

**근거**:
- **근본 원인(Decision 1 실패)**: iOS 한글 키보드는 `compositionstart/end`를 안 쏘면서 내부 IME 상태(markedText)를 유지 → contenteditable DOM을 우리가 재구성하면 그 상태가 orphan 돼 자모 중복·줄바꿈 소실. sentinel `\n`·trailing `<br>`·keydown Enter 처리 모두 실패(§11 헛수정 반복 후 정지).
- **검증 패턴**: deep research 2종(출처 39+43) → CodeMirror 2/5·Monaco가 모두 hidden textarea 프록시로 IME를 네이티브 처리. 우리가 DOM을 만지지 않으므로 orphan이 원천 차단.
- **실기기 dogfooding 전부 통과**: 한글 IME(받침 재조합)·줄바꿈(중복 0)·글자 크기 reflow·탭 이동+작성.

**핵심 정합**:

| 자체 엔진이 필요로 하는 것 | EditContext(데스크탑) | **textarea(iOS, 채택)** |
|---|---|---|
| 텍스트 삽입/치환 | `textupdate` | `input` → `value` diff(공통 prefix/suffix 제거) → `onTextUpdate` |
| IME 조합 추적 | `compositionstart`/`end` | `compositionstart`/`end`(조합 중 syncText/syncSelection 억제) |
| 줄바꿈(Enter) | host `keydown`→splitBlock | textarea가 `value`에 `\n` 삽입 → diff → `insertText`가 blockAttrs까지 분할(별도 onEdit 라우팅 **불필요**) |
| 캐럿/선택 이동(클릭·화살표·탭) | host `keydown` 직접 | textarea 네이티브 → `selectionchange` → `onSelectionChange`로 렌더 캐럿 추종 |
| 모델→입력소스 동기 | `ec.updateText/Selection` | `textarea.value` / `setSelectionRange`(조합 중 억제) |
| 복사/잘라내기/붙여넣기 | host `copy/cut/paste`(공통) | host `copy/cut/paste`(공통) ⚠️ textarea 네이티브 클립보드와 충돌 가능 — **US2에서 점검** |

- **offset 1:1**: `textarea.value === model.buffer`(둘 다 `\n` 줄 구분) → 오프셋 매핑 단순.
- **이중처리 차단**: textarea `keydown`을 `stopPropagation` → host의 EditContext용 `onKey`가 안 받음(textarea가 입력 전담).
- **폴링 안전망**: iOS가 일부 IME 입력에 `input`을 안 쏠 수 있어 포커스 중 150ms 간격으로 value 동기(CodeMirror 전략).
- **소프트 키보드**: iOS는 사용자 제스처 콜스택 내 `focus()`라야 키보드가 뜸 → stage 탭 핸들러에서 `focusInput()` 호출.

**US2 잔여 리스크(미해결, dogfooding 게이트)**:
- **소프트 줄바꿈(Shift+Enter)**: textarea는 Enter·Shift+Enter 모두 `value`에 `\n`을 넣어 둘을 value diff로 **구분 불가** → 현재 둘 다 splitBlock으로 귀결. softBreak(U+2028) 분기 방법 미확정.
- **마크/블록 토글·undo/redo**: textarea가 키를 `stopPropagation`하므로 host keydown 단축키 경로가 iOS에서 안 닿을 수 있음 — toolbar 경유/별도 라우팅 점검 필요.
- **복붙**: 위 표 ⚠️.

## Decision 7 (최종 채택, 2026-06-18) — iOS 자체에디터 입력 **미지원**

**선택**: iOS 자체에디터 입력을 **지원하지 않는다**(사용자 결정). 데스크탑·안드 Chromium(EditContext)만 입력. iOS(EditContext 미지원)는 "글쓰기 미지원 안내 배너" + **집필실 페이지(`/b/works/[id]`) 차단**(읽기 전용 아님).

**근거**: Decision 6(textarea)의 입력은 됐으나 **iOS 네이티브 선택(더블탭 단어선택·핸들·돋보기)이 억제 불가**. full-size textarea는 `user-select:none`을 iOS가 무시(form 컨트롤, 실측 확정)하고, caret-앵커 tiny textarea로 표면을 줄이는 변형도 dogfooding 중 한계가 보여, **투자 대비 효용이 낮다고 판단해 미지원으로 되돌림**. 입력(타이핑·IME)만 되고 선택·마크가 불안정한 "반쪽 에디터"보다 명확한 미지원 안내가 UX상 낫다는 판단.

**코드 정리**: `textareaAdapter`(+test)·`setCaretRect`·`debugNoZoom`·`poc/mobile-editor`·`ios-textarea-probe` 제거. `editContextUnsupported` 배너 복원 + iOS에서 입력 어댑터 미부착 + 집필실 페이지 가드. `InputAdapter` 추상화(editContextAdapter=데스크탑)는 유지.

**남은 가치(US3 완료)**: 모바일 반응형은 별개로 완료 — 헤더 가로 overflow를 햄버거 메뉴로 해소(`b/layout.tsx`), 에디터는 화면 폭(≤880px) 기준 reflow(EditContext 지원하는 좁은 화면 = 안드 모바일·좁은 데스크탑 창에서 A4 축소 대신 화면 폭에 맞춤). 운영(harubuild.xyz) 배포·검증 완료.
