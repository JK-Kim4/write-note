/** 어드민 공지 마크다운 툴바 (032) — 순수 마커 삽입. */
export type MarkdownKind = "h2" | "h3" | "bold" | "bullet";

export interface MarkdownEdit {
    text: string;
    selStart: number;
    selEnd: number;
}

const linePrefix = (text: string, start: number, end: number, prefix: string): MarkdownEdit => {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const before = text.slice(0, lineStart);
    const region = text.slice(lineStart, end);
    const rest = text.slice(end);
    const prefixed = region
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
    const next = before + prefixed + rest;
    return { text: next, selStart: lineStart, selEnd: lineStart + prefixed.length };
};

export function applyMarkdown(text: string, start: number, end: number, kind: MarkdownKind): MarkdownEdit {
    if (kind === "bold") {
        const selected = text.slice(start, end);
        const next = text.slice(0, start) + "**" + selected + "**" + text.slice(end);
        return { text: next, selStart: start + 2, selEnd: start + 2 + selected.length };
    }
    if (kind === "h2") return linePrefix(text, start, end, "## ");
    if (kind === "h3") return linePrefix(text, start, end, "### ");
    return linePrefix(text, start, end, "- "); // bullet
}
