"use client";
import { pageGeometry, type PaperSize as GeoPaperSize } from "@/components/custom-editor/geometry";
import type { PaperSize as LayoutPaperSize } from "@/components/editor/pageLayout";
import { FONT_FAMILY, IMG_SRC, relayout, renderRuns, type ParsedBlock } from "@/components/custom-editor/printLayout";
import type { DocModel } from "@/components/custom-editor/model";

const FONT_SIZE_PX = 18;
const MARGIN_MM = 25;
const MM_TO_PX = 96 / 25.4;

type Props = { models: DocModel[]; paperSize: LayoutPaperSize };

/**
 * 인쇄 전용 문서 렌더. models 각각을 relayout 으로 페이지화해 모든 페이지를 break-after:page 로 잇는다.
 * geometry·FONT_FAMILY·FONT_SIZE_PX 는 화면 에디터(BCustomChapterEditor)와 동일 — 줄·페이지 정합.
 */
export function PrintDocument({ models, paperSize }: Props) {
  const geo = pageGeometry(paperSize as GeoPaperSize, FONT_SIZE_PX);
  const marginPx = MARGIN_MM * MM_TO_PX;
  const docPages = models.flatMap((model) => {
    const view = relayout(model, geo);
    return view.pages.map((page) => ({ page, byId: Object.fromEntries(view.blocks.map((b) => [b.id, b])) }));
  });

  return (
    <div className="print-root">
      <style>{`@page { size: ${paperSize} portrait; margin: 0; }`}</style>
      {docPages.map(({ page, byId }, pi) => (
        <div
          key={pi}
          style={{
            position: "relative", width: geo.pageWidthPx, height: geo.pageHeightPx, background: "#fff",
            breakAfter: pi < docPages.length - 1 ? "page" : "auto", overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: marginPx, top: marginPx, width: geo.contentWidthPx, height: geo.contentHeightPx }}>
            {page.fragments.map((f, idx) => {
              const b = byId[f.blockId] as ParsedBlock | undefined;
              if (f.kind === "image" && b?.kind === "image") {
                // eslint-disable-next-line @next/next/no-img-element
                return <img key={idx} src={IMG_SRC} alt="" style={{ position: "absolute", top: f.offsetY, left: 0, height: f.height, width: "auto", maxWidth: geo.contentWidthPx }} />;
              }
              if (f.kind === "paragraph" && b?.kind === "paragraph") {
                if (b.attr.type === "hr") {
                  return (
                    <div key={idx} style={{ position: "absolute", top: f.offsetY, left: 0, width: geo.contentWidthPx, height: f.height, display: "flex", alignItems: "center" }}>
                      <div style={{ width: "100%", borderTop: "2px solid #d4d4d8" }} />
                    </div>
                  );
                }
                const isQuote = b.attr.type === "blockquote";
                const isList = b.attr.type === "listItem";
                const marker = isList && f.startLine === 0 ? (b.listNumber != null ? `${b.listNumber}.` : "•") : null;
                return (
                  <div key={idx} style={{ position: "absolute", top: f.offsetY, left: 0, width: geo.contentWidthPx, height: f.height, overflow: "hidden" }}>
                    {isQuote && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#a1a1aa" }} />}
                    {marker != null && (
                      <div style={{ position: "absolute", left: 0, top: 0, width: b.indentPx, fontSize: b.fontSizePx, lineHeight: `${b.lineHeightPx}px`, fontFamily: FONT_FAMILY, color: "#6b7280", boxSizing: "border-box", textAlign: b.listNumber != null ? "right" : "center", paddingRight: b.listNumber != null ? 6 : 0 }}>
                        {marker}
                      </div>
                    )}
                    <div style={{ transform: `translateY(${-(f.startLine * b.lineHeightPx)}px)`, width: geo.contentWidthPx, paddingLeft: b.indentPx, boxSizing: "border-box", fontSize: b.fontSizePx, lineHeight: `${b.lineHeightPx}px`, fontFamily: FONT_FAMILY, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#1f2937" }}>
                      {renderRuns(b.text, b.marks)}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
