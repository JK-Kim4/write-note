import type { ReactNode } from "react";
import type { Screen } from "../types";

type RailItem = { key: Screen; label: string; icon: ReactNode };

const ITEMS: RailItem[] = [
  {
    key: "projects",
    label: "작품",
    icon: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  },
  {
    key: "write",
    label: "집필",
    icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  },
  {
    key: "memo",
    label: "메모",
    icon: <path d="M4 5h16M4 12h16M4 19h10" />,
  },
  {
    key: "log",
    label: "기록",
    icon: <><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4" /><path d="M3 4v3.5h3.5" /><path d="M12 8v4l3 2" /></>,
  },
  {
    key: "contact",
    label: "문의",
    icon: <><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /><path d="m3.5 6.5 8.5 6 8.5-6" /></>,
  },
];

type RailProps = {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  onCapture: () => void;
};

/** 화면 전환 rail + 하단 빠른 메모 캡처 버튼. */
export function Rail({ active, onNavigate, onCapture }: RailProps) {
  return (
    <nav className="rail" aria-label="화면 전환">
      <div className="rail__mark" aria-hidden="true" title="소설비">
        <span className="rail__logo" />
      </div>
      <div className="rail__nav">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="rail__item"
            aria-current={item.key === active ? "page" : undefined}
            onClick={() => onNavigate(item.key)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="rail__ink" onClick={onCapture} aria-label="빠른 메모">
        {/* 잉크 한 방울 — 떠오른 생각을 책상에 떨군다. '새 항목'이 아니라 캡처 affordance. */}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3.2c.38 0 .72.21.9.55 1.06 2.02 4.6 7.1 4.6 10.45a5.5 5.5 0 0 1-11 0c0-3.35 3.54-8.43 4.6-10.45.18-.34.52-.55.9-.55Z" />
        </svg>
        <span className="rail__ink-label">잉크 한 방울</span>
      </button>
    </nav>
  );
}
