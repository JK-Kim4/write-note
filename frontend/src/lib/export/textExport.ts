/**
 * txt·json 내보내기(031) — 백엔드 없이 클라이언트에서 평문/구조화 합본 생성(순수).
 * 본문은 collectChapters 의 bodyJson(ProseMirror JSON) → extractPlainText(평문)·파싱(구조).
 */

import type { CollectedChapter } from "./collectChapters";
import type { JoinMode } from "./exportDoc";
import { extractPlainText } from "@/components/editor/wordCountUtils";

const safeParse = (s: string): unknown => {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
};

/** 챕터들을 평문 텍스트로 합본 — joinMode 에 따라 제목 포함(txt). */
export function buildPlainText(chapters: CollectedChapter[], joinMode: JoinMode): string {
    // page-title 은 txt 에 페이지 개념이 없어 더 큰 간격으로만 구분.
    const sep = joinMode === "page-title" ? "\n\n\n" : "\n\n";
    return chapters
        .map((c) => {
            const body = extractPlainText(c.bodyJson);
            if (joinMode === "body-only") return body;
            const title = c.title.trim() || "(제목 없음)";
            return `${title}\n\n${body}`;
        })
        .join(sep);
}

/** 챕터들을 구조화 JSON 으로 — 재가공·백업용. title + 평문(text) + ProseMirror body(json). */
export function buildExportJson(chapters: CollectedChapter[]): string {
    const payload = {
        chapters: chapters.map((c) => ({
            title: c.title,
            text: extractPlainText(c.bodyJson),
            body: safeParse(c.bodyJson),
        })),
    };
    return JSON.stringify(payload, null, 2);
}
