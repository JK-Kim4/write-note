import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Content } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import type { DocumentChange } from "../types";

/** A4 한 쪽 높이(px) — 297mm @ 96dpi. 본문 종이 높이 ÷ 이 값 = 페이지수. */
const A4_PAGE_PX = (297 * 96) / 25.4;

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
  /** 작업공간 줌(페이지수 측정 시 종이 시각 높이를 보정한다). */
  zoom?: number;
};

export function Editor({ title, initialBodyJson, onChange, lined, zoom = 1 }: EditorProps) {
  const paperRef = useRef<HTMLElement>(null);
  const [pages, setPages] = useState(1);

  // 종이(A4) 실제 높이를 관찰해 페이지수를 계산한다. getBoundingClientRect 는 zoom 이 반영된
  // 시각 높이라, A4 한 쪽 높이에도 같은 zoom 을 곱해 나누면 zoom 과 무관하게 페이지수가 나온다.
  useEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      // 허용오차(0.01쪽 ≈ 11px) — 빈 종이가 반올림으로 1.000…쪽이 되어 2로 올림되는 것을 막는다.
      const ratio = h / (A4_PAGE_PX * zoom);
      setPages(Math.max(1, Math.ceil(ratio - 0.01)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom]);

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
      <article ref={paperRef} className={lined ? "paper paper--lined" : "paper"}>
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
        <div className="page-num" aria-label={`${pages}쪽`}>{pages}</div>
      </article>
    </main>
  );
}
