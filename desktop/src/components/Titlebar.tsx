import type { SaveState } from "../types";

type TitlebarProps = {
  title: string;
  save: SaveState;
  count: number;
};

function saveLabel(save: SaveState, count: number): string {
  if (save === "saving") return "저장 중…";
  if (save === "error") return "저장 실패 · 다시 시도";
  return `저장됨 · ${count.toLocaleString("ko-KR")}자`;
}

/** chrome — 조용한 macOS-native 외관. 좌측 신호등, 중앙 화면명, 우측 저장 상태(blue 아님). */
export function Titlebar({ title, save, count }: TitlebarProps) {
  return (
    <header className="titlebar">
      <div className="lights" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="titlebar__center">{title}</div>
      <div className="titlebar__right">
        <div className={`savestate savestate--${save}`} role="status" aria-live="polite">
          <span className="savestate__dot" aria-hidden="true" />
          <span className="savestate__label">{saveLabel(save, count)}</span>
        </div>
      </div>
    </header>
  );
}
