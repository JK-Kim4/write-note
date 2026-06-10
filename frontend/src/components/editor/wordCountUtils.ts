/**
 * 자수 계산 / 진행률 유틸 (006 T009).
 *
 * extractPlainText: ProseMirror JSON 문자열에서 text node 를 이어붙여 반환.
 * calcProgress: wordCount / targetLength → 0..1 (clamp).
 */

interface PmNode {
    type: string;
    text?: string;
    content?: PmNode[];
}

const collectText = (node: PmNode): string => {
    if (node.type === "text") {
        return node.text ?? "";
    }
    if (!node.content) {
        return "";
    }
    // 블록 자식(paragraph·heading 등)은 줄바꿈으로 구분해 문단 경계를 보존한다.
    // 같은 문단 안의 inline(text)만 있으면 그대로 이어붙인다.
    // 자수 계산(manuscript)은 공백 제거 후 세므로 영향 없고, 마지막 문장 파생(lastSentence)은
    // 종결부호가 없어도 문단 경계로 마지막 문단을 분리할 수 있게 된다.
    const hasBlockChild = node.content.some((child) => child.type !== "text");
    return node.content.map(collectText).join(hasBlockChild ? "\n" : "");
};

export const extractPlainText = (body: string): string => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return "";
    }
    const node = parsed as PmNode;
    if (node.type !== "doc") {
        return "";
    }
    return collectText(node);
};

export const calcProgress = (wordCount: number, targetLength: number): number => {
    if (targetLength <= 0) {
        return 0;
    }
    return Math.min(1, wordCount / targetLength);
};
