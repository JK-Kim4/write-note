# Data Model: 입력 어댑터

이 기능은 새 영속 데이터를 만들지 않는다(백엔드 0, DocModel 재사용). 핵심은 **입력 어댑터 인터페이스**다.

## InputAdapter (신규 인터페이스)

`CustomEditor`가 입력 소스에 거는 계약. 두 구현(EditContextAdapter, ContentEditableAdapter)이 만족한다.

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
  // IME 조합 중 여부(keydown 가드용)
  isComposing(): boolean
```

```text
InputHandlers (어댑터 → CustomEditor 콜백)
  onTextUpdate(rangeStart: number, rangeEnd: number, text: string, selStart: number, selEnd: number)
  onCompositionStart()
  onCompositionEnd(selStart: number, selEnd: number)
  // 편집키·구조 편집: contenteditable은 beforeinput(inputType)→여기로,
  // EditContext는 host keydown→CustomEditor가 직접(어댑터 통과 안 함). 인터페이스는
  // "구조 편집 의도"를 공통화: onEdit(intent), intent ∈ {splitBlock, softBreak,
  //  deleteBackward, deleteForward, deleteSelection}
  onEdit(intent: EditIntent): void
```

**참고**: 복사/잘라내기/붙여넣기(`copy`/`cut`/`paste`)와 캐럿 이동 키(화살표 등)는 host 요소 이벤트로 처리되며 입력 어댑터와 독립(공통 코드 유지). 어댑터는 "텍스트 입력·IME·구조 편집(Enter/Backspace 등)"만 책임진다.

## 두 구현

- **EditContextAdapter (데스크탑)**: 기존 `CustomEditor.tsx`의 EditContext 결합부 이동. `new EditContext` + `host.editContext` + `textupdate`→`onTextUpdate`, `compositionstart/end`, `updateText/updateSelection`. 동작 보존(무회귀).
- **ContentEditableAdapter (iOS)**: contenteditable 요소 + `beforeinput`(inputType 분기)→`onTextUpdate`/`onEdit`, `compositionstart/update/end`, DOM Selection 동기. `beforeinput` 기본동작 `preventDefault`로 모델 단일 진실.

## DocModel (기존, 무변경 재사용)

`model.ts`의 문서 표현: `buffer`(텍스트, `\n` 블록 구분 + U+2028 소프트브레이크) + `blockAttrs`(paragraph/heading/blockquote/listItem/hr) + `markRuns`(bold/italic/underline/strike). 입력 어댑터와 무관하게 동일하며, `insertText`/`splitBlock`/`mergeWith*`/`deleteRange`/`toggleMark`/`toggleBlockType` 연산을 두 어댑터가 공유한다.

## 환경 분기

기능 감지: `typeof EditContext !== "undefined"` → EditContextAdapter, 아니면 ContentEditableAdapter. (브라우저 sniffing 금지 — 기존 안내 배너와 동일 기준)
