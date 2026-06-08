import { useState } from "react";
import type { Theme } from "../types";

type DockProps = {
  theme: Theme;
  setTheme: (v: Theme) => void;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;
};

/** 보기 설정 — 기본은 접힘(작업공간 겹침 회피), ⚙ 버튼으로 펼친다. 테마 + 자동저장. */
export function Dock({ theme, setTheme, autoSave, setAutoSave }: DockProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="dock-fab" aria-label="설정 열기" title="설정" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="dock" role="region" aria-label="설정">
      <div className="dock__head">
        <span className="dock__cap"><b>설정</b></span>
        <button type="button" className="dock__close" aria-label="설정 접기" title="접기" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="dock__row">
        <span className="dock__lbl">테마</span>
        <div className="seg" role="group" aria-label="테마">
          {([{ label: "종이", value: "light" }, { label: "촛불", value: "dark" }] as const).map((o) => (
            <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => setTheme(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dock__row">
        <span className="dock__lbl">자동저장</span>
        <div className="seg" role="group" aria-label="자동저장">
          {([{ label: "켜기", value: true }, { label: "끄기", value: false }] as const).map((o) => (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={autoSave === o.value}
              onClick={() => setAutoSave(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
