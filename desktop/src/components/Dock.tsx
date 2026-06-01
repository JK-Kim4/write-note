import type { MemoState, SaveState, Theme } from "../types";

type DockProps = {
  theme: Theme;
  setTheme: (v: Theme) => void;
  save: SaveState;
  setSave: (v: SaveState) => void;
  memos: MemoState;
  setMemos: (v: MemoState) => void;
};

type Seg<T extends string> = { label: string; value: T };

function Segment<T extends string>(props: { label: string; options: Seg<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="dock__row">
      <span className="dock__lbl">{props.label}</span>
      <div className="seg" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 와이어프레임 미리보기 도크 — 실제 앱에는 없는 데모 컨트롤. */
export function Dock({ theme, setTheme, save, setSave, memos, setMemos }: DockProps) {
  return (
    <div className="dock" role="region" aria-label="와이어프레임 미리보기 컨트롤">
      <div className="dock__cap"><b>미리보기</b> · 실제 앱에는 없는 데모 컨트롤</div>
      <Segment
        label="테마"
        value={theme}
        onChange={setTheme}
        options={[{ label: "종이", value: "light" }, { label: "촛불", value: "dark" }]}
      />
      <Segment
        label="저장"
        value={save}
        onChange={setSave}
        options={[{ label: "저장됨", value: "saved" }, { label: "저장 중", value: "saving" }, { label: "실패", value: "error" }]}
      />
      <Segment
        label="메모"
        value={memos}
        onChange={setMemos}
        options={[{ label: "있음", value: "loaded" }, { label: "빈", value: "empty" }, { label: "로딩", value: "loading" }]}
      />
    </div>
  );
}
