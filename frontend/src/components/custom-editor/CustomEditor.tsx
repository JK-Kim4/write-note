"use client";

/**
 * 자체 에디터 — EditContext 라이브 입력 + 선택. PocEditorLive 승격(버퍼를 props DocModel 로 구동).
 *
 * 입력 모델: 문서는 props.model(DocModel — buffer '\n' 구분 + blockAttrs). 선택은 {anchor, focus}.
 * - 타이핑/IME/블록 내부 collapsed Backspace·Delete → EditContext 자동 처리 → textupdate 에서
 *   model.ts 로 보정(reconcileAttrs)한 새 DocModel 을 onModelChange 로 올린다.
 * - Enter·블록경계 병합·선택삭제 → keydown 에서 model.ts 연산(splitBlock/mergeWithPrev/mergeWithNext/
 *   deleteRange)으로 라우팅 + EditContext(updateText/updateSelection) 동기.
 * - 캐럿·선택 하이라이트는 직접 그림(measureLineXs = 줄바꿈·렌더와 동일 메트릭).
 *
 * 본 단계 단순화: 전부 단일 폰트(heading 폰트 분기·blockAttrs 정확보존 검증은 US2). toolbar 없음
 * (용지는 props, 폰트 고정, 이미지삽입 보류) — CustomEditor 는 편집 표면만.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { pageGeometry, type PageGeometry, type PaperSize } from "./geometry";
import { emptyHistory, pushSnapshot, redo, undo, type Snapshot } from "./history";
import { type LaidOutPage } from "./layoutEngine";
import { measureLineXs } from "./measure";
import { modelToPmJson, pmJsonToModel } from "./pmConvert";
import { FONT_FAMILY, IMG_SRC, relayout, renderRuns, type ParsedBlock, type View } from "./printLayout";
import {
    blockIndexAt,
    demoteEmptyBlockAtCaret,
    deleteAtomicAt,
    deleteRange,
    insertHr,
    insertModel,
    insertSoftBreak,
    insertText,
    isAtomic,
    lineIndexFor,
    sliceModel,
    MARK,
    marksAt,
    mergeWithNext,
    mergeWithPrev,
    nextCaretSkippingAtomic,
    SOFT_BREAK,
    splitBlock,
    toggleBlockType,
    toggleHeading,
    toggleMark,
    type Affinity,
    type BlockAttr,
    type DocModel,
    type Mask,
} from "./model";

type CaretPos = { pageIndex: number; x: number; y: number; height: number };
type SelRect = { pageIndex: number; x: number; y: number; width: number; height: number };

/**
 * 버퍼 오프셋 캐럿 → 화면 위치. 측정·레이아웃에서 줄·페이지·x 를 역추적(measureLineXs = 렌더와 동일 메트릭).
 * affinity: wrap 경계 offset 의 시각 줄 선택 — +1(기본)=다음 줄 머리(1라운드 동작), -1=앞 줄 끝.
 */
function caretToScreen(caret: number, blocks: ParsedBlock[], pages: LaidOutPage[], geo: PageGeometry, affinity: Affinity = 1): CaretPos | null {
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
    // wrap 경계 offset(line[K].start==line[K-1].end)의 시각 줄을 affinity 로 선택(lineIndexFor):
    //   +1(기본·downstream) = `within < l.end` → 다음 줄 머리. 1라운드 동작 그대로(무회귀).
    //   -1(upstream)        = `within <= l.end` → 앞 줄 끝.
    // 맨끝은 findIndex -1 → 마지막 줄 fallback(lineIndexFor 내부 처리).
    const lineIdx = lineIndexFor(blk.lines, within, affinity);
    const line = blk.lines[lineIdx];
    const fr = findFrag(lineIdx);
    if (!fr) return null;
    const xs = measureLineXs(blk.text, blk.marks, line.start, line.end, geo.contentWidthPx, blk.lineHeightPx, blk.fontSizePx, FONT_FAMILY);
    return {
        pageIndex: fr.pageIndex,
        x: (xs[within - line.start] ?? 0) + blk.indentPx,
        y: fr.offsetY + (lineIdx - fr.startLine) * blk.lineHeightPx,
        height: blk.lineHeightPx,
    };
}

/**
 * 화면 좌표(페이지·콘텐츠 상대 x/y) → 버퍼 캐럿. caretToScreen 의 역 — 클릭·드래그·세로이동.
 * affinity: 클릭 offset 이 wrap 으로 접힌 줄(다음 시각 줄이 같은 블록에 이어짐)의 끝에 떨어지면 -1(앞 줄 끝),
 * 그 외는 +1(downstream). 줄 끝을 정확히 클릭한 의도를 보존 — 그래야 캐럿이 클릭한 줄에 그려진다.
 */
function screenToCaret(pageIndex: number, x: number, y: number, view: View, geo: PageGeometry): { offset: number; affinity: Affinity } | null {
    const page = view.pages[pageIndex];
    if (!page || page.fragments.length === 0) return null;
    let frag = page.fragments.find((f) => y >= f.offsetY && y < f.offsetY + f.height);
    if (!frag) frag = y < page.fragments[0].offsetY ? page.fragments[0] : page.fragments[page.fragments.length - 1];
    const block = view.blocks.find((b) => b.id === frag!.blockId);
    if (!block) return null;
    if (frag.kind === "image" || block.kind === "image") return { offset: block.bufStart, affinity: 1 };
    // 구분선(원자)은 캐럿 진입 불가 — 가까운 이웃 블록 가장자리로 보낸다.
    if (block.attr.type === "hr") {
        const bi = view.blocks.indexOf(block);
        const prev = view.blocks[bi - 1];
        const nx = view.blocks[bi + 1];
        if (prev) return { offset: prev.bufEnd, affinity: 1 };
        if (nx) return { offset: nx.bufStart, affinity: 1 };
        return { offset: block.bufStart, affinity: 1 };
    }
    const lineWithin = Math.min(frag.endLine - frag.startLine, Math.max(0, Math.floor((y - frag.offsetY) / block.lineHeightPx)));
    const lineIdx = frag.startLine + lineWithin;
    const line = block.lines[lineIdx];
    if (!line) return { offset: block.bufEnd, affinity: 1 };
    const xs = measureLineXs(block.text, block.marks, line.start, line.end, geo.contentWidthPx, block.lineHeightPx, block.fontSizePx, FONT_FAMILY);
    const localX = x - block.indentPx; // 들여쓰기만큼 좌측 보정 후 글자 매칭
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < xs.length; i++) {
        const d = Math.abs(xs[i] - localX);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    // 클릭이 이 줄의 끝(line.end)에 떨어졌고, 같은 블록에 다음 시각 줄이 이어지면(soft-wrap) upstream(-1).
    // 그래야 캐럿이 클릭한 줄 끝에 렌더된다(없으면 +1=다음 줄 머리로 가버림). 마지막 줄이면 +1(개행/블록 끝).
    const atLineEnd = line.start + best === line.end;
    const hasNextWrappedLine = lineIdx < block.lines.length - 1;
    const affinity: Affinity = atLineEnd && hasNextWrappedLine ? -1 : 1;
    return { offset: block.bufStart + line.start + best, affinity };
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
                const y = f.offsetY + (L - f.startLine) * block.lineHeightPx;
                if (os >= oe) {
                    // 빈 줄이 통째로 선택됐거나, 줄 끝 개행만 걸친 경우 작은 sliver 표시
                    if (lo <= lineLo && lineLo < hi)
                        rects.push({ pageIndex: pg.index, x: block.indentPx, y, width: 8, height: block.lineHeightPx });
                    continue;
                }
                const xs = measureLineXs(block.text, block.marks, line.start, line.end, geo.contentWidthPx, block.lineHeightPx, block.fontSizePx, FONT_FAMILY);
                const xStart = xs[os - block.bufStart - line.start] + block.indentPx;
                const xEnd = xs[oe - block.bufStart - line.start] + block.indentPx;
                const tail = hi > lineHi ? 8 : 0; // 개행까지 선택되면 줄 끝에 sliver
                rects.push({ pageIndex: pg.index, x: xStart, y, width: xEnd - xStart + tail, height: block.lineHeightPx });
            }
        }
    }
    return rects;
}

/**
 * offset 이 soft-wrap 경계인가 — 어떤 시각 줄의 end 와 같고, 같은 블록에 다음 시각 줄이 이어지는가
 * (즉 진짜 '\n' 블록 끝이 아니라 줄바꿈으로 접힌 경계). 경계면 캐럿이 "앞 줄 끝"(upstream)에 그려질 수 있다.
 * 캐럿 이동 시 affinity 결정에 사용 — 경계가 아니면 항상 downstream(+1) = 1라운드 동작.
 */
function isWrapBoundary(offset: number, blocks: ParsedBlock[]): boolean {
    const blk = blocks.find((b) => offset >= b.bufStart && offset <= b.bufEnd);
    if (!blk || blk.kind === "image") return false;
    const within = offset - blk.bufStart;
    for (let i = 0; i < blk.lines.length - 1; i++) {
        if (within === blk.lines[i].end) return true;
    }
    return false;
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
                        // 구분선(hr) — 텍스트 대신 가로선.
                        if (b.attr.type === "hr") {
                            return (
                                <div key={idx} style={{ position: "absolute", top: f.offsetY, left: 0, width: geo.contentWidthPx, height: f.height, display: "flex", alignItems: "center" }}>
                                    <div style={{ width: "100%", borderTop: "2px solid #d4d4d8" }} />
                                </div>
                            );
                        }
                        // heading 의 첫 fragment(startLine===0)에만 data-heading-level 태깅.
                        // 다페이지 heading 중복 방지 — fragment 가 여러 페이지에 걸쳐도 인덱스는 1개.
                        const headingDataAttr =
                            b.headingLevel != null && f.startLine === 0
                                ? { "data-heading-level": b.headingLevel }
                                : {};
                        const isQuote = b.attr.type === "blockquote";
                        const isList = b.attr.type === "listItem";
                        // 목록 마커는 첫 시각 줄(startLine===0 fragment)에만, 들여쓰기 거터 안에 그린다.
                        const marker = isList && f.startLine === 0 ? (b.listNumber != null ? `${b.listNumber}.` : "•") : null;
                        return (
                            <div key={idx} style={{ position: "absolute", top: f.offsetY, left: 0, width: geo.contentWidthPx, height: f.height, overflow: "hidden" }} {...headingDataAttr}>
                                {isQuote && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#a1a1aa" }} />}
                                {marker != null && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            width: b.indentPx,
                                            fontSize: b.fontSizePx,
                                            lineHeight: `${b.lineHeightPx}px`,
                                            fontFamily: FONT_FAMILY,
                                            color: "#6b7280",
                                            boxSizing: "border-box",
                                            textAlign: b.listNumber != null ? "right" : "center",
                                            paddingRight: b.listNumber != null ? 6 : 0,
                                        }}
                                    >
                                        {marker}
                                    </div>
                                )}
                                <div
                                    style={{
                                        transform: `translateY(${-(f.startLine * b.lineHeightPx)}px)`,
                                        width: geo.contentWidthPx,
                                        paddingLeft: b.indentPx,
                                        boxSizing: "border-box",
                                        fontSize: b.fontSizePx,
                                        lineHeight: `${b.lineHeightPx}px`,
                                        fontFamily: FONT_FAMILY,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        color: "#1f2937",
                                    }}
                                >
                                    {renderRuns(b.text, b.marks)}
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

/** 외부(목차 클릭 등)에서 에디터 캐럿을 제어하는 명령형 핸들. */
export type CustomEditorRef = {
    /** headingIndex(문서 순서상 N번째 heading)의 텍스트 끝으로 캐럿 점프 + 스크롤·포커스. */
    jumpToHeading: (headingIndex: number) => void;
};

export const CustomEditor = forwardRef<
    CustomEditorRef,
    {
        model: DocModel;
        onModelChange: (next: DocModel) => void;
        paperSize: PaperSize;
        fontSizePx?: number;
    }
>(function CustomEditor({ model, onModelChange, paperSize, fontSizePx = 18 }, ref) {
    const buffer = model.buffer;
    // sel.affinity = focus 캐럿의 wrap 경계 시각 위치(-1=앞 줄 끝, +1=다음 줄 시작). 기본 +1 = 1라운드 동작.
    const [sel, setSel] = useState<{ anchor: number; focus: number; affinity: Affinity }>({ anchor: buffer.length, focus: buffer.length, affinity: 1 });
    const [pendingMarks, setPendingMarks] = useState<Mask | null>(null);
    const [mounted, setMounted] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const ecRef = useRef<EditContext | null>(null);
    const dragAnchorRef = useRef<number | null>(null);
    // IME 조합 상태 — EditContext 의 compositionstart/end 로 추적(keydown e.isComposing 은 EditContext 에서 미설정).
    const composingRef = useRef(false);
    // 마크 토글(선택 구간) — 단축키(effect 안 keydown)와 툴바 버튼(render)이 공유. effect 안에서 ec 동기까지
    // 처리하는 실제 구현을 ref 에 담아 양쪽이 호출. 선택 없으면(US2 보류 마크 전) 무동작.
    const toggleMarkRef = useRef<(mark: Mask) => void>(() => {});
    // 구분선 삽입 — buffer 변경 + undo + EC 동기가 effect 안에서만 가능하므로 ref 로 노출(toggleMarkRef 패턴).
    const applyHrRef = useRef<() => void>(() => {});
    // undo/redo 스택 + 타이핑 런 경계(연속 타이핑은 undo 1회). 마운트 1회 effect 안 핸들러가 참조.
    const historyRef = useRef(emptyHistory());
    const typingRunRef = useRef(false);
    // fit-to-width — 종이가 에디터 폭보다 넓으면 축소비율(0<scale≤1). 클릭 hit-test 보정에 scaleRef 사용.
    const [scale, setScale] = useState(1);
    const scaleRef = useRef(1);
    // 사용자 확대/축소 배수(−/+ 버튼). 최종 zoom = fit-to-width(scale) × userZoom.
    const [userZoom, setUserZoom] = useState(1);

    const geo = useMemo(() => pageGeometry(paperSize, fontSizePx), [paperSize, fontSizePx]);
    // 버퍼뿐 아니라 blockAttrs(heading 토글) 변경도 리플로우 — 블록별 폰트가 측정·렌더에 관통.
    const view = useMemo<View>(() => (mounted ? relayout(model, geo) : { blocks: [], pages: [] }), [mounted, model, geo]);
    const caretPos = mounted ? caretToScreen(sel.focus, view.blocks, view.pages, geo, sel.affinity) : null;
    const selRects = mounted ? selectionRects(sel.anchor, sel.focus, view, geo) : [];

    // 툴바 활성 표시 — 현재 캐럿이 속한 블록의 attr.
    const activeBlockIdx = blockIndexAt(model, sel.focus);
    const activeAttr: BlockAttr = model.blockAttrs[activeBlockIdx] ?? { type: "paragraph" };
    // 마크 버튼 활성(T027) — pendingMarks 가 있으면 그것을, 없으면 focus 캐럿 좌측 글자의 mask.
    // pendingMarks state 또는 sel state 가 바뀌면 리렌더되어 버튼 활성 갱신됨.
    const activeMask = pendingMarks !== null ? pendingMarks : marksAt(model, sel.focus);

    // keydown/드래그 핸들러(마운트 1회 생성)가 최신 값을 보도록 ref 안정화.
    const viewRef = useRef(view);
    const geoRef = useRef(geo);
    const selStateRef = useRef(sel);
    const modelRef = useRef(model);
    const onModelChangeRef = useRef(onModelChange);
    // pendingMarks ref — onKey(마운트 1회 effect)에서 최신값 읽기. setter 는 안정적이라 ref 불필요.
    const pendingMarksRef = useRef<Mask | null>(null);
    viewRef.current = view;
    geoRef.current = geo;
    selStateRef.current = sel;
    modelRef.current = model;
    onModelChangeRef.current = onModelChange;
    pendingMarksRef.current = pendingMarks;
    const effectiveScale = scale * userZoom;
    scaleRef.current = effectiveScale;

    // fit-to-width — stage 가용 폭에 종이가 들어가도록 축소비율 계산(ResizeObserver 로 패널/창 변화 추종).
    // 페이지 + 좌우 패딩(48*2=96)이 stage clientWidth 안에 들어가도록. 종이가 좁으면 scale=1(축소 안 함).
    useEffect(() => {
        if (!mounted) return;
        const stage = stageRef.current;
        if (!stage) return;
        const compute = () => {
            const avail = stage.clientWidth - 8; // 세로 스크롤바 여유
            const natural = geo.pageWidthPx + 96;
            setScale(Math.max(0.3, Math.min(1, avail / natural)));
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(stage);
        return () => ro.disconnect();
    }, [geo, mounted]);

    // 캐럿 가시화 — 캐럿이 페이지를 넘어가 stage 뷰포트 밖이면 stage 만 최소 스크롤해 따라간다.
    // (window 는 건드리지 않음. block:'nearest' scrollIntoView 대신 scrollTop 직접 보정으로 부작용 차단.)
    useEffect(() => {
        if (!mounted) return;
        const stage = stageRef.current;
        if (!stage) return;
        const caretEl = stage.querySelector<HTMLElement>(".poc-caret");
        if (!caretEl) return;
        const cr = caretEl.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        const margin = 24;
        if (cr.top < sr.top + margin) stage.scrollTop -= sr.top + margin - cr.top;
        else if (cr.bottom > sr.bottom - margin) stage.scrollTop += cr.bottom - (sr.bottom - margin);
    }, [sel.focus, sel.anchor, view, mounted]);

    useEffect(() => setMounted(true), []);

    /** 선택 적용 — EditContext 선택 동기(min,max) + 상태(anchor/focus/affinity). 타이핑/Backspace 가 선택을 교체/삭제하게. */
    const applySel = (anchor: number, focus: number, affinity: Affinity = 1) => {
        const ec = ecRef.current;
        if (ec) ec.updateSelection(Math.min(anchor, focus), Math.max(anchor, focus));
        setSel({ anchor, focus, affinity });
    };

    // 목차 클릭 점프 — heading 텍스트 끝으로 캐럿 collapse(sel.focus effect 가 즉시 scrollTop 보정 →
    // smooth scroll 없음 → activeIndex measure 경합 없음) + stage 포커스 복귀(키 입력 가능).
    // view 가 useMemo 이므로 deps 에 포함해 최신 blocks 클로저 보장.
    useImperativeHandle(
        ref,
        () => ({
            jumpToHeading: (headingIndex: number) => {
                const headings = view.blocks.filter((b) => b.kind === "paragraph" && b.headingLevel != null);
                const target = headings[headingIndex];
                if (!target) return;
                applySel(target.bufEnd, target.bufEnd, 1);
                stageRef.current?.focus({ preventScroll: true });
            },
        }),
        [view],
    );

    // EditContext 부착 + 입력 루프(마운트 1회).
    useEffect(() => {
        const host = stageRef.current;
        if (!host || typeof EditContext === "undefined") return;
        const initial = modelRef.current.buffer;
        const ec = new EditContext({ text: initial, selectionStart: initial.length, selectionEnd: initial.length });
        ecRef.current = ec;
        host.editContext = ec;

        // ── undo/redo 헬퍼(effect 안 = ec 직접 접근). ──
        /** 현재 편집 직전 상태 스냅샷(modelRef 는 아직 이전 모델 → pre-edit 캡처). */
        const snapshotOf = (): Snapshot => ({
            buffer: modelRef.current.buffer,
            blockAttrs: modelRef.current.blockAttrs,
            markRuns: modelRef.current.markRuns,
            selection: selStateRef.current,
        });
        /** 구조편집(Enter/선택삭제/병합/paste) 직전 스냅샷 push + 타이핑 런 종료(coalesce 없음). */
        const recordBeforeStructural = () => {
            historyRef.current = pushSnapshot(historyRef.current, snapshotOf(), { coalesce: false });
            typingRunRef.current = false;
        };
        /** 스냅샷 복원 — EditContext 텍스트·선택 + model + sel 동기. */
        const applySnapshot = (s: Snapshot) => {
            const nextModel: DocModel = { buffer: s.buffer, blockAttrs: s.blockAttrs, markRuns: s.markRuns };
            ec.updateText(0, ec.text.length, s.buffer);
            ec.updateSelection(Math.min(s.selection.anchor, s.selection.focus), Math.max(s.selection.anchor, s.selection.focus));
            onModelChangeRef.current(nextModel);
            setSel(s.selection);
        };

        // 타이핑/IME/블록내부 collapsed Backspace·Delete = EditContext 자동 → model 보정 후 올림.
        const onText = (e: Event) => {
            const te = e as TextUpdateEvent;
            // 타이핑 런 시작 시 1회 pre-edit 스냅샷(modelRef 는 아직 이전 모델). 런 = undo 1회 경계.
            if (!typingRunRef.current) {
                historyRef.current = pushSnapshot(historyRef.current, snapshotOf(), { coalesce: false });
                typingRunRef.current = true;
            }
            // 마크 상속(T022): 삽입 글자는 보류 마크(pendingMarks)가 있으면 그것을, 없으면 좌측 글자
            // (updateRangeStart)의 mask 를 이어받는다. EditContext 의 updateRange[Start,End) 가 치환 범위.
            // insertText 로 재구성해 markRuns 가 삽입/삭제를 추종(modelFromEc 의 reconcile 은 mask 0 으로 평탄).
            const pre = modelRef.current;
            const pending = pendingMarksRef.current;
            const inheritMask = pending !== null ? pending : marksAt(pre, te.updateRangeStart);
            const next = insertText(pre, te.updateRangeStart, te.updateRangeEnd, te.text, inheritMask);
            onModelChangeRef.current(next);
            // 보류 마크 소비 — 입력이 들어오면 폐기.
            if (pending !== null) setPendingMarks(null);
            setSel({ anchor: te.selectionStart, focus: te.selectionEnd, affinity: 1 }); // 편집 후 collapse(downstream)
        };
        ec.addEventListener("textupdate", onText);

        // 조합 상태 추적 — keydown 가드가 조합 중 Enter 이중삽입을 막는 데 쓴다.
        const onCompositionStart = () => {
            composingRef.current = true;
        };
        const onCompositionEnd = () => {
            composingRef.current = false;
        };
        ec.addEventListener("compositionstart", onCompositionStart);
        ec.addEventListener("compositionend", onCompositionEnd);

        // 내부 리치 클립보드 MIME — 복사 시 선택 부분문서를 PM JSON 으로 병기, 붙여넣기 시 복원.
        const PM_MIME = "application/x-writenote-pm";

        // 복사 — text/plain(U+2028→\n) + PM JSON 병기. 동기 copy 이벤트라야 커스텀 MIME 가능(Chromium).
        const onCopy = (e: ClipboardEvent) => {
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            if (lo >= hi) return;
            e.preventDefault();
            const sub = sliceModel(modelRef.current, lo, hi);
            e.clipboardData?.setData("text/plain", ec.text.slice(lo, hi).split(SOFT_BREAK).join("\n"));
            e.clipboardData?.setData(PM_MIME, modelToPmJson(sub));
        };
        host.addEventListener("copy", onCopy);

        // 잘라내기 — 복사 후 선택 삭제.
        const onCut = (e: ClipboardEvent) => {
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            if (lo >= hi) return;
            e.preventDefault();
            const sub = sliceModel(modelRef.current, lo, hi);
            e.clipboardData?.setData("text/plain", ec.text.slice(lo, hi).split(SOFT_BREAK).join("\n"));
            e.clipboardData?.setData(PM_MIME, modelToPmJson(sub));
            recordBeforeStructural();
            const next = deleteRange(modelRef.current, lo, hi);
            ec.updateText(0, ec.text.length, next.buffer);
            ec.updateSelection(lo, lo);
            onModelChangeRef.current(next);
            setSel({ anchor: lo, focus: lo, affinity: 1 });
        };
        host.addEventListener("cut", onCut);

        // 붙여넣기 — 내부 PM JSON 있으면 서식·블록 보존 복원, 없으면 평문(블록 분할).
        const onPaste = (e: ClipboardEvent) => {
            if (composingRef.current) return;
            e.preventDefault();
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            const pm = e.clipboardData?.getData(PM_MIME);
            if (pm) {
                let sub: DocModel | null = null;
                try {
                    sub = pmJsonToModel(pm);
                } catch {
                    sub = null;
                }
                if (sub) {
                    recordBeforeStructural();
                    const next = insertModel(modelRef.current, lo, hi, sub);
                    ec.updateText(0, ec.text.length, next.buffer);
                    const caret = lo + sub.buffer.length;
                    ec.updateSelection(caret, caret);
                    onModelChangeRef.current(next);
                    setSel({ anchor: caret, focus: caret, affinity: 1 });
                    return;
                }
            }
            const raw = e.clipboardData?.getData("text/plain") ?? "";
            if (!raw) return;
            const text = raw.replace(/\r\n?/g, "\n");
            recordBeforeStructural();
            const next = insertText(modelRef.current, lo, hi, text);
            ec.updateText(0, ec.text.length, next.buffer);
            const caret = lo + text.length;
            ec.updateSelection(caret, caret);
            onModelChangeRef.current(next);
            setSel({ anchor: caret, focus: caret, affinity: 1 });
        };
        host.addEventListener("paste", onPaste);

        const updateCB = () => {
            if (stageRef.current) ec.updateControlBounds(stageRef.current.getBoundingClientRect());
        };
        updateCB();
        window.addEventListener("resize", updateCB);

        const setSelLocal = (a: number, f: number, affinity: Affinity = 1) => {
            ec.updateSelection(Math.min(a, f), Math.max(a, f));
            setSel({ anchor: a, focus: f, affinity });
        };

        // 선택 구간 마크 토글(T021) — buffer/선택 불변(EC 텍스트 동기 불필요), markRuns 만 변경 + undo 스냅샷.
        // 선택 없으면(collapsed) 무동작 — 보류 마크(pendingMarks)는 US2 범위.
        const applyToggleMark = (mark: Mask) => {
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            if (lo >= hi) return;
            recordBeforeStructural();
            const next = toggleMark(modelRef.current, lo, hi, mark);
            onModelChangeRef.current(next);
        };
        toggleMarkRef.current = applyToggleMark;

        // 구분선(hr) 삽입 — 선택 있으면 먼저 삭제 후 caret 위치에 hr 블록 삽입. EC 텍스트 동기 + undo.
        const applyHr = () => {
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            recordBeforeStructural();
            const base = lo < hi ? deleteRange(modelRef.current, lo, hi) : modelRef.current;
            const bi = blockIndexAt(base, lo);
            const next = insertHr(base, lo);
            ec.updateText(0, ec.text.length, next.buffer);
            // hr 다음 블록(bi+2 = 뒤 분리 블록) 시작으로 캐럿(원자 블록 건너뜀).
            const after = blockBufRanges(next.buffer)[bi + 2]?.start ?? next.buffer.length;
            ec.updateSelection(after, after);
            onModelChangeRef.current(next);
            setSel({ anchor: after, focus: after, affinity: 1 });
        };
        applyHrRef.current = applyHr;

        // Enter·블록경계병합·선택삭제·화살표 — keydown 직접 처리(EditContext 는 시각 레이아웃/blockAttrs 를 모름).
        const onKey = (e: KeyboardEvent) => {
            // IME 조합 중(한글 등)에는 커스텀 키 처리를 건너뛴다 — 조합 중 Enter/Backspace/화살표는
            // IME·EditContext 가 처리한다. 이 가드가 없으면 조합 중 Enter 가 우리 splitBlock(\n 1개) +
            // IME 자체 개행(\n 1개)으로 이중 삽입돼 빈 블록(\n\n)이 생긴다(2026-06-15 dogfooding 회귀).
            // EditContext 는 keydown e.isComposing 을 미설정 → 자체 compositionstart/end 로 추적한 composingRef 사용.
            if (e.isComposing || composingRef.current) return;
            const cur = selStateRef.current;
            const lo = Math.min(cur.anchor, cur.focus);
            const hi = Math.max(cur.anchor, cur.focus);
            const collapsed = cur.anchor === cur.focus;
            const len = ec.text.length;
            const m = modelRef.current;

            // 마크 단축키(T021+T025) — Cmd/Ctrl+B/I/U. strike 는 툴바 버튼만.
            // 선택 있으면 구간 토글(applyToggleMark). collapsed 이면 보류 마크 토글(pendingMarks).
            // IME 가드 아래 = 조합 중 토글 차단(정상). 'z'/'c'/'x'/'a' 분기와 키가 달라 충돌 없음.
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                const k = e.key.toLowerCase();
                if (k === "b" || k === "i" || k === "u") {
                    e.preventDefault();
                    const mark = k === "b" ? MARK.bold : k === "i" ? MARK.italic : MARK.underline;
                    if (!collapsed) {
                        applyToggleMark(mark);
                    } else {
                        // collapsed: 보류 마크 토글 — base 는 현재 pendingMarks 또는 캐럿 좌측 글자 mask.
                        const base = pendingMarksRef.current !== null ? pendingMarksRef.current : marksAt(modelRef.current, cur.focus);
                        setPendingMarks(base ^ mark);
                    }
                    return;
                }
            }

            // ⓪ Cmd/Ctrl+Z = undo, +Shift = redo. 'z'·'a' 다른 키라 Cmd+A 분기와 충돌 없음.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                const r = e.shiftKey
                    ? redo(historyRef.current, snapshotOf())
                    : undo(historyRef.current, snapshotOf());
                if (r.snapshot) {
                    historyRef.current = r.history;
                    applySnapshot(r.snapshot);
                }
                typingRunRef.current = false;
                return;
            }

            // 복사(Cmd+C)·잘라내기(Cmd+X) 는 네이티브 copy/cut 이벤트(onCopy/onCut)에서 처리 —
            // 서식 보존(PM JSON) 위해 동기 clipboardData 필요. 여기서 가로채지 않는다(preventDefault 금지).
            // ③-0 Shift+Enter = 소프트 줄바꿈(U+2028) — 같은 블록·목록 번호 유지, 줄만 추가.
            if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                recordBeforeStructural();
                const caret = lo;
                const next = insertSoftBreak(deleteRange(m, lo, hi), caret);
                ec.updateText(0, ec.text.length, next.buffer);
                ec.updateSelection(caret + 1, caret + 1);
                onModelChangeRef.current(next);
                setSel({ anchor: caret + 1, focus: caret + 1, affinity: 1 });
                return;
            }
            // ③ Enter = splitBlock(model, caret) — model 연산으로 라우팅 + EditContext 동기.
            if (e.key === "Enter") {
                e.preventDefault();
                recordBeforeStructural();
                // 선택이 있으면 먼저 삭제 후 split(EditContext 텍스트도 함께 정합).
                const caret = lo;
                // Enter 직전 활성 마크(보류 마크 또는 좌측 글자 mask)를 새 줄로 이어준다 — 워드 관습:
                // 굵게 쓰던 중 Enter 치면 다음 줄도 굵게 유지. 새 블록은 빈 run 이라 marksAt=0 → 평문이 되는 회귀 방지.
                const carry = pendingMarksRef.current !== null ? pendingMarksRef.current : marksAt(m, caret);
                const next = splitBlock(deleteRange(m, lo, hi), caret);
                ec.updateText(0, ec.text.length, next.buffer);
                ec.updateSelection(caret + 1, caret + 1);
                onModelChangeRef.current(next);
                setSel({ anchor: caret + 1, focus: caret + 1, affinity: 1 });
                setPendingMarks(carry !== 0 ? carry : null);
                return;
            }
            // 전체 선택
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
                e.preventDefault();
                typingRunRef.current = false; // 선택만 변경 → 다음 타이핑이 새 undo 경계
                setSelLocal(0, len);
                return;
            }
            // ② 선택이 있을 때 Backspace/Delete = deleteRange(model, lo, hi).
            if ((e.key === "Backspace" || e.key === "Delete") && !collapsed) {
                e.preventDefault();
                recordBeforeStructural();
                const next = deleteRange(m, lo, hi);
                ec.updateText(0, ec.text.length, next.buffer);
                ec.updateSelection(lo, lo);
                onModelChangeRef.current(next);
                setSel({ anchor: lo, focus: lo, affinity: 1 });
                return;
            }
            // ③ 블록 시작에서 collapsed Backspace = mergeWithPrev(model, blockIdx).
            if (e.key === "Backspace" && collapsed) {
                const blockIdx = blockIndexAt(m, cur.focus);
                const ranges = blockBufRanges(m.buffer);
                const atBlockStart = cur.focus === ranges[blockIdx].start;
                // 빈 비-본문 블록(heading/blockquote/listItem) 시작에서 Backspace → paragraph 강등.
                // mergeWithPrev 보다 먼저 — blockIdx 0(앞 블록 없음)에서도 강등되어야 한다.
                if (atBlockStart) {
                    const demote = demoteEmptyBlockAtCaret(m, cur.focus);
                    if (demote.demoted) {
                        e.preventDefault();
                        recordBeforeStructural();
                        // buffer 불변(attr 만 교체) → ec.updateText 불필요, 캐럿 유지.
                        onModelChangeRef.current(demote.model);
                        setSel({ anchor: cur.focus, focus: cur.focus, affinity: 1 });
                        return;
                    }
                }
                if (atBlockStart && blockIdx > 0) {
                    e.preventDefault();
                    recordBeforeStructural();
                    const newCaret = ranges[blockIdx].start - 1; // 병합/hr삭제 후 캐럿 = 제거된 '\n' 위치
                    // 앞 블록이 구분선(원자)이면 병합 대신 그 블록만 삭제.
                    const prevAtomic = isAtomic(m.blockAttrs[blockIdx - 1] ?? { type: "paragraph" });
                    const next = prevAtomic ? deleteAtomicAt(m, blockIdx - 1) : mergeWithPrev(m, blockIdx);
                    ec.updateText(0, ec.text.length, next.buffer);
                    ec.updateSelection(newCaret, newCaret);
                    onModelChangeRef.current(next);
                    setSel({ anchor: newCaret, focus: newCaret, affinity: 1 });
                    return;
                }
                // 그 외(블록 내부) collapsed Backspace 는 EditContext 자동 처리 → textupdate.
            }
            // ④ 블록 끝에서 collapsed Delete = mergeWithNext(model, blockIdx).
            if (e.key === "Delete" && collapsed) {
                const blockIdx = blockIndexAt(m, cur.focus);
                const ranges = blockBufRanges(m.buffer);
                const isLastBlock = blockIdx >= ranges.length - 1;
                // 블록의 시각 끝 = '\n' 직전(마지막 블록은 buffer 끝). end 는 '\n' 포함이므로 콘텐츠 끝 = end-(개행유무).
                const contentEnd = isLastBlock ? ranges[blockIdx].end : ranges[blockIdx].end - 1;
                if (!isLastBlock && cur.focus === contentEnd) {
                    e.preventDefault();
                    recordBeforeStructural();
                    // 다음 블록이 구분선(원자)이면 병합 대신 그 블록만 삭제.
                    const nextAtomic = isAtomic(m.blockAttrs[blockIdx + 1] ?? { type: "paragraph" });
                    const next = nextAtomic ? deleteAtomicAt(m, blockIdx + 1) : mergeWithNext(m, blockIdx);
                    ec.updateText(0, ec.text.length, next.buffer);
                    ec.updateSelection(cur.focus, cur.focus);
                    onModelChangeRef.current(next);
                    setSel({ anchor: cur.focus, focus: cur.focus, affinity: 1 });
                    return;
                }
                // 그 외(블록 내부) collapsed Delete 는 EditContext 자동 처리 → textupdate.
            }

            const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
            if (!isArrow) return;
            e.preventDefault();
            typingRunRef.current = false; // 캐럿/선택만 변경 → 다음 타이핑이 새 undo 경계
            // 캐럿 이동 시 보류 마크 폐기 — 화살표로 다른 위치로 가면 토글 컨텍스트가 무효화됨.
            if (pendingMarksRef.current !== null) setPendingMarks(null);
            let newFocus = cur.focus;
            // affinity 갱신(T031): 기본 +1(downstream) = 1라운드 동작. wrap 경계에 멈출 때만 -1(upstream).
            //   좌/우 화살표·End·단어경계 가 wrap 경계 offset 에 멈추면 그 줄 끝(앞 줄 끝)에 캐럿을 그린다.
            //   Home(줄 맨앞)·상/하(screenToCaret 결정)·블록 경계는 따로 처리. 애매하면 +1.
            let newAffinity: Affinity = 1;
            const horiz = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
            const blocks = viewRef.current.blocks;

            if (horiz !== 0 && (e.metaKey || e.ctrlKey)) {
                // Cmd+좌/우 = 줄 맨앞(Home)/맨뒤(End). End 가 wrap 경계면 그 줄 끝(upstream).
                const lb = lineBoundsOf(cur.focus, blocks);
                newFocus = horiz < 0 ? lb.start : lb.end;
                newAffinity = horiz < 0 ? 1 : isWrapBoundary(newFocus, blocks) ? -1 : 1;
            } else if (horiz !== 0 && e.altKey) {
                // Option+좌/우 = 단어 경계. wrap 경계에 멈추면 upstream.
                newFocus = wordBoundary(ec.text, cur.focus, horiz);
                newAffinity = isWrapBoundary(newFocus, blocks) ? -1 : 1;
            } else if (horiz !== 0) {
                // 화살표 좌/우 — 선택 있으면(비shift) 가장자리로 collapse, 아니면 ±1
                if (!collapsed && !e.shiftKey) {
                    newFocus = horiz < 0 ? lo : hi;
                    setSelLocal(newFocus, newFocus, isWrapBoundary(newFocus, blocks) ? -1 : 1);
                    return;
                }
                // ±1 이동하되 구분선(원자) 블록은 건너뛴다(진입 안 함).
                newFocus = nextCaretSkippingAtomic(m, cur.focus, horiz);
                // 좌/우 화살표가 wrap 경계에 멈추면 upstream(앞 줄 끝). 좌(이전 줄 끝으로 올라옴)·우(현재 줄 끝 도달) 둘 다.
                newAffinity = isWrapBoundary(newFocus, blocks) ? -1 : 1;
            } else {
                // 상/하
                if (e.metaKey || e.ctrlKey) {
                    newFocus = e.key === "ArrowUp" ? 0 : len;
                } else {
                    const v = viewRef.current;
                    const g = geoRef.current;
                    const cs = caretToScreen(cur.focus, v.blocks, v.pages, g, cur.affinity);
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
                        const hit = screenToCaret(pageIndex, cs.x, ty, v, g);
                        if (hit != null) {
                            newFocus = hit.offset;
                            newAffinity = hit.affinity;
                        }
                    }
                }
            }
            if (e.shiftKey) setSelLocal(cur.anchor, newFocus, newAffinity);
            else setSelLocal(newFocus, newFocus, newAffinity);
        };
        host.addEventListener("keydown", onKey);
        host.focus();

        return () => {
            ec.removeEventListener("textupdate", onText);
            ec.removeEventListener("compositionstart", onCompositionStart);
            ec.removeEventListener("compositionend", onCompositionEnd);
            host.removeEventListener("copy", onCopy);
            host.removeEventListener("cut", onCut);
            host.removeEventListener("paste", onPaste);
            host.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", updateCB);
            host.editContext = null;
            ecRef.current = null;
        };
        // 마운트 1회 — 최신 값은 ref(modelRef/onModelChangeRef/selStateRef/viewRef/geoRef)로 참조.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 포인터 좌표 → 버퍼 캐럿({offset, affinity}, 어느 페이지든). data-poc-page + elementFromPoint 로 페이지·로컬좌표 산출.
    const pointToCaret = (clientX: number, clientY: number): { offset: number; affinity: Affinity } | null => {
        const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-poc-page]");
        if (!el) return null;
        const pageIndex = Number(el.getAttribute("data-poc-page"));
        const r = el.getBoundingClientRect();
        // zoom 축소 시 getBoundingClientRect 는 축소된 시각 좌표 → 내부(미축소) 콘텐츠 좌표로 환산(/scale).
        const s = scaleRef.current;
        return screenToCaret(pageIndex, (clientX - r.left) / s, (clientY - r.top) / s, viewRef.current, geoRef.current);
    };

    // 드래그용 — 커서가 page 콘텐츠 박스 밖(여백·페이지 사이·텍스트 아래)이면 가장 가까운 page 로 clamp.
    // data-poc-page 는 콘텐츠 영역만 덮으므로(여백 제외), 빠른 드래그가 여백을 지날 때 pointToCaret 가
    // null 을 반환해 선택이 끊기는 회귀를 막는다(2026-06-15 dogfooding). 클릭(mousedown)은 정밀 유지.
    const pointToCaretClamped = (clientX: number, clientY: number): { offset: number; affinity: Affinity } | null => {
        const direct = pointToCaret(clientX, clientY);
        if (direct != null) return direct;
        const pages = stageRef.current?.querySelectorAll<HTMLElement>("[data-poc-page]");
        if (!pages || pages.length === 0) return null;
        let nearest: HTMLElement | null = null;
        let nearestDist = Infinity;
        for (const p of pages) {
            const pr = p.getBoundingClientRect();
            const dy = clientY < pr.top ? pr.top - clientY : clientY > pr.bottom ? clientY - pr.bottom : 0;
            if (dy < nearestDist) {
                nearestDist = dy;
                nearest = p;
            }
        }
        if (!nearest) return null;
        const pr = nearest.getBoundingClientRect();
        const s = scaleRef.current;
        const geo = geoRef.current;
        const lx = Math.min(Math.max((clientX - pr.left) / s, 0), geo.contentWidthPx);
        const ly = Math.min(Math.max((clientY - pr.top) / s, 0), geo.contentHeightPx);
        return screenToCaret(Number(nearest.getAttribute("data-poc-page")), lx, ly, viewRef.current, geo);
    };

    // 드래그 선택 — mousedown=anchor, move=focus, up=종료. preventDefault 로 네이티브 선택 억제 + 수동 focus.
    const onStageMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        stageRef.current?.focus();
        const hit = pointToCaret(e.clientX, e.clientY);
        if (hit == null) return;
        typingRunRef.current = false; // 클릭/드래그 = 캐럿 이동 → 다음 타이핑이 새 undo 경계
        // 클릭/드래그 시작 = 캐럿 이동 → 보류 마크 폐기.
        if (pendingMarks !== null) setPendingMarks(null);
        dragAnchorRef.current = hit.offset;
        applySel(hit.offset, hit.offset, hit.affinity);
        const onMove = (me: MouseEvent) => {
            const f = pointToCaretClamped(me.clientX, me.clientY);
            if (f != null && dragAnchorRef.current != null) applySel(dragAnchorRef.current, f.offset, f.affinity);
        };
        const onUp = () => {
            dragAnchorRef.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // 툴바 — 현재 블록 attr 만 토글(buffer 불변 → EditContext 텍스트 동기 불필요, 선택도 불변).
    // level 지정 = toggleHeading(같은 level 이면 paragraph 해제). 본문 = heading 일 때만 그 level 로 해제.
    const applyHeading = (level: 1 | 2 | 3) => {
        const idx = blockIndexAt(modelRef.current, selStateRef.current.focus);
        onModelChangeRef.current(toggleHeading(modelRef.current, idx, level));
        stageRef.current?.focus();
    };
    const applyParagraph = () => {
        const idx = blockIndexAt(modelRef.current, selStateRef.current.focus);
        const attr = modelRef.current.blockAttrs[idx];
        if (attr?.type === "heading") onModelChangeRef.current(toggleHeading(modelRef.current, idx, attr.level));
        stageRef.current?.focus();
    };
    // 블록 타입 토글(인용/목록) — 같은 타입이면 본문으로 해제. buffer 불변(blockAttrs 만) → EC 동기 불필요.
    const applyBlockType = (target: "blockquote" | { listKind: "bullet" | "ordered" }) => {
        const idx = blockIndexAt(modelRef.current, selStateRef.current.focus);
        const cur = modelRef.current.blockAttrs[idx];
        const isSame =
            typeof target === "string"
                ? cur?.type === target
                : cur?.type === "listItem" && cur.listKind === target.listKind;
        onModelChangeRef.current(toggleBlockType(modelRef.current, idx, isSame ? "paragraph" : target));
        stageRef.current?.focus();
    };
    // 마크 토글 버튼 — 선택 있으면 구간 토글, collapsed 이면 보류 마크 토글(T025). 포커스 복귀.
    const applyMark = (mark: Mask) => {
        const cur = selStateRef.current;
        const collapsed = cur.anchor === cur.focus;
        if (!collapsed) {
            toggleMarkRef.current(mark);
        } else {
            // collapsed: 보류 마크 토글 — base 는 현재 pendingMarks 또는 캐럿 좌측 글자 mask.
            const base = pendingMarksRef.current !== null ? pendingMarksRef.current : marksAt(modelRef.current, cur.focus);
            setPendingMarks(base ^ mark);
        }
        stageRef.current?.focus();
    };

    const toolbarBtn = (label: string, isActive: boolean, onClick: () => void) => (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            style={{
                padding: "4px 10px",
                fontSize: 13,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: isActive ? "#e0e7ff" : "#fff",
                color: isActive ? "#3730a3" : "#374151",
                cursor: "pointer",
            }}
        >
            {label}
        </button>
    );

    return (
        <>
            <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid #e5e7eb", flex: "none" }}>
                {toolbarBtn("본문", activeAttr.type === "paragraph", applyParagraph)}
                {toolbarBtn("제목1", activeAttr.type === "heading" && activeAttr.level === 1, () => applyHeading(1))}
                {toolbarBtn("제목2", activeAttr.type === "heading" && activeAttr.level === 2, () => applyHeading(2))}
                {toolbarBtn("제목3", activeAttr.type === "heading" && activeAttr.level === 3, () => applyHeading(3))}
                {/* 마크 — 선택 구간 토글. 활성 표시 = focus 좌측 글자 mask. */}
                {toolbarBtn("B", (activeMask & MARK.bold) !== 0, () => applyMark(MARK.bold))}
                {toolbarBtn("I", (activeMask & MARK.italic) !== 0, () => applyMark(MARK.italic))}
                {toolbarBtn("U", (activeMask & MARK.underline) !== 0, () => applyMark(MARK.underline))}
                {toolbarBtn("S", (activeMask & MARK.strike) !== 0, () => applyMark(MARK.strike))}
                {/* 블록 — 인용·글머리표·번호목록·구분선. 활성 = 현재 블록 attr. */}
                {toolbarBtn("인용", activeAttr.type === "blockquote", () => applyBlockType("blockquote"))}
                {toolbarBtn("• 목록", activeAttr.type === "listItem" && activeAttr.listKind === "bullet", () => applyBlockType({ listKind: "bullet" }))}
                {toolbarBtn("1. 목록", activeAttr.type === "listItem" && activeAttr.listKind === "ordered", () => applyBlockType({ listKind: "ordered" }))}
                {toolbarBtn("구분선", false, () => applyHrRef.current())}
                {/* 확대/축소 — fit-to-width(scale) 위의 사용자 배수(userZoom). 표시는 실제 배율(effectiveScale). */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                        type="button"
                        aria-label="축소"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setUserZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                        style={{ width: 26, height: 26, fontSize: 15, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#374151", cursor: "pointer", lineHeight: 1 }}
                    >
                        −
                    </button>
                    <span style={{ fontSize: 12, minWidth: 42, textAlign: "center", color: "#374151" }}>{Math.round(userZoom * 100)}%</span>
                    <button
                        type="button"
                        aria-label="확대"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setUserZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                        style={{ width: 26, height: 26, fontSize: 15, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#374151", cursor: "pointer", lineHeight: 1 }}
                    >
                        +
                    </button>
                </div>
            </div>
            <div
                ref={stageRef}
                tabIndex={0}
                onMouseDown={onStageMouseDown}
                className="custom-editor-scroll"
                // 은은한 배경 — 흰 페이지가 "책상 위 종이"처럼 떠 보이게(흰-on-흰 답답함 해소).
                style={{ flex: 1, overflow: "auto", outline: "none", caretColor: "transparent", background: "#eceae4" }}
            >
            <style>{"@keyframes pocBlink{0%,49%{opacity:1}50%,100%{opacity:0}} .poc-caret{animation:pocBlink 1s step-end infinite}"}</style>
            {/* width:max-content + margin:0 auto — 페이지가 뷰포트보다 넓어도 왼쪽 클리핑 없이 가로 스크롤,
                좁지 않으면 중앙 정렬. (flexbox alignItems:center 의 중앙정렬 오버플로 클리핑 회피.) */}
            <div style={{ width: "max-content", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "40px 48px", zoom: effectiveScale }}>
                {view.pages.map((pg) => (
                    <PageBox key={pg.index} page={pg} geo={geo} blocks={view.blocks} caret={caretPos} selRects={selRects.filter((r) => r.pageIndex === pg.index)} />
                ))}
            </div>
            </div>
        </>
    );
});

CustomEditor.displayName = "CustomEditor";

/** buffer 의 각 블록 [start, end) — '\n' 은 이전 블록 end 에 포함(model.ts blockRanges 와 동일 규약). */
function blockBufRanges(buffer: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let start = 0;
    for (let i = 0; i <= buffer.length; i++) {
        if (i === buffer.length || buffer[i] === "\n") {
            ranges.push({ start, end: i === buffer.length ? i : i + 1 });
            start = i + 1;
        }
    }
    if (ranges.length === 0) ranges.push({ start: 0, end: 0 });
    return ranges;
}
