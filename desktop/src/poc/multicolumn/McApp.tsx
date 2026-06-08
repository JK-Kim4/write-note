import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

/**
 * PoC 0-4 / 안 1 — CSS multi-column 기반 TipTap.
 *
 * 가설: 분할을 JS(데코레이션 재계산)로 하지 않고 **브라우저 layout engine** 에 맡긴다.
 *  - `.ProseMirror`(contenteditable)에 column-height(한 장 본문 높이) + column-wrap: wrap 을 주면,
 *    한 장을 다 채우면 브라우저가 아래 새 행(=다음 장)으로 흘린다(세로로 쌓임, Chrome 145+/Electron42=Chromium148).
 *  - 입력 중 우리가 dispatch 하는 transform 이 0 → 데코레이션 방식 RED 의 원인(매변경 재계산 ↔ IME)이
 *    구조적으로 없는지가 본 PoC 의 핵심 확인점.
 *
 * 측정(페이지 수)은 읽기 전용(scrollWidth) 이라 IME 와 무관 — 문서를 건드리지 않는다.
 */

const LINE_PX = 18 * 1.92; // 본문 줄 높이 — CSS --line 과 일치
const PAGE_STRIDE_PX = LINE_PX * 29; // 한 장(26줄) + 간격(3줄) = CSS --page-stride 와 일치

const SEED = [
  "창문을 열자 소금기 밴 바람이 먼저 들어왔다. 그 애는 책상 앞에 앉은 채로 한참을 가만히 있었다. 무언가를 쓰려던 손은 끝내 펜을 들지 못했고, 대신 바다 쪽으로 천천히 고개를 돌렸다.",
  "먼 데서 고깃배 한 척이 수평선을 따라 미끄러지고 있었다. 어제와 똑같은 풍경인데도 오늘은 어딘가 달라 보였다. 어쩌면 달라진 건 바다가 아니라, 그것을 바라보는 사람의 마음이었을 것이다.",
  "그 애는 다시 책상으로 돌아왔다. 이번에는 망설이지 않고 첫 문장을 적었다. 나는 그해 여름을 끝내 잊지 못할 것이다. 쓰고 나니 비로소, 오래 미뤄둔 이야기가 시작되려는 참이었다.",
];

function longDoc(times: number): string {
  let html = "";
  for (let i = 0; i < times; i++) html += `<p>${SEED[i % SEED.length]}</p>`;
  return html;
}

/** 엔터 없이 한 문단으로 길게 — 줄 단위 흐름(문단 한가운데 분할) 테스트용. */
function oneLongParagraph(times: number): string {
  let body = "";
  for (let i = 0; i < times; i++) body += SEED[i % SEED.length] + " ";
  return `<p>${body.trim()}</p>`;
}

export function McApp() {
  const [paged, setPaged] = useState(true);
  const [lined, setLined] = useState(true);
  const [pages, setPages] = useState(1);
  const [chars, setChars] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: longDoc(8),
    immediatelyRender: false,
  });

  /** 페이지 수 = multicol 세로 스크롤 높이 ÷ (한 장 높이 + 간격). 읽기 전용 측정. */
  const measure = useCallback(() => {
    const pm = hostRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (!pm) return;
    setChars(pm.textContent?.length ?? 0);
    if (!paged) {
      setPages(1);
      return;
    }
    setPages(Math.max(1, Math.round(pm.scrollHeight / PAGE_STRIDE_PX)));
  }, [paged]);

  useEffect(() => {
    if (!editor) return;
    // rAF 로 미뤄 레이아웃 확정 후 측정.
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    schedule();
    editor.on("update", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      editor.off("update", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [editor, measure]);

  return (
    <div className="mc-root">
      <header className="mc-bar">
        <div className="mc-bar__title">
          PoC 0-4 · 안1 — CSS multi-column{" "}
          <span>· 분할 = 브라우저 레이아웃(JS transform 0) · column-wrap 으로 세로로 쌓이는 A4 장</span>
        </div>
        <div className="mc-bar__actions">
          <label className="mc-check">
            <input type="checkbox" checked={paged} onChange={(e) => setPaged(e.target.checked)} />
            페이지 분할
          </label>
          <label className="mc-check">
            <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} />
            줄노트
          </label>
          <button type="button" onClick={() => editor?.commands.setContent(oneLongParagraph(12))}>
            엔터 없이 긴 문단
          </button>
          <button type="button" onClick={() => editor?.commands.setContent(longDoc(40))}>
            여러 문단(≈여러 장)
          </button>
        </div>
      </header>

      <div className={paged ? "mc-stage mc-stage--paged" : "mc-stage"}>
        <div
          ref={hostRef}
          className={
            "mc-prose" +
            (paged ? " mc-prose--paged" : "") +
            (lined ? " mc-prose--lined" : "")
          }
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      <aside className="mc-stats" aria-live="polite">
        <div className="mc-stats__row"><span>페이지(컬럼)</span><b>{pages}</b></div>
        <div className="mc-stats__row"><span>글자 수</span><b>{chars}</b></div>
        <p className="mc-stats__hint">
          <b>핵심 확인:</b> 분할이 브라우저 레이아웃이라 입력 중 깜빡임/재계산이 없는가. 컬럼(장)
          <b> 경계 근처</b>에서 한글 IME 4케이스 + 커서/선택이 안정적인가.
        </p>
        <ul className="mc-stats__ime">
          <li>① 빠른 타자(조합 중 다음 자모)</li>
          <li>② 조합 중 굵게(⌘B) 토글</li>
          <li>③ 한자 변환</li>
          <li>④ Backspace 자모 분해</li>
          <li>⑤ 장 경계 넘는 커서·드래그 선택</li>
        </ul>
        <p className="mc-stats__hint">
          <b>엔터 없이 긴 문단</b>을 넣고 본문 끝에 한글을 이어 쳐, 문단 한가운데 줄에서 다음 장으로
          넘어가는지 보세요. 페이지 끄면(체크 해제) 연속 TipTap 과 비교됩니다.
        </p>
      </aside>
    </div>
  );
}
