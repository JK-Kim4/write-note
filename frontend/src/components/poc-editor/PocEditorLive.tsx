"use client";

/**
 * PoC 자체 에디터 — EditContext 라이브 입력 + 기본 선택(selection). Chromium 121+ 전용.
 *
 * 입력 모델: 문서 버퍼는 EditContext.text(문단 '\n' 구분, 이미지 U+FFFC). 선택은 {anchor, focus}.
 * - textupdate(IME·타이핑·Backspace 자동) → 버퍼 재파싱·재측정·재분할·재렌더, 선택 collapse.
 * - 드래그/Shift·Cmd·Option+화살표로 선택, 선택 위 타이핑/Backspace = EditContext 가 교체/삭제.
 * - 캐럿·선택 하이라이트는 직접 그림(측정은 measure.measureLineXs = 줄바꿈·렌더와 동일 메트릭).
 * 미구현(본 구축): 서식·저장 결선·복붙·undo·문단 간 여백·Safari.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { pageGeometry, paperLabel, PAPER_SIZES, type PageGeometry, type PaperSize } from "../custom-editor/geometry";
import { layout, type LaidOutPage, type MeasuredBlock, type MeasuredLine } from "../custom-editor/layoutEngine";
import { measureLineXs, measureParagraphLines } from "../custom-editor/measure";

const FONT_FAMILY = "'Apple SD Gothic Neo', 'Noto Serif KR', serif";
const OBJ = "￼"; // 이미지 마커
const IMG_NW = 600;
const IMG_NH = 400;
// SVG data URI 는 리터럴 문자열로(보간 ${} 넣으면 SWC 상수폴딩이 '/>' 유실 → SVG 깨짐, 2026-06-15).
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
const INITIAL = "여기를 클릭하고 한글을 입력해 보세요. 빠르게 타자를 쳐도 조합이 깨지지 않습니다. " + KO(30) + "\n" + OBJ + "\n" + KO(16);

type ParsedBlock =
    | { id: string; kind: "paragraph"; text: string; lines: MeasuredLine[]; bufStart: number; bufEnd: number }
    | { id: string; kind: "image"; height: number; bufStart: number; bufEnd: number };

type View = { blocks: ParsedBlock[]; pages: LaidOutPage[] };

/** 버퍼 → 블록 파싱 + 측정 + 레이아웃. geo/버퍼 변경 시 재호출 = 리플로우. */
function relayout(buffer: string, geo: PageGeometry): View {
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
            const lines = measureParagraphLines(seg, [], geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY);
            blocks.push({ id, kind: "paragraph", text: seg, lines, bufStart, bufEnd });
        }
        off = bufEnd + 1; // '\n' 구분자 1칸
    });
    const measured: MeasuredBlock[] = blocks.map((b) =>
        b.kind === "image" ? { kind: "image", id: b.id, height: b.height } : { kind: "paragraph", id: b.id, lines: b.lines },
    );
    return { blocks, pages: layout(measured, geo.contentHeightPx) };
}

type CaretPos = { pageIndex: number; x: number; y: number; height: number };
type SelRect = { pageIndex: number; x: number; y: number; width: number; height: number };

/** 버퍼 오프셋 캐럿 → 화면 위치. 측정·레이아웃에서 줄·페이지·x 를 역추적(measureLineXs = 렌더와 동일 메트릭). */
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
    // within < end (≤ 아님) — wrap 경계 offset(line[K].start==line[K-1].end)을 다음 줄 시작에 렌더(downstream
    // affinity). ≤ 면 이전 줄 끝에 렌더돼 Cmd+Left/타이핑 줄바꿈 캐럿이 어긋난다. 맨끝은 findIndex -1 → fallback.
    let lineIdx = blk.lines.findIndex((l) => within < l.end);
    if (lineIdx < 0) lineIdx = blk.lines.length - 1;
    const line = blk.lines[lineIdx];
    const fr = findFrag(lineIdx);
    if (!fr) return null;
    const xs = measureLineXs(blk.text, [], line.start, line.end, geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY);
    return {
        pageIndex: fr.pageIndex,
        x: xs[within - line.start] ?? 0,
        y: fr.offsetY + (lineIdx - fr.startLine) * geo.lineHeightPx,
        height: geo.lineHeightPx,
    };
}

/** 화면 좌표(페이지·콘텐츠 상대 x/y) → 버퍼 캐럿 오프셋. caretToScreen 의 역 — 클릭·드래그·세로이동. */
function screenToCaret(pageIndex: number, x: number, y: number, view: View, geo: PageGeometry): number | null {
    const page = view.pages[pageIndex];
    if (!page || page.fragments.length === 0) return null;
    let frag = page.fragments.find((f) => y >= f.offsetY && y < f.offsetY + f.height);
    if (!frag) frag = y < page.fragments[0].offsetY ? page.fragments[0] : page.fragments[page.fragments.length - 1];
    const block = view.blocks.find((b) => b.id === frag!.blockId);
    if (!block) return null;
    if (frag.kind === "image" || block.kind === "image") return block.bufStart;
    const lineWithin = Math.min(frag.endLine - frag.startLine, Math.max(0, Math.floor((y - frag.offsetY) / geo.lineHeightPx)));
    const line = block.lines[frag.startLine + lineWithin];
    if (!line) return block.bufEnd;
    const xs = measureLineXs(block.text, [], line.start, line.end, geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < xs.length; i++) {
        const d = Math.abs(xs[i] - x);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return block.bufStart + line.start + best;
}

/** 선택 범위 [s,e) 를 페이지·줄별 하이라이트 사각형들로. */
function selectionRects(s: number, e: number, view: View, geo: PageGeometry): SelRect[] {
    if (s === e) return [];
    const lo = Math.min(s, e);
    const hi = Math.max(s, e);
    const rects: SelRect[] = [];
    for (const pg of view.pages) {
        for (const f of pg.fragments) {
            const block = view.blocks.find((b) => b.id === f.blockId);
            if (!block) continue;
            if (f.kind === "image" || block.kind === "image") {
                if (lo <= block.bufStart && block.bufStart < hi)
                    rects.push({ pageIndex: pg.index, x: 0, y: f.offsetY, width: geo.contentWidthPx, height: f.height });
                continue;
            }
            for (let L = f.startLine; L <= f.endLine; L++) {
                const line = block.lines[L];
                const lineLo = block.bufStart + line.start;
                const lineHi = block.bufStart + line.end;
                const os = Math.max(lo, lineLo);
                const oe = Math.min(hi, lineHi);
                const y = f.offsetY + (L - f.startLine) * geo.lineHeightPx;
                if (os >= oe) {
                    // 빈 줄이 통째로 선택됐거나, 줄 끝 개행만 걸친 경우 작은 sliver 표시
                    if (lo <= lineLo && lineLo < hi)
                        rects.push({ pageIndex: pg.index, x: 0, y, width: 8, height: geo.lineHeightPx });
                    continue;
                }
                const xs = measureLineXs(block.text, [], line.start, line.end, geo.contentWidthPx, geo.lineHeightPx, geo.fontSizePx, FONT_FAMILY);
                const xStart = xs[os - block.bufStart - line.start];
                const xEnd = xs[oe - block.bufStart - line.start];
                const tail = hi > lineHi ? 8 : 0; // 개행까지 선택되면 줄 끝에 sliver
                rects.push({ pageIndex: pg.index, x: xStart, y, width: xEnd - xStart + tail, height: geo.lineHeightPx });
            }
        }
    }
    return rects;
}

/** offset 이 속한 시각 줄의 버퍼 시작/끝(Cmd+화살표 줄 끝 이동용). */
function lineBoundsOf(offset: number, blocks: ParsedBlock[]): { start: number; end: number } {
    const blk = blocks.find((b) => offset >= b.bufStart && offset <= b.bufEnd);
    if (!blk || blk.kind === "image") return { start: offset, end: offset };
    const within = offset - blk.bufStart;
    let line = blk.lines.find((l) => within >= l.start && within <= l.end);
    if (!line) line = blk.lines[blk.lines.length - 1];
    return { start: blk.bufStart + line.start, end: blk.bufStart + line.end };
}

/** 단어 경계(Option+화살표). '\n'·공백은 구분자, 그 외(OBJ 포함)는 단어. */
function wordBoundary(text: string, offset: number, dir: number): number {
    const isWs = (ch: string) => ch === " " || ch === "\n" || ch === "\t";
    let i = offset;
    if (dir < 0) {
        while (i > 0 && isWs(text[i - 1])) i--;
        while (i > 0 && !isWs(text[i - 1])) i--;
    } else {
        while (i < text.length && isWs(text[i])) i++;
        while (i < text.length && !isWs(text[i])) i++;
    }
    return i;
}

function PageBox({
    page,
    geo,
    blocks,
    caret,
    selRects,
}: {
    page: LaidOutPage;
    geo: PageGeometry;
    blocks: ParsedBlock[];
    caret: CaretPos | null;
    selRects: SelRect[];
}) {
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
            <div
                data-poc-page={page.index}
                style={{ position: "absolute", left: marginPx, top: marginPx, width: geo.contentWidthPx, height: geo.contentHeightPx, userSelect: "none", cursor: "text" }}
            >
                {/* 선택 하이라이트 — 텍스트보다 먼저(뒤에) 그림 */}
                {selRects.map((r, i) => (
                    <div key={"s" + i} style={{ position: "absolute", left: r.x, top: r.y, width: r.width, height: r.height, background: "rgba(99,102,241,0.28)", pointerEvents: "none" }} />
                ))}
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
    const [sel, setSel] = useState({ anchor: INITIAL.length, focus: INITIAL.length });
    const [mounted, setMounted] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const ecRef = useRef<EditContext | null>(null);
    const dragAnchorRef = useRef<number | null>(null);

    const geo = useMemo(() => pageGeometry(paper, fontSize), [paper, fontSize]);
    const view = useMemo<View>(() => (mounted ? relayout(buffer, geo) : { blocks: [], pages: [] }), [mounted, buffer, geo]);
    const caretPos = mounted ? caretToScreen(sel.focus, view.blocks, view.pages, geo) : null;
    const selRects = mounted ? selectionRects(sel.anchor, sel.focus, view, geo) : [];

    // keydown/드래그 핸들러(마운트 1회 생성)가 최신 값을 보도록 ref 안정화.
    const viewRef = useRef(view);
    const geoRef = useRef(geo);
    const selStateRef = useRef(sel);
    viewRef.current = view;
    geoRef.current = geo;
    selStateRef.current = sel;

    useEffect(() => setMounted(true), []);

    /** 선택 적용 — EditContext 선택 동기(min,max) + 상태(anchor/focus). 타이핑/Backspace 가 선택을 교체/삭제하게. */
    const applySel = (anchor: number, focus: number) => {
        const ec = ecRef.current;
        if (ec) ec.updateSelection(Math.min(anchor, focus), Math.max(anchor, focus));
        setSel({ anchor, focus });
    };

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
            setSel({ anchor: te.selectionStart, focus: te.selectionEnd }); // 편집 후 collapse
        };
        ec.addEventListener("textupdate", onText);

        const updateCB = () => {
            if (stageRef.current) ec.updateControlBounds(stageRef.current.getBoundingClientRect());
        };
        updateCB();
        window.addEventListener("resize", updateCB);

        const setSelLocal = (a: number, f: number) => {
            ec.updateSelection(Math.min(a, f), Math.max(a, f));
            setSel({ anchor: a, focus: f });
        };
        // Enter·화살표·선택삭제 — keydown 직접 처리(EditContext 는 시각 레이아웃을 모름).
        const onKey = (e: KeyboardEvent) => {
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            const collapsed = cur.anchor === cur.focus;
            const len = ec.text.length;

            if (e.key === "Enter") {
                e.preventDefault();
                ec.updateText(lo, hi, "\n");
                ec.updateSelection(lo + 1, lo + 1);
                setBuffer(ec.text);
                setSel({ anchor: lo + 1, focus: lo + 1 });
                return;
            }
            // 전체 선택
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                setSelLocal(0, len);
                return;
            }
            // 선택이 있을 때 Backspace/Delete = 선택 삭제
            if ((e.key === "Backspace" || e.key === "Delete") && !collapsed) {
                e.preventDefault();
                ec.updateText(lo, hi, "");
                ec.updateSelection(lo, lo);
                setBuffer(ec.text);
                setSel({ anchor: lo, focus: lo });
                return;
            }
            // collapsed Backspace/Delete 는 EditContext 자동 처리(여기서 손대지 않음)

            const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
            if (!isArrow) return;
            e.preventDefault();
            let newFocus = cur.focus;
            const horiz = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;

            if (horiz !== 0 && (e.metaKey || e.ctrlKey)) {
                // Cmd+좌/우 = 줄 맨앞/맨뒤
                const lb = lineBoundsOf(cur.focus, viewRef.current.blocks);
                newFocus = horiz < 0 ? lb.start : lb.end;
            } else if (horiz !== 0 && e.altKey) {
                // Option+좌/우 = 단어 경계
                newFocus = wordBoundary(ec.text, cur.focus, horiz);
            } else if (horiz !== 0) {
                // 화살표 좌/우 — 선택 있으면(비shift) 가장자리로 collapse, 아니면 ±1
                if (!collapsed && !e.shiftKey) {
                    newFocus = horiz < 0 ? lo : hi;
                    setSelLocal(newFocus, newFocus);
                    return;
                }
                newFocus = Math.max(0, Math.min(len, cur.focus + horiz));
            } else {
                // 상/하
                if (e.metaKey || e.ctrlKey) {
                    newFocus = e.key === "ArrowUp" ? 0 : len;
                } else {
                    const v = viewRef.current;
                    const g = geoRef.current;
                    const cs = caretToScreen(cur.focus, v.blocks, v.pages, g);
                    if (cs) {
                        let pageIndex = cs.pageIndex;
                        let ty = cs.y + (e.key === "ArrowDown" ? 1.5 : -0.5) * g.lineHeightPx;
                        if (ty < 0 && pageIndex > 0) {
                            pageIndex -= 1;
                            ty += g.contentHeightPx;
                        } else if (ty > g.contentHeightPx && pageIndex < v.pages.length - 1) {
                            pageIndex += 1;
                            ty -= g.contentHeightPx;
                        }
                        const off = screenToCaret(pageIndex, cs.x, ty, v, g);
                        if (off != null) newFocus = off;
                    }
                }
            }
            if (e.shiftKey) setSelLocal(cur.anchor, newFocus);
            else setSelLocal(newFocus, newFocus);
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

    // 포인터 좌표 → 버퍼 오프셋(어느 페이지든). data-poc-page + elementFromPoint 로 페이지·로컬좌표 산출.
    const pointToCaret = (clientX: number, clientY: number): number | null => {
        const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-poc-page]");
        if (!el) return null;
        const pageIndex = Number(el.getAttribute("data-poc-page"));
        const r = el.getBoundingClientRect();
        return screenToCaret(pageIndex, clientX - r.left, clientY - r.top, viewRef.current, geoRef.current);
    };

    // 드래그 선택 — mousedown=anchor, move=focus, up=종료. preventDefault 로 네이티브 선택 억제 + 수동 focus.
    const onStageMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        stageRef.current?.focus();
        const off = pointToCaret(e.clientX, e.clientY);
        if (off == null) return;
        dragAnchorRef.current = off;
        applySel(off, off);
        const onMove = (me: MouseEvent) => {
            const f = pointToCaret(me.clientX, me.clientY);
            if (f != null && dragAnchorRef.current != null) applySel(dragAnchorRef.current, f);
        };
        const onUp = () => {
            dragAnchorRef.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const insertImage = () => {
        const ec = ecRef.current;
        if (!ec) return;
        const lo = Math.min(sel.anchor, sel.focus);
        const hi = Math.max(sel.anchor, sel.focus);
        ec.updateText(lo, hi, "\n" + OBJ + "\n");
        ec.updateSelection(lo + 3, lo + 3);
        setBuffer(ec.text);
        setSel({ anchor: lo + 3, focus: lo + 3 });
        stageRef.current?.focus();
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ece7df" }}>
            <style>{"@keyframes pocBlink{0%,49%{opacity:1}50%,100%{opacity:0}} .poc-caret{animation:pocBlink 1s step-end infinite}"}</style>
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>자체 에디터 PoC — EditContext + 선택</strong>
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
                <span style={{ fontSize: 12, color: "#9ca3af" }}>드래그 선택 · Shift/Cmd/Option+화살표 · Cmd+A · Enter · Backspace</span>
            </div>
            <div
                ref={stageRef}
                tabIndex={0}
                onMouseDown={onStageMouseDown}
                style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24, outline: "none", caretColor: "transparent" }}
            >
                {view.pages.map((pg) => (
                    <PageBox key={pg.index} page={pg} geo={geo} blocks={view.blocks} caret={caretPos} selRects={selRects.filter((r) => r.pageIndex === pg.index)} />
                ))}
            </div>
        </div>
    );
}
