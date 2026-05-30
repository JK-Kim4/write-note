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
    return node.content.map(collectText).join("");
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
