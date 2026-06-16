import type { CollectedChapter } from "./collectChapters";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import type { BlockAttr, DocModel, MarkRun } from "@/components/custom-editor/model";

/** 제목 heading(level 1) 블록 1개짜리 조각. */
function titleBlock(title: string): { text: string; attr: BlockAttr; runs: MarkRun[] } {
	return {
		text: title,
		attr: { type: "heading", level: 1 },
		runs: title.length > 0 ? [{ len: title.length, mask: 0 }] : [],
	};
}

/** DocModel 을 (text, attr, runs) 블록 배열로 분해. */
function toBlocks(model: DocModel): { text: string; attr: BlockAttr; runs: MarkRun[] }[] {
	const segs = model.buffer.split("\n");
	return segs.map((text, i) => ({
		text,
		attr: model.blockAttrs[i] ?? { type: "paragraph" },
		runs: model.markRuns[i] ?? [],
	}));
}

/** 블록 배열을 DocModel 로 조립. */
function fromBlocks(blocks: { text: string; attr: BlockAttr; runs: MarkRun[] }[]): DocModel {
	if (blocks.length === 0) return { buffer: "", blockAttrs: [{ type: "paragraph" }], markRuns: [[]] };
	return {
		buffer: blocks.map((b) => b.text).join("\n"),
		blockAttrs: blocks.map((b) => b.attr),
		markRuns: blocks.map((b) => b.runs),
	};
}

/**
 * joinMode 에 따라 챕터들을 PDF 렌더용 DocModel 배열로 변환.
 * page-title → 챕터당 1 DocModel(제목 prepend), 그 외 → 단일 DocModel 1개.
 */
export function mergeChaptersForPrint(
	chapters: CollectedChapter[],
	joinMode: "page-title" | "inline-title" | "body-only",
): DocModel[] {
	if (joinMode === "page-title") {
		return chapters.map((c) =>
			fromBlocks([titleBlock(c.title), ...toBlocks(pmJsonToModel(c.bodyJson))]),
		);
	}
	const merged = chapters.flatMap((c) => {
		const body = toBlocks(pmJsonToModel(c.bodyJson));
		return joinMode === "inline-title" ? [titleBlock(c.title), ...body] : body;
	});
	return [fromBlocks(merged)];
}
