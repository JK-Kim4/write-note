import { useEffect, useRef, useState } from "react";

/**
 * EditContext API PoC — 자체 텍스트 엔진의 토대 검증.
 *
 * 핵심: contenteditable 도 canvas 엔진의 자체 IME 도 아니라, **브라우저 네이티브 IME 파이프라인**
 * (EditContext)을 직접 받아 우리가 텍스트를 렌더한다. 한글 조합이 OS IME 그대로 흐르므로
 * Syncfusion(자체 IME 한글 깨짐)·contenteditable(decoration↔IME 충돌)의 문제를 우회할 수 있는지 본다.
 *
 * 이 PoC 의 본질 질문 = "우리가 직접 그리면서 EditContext 로 입력받을 때 한글이 안 깨지나?"
 * (페이지 분할은 다음 단계 — 여기선 입력 토대만.)
 */

/** contentEl 안에서 글자 offset 위치의 collapsed Range. 여러 text 노드를 가로질러 계산. */
function rangeAt(container: HTMLElement, offset: number): Range {
  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    last = node;
    if (remaining <= node.length) {
      range.setStart(node, remaining);
      range.collapse(true);
      return range;
    }
    remaining -= node.length;
    node = walker.nextNode() as Text | null;
  }
  if (last) range.setStart(last, last.length);
  else range.setStart(container, 0);
  range.collapse(true);
  return range;
}

type Info = { len: number; sel: number; composing: boolean; lastEvent: string };

export function EditContextPoc() {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [info, setInfo] = useState<Info>({ len: 0, sel: 0, composing: false, lastEvent: "—" });

  useEffect(() => {
    if (typeof EditContext === "undefined") {
      setSupported(false);
      return;
    }
    setSupported(true);

    const editorEl = editorRef.current!;
    const contentEl = contentRef.current!;
    const caretEl = caretRef.current!;
    const ec = new EditContext({ text: "" });
    editorEl.editContext = ec;

    let composeRange: { start: number; end: number } | null = null;

    const setSpan = (s: string, cls?: string) => {
      const n = document.createElement("span");
      if (cls) n.className = cls;
      n.textContent = s;
      return n;
    };

    const positionCaret = () => {
      const r = rangeAt(contentEl, ec.selectionStart);
      const rect = r.getBoundingClientRect();
      const base = editorEl.getBoundingClientRect();
      const top = (rect.height ? rect.top : base.top + 16) - base.top + editorEl.scrollTop;
      const left = (rect.height ? rect.left : base.left + 16) - base.left;
      caretEl.style.top = `${top}px`;
      caretEl.style.left = `${left}px`;
    };

    const render = (evt: string) => {
      const text = ec.text;
      contentEl.textContent = "";
      if (composeRange && composeRange.end > composeRange.start) {
        contentEl.appendChild(setSpan(text.slice(0, composeRange.start)));
        contentEl.appendChild(setSpan(text.slice(composeRange.start, composeRange.end), "composing"));
        contentEl.appendChild(setSpan(text.slice(composeRange.end)));
      } else {
        contentEl.appendChild(setSpan(text));
      }
      positionCaret();
      setInfo({ len: text.length, sel: ec.selectionStart, composing: !!composeRange, lastEvent: evt });
    };

    const updateBounds = () => {
      ec.updateControlBounds(editorEl.getBoundingClientRect());
      ec.updateSelectionBounds(rangeAt(contentEl, ec.selectionStart).getBoundingClientRect());
    };

    ec.addEventListener("textupdate", () => {
      render("textupdate");
      updateBounds();
    });

    ec.addEventListener("textformatupdate", (e) => {
      const formats = e.getTextFormats();
      composeRange = formats.length ? { start: formats[0].rangeStart, end: formats[0].rangeEnd } : null;
      render("textformatupdate");
    });

    ec.addEventListener("compositionstart", () => render("compositionstart"));
    ec.addEventListener("compositionend", () => {
      composeRange = null;
      render("compositionend");
    });

    ec.addEventListener("characterboundsupdate", (e) => {
      const bounds: DOMRect[] = [];
      for (let i = e.rangeStart; i < e.rangeEnd; i++) {
        const a = rangeAt(contentEl, i);
        const b = rangeAt(contentEl, i + 1);
        const r = document.createRange();
        r.setStart(a.startContainer, a.startOffset);
        r.setEnd(b.startContainer, b.startOffset);
        bounds.push(r.getBoundingClientRect());
      }
      ec.updateCharacterBounds(e.rangeStart, bounds);
    });

    // Enter / 화살표 / Home / End 는 직접 처리(EditContext 는 selection 을 앱이 관리).
    const onKeyDown = (e: KeyboardEvent) => {
      const a = Math.min(ec.selectionStart, ec.selectionEnd);
      const b = Math.max(ec.selectionStart, ec.selectionEnd);
      if (e.key === "Enter") {
        e.preventDefault();
        ec.updateText(a, b, "\n");
        ec.updateSelection(a + 1, a + 1);
        render("enter");
        updateBounds();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const p = Math.max(0, a - 1);
        ec.updateSelection(p, p);
        render("arrow");
        updateBounds();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const p = Math.min(ec.text.length, b + 1);
        ec.updateSelection(p, p);
        render("arrow");
        updateBounds();
      } else if (e.key === "Home") {
        e.preventDefault();
        ec.updateSelection(0, 0);
        render("home");
      } else if (e.key === "End") {
        e.preventDefault();
        const p = ec.text.length;
        ec.updateSelection(p, p);
        render("end");
      }
    };
    editorEl.addEventListener("keydown", onKeyDown);

    const onResize = () => updateBounds();
    window.addEventListener("resize", onResize);

    editorEl.focus();
    render("init");
    updateBounds();

    return () => {
      editorEl.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      editorEl.editContext = null;
    };
  }, []);

  return (
    <div className="ec-root">
      <header className="ec-bar">
        <div className="ec-bar__title">
          EditContext API PoC <span>· 브라우저 네이티브 IME · 자체 렌더 · 한글 dealbreaker 검증</span>
        </div>
        <div className="ec-stats">
          글자 <b>{info.len}</b> · 커서 <b>{info.sel}</b> · 조합 <b>{info.composing ? "중" : "—"}</b> · {info.lastEvent}
        </div>
      </header>

      {supported === false && (
        <div className="ec-unsupported">이 브라우저는 EditContext API 미지원 — Chrome/Edge 121+ 또는 Electron(Chromium 121+)에서 열어주세요.</div>
      )}

      <div className="ec-stage">
        <div ref={editorRef} className="ec-editor" tabIndex={0} spellCheck={false} role="textbox" aria-multiline="true">
          <div ref={contentRef} className="ec-content" />
          <span ref={caretRef} className="ec-caret" aria-hidden="true" />
        </div>
      </div>

      <footer className="ec-foot">
        <b>여기에 한글을 직접 타이핑하세요.</b> ① 빠른 타자(조합 중 다음 자모) ② 한자 변환 ③ Backspace 자모 분해 ④ 경계 근처 ←/→ 커서.
        조합 중 글자는 <u>밑줄</u>로 보입니다. "안녕하세요"가 <b>음절로 또박또박</b> 합쳐지면 GREEN, 자모(ㅇㅏㄴ…)로 흩어지면 RED.
      </footer>
    </div>
  );
}
