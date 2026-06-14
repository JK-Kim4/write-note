"use client";

/**
 * PoC 자체 에디터 — EditContext 라이브 입력(M5). Chromium 121+ 전용.
 *
 * 흐름: EditContext(text 버퍼) → textupdate(한글 IME·타이핑·Backspace 자동) → 버퍼 재파싱(블록) →
 *       편집된 문단 재측정 → layout 재분할 → 페이지 박스 렌더 + 자체 캐럿. Enter 는 keydown 에서 '\n' 삽입.
 * 검증: ④ 한글 IME 정상 + 라이브 리플로우(타이핑이 페이지를 줄 단위로 넘김) + 이미지 삽입(가변높이 push).
 *
 * 문서 버퍼 표현: 문단은 '\n' 구분, 이미지는 OBJECT REPLACEMENT CHARACTER('￼') 한 글자.
 * 미구현(후속): 클릭 캐럿 배치(hit-test)·화살표 정밀 이동·선택/복붙/undo·서식.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { pageGeometry, paperLabel, PAPER_SIZES, type PageGeometry, type PaperSize } from "./geometry";
import { layout, type LaidOutPage, type MeasuredBlock, type MeasuredLine } from "./layoutEngine";
import { measureParagraphLines } from "./measure";

const FONT_FAMILY = "'Apple SD Gothic Neo', 'Noto Serif KR', serif";
const OBJ = "￼"; // 이미지 마커
const IMG_NW = 600;
const IMG_NH = 400;
// SVG data URI 는 리터럴 문자열로 작성한다. 템플릿 보간(${IMG_NW} 등)을 넣으면 SWC 상수폴딩이
// `'/>` 시퀀스를 유실시켜 SVG 가 깨진다(2026-06-15 발견 — 정적판은 리터럴이라 무사했음).
const IMG_SRC =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>" +
            "<rect width='600' height='400' fill='#e0e7ff'/>" +
            "<rect x='1' y='1' width='598' height='398' fill='none' stroke='#6366f1' stroke-width='2'/>" +
            "<text x='300' y='208' font-size='30' fill='#4338ca' text-anchor='middle' font-family='sans-serif'>이미지 · 가변 높이 블록</text>" +
            "</svg>",
    );

const KO = (n: number) =>
    Array.from({ length: n }, () => "그날 밤의 공기는 유난히 차고 맑아서 멀리 가로등 아래 그림자마저 또렷하게 보였다. ").join("");
// 다중 페이지로 시작 — 긴 첫 문단(페이지 경계에서 줄 단위로 쪼개짐=①) + 이미지(③) + 둘째 문단.
const INITIAL = "여기를 클릭하고 한글을 입력해 보세요. 빠르게 타자를 쳐도 조합이 깨지지 않습니다. " + KO(30) + "\n" + OBJ + "\n" + KO(16);

type ParsedBlock =
    | { id: string; kind: "paragraph"; text: string; lines: MeasuredLine[]; bufStart: number; bufEnd: number }
    | { id: string; kind: "image"; height: number; bufStart: number; bufEnd: number };

/** 버퍼 → 블록 파싱 + 측정 + 레이아웃. geo/버퍼 변경 시 재호출 = 리플로우. */
function relayout(buffer: string, geo: PageGeometry): { blocks: ParsedBlock[]; pages: LaidOutPage[] } {
    const segs = buffer.split("\n");
    const blocks: ParsedBlock[] = [];
    let off = 0;
    segs.forEach((seg, i) => {
        const bufStart = off;
        const bufEnd = off + seg.length;
        const id = "b" + i;
        if (seg === OBJ) {
            const scale = Math.min(1, geo.contentWidthPx / IMG_NW, geo.contentHeightPx / IMG_NH);
            blocks.push({ id, kind: "image", height: IMG_NH * scale, bufStart, bufEnd });
        } else {
            const lines = measureParagraphLines(seg, geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY);
            blocks.push({ id, kind: "paragraph", text: seg, lines, bufStart, bufEnd });
        }
        off = bufEnd + 1; // '\n' 구분자 1칸
    });
    const measured: MeasuredBlock[] = blocks.map((b) =>
        b.kind === "image" ? { kind: "image", id: b.id, height: b.height } : { kind: "paragraph", id: b.id, lines: b.lines },
    );
    return { blocks, pages: layout(measured, geo.contentHeightPx) };
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** 줄 내 캐럿 x 오프셋 — canvas measureText(레이아웃 없이 advance width). 폰트는 렌더와 동일. */
function textWidth(s: string, fontSizePx: number): number {
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    if (!measureCtx) return 0;
    measureCtx.font = `${fontSizePx}px ${FONT_FAMILY}`;
    return measureCtx.measureText(s).width;
}

type CaretPos = { pageIndex: number; x: number; y: number; height: number };

/** 버퍼 오프셋 캐럿 → 화면 위치(페이지·x·y). 측정·레이아웃에서 줄·페이지를 역추적. */
function caretToScreen(caret: number, blocks: ParsedBlock[], pages: LaidOutPage[], geo: PageGeometry): CaretPos | null {
    if (blocks.length === 0) return null;
    let blk = blocks.find((b) => caret >= b.bufStart && caret <= b.bufEnd);
    let c = caret;
    if (!blk) {
        blk = blocks[blocks.length - 1];
        c = blk.bufEnd;
    }
    const findFrag = (lineIdx: number) => {
        for (const pg of pages) {
            for (const f of pg.fragments) {
                if (f.kind === "paragraph" && f.blockId === blk!.id && lineIdx >= f.startLine && lineIdx <= f.endLine)
                    return { pageIndex: pg.index, startLine: f.startLine, offsetY: f.offsetY };
                if (f.kind === "image" && f.blockId === blk!.id) return { pageIndex: pg.index, startLine: 0, offsetY: f.offsetY };
            }
        }
        return null;
    };
    if (blk.kind === "image") {
        const fr = findFrag(0);
        return fr ? { pageIndex: fr.pageIndex, x: 0, y: fr.offsetY, height: geo.lineHeightPx } : null;
    }
    const within = c - blk.bufStart;
    let lineIdx = blk.lines.findIndex((l) => within <= l.end);
    if (lineIdx < 0) lineIdx = blk.lines.length - 1;
    const line = blk.lines[lineIdx];
    const fr = findFrag(lineIdx);
    if (!fr) return null;
    return {
        pageIndex: fr.pageIndex,
        x: textWidth(blk.text.slice(line.start, within), geo.fontSizePx),
        y: fr.offsetY + (lineIdx - fr.startLine) * geo.lineHeightPx,
        height: geo.lineHeightPx,
    };
}

function PageBox({ page, geo, blocks, caret }: { page: LaidOutPage; geo: PageGeometry; blocks: ParsedBlock[]; caret: CaretPos | null }) {
    const marginPx = (geo.pageWidthPx - geo.contentWidthPx) / 2;
    const byId: Record<string, ParsedBlock> = Object.fromEntries(blocks.map((b) => [b.id, b]));
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
                    const b = byId[f.blockId];
                    if (f.kind === "image" && b?.kind === "image") {
                        // eslint-disable-next-line @next/next/no-img-element
                        return <img key={idx} src={IMG_SRC} alt="" style={{ position: "absolute", top: f.offsetY, left: 0, height: f.height, width: "auto", maxWidth: geo.contentWidthPx }} />;
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
                {caret && caret.pageIndex === page.index && (
                    <div className="poc-caret" style={{ position: "absolute", left: caret.x, top: caret.y, height: caret.height, width: 2, background: "#4f46e5" }} />
                )}
            </div>
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>{page.index + 1}</div>
        </div>
    );
}

export function PocEditorLive() {
    const [paper, setPaper] = useState<PaperSize>("A4");
    const [fontSize, setFontSize] = useState(18);
    const [buffer, setBuffer] = useState(INITIAL);
    const [caret, setCaret] = useState(INITIAL.length);
    const [mounted, setMounted] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const ecRef = useRef<EditContext | null>(null);

    const geo = useMemo(() => pageGeometry(paper, fontSize), [paper, fontSize]);
    const view = useMemo(
        () => (mounted ? relayout(buffer, geo) : { blocks: [] as ParsedBlock[], pages: [] as LaidOutPage[] }),
        [mounted, buffer, geo],
    );
    const caretPos = mounted ? caretToScreen(caret, view.blocks, view.pages, geo) : null;

    useEffect(() => setMounted(true), []);

    // EditContext 부착 + 입력 루프(마운트 1회).
    useEffect(() => {
        const host = stageRef.current;
        if (!host || typeof EditContext === "undefined") return;
        const ec = new EditContext({ text: INITIAL, selectionStart: INITIAL.length, selectionEnd: INITIAL.length });
        ecRef.current = ec;
        host.editContext = ec;

        const onText = (e: Event) => {
            const te = e as TextUpdateEvent;
            setBuffer(ec.text);
            setCaret(te.selectionStart);
        };
        ec.addEventListener("textupdate", onText);

        const updateCB = () => {
            if (stageRef.current) ec.updateControlBounds(stageRef.current.getBoundingClientRect());
        };
        updateCB();
        window.addEventListener("resize", updateCB);

        // Enter 는 textupdate 가 안 오므로 keydown 에서 '\n' 삽입(문단 분할). Backspace/화살표는 자동.
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const start = Math.min(ec.selectionStart, ec.selectionEnd);
            const end = Math.max(ec.selectionStart, ec.selectionEnd);
            ec.updateText(start, end, "\n");
            ec.updateSelection(start + 1, start + 1);
            setBuffer(ec.text);
            setCaret(start + 1);
        };
        host.addEventListener("keydown", onKey);
        host.focus();

        return () => {
            ec.removeEventListener("textupdate", onText);
            host.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", updateCB);
            host.editContext = null;
            ecRef.current = null;
        };
    }, []);

    const insertImage = () => {
        const ec = ecRef.current;
        if (!ec) return;
        const start = Math.min(ec.selectionStart, ec.selectionEnd);
        const end = Math.max(ec.selectionStart, ec.selectionEnd);
        ec.updateText(start, end, "\n" + OBJ + "\n");
        ec.updateSelection(start + 3, start + 3);
        setBuffer(ec.text);
        setCaret(start + 3);
        stageRef.current?.focus();
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ece7df" }}>
            <style>{"@keyframes pocBlink{0%,49%{opacity:1}50%,100%{opacity:0}} .poc-caret{animation:pocBlink 1s step-end infinite}"}</style>
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>자체 에디터 PoC — EditContext 라이브(M5)</strong>
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
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={insertImage}
                    style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", cursor: "pointer" }}
                >
                    이미지 삽입
                </button>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{view.pages.length}장 · {buffer.length}자</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>여기 클릭 후 한글 입력 · Enter=문단 · Backspace=삭제</span>
            </div>
            <div ref={stageRef} tabIndex={0} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24, outline: "none" }}>
                {view.pages.map((pg) => (
                    <PageBox key={pg.index} page={pg} geo={geo} blocks={view.blocks} caret={caretPos} />
                ))}
            </div>
        </div>
    );
}
