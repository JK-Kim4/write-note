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
