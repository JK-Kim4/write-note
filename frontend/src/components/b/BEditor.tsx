"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useEditor, EditorContent, type Content, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { DocumentChange } from "@/components/editor/PaperEditor";
import { extractPlainText } from "@/components/editor/wordCountUtils";
import { pageCount, globalLineAt, pageNumberTopsPx, paperGeometry, PAPER_PRESETS, LINE_PX, type PaperGeometry, type PaperSize } from "@/components/editor/pageLayout";
import { InlineEditableTitle } from "@/components/editor/InlineEditableTitle";

/**
 * B타입 본문 에디터 — fable-test ChapterEditor 디자인(툴바 / 본문 / 상태바 세로 3단) + 줄노트 라인.
 *
 * 흰 배경 흐름형 본문(max-width 48rem)에 b.css 가 행 단위 밑줄(줄 격자)을 그린다.
 * 자동저장·draft 결선은 A 디자인 PaperEditor 와 동일 규약: 한국어 IME 조합 중에는 부모 state 갱신을
 * 억제하고(onChange 차단) draft(onDraftUpdate)는 항상 흘려보낸다(작성분 무유실, PoC 0-1 가드).
 */

function parseContent(bodyJson: string): Content {
    if (!bodyJson) return "";
    try {
        return JSON.parse(bodyJson) as Content;
    } catch {
        return "";
    }
}

type BEditorProps = {
    initialBodyJson: string;
    onChange: (change: DocumentChange) => void;
    /** IME 조합 중에도 매 변경마다 호출 — localStorage draft 즉시 보존 통로(re-render 없음). */
    onDraftUpdate?: (bodyJson: string) => void;
    /** 에디터 인스턴스를 상위로 노출(아웃라인 목차 파생·점프용). */
    onEditorReady?: (editor: Editor | null) => void;
    /** 상태바 좌측 저장 상태 라벨(부모의 useDocumentSession syncStatus 매핑). */
    statusLabel: string;
    /** 상태 라벨 색조 — error 만 빨강, 나머지 회색. */
    statusTone: "ok" | "error";
    /** 용지 크기 — 분할·CSS변수 계산에 사용. Phase 3에서 store 연결. 미전달 시 A4. */
    paperSize?: PaperSize;
    /** 현재 챕터 제목 — 본문 상단에 부제로 표시. 미전달 시 표시 안 함. */
    chapterTitle?: string;
    /**
     * 본문 상단 챕터 제목 인라인 편집 완료 콜백 — 더블클릭 → input → Enter/blur 저장 시 호출.
     * 미전달 시 제목 편집 비활성(표시만).
     */
    onChapterRename?: (title: string) => void;
};

function ToolbarButton({
    label,
    isActive,
    onClick,
    children,
}: {
    label: string;
    isActive?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            // mousedown 기본 동작 차단 — 에디터 포커스/선택을 유지한 채 서식 토글.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={
                isActive
                    ? "rounded-md bg-indigo-100 px-2 py-1 text-sm font-medium text-indigo-700"
                    : "rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            }
        >
            {children}
        </button>
    );
}

function ToolbarDivider() {
    return <span aria-hidden="true" className="mx-1 h-5 w-px bg-gray-200" />;
}

/** A4 폭(210mm)을 px 로 — CSS mm = 96/25.4 px. 가용 폭에 A4 가 들어오는 fit-zoom 계산 기준. */
const A4_WIDTH_PX = 210 * (96 / 25.4);
/** .b-paged-stage 좌우 패딩 합(32+32) — 가용 폭 계산 시 차감. */
const STAGE_X_PADDING_PX = 64;

/**
 * Paged 모드 내부 서브컴포넌트 — 시트 절대배치 + ResizeObserver 장수 계산.
 * BEditor 의 useEditor 소유·IME 가드·자동저장은 불변(이 컴포넌트는 렌더+click-fill 전담).
 * Phase 2: geometry prop 수용 — 용지 선택 배선은 Phase 3. 현재는 A4 고정.
 */
function BPagedBody({
    editor,
    pagedRef,
    pages,
    geometry,
    zoom,
    lined,
    onMouseDown,
}: {
    editor: Editor | null;
    pagedRef: React.RefObject<HTMLElement | null>;
    pages: number;
    geometry: PaperGeometry;
    zoom: number;
    lined: boolean;
    onMouseDown: (e: ReactMouseEvent<HTMLElement>) => void;
}) {
    // 미축소 종이 높이(px). transform: scale 은 레이아웃 박스를 축소하지 않으므로(시각만),
    // 래퍼(.b-paged-fit)에 *축소된* 폭·높이를 예약해 가운데 정렬·스크롤 높이를 맞춘다.
    const unscaledH = (pages - 1) * geometry.stridePx + geometry.sheetHpx;
    return (
        <div
            className="b-paged-fit"
            style={{
                width: `calc(${geometry.maxWidthMm}mm * ${zoom})`,
                height: `${unscaledH * zoom}px`,
            }}
        >
            <article
                ref={pagedRef}
                className="b-paged-paper"
                style={
                    {
                        minHeight: `${unscaledH}px`,
                        // 용지 기하를 CSS 로 주입 — b.css 의 A4 하드코딩(폭·열폭·줄수·보폭)을 용지별 값으로 치환.
                        "--b-page-h": `${geometry.pageHpx}px`,
                        "--b-page-stride": `${geometry.stridePx}px`,
                        "--b-page-max-width": `${geometry.maxWidthMm}mm`,
                        "--b-page-col-width": `${geometry.colWidthMm}mm`,
                        // fit — transform: scale 로 다운스케일(b.css). zoom 과 달리 .ProseMirror 레이아웃(줄높이 정수)을
                        // 보존해 column-height 에 26줄이 그대로 들어간다(zoom 은 정수를 깨 under-fill 유발).
                        "--b-page-zoom": zoom,
                    } as React.CSSProperties
                }
                onMouseDown={onMouseDown}
            >
                <div className="b-paged-sheets" aria-hidden="true">
                {Array.from({ length: pages }, (_, i) => (
                    <div
                        key={i}
                        className={lined ? "b-sheet b-sheet--lined" : "b-sheet"}
                        style={{ top: `${i * geometry.stridePx}px`, height: `${geometry.sheetHpx}px` }}
                    />
                ))}
            </div>
            <EditorContent editor={editor} className="b-paged-prose" />
                {pageNumberTopsPx(pages, geometry.stridePx, geometry.sheetHpx).map((top, i) => (
                    <div key={i} className="b-page-num" style={{ top: `${top}px` }} aria-label={`${i + 1}쪽`}>
                        {i + 1}
                    </div>
                ))}
            </article>
        </div>
    );
}

export function BEditor({ initialBodyJson, onChange, onDraftUpdate, onEditorReady, statusLabel, statusTone, paperSize = "A4", chapterTitle, onChapterRename }: BEditorProps) {
    // 용지 크기 기하 — paperSize prop 변경 시 재계산(순수함수, 메모이제이션 불필요).
    const geometry = paperGeometry(paperSize);
    // 초기 글자수는 본문 JSON 에서 직접 파생 — 이후엔 onUpdate 가 갱신.
    const [charCount, setCharCount] = useState(() => extractPlainText(initialBodyJson).replace(/\s/g, "").length);
    // 툴바 active 상태 갱신용 tick — 조합 중 re-render 는 IME 를 깨므로 비조합 트랜잭션에서만 올린다.
    const [, setTick] = useState(0);
    // CSS column-height 지원 여부 — SSR 후 클라이언트 마운트 시 확인.
    const [isPaged, setIsPaged] = useState(false);
    // paged 모드 장수 — ResizeObserver 가 .ProseMirror 높이 측정.
    const [pages, setPages] = useState(1);
    const pagedRef = useRef<HTMLElement>(null);
    // fit-zoom — A4 가 가용 폭에 들어오도록 다운스케일(≤1). A4 항상 한 화면, 큰 용지는 같은 줌에서 비례 확대→가로 스크롤.
    const [fitZoom, setFitZoom] = useState(1);
    const stageRef = useRef<HTMLDivElement>(null);
    // 줄노트(괘선) 토글 — 기본 백지(false). 워드프로세서 기본 = 백지, 괘선은 옵션(향후 글씨크기·목차 등에 유연).
    const [lined, setLined] = useState(false);

    const onChangeRef = useRef(onChange);
    const onDraftUpdateRef = useRef(onDraftUpdate);
    useEffect(() => {
        onChangeRef.current = onChange;
        onDraftUpdateRef.current = onDraftUpdate;
    });

    const editor = useEditor({
        extensions: [StarterKit],
        content: parseContent(initialBodyJson),
        immediatelyRender: false,
        onUpdate: ({ editor: e }) => {
            const bodyJson = JSON.stringify(e.getJSON());
            // 조합 중에도 draft 는 항상 보존(re-render 없음 → IME 안전).
            onDraftUpdateRef.current?.(bodyJson);
            // 조합 도중 re-render 되면 composition 이 깨져 자모가 분리 입력된다 → 조합 끝에만 부모 갱신.
            if (e.view.composing) return;
            const text = e.getText();
            const wordCount = text.replace(/\s/g, "").length;
            setCharCount(wordCount);
            onChangeRef.current({ bodyJson, plainText: text, wordCount });
        },
    });

    // 선택 이동(서식 active 변화) 반영 — 비조합 시점에만 re-render(조합 중 re-render 는 IME 를 깬다).
    useEffect(() => {
        if (!editor) return;
        const onTransaction = () => {
            if (editor.view.composing) return;
            setTick((t) => t + 1);
        };
        editor.on("transaction", onTransaction);
        return () => {
            editor.off("transaction", onTransaction);
        };
    }, [editor]);

    // 언마운트 직전 현재 내용을 draft 로 강제 flush — 조합 중이던 작성분까지 보존.
    useEffect(() => {
        if (!editor) return;
        return () => {
            if (editor.isDestroyed) return;
            onDraftUpdateRef.current?.(JSON.stringify(editor.getJSON()));
        };
    }, [editor]);

    useEffect(() => {
        if (!editor) return;
        onEditorReady?.(editor);
        return () => onEditorReady?.(null);
    }, [editor, onEditorReady]);

    // CSS column-height 지원 여부 — SSR 안전: 마운트 후 한 번만 판정.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsPaged(CSS.supports("column-height", "1px"));
    }, []);

    // 가용 폭 → fit-zoom: A4(210mm)가 들어오도록 다운스케일(최대 1). 큰 용지는 같은 줌에서 비례 확대 → 가로 스크롤.
    useEffect(() => {
        if (!isPaged) return;
        const stage = stageRef.current;
        if (!stage) return;
        const measure = () => {
            const avail = stage.clientWidth - STAGE_X_PADDING_PX;
            setFitZoom(avail > 0 ? Math.min(1, avail / A4_WIDTH_PX) : 1);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(stage);
        return () => ro.disconnect();
    }, [isPaged]);

    // paged 모드: ResizeObserver 로 .ProseMirror 높이 측정 → 장수 갱신. fit-zoom 반영(높이가 줌 스케일됨).
    useEffect(() => {
        if (!isPaged) return;
        const pm = pagedRef.current?.querySelector<HTMLElement>(".ProseMirror");
        if (!pm) return;
        const measure = () => setPages(pageCount(pm.getBoundingClientRect().height, fitZoom, geometry.stridePx));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(pm);
        return () => ro.disconnect();
    }, [isPaged, editor, geometry.stridePx, fitZoom]);

    // 본문 빈 영역 클릭 시 에디터 포커스(문서 끝으로) — 줄노트 빈 줄을 클릭해도 바로 쓸 수 있게.
    const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!editor) return;
        if ((e.target as HTMLElement).closest(".ProseMirror")) return;
        e.preventDefault();
        editor.chain().focus("end").run();
    };

    // paged 모드 click-fill — PaperEditor.handlePaperMouseDown 이식.
    // 본문 영역 아래 빈 시트를 클릭하면 globalLineAt 까지 빈 문단을 채우고 포커스.
    const handlePagedMouseDown = (e: ReactMouseEvent<HTMLElement>) => {
        if (!editor) return;
        const pm = pagedRef.current?.querySelector<HTMLElement>(".ProseMirror");
        if (!pm) return;
        const pmTop = pm.getBoundingClientRect().top;
        // fit-zoom 적용 시 화면 px 가 줌 스케일되므로 줄 단위(LINE_PX)도 동일 배율로 환산.
        const lineUnit = LINE_PX * fitZoom;
        const targetLine = globalLineAt((e.clientY - pmTop) / lineUnit, geometry.bodyLines, geometry.strideLines);
        const endTop = editor.view.coordsAtPos(editor.state.doc.content.size).top;
        const lastLine = globalLineAt((endTop - pmTop) / lineUnit, geometry.bodyLines, geometry.strideLines);
        if (targetLine <= lastLine) return;
        e.preventDefault();
        const fill = Math.min(1000, targetLine - lastLine);
        editor
            .chain()
            .focus("end")
            .insertContent(Array.from({ length: fill }, () => ({ type: "paragraph" })))
            .run();
    };

    return (
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-1.5">
                {editor && (
                    <>
                        <ToolbarButton
                            label="굵게"
                            isActive={editor.isActive("bold")}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                        >
                            <strong>B</strong>
                        </ToolbarButton>
                        <ToolbarButton
                            label="기울임"
                            isActive={editor.isActive("italic")}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                        >
                            <em>I</em>
                        </ToolbarButton>
                        <ToolbarButton
                            label="밑줄"
                            isActive={editor.isActive("underline")}
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                        >
                            <span className="underline">U</span>
                        </ToolbarButton>
                        <ToolbarButton
                            label="취소선"
                            isActive={editor.isActive("strike")}
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                        >
                            <s>S</s>
                        </ToolbarButton>
                        <ToolbarDivider />
                        {([1, 2, 3] as const).map((level) => (
                            <ToolbarButton
                                key={level}
                                label={`제목 ${level}`}
                                isActive={editor.isActive("heading", { level })}
                                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
                            >
                                H{level}
                            </ToolbarButton>
                        ))}
                        <ToolbarDivider />
                        <ToolbarButton
                            label="인용"
                            isActive={editor.isActive("blockquote")}
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        >
                            &ldquo;
                        </ToolbarButton>
                        <ToolbarButton
                            label="글머리 목록"
                            isActive={editor.isActive("bulletList")}
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            &bull;
                        </ToolbarButton>
                        <ToolbarButton
                            label="번호 목록"
                            isActive={editor.isActive("orderedList")}
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                            1.
                        </ToolbarButton>
                        <ToolbarDivider />
                        <ToolbarButton label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                            ―
                        </ToolbarButton>
                        <ToolbarDivider />
                        <ToolbarButton label="줄노트" isActive={lined} onClick={() => setLined((v) => !v)}>
                            ☰
                        </ToolbarButton>
                    </>
                )}
            </div>
            {/* 챕터 제목 — 작품 제목 구분 없이 에디터 영역 상단에 부제로 표시. */}
            {chapterTitle != null && (
                <div className="border-b border-gray-100 px-6 py-2">
                    <InlineEditableTitle
                        title={chapterTitle}
                        onRename={onChapterRename}
                        placeholder="새 챕터"
                        className="text-sm font-medium text-gray-400"
                        ariaLabel="챕터 제목 편집"
                    />
                </div>
            )}
            {/* b-editor-scroll — 아웃라인 현재 섹션 추적의 스크롤 컨테이너(useEditorOutline 에 선택자 전달). */}
            {isPaged ? (
                <div ref={stageRef} className="b-editor-scroll b-paged-stage flex-1 overflow-x-auto overflow-y-auto">
                    {/* 용지 배지 — 현재 용지·치수를 항상 노출(규격 변경 인지). 폭 변화와 함께 이중 신호. */}
                    <div className="b-paper-badge" aria-label={`용지 ${paperSize}`}>
                        {paperSize} · {PAPER_PRESETS[paperSize].widthMm}×{PAPER_PRESETS[paperSize].heightMm}mm
                    </div>
                    <BPagedBody
                        editor={editor}
                        pagedRef={pagedRef}
                        pages={pages}
                        geometry={geometry}
                        zoom={fitZoom}
                        lined={lined}
                        onMouseDown={handlePagedMouseDown}
                    />
                </div>
            ) : (
                <div
                    className="b-editor-scroll b-editor flex-1 overflow-y-auto px-8 py-6"
                    onMouseDown={handleBodyMouseDown}
                >
                    <EditorContent editor={editor} className="b-editor-content" />
                </div>
            )}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
                <span role="status" aria-live="polite" className={statusTone === "error" ? "text-red-600" : undefined}>
                    {statusLabel}
                </span>
                <span>{charCount.toLocaleString()}자 (공백 제외)</span>
            </div>
        </div>
    );
}
