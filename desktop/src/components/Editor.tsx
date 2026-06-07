import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useEditor, EditorContent, type Content } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import type { DocumentChange } from "../types";
import { pageCount, globalLineAt, pageNumberTopsPx, LINE_PX, PAGE_STRIDE_PX, SHEET_H_PX } from "./pageLayout";

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

  // 본문 flow(.ProseMirror)의 시각 높이(zoom 반영)로 장수를 계산. pageCount 가 zoom 을 상쇄한다.
  // 장수만큼 종이 박스(.sheet)를 결정적 위치(보폭 PAGE_STRIDE_PX)에 깔고, 본문은 그 위로 흐른다.
  useEffect(() => {
    const pm = paperRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (!pm) return;
    const measure = () => setPages(pageCount(pm.getBoundingClientRect().height, zoom));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pm);
    return () => ro.disconnect();
  }, [zoom, editor]);

  // 노트처럼 빈 줄을 클릭하면 그 줄까지 빈 문단을 채우고 커서를 그 줄에 둔다.
  // .ProseMirror 에 min-height 가 있어 빈 줄 영역도 그 박스라, target 이 아니라 "클릭 줄 vs 마지막 글자 줄"로 판단.
  // 클릭이 글자 줄 이하(기존 글자/위)면 ProseMirror 가 클릭·드래그를 그대로 처리하도록 통과시킨다.
  const handlePaperMouseDown = (e: ReactMouseEvent<HTMLElement>) => {
    if (!editor) return;
    const pm = paperRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (!pm) return;
    const pmTop = pm.getBoundingClientRect().top; // 줌 반영된 화면 좌표
    const lineUnit = LINE_PX * zoom;
    const targetLine = globalLineAt((e.clientY - pmTop) / lineUnit);
    const endTop = editor.view.coordsAtPos(editor.state.doc.content.size).top;
    const lastLine = globalLineAt((endTop - pmTop) / lineUnit);
    if (targetLine <= lastLine) return; // 기존 글자 영역/위 → ProseMirror 처리(클릭·드래그)
    e.preventDefault();
    const fill = Math.min(1000, targetLine - lastLine); // 채울 빈 줄 수(폭주 방지 상한)
    editor
      .chain()
      .focus("end")
      .insertContent(Array.from({ length: fill }, () => ({ type: "paragraph" })))
      .run();
  };

  return (
    <main className="editor-scroll" aria-label="본문 편집기">
      <h1 className="doc-title">{title}</h1>
      <article
        ref={paperRef}
        className={lined ? "paper paper--lined" : "paper"}
        style={{ minHeight: `${(pages - 1) * PAGE_STRIDE_PX + SHEET_H_PX}px` }}
        onMouseDown={handlePaperMouseDown}
      >
        {/* 장별 종이 박스(그림자·둥근 모서리·줄선) — 결정적 위치(보폭)에 깔고 본문은 그 위로 흐른다. */}
        <div className="sheets" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <div
              key={i}
              className={lined ? "sheet sheet--lined" : "sheet"}
              style={{ top: `${i * PAGE_STRIDE_PX}px`, height: `${SHEET_H_PX}px` }}
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
        {/* 장별 쪽번호 — 각 종이 하단 패딩 줄 자리(파생 위치, 저장 안 함). */}
        {pageNumberTopsPx(pages).map((top, i) => (
          <div key={i} className="page-num" style={{ top: `${top}px` }} aria-label={`${i + 1}쪽`}>
            {i + 1}
          </div>
        ))}
      </article>
    </main>
  );
}
