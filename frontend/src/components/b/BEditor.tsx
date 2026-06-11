"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Content, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { DocumentChange } from "@/components/editor/PaperEditor";
import { extractPlainText } from "@/components/editor/wordCountUtils";

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

export function BEditor({ initialBodyJson, onChange, onDraftUpdate, onEditorReady, statusLabel, statusTone }: BEditorProps) {
    // 초기 글자수는 본문 JSON 에서 직접 파생 — 이후엔 onUpdate 가 갱신.
    const [charCount, setCharCount] = useState(() => extractPlainText(initialBodyJson).replace(/\s/g, "").length);
    // 툴바 active 상태 갱신용 tick — 조합 중 re-render 는 IME 를 깨므로 비조합 트랜잭션에서만 올린다.
    const [, setTick] = useState(0);

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

    // 본문 빈 영역 클릭 시 에디터 포커스(문서 끝으로) — 줄노트 빈 줄을 클릭해도 바로 쓸 수 있게.
    const handleBodyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!editor) return;
        if ((e.target as HTMLElement).closest(".ProseMirror")) return;
        e.preventDefault();
        editor.chain().focus("end").run();
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
                    </>
                )}
            </div>
            {/* b-editor-scroll — 아웃라인 현재 섹션 추적의 스크롤 컨테이너(useEditorOutline 에 선택자 전달). */}
            <div
                className="b-editor-scroll b-editor flex-1 overflow-y-auto px-8 py-6"
                onMouseDown={handleBodyMouseDown}
            >
                <EditorContent editor={editor} className="b-editor-content" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
                <span role="status" aria-live="polite" className={statusTone === "error" ? "text-red-600" : undefined}>
                    {statusLabel}
                </span>
                <span>{charCount.toLocaleString()}자 (공백 제외)</span>
            </div>
        </div>
    );
}
