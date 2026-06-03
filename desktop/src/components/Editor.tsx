import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * 집필실 본문 에디터 (실제 TipTap).
 *
 * - StarterKit (bold/italic/heading/blockquote/list 등). 한국어 IME 조합은 PoC 0-1 기준.
 * - 서식은 '도구가 물러나는' 순도 컨셉(PRODUCT.md)에 맞춰, 텍스트 선택 시에만 뜨는
 *   BubbleMenu 로 제공한다. 본문 글꼴·크기는 고정(고운바탕 18px) — 변경 도구 없음.
 * - 본문 글자수는 공백·줄바꿈 제외. 자동저장 상태는 부모(App)가 관리.
 * - 로컬 persistence(앱 재시작 복원)는 desktop Phase 2.
 */

const INITIAL_CONTENT = `
<p>창문을 열자 소금기 밴 바람이 먼저 들어왔다. 그 애는 책상 앞에 앉은 채로 한참을 가만히 있었다. 무언가를 쓰려던 손은 끝내 펜을 들지 못했고, 대신 바다 쪽으로 천천히 고개를 돌렸다.</p>
<p>먼 데서 고깃배 한 척이 수평선을 따라 미끄러지고 있었다. 어제와 똑같은 풍경인데도 오늘은 어딘가 달라 보였다. 어쩌면 달라진 건 바다가 아니라, 그것을 바라보는 사람의 마음이었을 것이다.</p>
<p>그 애는 다시 책상으로 돌아왔다. 이번에는 망설이지 않고 첫 문장을 적었다. “나는 그해 여름을 끝내 잊지 못할 것이다.” 쓰고 나니 비로소, 오래 미뤄둔 이야기가 시작되려는 참이었다.</p>
`;

function countChars(editor: TiptapEditor): number {
  return editor.getText().replace(/\s/g, "").length;
}

type EditorProps = {
  /** 글자수만 갱신 (저장 상태 영향 없음 — 마운트 시 초기 카운트용) */
  onCount: (chars: number) => void;
  /** 사용자 입력 발생 — 자동저장 'saving' 트리거 */
  onTyping: () => void;
};

export function Editor({ onCount, onTyping }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: INITIAL_CONTENT,
    immediatelyRender: false,
    onCreate: ({ editor: e }) => onCount(countChars(e)),
    onUpdate: ({ editor: e }) => {
      onCount(countChars(e));
      onTyping();
    },
  });

  return (
    <main className="editor-scroll" aria-label="본문 편집기">
      <article className="paper">
        <h1 className="doc-title">바다가 보이는 방</h1>
        <p className="doc-meta">초고 · 3장</p>
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
