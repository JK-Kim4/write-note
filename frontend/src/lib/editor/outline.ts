/**
 * 아웃라인 파생 (017 US1) — 본문 ProseMirror JSON 에서 level 1·2·3 heading 목차를 파생한다.
 *
 * 백엔드/데이터 모델 변경 없는 순수 파생. 점프용 pos 는 여기서 산출하지 않고(JSON 위치 산술 재현은 fragile)
 * StudioOutline 이 라이브 에디터 doc 에서 `index` 번째 heading 위치를 해결한다.
 */

/** 목차 한 항목 — 본문 heading 하나를 가리키는 파생 표시값(비영속). */
export type OutlineItem = {
    level: 1 | 2 | 3;
    /** heading 텍스트(텍스트 노드 이어붙임). 빈/공백 가능. */
    text: string;
    /** 방출 순번 = doc 내 level 1·2·3 heading 등장 순번. 점프 시 pos 해결 키. */
    index: number;
};

/** ProseMirror 노드의 최소 형태(파생에 필요한 필드만). */
type PmNode = {
    type?: string;
    attrs?: { level?: number };
    text?: string;
    content?: PmNode[];
};

/** heading 노드의 텍스트 노드를 깊이 우선으로 이어붙인다. */
function textOf(node: PmNode): string {
    if (typeof node.text === "string") return node.text;
    if (!node.content) return "";
    return node.content.map(textOf).join("");
}

/**
 * ProseMirror JSON 문자열에서 level 1·2·3 heading 을 등장 순서대로 추출한다.
 * 빈 문자열 / 파싱 실패 / 빈 문서는 빈 배열.
 */
export function outlineFromDoc(bodyJson: string): OutlineItem[] {
    if (!bodyJson) return [];
    let parsed: PmNode;
    try {
        parsed = JSON.parse(bodyJson) as PmNode;
    } catch {
        return [];
    }

    const items: OutlineItem[] = [];
    const walk = (node: PmNode): void => {
        if (node.type === "heading") {
            const level = node.attrs?.level;
            if (level === 1 || level === 2 || level === 3) {
                items.push({ level, text: textOf(node), index: items.length });
                return; // heading 안 텍스트는 텍스트로 처리, 하위 heading 중첩 없음
            }
        }
        node.content?.forEach(walk);
    };
    parsed.content?.forEach(walk);
    return items;
}
