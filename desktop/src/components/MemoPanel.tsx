import type { Memo, MemoState } from "../types";

const MEMOS: Memo[] = [
  { id: "m1", body: "주인공이 바다를 처음 본 건 일곱 살. 그 기억을 3장 어딘가에 심을 것.", date: "5월 28일", tag: "설정" },
  { id: "m2", body: "“달라진 건 바다가 아니라 바라보는 마음” — 이 문장을 살려서 쓰기.", date: "5월 30일", tag: "문장" },
  { id: "m3", body: "고깃배는 아버지의 직업과 연결. 너무 직접적이지 않게, 배경으로만.", date: "6월 1일", tag: "아이디어" },
];

type MemoPanelProps = { state: MemoState };

function subText(state: MemoState): string {
  if (state === "loaded") return `바다가 보이는 방 · ${MEMOS.length}개`;
  if (state === "loading") return "바다가 보이는 방 · 불러오는 중";
  return "바다가 보이는 방";
}

/** 연결된 메모 패널 — 에디터보다 시각적으로 약하게(HARD). */
export function MemoPanel({ state }: MemoPanelProps) {
  return (
    <aside className="side-panel" aria-label="연결된 메모">
      <div className="panel__head">
        <h2 className="panel__title">연결된 메모</h2>
        <p className="panel__sub">{subText(state)}</p>
      </div>

      {state === "loaded" && (
        <div className="panel__list">
          {MEMOS.map((memo, i) => (
            <button key={memo.id} type="button" className="memo" style={{ animationDelay: `${40 + i * 50}ms` }}>
              <p className="memo__body">{memo.body}</p>
              <div className="memo__foot">
                <span className="memo__date">{memo.date}</span>
                <span className="memo__tag">{memo.tag}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {state === "empty" && (
        <div className="panel__empty">
          이 작품에 연결된 메모가<br />아직 없어요.
        </div>
      )}

      {state === "loading" && (
        <div className="panel__list" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="skel">
              <div className="skel__bar" />
              <div className="skel__bar" />
              <div className="skel__bar" />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
