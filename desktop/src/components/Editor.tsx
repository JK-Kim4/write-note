import { useEditor, EditorContent, type Content } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import type { DocumentChange } from "../types";

/**
 * 집필실 본문 에디터 (실제 TipTap).
 *
 * - StarterKit (bold/italic/heading/blockquote/list 등). 한국어 IME 조합은 PoC 0-1 기준.
 * - 서식은 '도구가 물러나는' 순도 컨셉(PRODUCT.md)에 맞춰, 텍스트 선택 시에만 뜨는
 *   BubbleMenu 로 제공한다. 본문 글꼴·크기는 고정(고운바탕 18px) — 변경 도구 없음.
 * - 본문 글자수는 공백·줄바꿈 제외. 자동저장 상태는 부모(App)가 관리.
 * - 본문은 선택 작품 document 의 bodyJson(ProseMirror JSON) 으로 초기화하고,
 *   입력 시 onChange 로 저장 페이로드를 올린다(저장·복원은 App↔IPC).
 */

/** bodyJson(ProseMirror JSON 문자열) 을 TipTap content 로. 빈 문자열/파싱 실패는 빈 문서. */
function parseContent(bodyJson: string): Content {
  if (!bodyJson) return "";
  try {
    return JSON.parse(bodyJson) as Content;
  } catch {
    return "";
  }
}

type EditorProps = {
  /** 집필 중인 작품 제목 (본문 상단 표시). */
  title: string;
  /** 초기 본문 — document.bodyJson(ProseMirror JSON 문자열). */
  initialBodyJson: string;
  /** 사용자 입력 발생 — 저장 페이로드를 부모로 올린다. */
  onChange: (change: DocumentChange) => void;
  /** 본문에 줄노트(가로 줄선) 표시 여부. */
  lined: boolean;
};

export function Editor({ title, initialBodyJson, onChange, lined }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseContent(initialBodyJson),
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      // 한글 IME 조합 중에는 부모 갱신(setState→re-render)을 막는다.
      // 조합 도중 EditorContent 가 re-render 되면 composition 이 깨져 자모가 분리 입력된다.
      // 조합이 끝나면 ProseMirror 가 트랜잭션을 다시 발생시켜 onUpdate 가 재호출된다.
      if (e.view.composing) return;
      const text = e.getText();
      onChange({
        bodyJson: JSON.stringify(e.getJSON()),
        plainText: text,
        wordCount: text.replace(/\s/g, "").length,
      });
    },
  });

  return (
    <main className="editor-scroll" aria-label="본문 편집기">
      <article className={lined ? "paper paper--lined" : "paper"}>
        <h1 className="doc-title">{title}</h1>
        {editor && (
          <BubbleMenu editor={editor} className="bubble">
            <button
              type="button"
              aria-label="굵게"
              className={editor.isActive("bold") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 5.2h6.2a3.6 3.6 0 0 1 0 7.2H7zM7 12h7a3.7 3.7 0 0 1 0 7.4H7z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="기울임"
              className={editor.isActive("italic") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <path d="M19 5h-7M12 19H5M15 5 9 19" />
              </svg>
            </button>
            <span className="bubble__div" aria-hidden="true" />
            <button
              type="button"
              aria-label="제목"
              className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 5v14M18 5v14M6 12h12" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="인용"
              className={editor.isActive("blockquote") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 8H6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3v2c0 1.3-.7 2-2 2.5M20 8h-4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3v2c0 1.3-.7 2-2 2.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="목록"
              className={editor.isActive("bulletList") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
              </svg>
            </button>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} className="prose" />
      </article>
    </main>
  );
}
