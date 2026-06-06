import { useEffect } from "react";
import type { Theme } from "../types";
import { ZoomControl } from "./ZoomControl";

type ViewMenuProps = {
  zoom: number;
  onZoom: (z: number) => void;
  lined: boolean;
  onLined: (v: boolean) => void;
  theme: Theme;
  onTheme: (v: Theme) => void;
  autoSave: boolean;
  onAutoSave: (v: boolean) => void;
  onClose: () => void;
};

/**
 * 보기/설정을 하나로 모은 접힌 팝오버 — 평소엔 펼쳐져 있지 않다(FR-007).
 * 확대축소·줄노트·테마·자동저장. LinkPopover 의 backdrop+Escape 패턴 재사용.
 */
export function ViewMenu({
  zoom,
  onZoom,
  lined,
  onLined,
  theme,
  onTheme,
  autoSave,
  onAutoSave,
  onClose,
}: ViewMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="popover-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="view-menu" role="group" aria-label="보기">
        <div className="view-menu__row">
          <span className="view-menu__lbl">크기</span>
          <ZoomControl zoom={zoom} onZoom={onZoom} />
        </div>
        <div className="view-menu__row">
          <span className="view-menu__lbl">줄노트</span>
          <div className="seg" role="group" aria-label="줄노트">
            {([
              { label: "끄기", value: false },
              { label: "켜기", value: true },
            ] as const).map((o) => (
              <button key={String(o.value)} type="button" aria-pressed={lined === o.value} onClick={() => onLined(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="view-menu__row">
          <span className="view-menu__lbl">테마</span>
          <div className="seg" role="group" aria-label="테마">
            {([
              { label: "종이", value: "light" },
              { label: "촛불", value: "dark" },
            ] as const).map((o) => (
              <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => onTheme(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="view-menu__row">
          <span className="view-menu__lbl">자동저장</span>
          <div className="seg" role="group" aria-label="자동저장">
            {([
              { label: "켜기", value: true },
              { label: "끄기", value: false },
            ] as const).map((o) => (
              <button
                key={String(o.value)}
                type="button"
                aria-pressed={autoSave === o.value}
                onClick={() => onAutoSave(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
