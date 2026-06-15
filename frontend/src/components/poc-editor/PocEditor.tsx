"use client";

/**
 * PoC 자체 에디터 — 정적 렌더 화면(M4). EditContext 입력(M5)은 후속.
 *
 * 흐름: 샘플 문서 → measure(줄) → layout(페이지 분할) → 페이지 박스 렌더.
 * 검증 목표: ① 문단이 페이지 경계에서 줄 단위로 이어짐 ② 용지/폰트 변경 시 즉시 재배치 ③ 이미지 통째 밀림.
 * 문단 fragment 는 "전체 문단을 그리되 해당 밴드만 clip+translate" — 전역 1회 측정한 줄바꿈을 보존.
 */

import { useEffect, useMemo, useState } from "react";
import { pageGeometry, paperLabel, PAPER_SIZES, type PaperSize, type PageGeometry } from "../custom-editor/geometry";
import { layout, type LaidOutPage, type MeasuredBlock } from "../custom-editor/layoutEngine";
import { measureParagraphLines } from "../custom-editor/measure";

/** 측정·렌더가 반드시 동일해야 하는 폰트 패밀리. */
const FONT_FAMILY = "'Apple SD Gothic Neo', 'Noto Serif KR', serif";

type DocBlock =
    | { kind: "paragraph"; id: string; text: string }
    | { kind: "image"; id: string; src: string; naturalWidth: number; naturalHeight: number };

const IMG_SRC =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>` +
            `<rect width='600' height='400' fill='#e0e7ff'/>` +
            `<rect x='1' y='1' width='598' height='398' fill='none' stroke='#6366f1' stroke-width='2'/>` +
            `<text x='300' y='205' font-size='30' fill='#4338ca' text-anchor='middle' font-family='sans-serif'>이미지 · 가변 높이 블록</text>` +
            `</svg>`,
    );

const KO = (n: number) =>
    Array.from({ length: n }, () =>
        "그날 밤의 공기는 유난히 차고 맑아서, 멀리 가로등 아래로 길게 늘어진 그림자마저 또렷하게 보였다. ",
    ).join("");

// 샘플 문서 — 여러 문단 + 중간에 가변높이 이미지 → 2~3장에 걸치게.
const SAMPLE: DocBlock[] = [
    { kind: "paragraph", id: "p1", text: KO(4) + "그는 창가에 서서 오래도록 바깥을 내다보았다." },
    { kind: "paragraph", id: "p2", text: KO(5) + "어디선가 개 짖는 소리가 들렸고, 곧 다시 고요해졌다." },
    { kind: "paragraph", id: "p3", text: KO(3) + "책상 위에는 식어버린 찻잔이 그대로 놓여 있었다." },
    { kind: "image", id: "im1", src: IMG_SRC, naturalWidth: 600, naturalHeight: 400 },
    { kind: "paragraph", id: "p4", text: KO(5) + "이야기는 거기서부터 천천히 다시 시작되었다." },
    { kind: "paragraph", id: "p5", text: KO(4) + "아침이 오기까지는 아직 긴 시간이 남아 있었다." },
];

const BLOCKS_BY_ID: Record<string, DocBlock> = Object.fromEntries(SAMPLE.map((b) => [b.id, b]));

function PocPage({ page, geo }: { page: LaidOutPage; geo: PageGeometry }) {
    const marginPx = (geo.pageWidthPx - geo.contentWidthPx) / 2;
    return (
        <div
            style={{
                position: "relative",
                width: geo.pageWidthPx,
                height: geo.pageHeightPx,
                flex: "none",
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,.1), 0 8px 24px rgba(0,0,0,.08)",
            }}
        >
            <div style={{ position: "absolute", left: marginPx, top: marginPx, width: geo.contentWidthPx, height: geo.contentHeightPx }}>
                {page.fragments.map((f, idx) => {
                    const b = BLOCKS_BY_ID[f.blockId];
                    if (f.kind === "image" && b?.kind === "image") {
                        return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={idx}
                                src={b.src}
                                alt=""
                                style={{ position: "absolute", top: f.offsetY, left: 0, height: f.height, width: "auto", maxWidth: geo.contentWidthPx }}
                            />
                        );
                    }
                    if (f.kind === "paragraph" && b?.kind === "paragraph") {
                        return (
                            <div key={idx} style={{ position: "absolute", top: f.offsetY, left: 0, width: geo.contentWidthPx, height: f.height, overflow: "hidden" }}>
                                <div
                                    style={{
                                        transform: `translateY(${-(f.startLine * geo.lineHeightPx)}px)`,
                                        width: geo.contentWidthPx,
                                        fontSize: geo.fontSizePx,
                                        lineHeight: `${geo.lineHeightPx}px`,
                                        fontFamily: FONT_FAMILY,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        color: "#1f2937",
                                    }}
                                >
                                    {b.text}
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>
                {page.index + 1}
            </div>
        </div>
    );
}

export function PocEditor() {
    const [paper, setPaper] = useState<PaperSize>("A4");
    const [fontSize, setFontSize] = useState(18);
    const [pages, setPages] = useState<LaidOutPage[]>([]);

    const geo = useMemo(() => pageGeometry(paper, fontSize), [paper, fontSize]);

    // 측정 + 레이아웃 — DOM 필요(클라이언트). geo 변경 시 재실행 = 규격/폰트 리플로우.
    useEffect(() => {
        const measured: MeasuredBlock[] = SAMPLE.map((b) => {
            if (b.kind === "paragraph") {
                return { kind: "paragraph", id: b.id, lines: measureParagraphLines(b.text, [], geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY) };
            }
            const scale = Math.min(1, geo.contentWidthPx / b.naturalWidth, geo.contentHeightPx / b.naturalHeight);
            return { kind: "image", id: b.id, height: b.naturalHeight * scale };
        });
        setPages(layout(measured, geo.contentHeightPx));
    }, [geo]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ece7df" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>자체 에디터 PoC — 정적 렌더(M4)</strong>
                <label style={{ fontSize: 13 }}>
                    용지{" "}
                    <select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)}>
                        {PAPER_SIZES.map((s) => (
                            <option key={s} value={s}>
                                {paperLabel(s)}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ fontSize: 13 }}>
                    폰트{" "}
                    <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
                        {[14, 16, 18, 22, 28].map((s) => (
                            <option key={s} value={s}>
                                {s}px
                            </option>
                        ))}
                    </select>
                </label>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{pages.length}장</span>
            </div>
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24 }}>
                {pages.map((page) => (
                    <PocPage key={page.index} page={page} geo={geo} />
                ))}
            </div>
        </div>
    );
}
