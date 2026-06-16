export type ExportMark = { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
export type ExportBlock = {
  type: "paragraph" | "heading" | "blockquote" | "listItem" | "hr";
  level?: 1 | 2 | 3;
  listKind?: "bullet" | "ordered";
  depth?: number;
  text: string;
  marks: ExportMark[];
};
export type ExportChapter = { title: string; blocks: ExportBlock[] };
export type JoinMode = "page-title" | "inline-title" | "body-only";
export type ExportDoc = { paperSize: string; joinMode: JoinMode; chapters: ExportChapter[] };

import { blockRuns, SOFT_BREAK, MARK, type DocModel, type MarkRun } from "@/components/custom-editor/model";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import type { CollectedChapter } from "./collectChapters";

function runsToMarks(runs: MarkRun[]): ExportMark[] {
  const marks: ExportMark[] = [];
  let pos = 0;
  for (const run of runs) {
    if (run.mask !== 0) {
      marks.push({
        start: pos, end: pos + run.len,
        ...(run.mask & MARK.bold ? { bold: true } : {}),
        ...(run.mask & MARK.italic ? { italic: true } : {}),
        ...(run.mask & MARK.underline ? { underline: true } : {}),
        ...(run.mask & MARK.strike ? { strike: true } : {}),
      });
    }
    pos += run.len;
  }
  return marks;
}

/** DocModel 의 각 블록을 ExportBlock 으로. U+2028 → \n 정규화(offset 은 정규화 후에도 동일 길이라 불변). */
export function docModelToExportBlocks(model: DocModel): ExportBlock[] {
  const segs = model.buffer.split("\n");
  return segs.map((seg, i) => {
    const attr = model.blockAttrs[i] ?? { type: "paragraph" as const };
    const runs = blockRuns(model, i);
    const text = seg.split(SOFT_BREAK).join("\n");
    const base = { text, marks: runsToMarks(runs) };
    switch (attr.type) {
      case "heading": return { type: "heading" as const, level: attr.level, ...base };
      case "blockquote": return { type: "blockquote" as const, ...base };
      case "listItem": return { type: "listItem" as const, listKind: attr.listKind, depth: attr.depth, ...base };
      case "hr": return { type: "hr" as const, text: "", marks: [] };
      default: return { type: "paragraph" as const, ...base };
    }
  });
}

/** 수집 챕터들을 백엔드 워드 생성용 ExportDoc DTO 로. */
export function buildExportDoc(chapters: CollectedChapter[], paperSize: string, joinMode: JoinMode): ExportDoc {
  return {
    paperSize, joinMode,
    chapters: chapters.map((c) => ({ title: c.title, blocks: docModelToExportBlocks(pmJsonToModel(c.bodyJson)) })),
  };
}
