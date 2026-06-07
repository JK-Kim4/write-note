import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { computePageBreaks } from "./computePageBreaks";

/**
 * 실시간 페이지 분할 — PoC (줄 단위).
 *
 * 핵심 설계(이번 세션 RED 의 원인을 각각 차단):
 *  1. 노드를 자르지 않음 — 분할은 '여백(spacer) 위젯 데코레이션'으로만 표현하므로 문서(ProseMirror JSON)
 *     불변(저장 포맷 불변) + 한글 음절/IME 조합이 쪼개질 일이 없다.
 *  2. 줄 단위 — 문단을 통째 옮기지 않고, getClientRects 로 문단 안 '줄'의 위치를 재서, 페이지 경계를
 *     넘는 줄 '앞'에 여백을 끼운다. 엔터 없이 길게 이어 써도 줄에서 자연스럽게 다음 장으로 넘어간다.
 *  3. requestAnimationFrame 코얼레싱 — 입력이 빨라도 프레임당 1회만. 조합(IME composing) 중 skip.
 *  4. naturalTop(여백 높이를 뺀 본래 위치)로 계산 — 여백이 끼어든 뒤 측정이 흔들려도 수렴한다.
 *  5. 경계가 실제로 바뀔 때만 dispatch — 같은 분할이면 redraw 안 함.
 */

export type Granularity = "line" | "block";

export type PaginationStats = {
  pages: number;
  units: number;
  recomputeCount: number;
  lastMs: number;
};

export type PaginationOptions = {
  /** 한 페이지 본문 높이(px). A4 기준 = (297-위25-아래30)mm. */
  pageHeightPx: number;
  /** 페이지 하단에 비워둘 버퍼(px). 보통 한 줄 높이 — 끝줄이 맨 끝에 붙기 전에 한 줄 일찍 넘긴다. */
  bottomBufferPx: number;
  /** 장 사이 책상색 여백(px). */
  gapPx: number;
  /** 분할 단위 — line(문단 안 줄까지) / block(문단 통째). */
  granularity: Granularity;
  /** 줄 단위 측정에서 마지막 줄 높이 추정값(px). */
  lineHeightPx: number;
  /** 재계산 통계 콜백(perf 가시화). */
  onStats?: (stats: PaginationStats) => void;
};

/** 분할 1건 — 문서 위치 pos '앞'에 spacerPx 만큼 여백. */
type Placed = { pos: number; spacerPx: number };

const pluginKey = new PluginKey<DecorationSet>("pocPagination");

/** 블록 단위 측정 — top-level 블록 intrinsic 높이 + 위치. */
function measureBlocks(view: EditorView): { heights: number[]; positions: number[] } {
  const heights: number[] = [];
  const positions: number[] = [];
  view.state.doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset);
    heights.push(dom instanceof HTMLElement ? dom.offsetHeight : 0);
    positions.push(offset);
  });
  return { heights, positions };
}

/**
 * 줄 단위 측정 — 각 top-level 블록의 줄 사각형(getClientRects)을 모아, 줄마다
 * { naturalTop, pos } 를 만든다. naturalTop = 측정 top − 그 위에 이미 끼워진 여백 합(현재 분할).
 * 이렇게 하면 여백이 끼어든 뒤에도 '여백 없는 본래 레이아웃' 기준으로 계산돼 수렴한다.
 */
function measureLines(
  view: EditorView,
  current: readonly Placed[],
  lineHeightPx: number,
): { heights: number[]; positions: number[] } {
  const root = view.dom as HTMLElement;
  const contentTop = root.getBoundingClientRect().top;
  const sorted = [...current].sort((a, b) => a.pos - b.pos);
  const spacerAbove = (pos: number) =>
    sorted.reduce((s, p) => (p.pos <= pos ? s + p.spacerPx : s), 0);

  const entries: { naturalTop: number; pos: number }[] = [];
  view.state.doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const range = document.createRange();
    range.selectNodeContents(dom);
    const rects = Array.from(range.getClientRects());
    if (rects.length === 0) {
      const r = dom.getBoundingClientRect();
      entries.push({ naturalTop: r.top - contentTop - spacerAbove(offset + 1), pos: offset + 1 });
      return;
    }
    const seenTop = new Set<number>();
    for (const r of rects) {
      const key = Math.round(r.top);
      if (seenTop.has(key)) continue; // 같은 줄의 여러 rect 중복 제거
      seenTop.add(key);
      const coords = view.posAtCoords({ left: r.left + 1, top: r.top + r.height / 2 });
      const pos = coords ? coords.pos : offset + 1;
      entries.push({ naturalTop: r.top - contentTop - spacerAbove(pos), pos });
    }
  });

  entries.sort((a, b) => a.naturalTop - b.naturalTop);
  const positions = entries.map((e) => e.pos);
  const heights: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const next = i + 1 < entries.length ? entries[i + 1].naturalTop : entries[i].naturalTop + lineHeightPx;
    heights.push(Math.max(1, next - entries[i].naturalTop));
  }
  return { heights, positions };
}

export function createPaginationPlugin(opts: PaginationOptions): Plugin<DecorationSet> {
  let rafId = 0;
  let lastSig = "";
  let recomputeCount = 0;
  let placed: Placed[] = [];

  const recompute = (view: EditorView) => {
    if (view.composing) return; // 조합 중에는 절대 건드리지 않는다.
    const t0 = performance.now();
    const { heights, positions } =
      opts.granularity === "block" ? measureBlocks(view) : measureLines(view, placed, opts.lineHeightPx);

    const usable = opts.pageHeightPx - opts.bottomBufferPx;
    const breaks = computePageBreaks(heights, usable, opts.gapPx);
    const next: Placed[] = breaks.map((b) => ({
      pos: positions[b.beforeIndex],
      spacerPx: Math.round(b.spacerPx),
    }));

    recomputeCount += 1;
    opts.onStats?.({
      pages: breaks.length + 1,
      units: heights.length,
      recomputeCount,
      lastMs: performance.now() - t0,
    });

    const sig = next.map((p) => `${p.pos}:${p.spacerPx}`).join("|");
    if (sig === lastSig) return; // 분할이 그대로면 dispatch 안 함.
    lastSig = sig;
    placed = next;

    const decos = next.map((p) =>
      Decoration.widget(
        p.pos,
        () => {
          const el = document.createElement("span");
          el.className = "poc-pagebreak";
          el.style.display = "inline-block";
          el.style.width = "100%";
          el.style.height = `${p.spacerPx}px`;
          el.style.verticalAlign = "top";
          el.setAttribute("contenteditable", "false");
          el.setAttribute("aria-hidden", "true");
          return el;
        },
        { side: -1, key: `pb-${p.pos}-${p.spacerPx}` },
      ),
    );
    view.dispatch(view.state.tr.setMeta(pluginKey, DecorationSet.create(view.state.doc, decos)));
  };

  const schedule = (view: EditorView) => {
    if (view.composing) return;
    if (rafId) return; // 이번 프레임에 이미 예약됨 — 코얼레싱
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      recompute(view);
    });
  };

  return new Plugin<DecorationSet>({
    key: pluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(pluginKey) as DecorationSet | undefined;
        if (meta) return meta;
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return pluginKey.getState(state);
      },
    },
    view(view) {
      const onResize = () => schedule(view);
      window.addEventListener("resize", onResize);
      schedule(view);
      return {
        update(v, prev) {
          if (v.state.doc !== prev.doc) schedule(v);
        },
        destroy() {
          if (rafId) cancelAnimationFrame(rafId);
          window.removeEventListener("resize", onResize);
        },
      };
    },
  });
}

/** TipTap 확장으로 감싼다. */
export const PaginationExtension = Extension.create<PaginationOptions>({
  name: "pocPagination",
  addOptions() {
    return {
      pageHeightPx: ((297 - 25 - 30) * 96) / 25.4,
      bottomBufferPx: 18 * 1.92,
      gapPx: 28,
      granularity: "line",
      lineHeightPx: 18 * 1.92,
      onStats: undefined,
    };
  },
  addProseMirrorPlugins() {
    return [createPaginationPlugin(this.options)];
  },
});
