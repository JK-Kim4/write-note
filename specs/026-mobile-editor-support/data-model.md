# Data Model: 입력 어댑터

> **⚠️ 최종(2026-06-18)**: iOS 입력 미지원 결정(research.md Decision 7). `TextareaAdapter`는 제거됐고, `InputAdapter` 구현은 **`EditContextAdapter`(데스크탑·안드) 하나만** 남는다. 아래 TextareaAdapter 서술은 시도 기록.

이 기능은 새 영속 데이터를 만들지 않는다(백엔드 0, DocModel 재사용). 핵심은 **입력 어댑터 인터페이스**다.

## InputAdapter (신규 인터페이스)

`CustomEditor`가 입력 소스에 거는 계약. 두 구현(EditContextAdapter, **TextareaAdapter**)이 만족한다. 실제 정의는 `frontend/src/components/custom-editor/input/inputAdapter.ts`.

```text
InputAdapter
  attach(host: HTMLElement, handlers: InputHandlers): void
  detach(): void
  // 모델 → 입력 소스 동기
  syncText(fullText: string): void
  syncSelection(start: number, end: number): void
  // 입력 소스 현재 상태 읽기
  getText(): string
  getSelection(): { start: number; end: number }
  // IME 조합 중 여부(keydown 가드·캐럿 오프셋 계산용)
  isComposing(): boolean
  // 입력 소스 포커스(소프트 키보드 호출 — iOS는 사용자 제스처 콜스택 내)
  focusInput(): void
  // 제어 영역 경계 갱신(EditContext 전용 — textarea는 no-op)
  updateControlBounds(bounds: DOMRect): void
```

```text
InputHandlers (어댑터 → CustomEditor 콜백)
  onTextUpdate({ rangeStart, rangeEnd, text, selectionStart, selectionEnd })
  onCompositionStart()
  onCompositionEnd(selectionStart: number, selectionEnd: number)
  // 구조 편집 의도(splitBlock/softBreak/deleteBackward/deleteForward/deleteSelection).
  // contenteditable 가정의 잔여 인터페이스 — textarea 경로는 onEdit을 호출하지 않는다
  // (Enter 등은 textarea value의 \n으로 들어와 onTextUpdate→insertText가 분할).
  onEdit(intent: EditIntent): void
  // 텍스트 변경 없는 캐럿/선택 이동(클릭·화살표·탭) — textarea 어댑터 전용.
  // textarea가 캐럿 이동을 네이티브 처리하므로 그 결과를 렌더 캐럿에 반영.
  onSelectionChange(selectionStart: number, selectionEnd: number)
```

**참고**: 복사/잘라내기/붙여넣기(`copy`/`cut`/`paste`)는 host 요소 이벤트로 처리되며 입력 어댑터와 독립(공통 코드 유지, ⚠️ textarea 네이티브 클립보드와 충돌 가능 — US2 점검). 캐럿 이동은 어댑터별로 다르다(EditContext=host keydown, textarea=네이티브+`onSelectionChange`).

## 두 구현

- **EditContextAdapter (데스크탑·안드 Chrome)**: 기존 `CustomEditor.tsx`의 EditContext 결합부 이동. `new EditContext` + `host.editContext` + `textupdate`→`onTextUpdate`, `compositionstart/end`, `updateText/updateSelection`. 동작 보존(무회귀).
- **TextareaAdapter (iOS WebKit)**: stage를 덮는 투명 hidden `<textarea>` + `input`→value diff→`onTextUpdate`, `compositionstart/end`, `selectionchange`→`onSelectionChange`. textarea가 IME·Enter·캐럿을 네이티브 처리(우리가 DOM 재구성 안 함). `keydown` stopPropagation으로 host onKey 이중처리 차단. (contenteditable 방식은 PoC 실패 폐기 — research.md Decision 6.)

## DocModel (기존, 무변경 재사용)

`model.ts`의 문서 표현: `buffer`(텍스트, `\n` 블록 구분 + U+2028 소프트브레이크) + `blockAttrs`(paragraph/heading/blockquote/listItem/hr) + `markRuns`(bold/italic/underline/strike). 입력 어댑터와 무관하게 동일하며, `insertText`/`splitBlock`/`mergeWith*`/`deleteRange`/`toggleMark`/`toggleBlockType` 연산을 두 어댑터가 공유한다.

## 환경 분기

기능 감지: `typeof EditContext !== "undefined"` → `createEditContextAdapter()`, 아니면 `createTextareaAdapter()`. (브라우저 sniffing 금지 — `CustomEditor.tsx`의 `isMobile = typeof EditContext === "undefined"` 동일 기준)
