import { useEffect, useRef, useState } from "react";
import { computePageBreaks } from "../pagination/computePageBreaks";

/**
 * 자체 페이지 분할 에디터 v1 — EditContext(입력) + 우리가 그리는 레이아웃(표시).
 *
 * - 입력: EditContext = 브라우저 네이티브 IME → 한글 조합 안전(Syncfusion 자체 IME 와 다름).
 * - 표시: ec.text 를 우리가 직접 렌더. 줄을 재서 A4 페이지 경계를 넘는 줄 '앞'에 책상색 여백을 끼운다.
 *   이 표시 DOM 은 입력 surface 가 아니므로(읽기 전용), 줄 단위로 자유롭게 나눠도 IME 와 충돌하지 않는다.
 * - 측정·재배치는 rAF 로 미뤄 조합을 막지 않는다(빠른 타자에도 자모 안 깨짐).
 */

const PAGE_PX = ((297 - 25 - 30) * 96) / 25.4; // A4 본문 높이
const LINE_PX = 18 * 1.92; // 본문 한 줄
const GAP_PX = 28; // 장 사이 책상색 여백

type Stats = { pages: number; lines: number; chars: number; composing: boolean };

export function PaginatedEditor() {
  const paperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>({ pages: 1, lines: 0, chars: 0, composing: false });

  useEffect(() => {
    if (typeof EditContext === "undefined") {
      setSupported(false);
      return;
    }
    setSupported(true);

    const paper = paperRef.current!;
    const flow = flowRef.current!;
    const caret = caretRef.current!;
    const ec = new EditContext({ text: "" });
    paper.editContext = ec;
    let composing = false;

    const textSpan = (s: string) => {
      const n = document.createElement("span");
      n.textContent = s;
      return n;
    };
    const spacerSpan = (h: number) => {
      const n = document.createElement("span");
      n.className = "pe-break";
      n.style.height = `${h}px`;
      return n;
    };

    /** flow 안에서 글자 offset(여백 제외, 텍스트 노드만) 위치의 collapsed Range. */
    const rangeAt = (offset: number): Range => {
      const r = document.createRange();
      const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
      let remaining = offset;
      let last: Text | null = null;
      let node = walker.nextNode() as Text | null;
      while (node) {
        last = node;
        if (remaining <= node.length) {
          r.setStart(node, remaining);
          r.collapse(true);
          return r;
        }
        remaining -= node.length;
        node = walker.nextNode() as Text | null;
      }
      if (last) r.setStart(last, last.length);
      else r.setStart(flow, 0);
      r.collapse(true);
      return r;
    };

    const positionCaret = () => {
      const rect = rangeAt(ec.selectionStart).getBoundingClientRect();
      const base = paper.getBoundingClientRect();
      const ok = rect.height > 0 || rect.top > 0;
      caret.style.left = `${(ok ? rect.left : base.left + 96) - base.left}px`;
      caret.style.top = `${(ok ? rect.top : base.top + 96) - base.top + paper.scrollTop}px`;
      ec.updateControlBounds(base);
      ec.updateSelectionBounds(rect);
    };

    /** 측정 → 페이지 경계 줄 찾기 → 여백 끼워 재렌더. */
    const relayout = () => {
      const text = ec.text;
      // 1) 측정 상태: 텍스트 한 덩어리로 그려 줄 위치를 잰다.
      flow.textContent = text;
      const flowTop = flow.getBoundingClientRect().top;
      const lineTops: number[] = [];
      const lineOffsets: number[] = [];
      if (flow.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(flow);
        let lastTop = Number.NaN;
        for (const rc of Array.from(range.getClientRects())) {
          if (!Number.isNaN(lastTop) && Math.abs(rc.top - lastTop) < 2) continue; // 같은 줄 중복
          lastTop = rc.top;
          lineTops.push(rc.top - flowTop);
          const cr = document.caretRangeFromPoint(rc.left + 1, rc.top + rc.height / 2);
          lineOffsets.push(cr ? cr.startOffset : 0);
        }
      }
      // 2) 줄 높이 → 페이지 분할(한 줄 버퍼)
      const heights = lineTops.map((t, i) => (i + 1 < lineTops.length ? lineTops[i + 1] - t : LINE_PX));
      const breaks = computePageBreaks(heights, PAGE_PX - LINE_PX, GAP_PX);
      const placed = breaks
        .map((b) => ({ off: lineOffsets[b.beforeIndex] ?? 0, spacer: Math.round(b.spacerPx) }))
        .filter((b) => b.off > 0)
        .sort((a, b) => a.off - b.off);

      // 3) 여백 끼워 재렌더
      flow.textContent = "";
      let prev = 0;
      for (const b of placed) {
        flow.appendChild(textSpan(text.slice(prev, b.off)));
        flow.appendChild(spacerSpan(b.spacer));
        prev = b.off;
      }
      flow.appendChild(textSpan(text.slice(prev)));

      positionCaret();
      setStats({ pages: placed.length + 1, lines: lineTops.length, chars: text.length, composing });
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        relayout();
      });
    };

    ec.addEventListener("textupdate", schedule);
    ec.addEventListener("compositionstart", () => {
      composing = true;
      schedule();
    });
    ec.addEventListener("compositionend", () => {
      composing = false;
      schedule();
    });

    /** 화면 좌표 → ec.text 전역 offset (여백 span 은 건너뛴다). */
    const pointToOffset = (x: number, y: number): number | null => {
      const cr = document.caretRangeFromPoint(x, y);
      if (!cr) return null;
      let offset = 0;
      const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        if (node === cr.startContainer) return offset + cr.startOffset;
        offset += node.length;
        node = walker.nextNode() as Text | null;
      }
      return offset;
    };

    const onPointerDown = (e: PointerEvent) => {
      const off = pointToOffset(e.clientX, e.clientY);
      if (off != null) {
        ec.updateSelection(off, off);
        positionCaret();
      }
      paper.focus();
    };
    paper.addEventListener("pointerdown", onPointerDown);

    const onKeyDown = (e: KeyboardEvent) => {
      const a = Math.min(ec.selectionStart, ec.selectionEnd);
      const b = Math.max(ec.selectionStart, ec.selectionEnd);
      if (e.key === "Enter") {
        e.preventDefault();
        ec.updateText(a, b, "\n");
        ec.updateSelection(a + 1, a + 1);
        schedule();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const p = Math.max(0, a - 1);
        ec.updateSelection(p, p);
        positionCaret();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const p = Math.min(ec.text.length, b + 1);
        ec.updateSelection(p, p);
        positionCaret();
      }
    };
    paper.addEventListener("keydown", onKeyDown);

    const onResize = () => schedule();
    window.addEventListener("resize", onResize);

    paper.focus();
    relayout();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      paper.removeEventListener("pointerdown", onPointerDown);
      paper.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      paper.editContext = null;
    };
  }, []);

  return (
    <div className="pe-root">
      <header className="pe-bar">
        <div className="pe-bar__title">
          자체 페이지 분할 에디터 v1 <span>· EditContext 입력 · 우리가 그리는 A4 분할 · 한글 안전</span>
        </div>
        <div className="pe-stats">
          페이지 <b>{stats.pages}</b> · 줄 <b>{stats.lines}</b> · 글자 <b>{stats.chars}</b> · 조합 <b>{stats.composing ? "중" : "—"}</b>
        </div>
      </header>

      {supported === false && (
        <div className="pe-unsupported">EditContext 미지원 브라우저 — Chrome/Edge 121+ 또는 Electron 에서 열어주세요.</div>
      )}

      <div className="pe-stage">
        <div ref={paperRef} className="pe-paper" tabIndex={0} spellCheck={false} role="textbox" aria-multiline="true">
          <div ref={flowRef} className="pe-flow" />
          <span ref={caretRef} className="pe-caret" aria-hidden="true" />
        </div>
      </div>

      <footer className="pe-foot">
        <b>한글을 길게 — 엔터 없이 한 문단으로도</b> 쳐보세요. 문단 한가운데 줄에서 다음 장으로 넘어가고(책상색 여백),
        자모 안 깨지면 GREEN. (v1 — 클릭 커서·방향키는 거칠 수 있음. 핵심은 한글+페이지 분할.)
      </footer>
    </div>
  );
}
