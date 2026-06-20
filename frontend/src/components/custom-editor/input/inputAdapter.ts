/**
 * 입력 어댑터 — CustomEditor 가 입력 소스(EditContext / hidden textarea)에 거는 계약.
 *
 * 데스크탑·안드 Chrome 은 EditContext(EditContextAdapter), iOS WebKit 은 hidden textarea 입력 프록시
 * (TextareaAdapter)로 분기한다(기능 감지: `typeof EditContext`). 두 구현이 동일 인터페이스를
 * 만족하므로 CustomEditor 는 입력 소스 종류를 모른 채 텍스트 입력·IME·구조 편집을 받는다.
 * (contenteditable 방식은 iOS 한글 IME PoC 실패로 폐기 — research.md Decision 6.)
 *
 * 책임 경계: 어댑터는 "텍스트 입력·IME 조합·구조 편집(Enter/Backspace 등)"만 책임진다.
 * 복사/잘라내기/붙여넣기(copy/cut/paste)와 캐럿 이동 키(화살표 등)는 host 요소 이벤트로
 * CustomEditor 가 직접 처리(어댑터 무관, 공통 코드).
 */

/** textupdate(EditContext) / beforeinput·composition(contenteditable) → CustomEditor 로 올리는 텍스트 변경. */
export type TextUpdate = {
    /** 치환 범위 시작(buffer 오프셋). EditContext updateRangeStart 대응. */
    rangeStart: number;
    /** 치환 범위 끝(buffer 오프셋). EditContext updateRangeEnd 대응. */
    rangeEnd: number;
    /** 삽입 텍스트. */
    text: string;
    /** 편집 후 선택 시작(입력 소스 기준). */
    selectionStart: number;
    /** 편집 후 선택 끝(입력 소스 기준). */
    selectionEnd: number;
};

/**
 * 구조 편집 의도 — contenteditable 은 `beforeinput`(inputType)이 텍스트와 구조 편집을 통합하므로
 * inputType 을 이 의도로 정규화해 CustomEditor 에 올린다. EditContext 경로는 host `keydown` 으로
 * CustomEditor 가 직접 처리하므로 이 콜백을 쓰지 않는다(어댑터별 차이).
 */
export type EditIntent = "splitBlock" | "softBreak" | "deleteBackward" | "deleteForward" | "deleteSelection";

/** 어댑터 → CustomEditor 콜백. attach 시 주입. */
export type InputHandlers = {
    /** 타이핑/IME 조합/블록 내부 collapsed Backspace·Delete 등 텍스트 변경. */
    onTextUpdate(update: TextUpdate): void;
    /** IME 조합 시작 — 조합 중 캐럿 setSel 억제(받침 재조합 보호) 가드에 쓰인다. */
    onCompositionStart(): void;
    /** IME 조합 종료 — 억제한 캐럿을 입력 소스 최종 선택으로 한 번 맞춘다. */
    onCompositionEnd(selectionStart: number, selectionEnd: number): void;
    /** 구조 편집(Enter/Backspace 등) — contenteditable 전용. EditContext 경로는 호출 안 함. */
    onEdit(intent: EditIntent): void;
    /**
     * 텍스트 변경 없는 캐럿/선택 이동(클릭·화살표 등) — textarea 어댑터 전용. textarea 가 캐럿 이동을
     * 네이티브로 처리하므로 그 결과(selectionStart/End)를 렌더 캐럿에 반영하기 위해 호출한다.
     * EditContext/contenteditable 경로는 호출하지 않는다(캐럿 이동을 host 이벤트로 직접 처리).
     */
    onSelectionChange(selectionStart: number, selectionEnd: number): void;
};

/**
 * 입력 소스 계약. CustomEditor 가 model→입력소스 동기(syncText/syncSelection)와 입력소스 상태 읽기
 * (getText/getSelection/isComposing)를 어댑터 종류와 무관하게 호출한다.
 */
export type InputAdapter = {
    /** host 요소에 입력 소스 부착 + 이벤트 등록(텍스트/IME). */
    attach(host: HTMLElement, handlers: InputHandlers): void;
    /** 이벤트 해제 + 입력 소스 분리. */
    detach(): void;
    /** model buffer 전체를 입력 소스 텍스트에 동기(편집 후 정합). */
    syncText(fullText: string): void;
    /** model 선택을 입력 소스 선택에 동기. start/end 정렬은 어댑터가 처리. */
    syncSelection(start: number, end: number): void;
    /** 입력 소스의 현재 텍스트(길이·슬라이스 계산용). */
    getText(): string;
    /** 입력 소스의 현재 선택. */
    getSelection(): { start: number; end: number };
    /** IME 조합 중 여부(keydown 가드·캐럿 오프셋 계산용). */
    isComposing(): boolean;
    /**
     * 입력 소스에 포커스(소프트 키보드 호출). iOS Safari 는 사용자 제스처(탭) 콜스택 내에서 호출해야
     * 키보드가 뜨므로, CustomEditor 가 stage 탭 핸들러 안에서 이를 부른다.
     */
    focusInput(): void;
    /** 입력 소스 제어 영역 경계 갱신(EditContext 전용 — contenteditable 은 no-op). */
    updateControlBounds(bounds: DOMRect): void;
};
