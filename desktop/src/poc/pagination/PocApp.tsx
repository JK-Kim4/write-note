import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { PaginationExtension, type Granularity, type PaginationStats } from "./paginationPlugin";

const PAGE_PX = ((297 - 25 - 30) * 96) / 25.4; // A4 본문 높이(px)
const LINE_PX = 18 * 1.92;
const GAP_PX = 28;

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

/** 엔터 없이 한 문단으로 길게 — 줄 단위 분할 테스트용. */
function oneLongParagraph(times: number): string {
  let body = "";
  for (let i = 0; i < times; i++) body += SEED[i % SEED.length] + " ";
  return `<p>${body.trim()}</p>`;
}

export function PocApp() {
  const [stats, setStats] = useState<PaginationStats | null>(null);
  const [lined, setLined] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("line");

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          pageHeightPx: PAGE_PX,
          bottomBufferPx: LINE_PX,
          lineHeightPx: LINE_PX,
          gapPx: GAP_PX,
          granularity,
          onStats: (s) => setStats(s),
        }),
      ],
      content: longDoc(8),
      immediatelyRender: false,
    },
    [granularity],
  );

  return (
    <div className="poc-root">
      <header className="poc-bar">
        <div className="poc-bar__title">
          실시간 페이지 분할 PoC <span>· {granularity === "line" ? "줄 단위(문단 안까지)" : "블록 단위(문단 통째)"} · rAF · 조합 중 skip</span>
        </div>
        <div className="poc-bar__actions">
          <div className="poc-seg" role="group" aria-label="분할 단위">
            <button type="button" aria-pressed={granularity === "line"} onClick={() => setGranularity("line")}>줄</button>
            <button type="button" aria-pressed={granularity === "block"} onClick={() => setGranularity("block")}>블록</button>
          </div>
          <label className="poc-check">
            <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} />
            줄노트
          </label>
          <button type="button" onClick={() => editor?.commands.setContent(oneLongParagraph(12))}>
            엔터 없이 긴 문단
          </button>
          <button type="button" onClick={() => editor?.commands.setContent(longDoc(40))}>
            여러 문단(≈4장)
          </button>
        </div>
      </header>

      <div className="poc-stage">
        <article className={lined ? "poc-paper poc-paper--lined" : "poc-paper"}>
          <EditorContent editor={editor} className="poc-prose" />
        </article>
      </div>

      <aside className="poc-stats" aria-live="polite">
        <div className="poc-stats__row"><span>페이지</span><b>{stats?.pages ?? "—"}</b></div>
        <div className="poc-stats__row"><span>측정 단위(줄/블록)</span><b>{stats?.units ?? "—"}</b></div>
        <div className="poc-stats__row"><span>재계산 횟수</span><b>{stats?.recomputeCount ?? 0}</b></div>
        <div className="poc-stats__row"><span>마지막 계산</span><b>{stats ? `${stats.lastMs.toFixed(1)}ms` : "—"}</b></div>
        <p className="poc-stats__hint">
          <b>엔터 없이 긴 문단</b>을 누르고 본문 끝에서 한글을 이어 쳐 보세요. <b>줄</b> 모드면 문단 한가운데서도
          줄에서 다음 장으로 넘어가야 정상. 한글을 빠르게 쳐도 자모가 쪼개지지 않아야 함.
        </p>
        <ul className="poc-stats__ime">
          <li>① 빠른 타자(조합 중 다음 자모)</li>
          <li>② 조합 중 굵게(⌘B) 토글</li>
          <li>③ 한자 변환</li>
          <li>④ Backspace 자모 분해</li>
          <li>⑤ 경계 근처 커서·방향키</li>
        </ul>
      </aside>
    </div>
  );
}
