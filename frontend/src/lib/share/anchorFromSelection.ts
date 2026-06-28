/**
 * 공유 공개 페이지(046 R5) — 텍스트 구간 선택 → 댓글 앵커 도출.
 *
 * 앵커 모델(research R-4) = 불변 스냅샷의 (문단 인덱스 blockIndex + 문단 내 start·length).
 * 렌더는 `printLayout.relayout` 의 블록 배열 순서와 1:1 — 각 블록은 `data-block-index` 속성을 가진
 * DOM 요소로 렌더되고, 그 요소의 텍스트가 곧 그 블록의 본문이다.
 *
 * 본 모듈은 두 층으로 나뉜다:
 *  - 순수부(deriveAnchor·quoteForAnchor): 블록 텍스트 길이·오프셋만으로 앵커를 판정/추출 — 단위 테스트.
 *  - DOM 의존부(readSelectionAnchor·buildAnchorRange): window.Selection·DOM Range 의존 — jsdom 미보장,
 *    dogfooding 게이트로 검증.
 *
 * Phase 1 제약: 앵커는 단일 블록 내 구간만 허용한다(여러 문단에 걸친 선택은 null).
 */

/** 구조적 선택 범위 — 블록 인덱스 + 블록 내 문자 오프셋(시작·끝). 순서 무관(deriveAnchor 가 정규화). */
export type StructuralSelection = {
    startBlock: number;
    startOffset: number;
    endBlock: number;
    endOffset: number;
};

/** 댓글 앵커 — blockIndex 번째 블록의 [start, start+length) 구간(0-base). */
export type CommentAnchor = {
    blockIndex: number;
    start: number;
    length: number;
};

function clamp(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value));
}

/**
 * 블록 텍스트 길이 배열 + 구조적 선택 → 단일 블록 앵커(순수).
 *
 * - 선택 boundary 순서를 정규화(역방향 드래그 허용).
 * - 여러 블록에 걸친 선택은 Phase 1 미지원 → null.
 * - 오프셋은 블록 길이 내로 clamp, 빈(길이 0) 선택은 null.
 */
export function deriveAnchor(
    blockTextLengths: readonly number[],
    sel: StructuralSelection,
): CommentAnchor | null {
    let { startBlock, startOffset, endBlock, endOffset } = sel;

    // boundary 정규화: 시작이 끝보다 뒤면 swap.
    if (startBlock > endBlock || (startBlock === endBlock && startOffset > endOffset)) {
        [startBlock, startOffset, endBlock, endOffset] = [endBlock, endOffset, startBlock, startOffset];
    }

    // 단일 블록 내 구간만 허용(R-4 Phase 1).
    if (startBlock !== endBlock) return null;

    const blockIndex = startBlock;
    if (!Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= blockTextLengths.length) {
        return null;
    }

    const len = blockTextLengths[blockIndex] ?? 0;
    const start = clamp(startOffset, 0, len);
    const end = clamp(endOffset, 0, len);
    if (end <= start) return null;

    return { blockIndex, start, length: end - start };
}

/** 앵커 구간에 해당하는 본문 텍스트를 잘라 반환(순수) — 댓글 인용 표시용. */
export function quoteForAnchor(blockText: string, start: number, length: number): string {
    const s = Math.max(0, start);
    const l = Math.max(0, length);
    return blockText.slice(s, s + l);
}

// ─── DOM 의존부 (jsdom 미보장, dogfooding) ────────────────────────────────────

/** node 에서 위로 올라가며 data-block-index 를 가진 가장 가까운 요소를 찾는다(root 범위 내). */
function findBlockElement(node: Node | null, root: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    while (el) {
        if (el.dataset?.blockIndex != null) return el;
        if (el === root) return null;
        el = el.parentElement;
    }
    return null;
}

/**
 * blockEl 시작부터 (node, offsetInNode) 경계까지의 텍스트 길이(문자 수).
 * Range.toString() 길이로 계산 — 인라인 mark <span> 분할·텍스트노드 분할과 무관하게 안정.
 * 마커(불릿/번호)는 data-block-index 요소 밖에 두므로 카운트되지 않는다.
 */
function offsetWithinBlock(blockEl: HTMLElement, node: Node, offsetInNode: number): number {
    const range = document.createRange();
    range.selectNodeContents(blockEl);
    try {
        range.setEnd(node, offsetInNode);
    } catch {
        return 0;
    }
    return range.toString().length;
}

/**
 * 현재 window 선택 → 단일 블록 앵커(DOM 의존). 선택이 reader(root) 밖이거나
 * 여러 블록에 걸치면 null. 순수부(deriveAnchor)로 최종 판정.
 */
export function readSelectionAnchor(
    root: HTMLElement,
    blockTextLengths: readonly number[],
    selection: Selection | null,
): CommentAnchor | null {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const { anchorNode, focusNode, anchorOffset, focusOffset } = selection;
    if (!anchorNode || !focusNode) return null;

    const startEl = findBlockElement(anchorNode, root);
    const endEl = findBlockElement(focusNode, root);
    if (!startEl || !endEl) return null;

    return deriveAnchor(blockTextLengths, {
        startBlock: Number(startEl.dataset.blockIndex),
        startOffset: offsetWithinBlock(startEl, anchorNode, anchorOffset),
        endBlock: Number(endEl.dataset.blockIndex),
        endOffset: offsetWithinBlock(endEl, focusNode, focusOffset),
    });
}

/** 블록 내 문자 오프셋 → (text node, node 내 오프셋). 하이라이트 Range 구성용. */
function locateTextOffset(blockEl: HTMLElement, target: number): { node: Node; offset: number } | null {
    const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let last: Node | null = null;
    let cur = walker.nextNode();
    while (cur) {
        const len = cur.textContent?.length ?? 0;
        if (target <= acc + len) return { node: cur, offset: target - acc };
        acc += len;
        last = cur;
        cur = walker.nextNode();
    }
    if (last && target === acc) return { node: last, offset: last.textContent?.length ?? 0 };
    return null;
}

/** 앵커 → DOM Range(하이라이트 사각형 계산용, DOM 의존). 블록·오프셋 미존재면 null. */
export function buildAnchorRange(root: HTMLElement, anchor: CommentAnchor): Range | null {
    const blockEl = root.querySelector<HTMLElement>(`[data-block-index="${anchor.blockIndex}"]`);
    if (!blockEl) return null;
    const startPos = locateTextOffset(blockEl, anchor.start);
    const endPos = locateTextOffset(blockEl, anchor.start + anchor.length);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    try {
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
    } catch {
        return null;
    }
    return range;
}
