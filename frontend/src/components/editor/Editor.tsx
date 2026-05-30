"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * TipTap 에디터 컴포넌트 (006 T017).
 *
 * - StarterKit (bold/italic/heading/list/blockquote 포함)
 * - immediatelyRender: false — Next.js SSR hydration 경고 방지 (PoC 0-1 기준선)
 * - body = ProseMirror JSON 문자열. onBodyChange 로 부모에게 전파.
 */

interface EditorProps {
    initialContent: string;
    onBodyChange: (body: string) => void;
    editable?: boolean;
}

export function Editor({ initialContent, onBodyChange, editable = true }: EditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: (() => {
            try {
                return JSON.parse(initialContent) as object;
            } catch {
                return { type: "doc", content: [] };
            }
        })(),
        immediatelyRender: false,
        editable,
        onUpdate: ({ editor: e }) => {
            onBodyChange(JSON.stringify(e.getJSON()));
        },
    });

    return (
        <div
            className="prose max-w-none"
            style={{
                fontFamily: "var(--w-font-prose)",
                fontSize: "var(--w-prose-size)",
                lineHeight: "var(--w-prose-line-height)",
                color: "var(--w-ink)",
            }}
        >
            <EditorContent editor={editor} />
        </div>
    );
}
