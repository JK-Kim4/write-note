"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useEditor, EditorContent, type Content, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { pageCount, globalLineAt, pageNumberTopsPx, paperGeometry, LINE_PX } from "./pageLayout";

/**
 * 진짜 페이지 분할 본문 에디터 — desktop `src/components/Editor.tsx` 이식(015 T001, PoC).
 *
 * - StarterKit. 한국어 IME 조합은 `view.composing` 가드(PoC 0-1) — 조합 중 부모 갱신 억제.
 * - 페이지 분할 = CSS column-wrap(.prose) + JS 기하(pageLayout) + ResizeObserver. 분할은 브라우저 레이아웃.
 * - 기존 006 `Editor.tsx`(ManuscriptGrid)와 별개 — US1 에서 /write 정식 교체.
 */

/** 에디터 본문 변경 페이로드 — documents.update 로 전달. desktop `types.ts` DocumentChange 이식. */
export type DocumentChange = { bodyJson: string; plainText: string; wordCount: number };

/** bodyJson(ProseMirror JSON 문자열) → TipTap content. 빈 문자열/파싱 실패는 빈 문서. */
function parseContent(bodyJson: string): Content {
    if (!bodyJson) return "";
    try {
        return JSON.parse(bodyJson) as Content;
    } catch {
        return "";
    }
}

type PaperEditorProps = {
    title: string;
    /** 현재 챕터 제목 — 작품 제목(.doc-title) 아래 부제로 표시. 미전달 시 표시 안 함. */
    chapterTitle?: string;
    initialBodyJson: string;
    onChange: (change: DocumentChange) => void;
    /**
     * 본문 변경 시 호출되는 경량 통로 — IME 조합 중에도 매 변경마다 발동.
     * setState/re-render 없이 localStorage draft 만 갱신하는 용도(조합을 깨지 않음). 작성분 무유실의 핵심.
     */
    onDraftUpdate?: (bodyJson: string) => void;
    /**
     * 에디터 인스턴스 참조를 상위로 노출(017 — 아웃라인 패널이 doc heading 파생·점프에 사용).
     * 준비 시 editor, 파기 시 null. PaperEditor 의 useEditor 소유·IME 가드·자동저장은 무변경.
     */
    onEditorReady?: (editor: Editor | null) => void;
    lined: boolean;
    zoom?: number;
};

// Phase 2: A4 geometry 상수. 용지 선택 배선은 Phase 3 에서 진행.
const A4_GEOMETRY = paperGeometry("A4");

export function PaperEditor({ title, chapterTitle, initialBodyJson, onChange, onDraftUpdate, onEditorReady, lined, zoom = 1 }: PaperEditorProps) {
    const paperRef = useRef<HTMLElement>(null);
    const [pages, setPages] = useState(1);

    // onChange/onDraftUpdate 의 최신 참조 — 언마운트 flush 에서 stale 클로저 방지.
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
            // 조합 중에도 draft 는 항상 보존(re-render 없음 → IME 안전). 작성분 무유실.
            onDraftUpdateRef.current?.(bodyJson);
            // 조합 도중 re-render 되면 composition 이 깨져 자모가 분리 입력된다 → 조합 끝에만 부모 state 갱신.
            if (e.view.composing) return;
            const text = e.getText();
            onChange({
                bodyJson,
                plainText: text,
                wordCount: text.replace(/\s/g, "").length,
            });
        },
    });

    // 언마운트(메뉴 이동 등) 직전 현재 에디터 내용을 draft 에 강제 flush — 조합 중이던 작성분까지 보존.
    useEffect(() => {
        if (!editor) return;
        return () => {
            if (editor.isDestroyed) return;
            onDraftUpdateRef.current?.(JSON.stringify(editor.getJSON()));
        };
    }, [editor]);

    // 에디터 참조를 상위(아웃라인 패널)로 노출 — 준비 시 editor, 언마운트 시 null.
    useEffect(() => {
        if (!editor) return;
        onEditorReady?.(editor);
        return () => onEditorReady?.(null);
    }, [editor, onEditorReady]);

    useEffect(() => {
        const pm = paperRef.current?.querySelector<HTMLElement>(".ProseMirror");
        if (!pm) return;
        const measure = () => setPages(pageCount(pm.getBoundingClientRect().height, zoom, A4_GEOMETRY.stridePx));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(pm);
        return () => ro.disconnect();
    }, [zoom, editor]);

    const handlePaperMouseDown = (e: ReactMouseEvent<HTMLElement>) => {
        if (!editor) return;
        const pm = paperRef.current?.querySelector<HTMLElement>(".ProseMirror");
        if (!pm) return;
        const pmTop = pm.getBoundingClientRect().top;
        const lineUnit = LINE_PX * zoom;
        const targetLine = globalLineAt((e.clientY - pmTop) / lineUnit, A4_GEOMETRY.bodyLines, A4_GEOMETRY.strideLines);
        const endTop = editor.view.coordsAtPos(editor.state.doc.content.size).top;
        const lastLine = globalLineAt((endTop - pmTop) / lineUnit, A4_GEOMETRY.bodyLines, A4_GEOMETRY.strideLines);
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
        <main className="editor-scroll" aria-label="본문 편집기">
            <h1 className="doc-title">{title}</h1>
            {chapterTitle != null && chapterTitle !== "" && (
                <p className="doc-chapter-title">{chapterTitle}</p>
            )}
            <article
                ref={paperRef}
                className="paper"
                style={{ minHeight: `${(pages - 1) * A4_GEOMETRY.stridePx + A4_GEOMETRY.sheetHpx}px` }}
                onMouseDown={handlePaperMouseDown}
            >
                <div className="sheets" aria-hidden="true">
                    {Array.from({ length: pages }, (_, i) => (
                        <div
                            key={i}
                            className={lined ? "sheet sheet--lined" : "sheet"}
                            style={{ top: `${i * A4_GEOMETRY.stridePx}px`, height: `${A4_GEOMETRY.sheetHpx}px` }}
                        />
                    ))}
                </div>
                {editor && (
                    <BubbleMenu editor={editor} className="bubble">
                        <button
                            type="button"
                            aria-label="굵게"
                            className={editor.isActive("bold") ? "is-active" : ""}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                        >
                            <strong>B</strong>
                        </button>
                        <button
                            type="button"
                            aria-label="기울임"
                            className={editor.isActive("italic") ? "is-active" : ""}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                        >
                            <em>I</em>
                        </button>
                        <span className="bubble__div" aria-hidden="true" />
                        <button
                            type="button"
                            aria-label="제목"
                            className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        >
                            H
                        </button>
                        <button
                            type="button"
                            aria-label="인용"
                            className={editor.isActive("blockquote") ? "is-active" : ""}
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        >
                            &ldquo;
                        </button>
                        <button
                            type="button"
                            aria-label="목록"
                            className={editor.isActive("bulletList") ? "is-active" : ""}
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            &bull;
                        </button>
                    </BubbleMenu>
                )}
                <EditorContent editor={editor} className="prose" />
                {pageNumberTopsPx(pages, A4_GEOMETRY.stridePx, A4_GEOMETRY.sheetHpx).map((top, i) => (
                    <div key={i} className="page-num" style={{ top: `${top}px` }} aria-label={`${i + 1}쪽`}>
                        {i + 1}
                    </div>
                ))}
            </article>
        </main>
    );
}
