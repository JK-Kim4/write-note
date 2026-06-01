import type { ReactNode } from "react";

type RailItem = { key: string; label: string; icon: ReactNode };

const ITEMS: RailItem[] = [
  {
    key: "works",
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
];

/** 화면 전환 rail. 이번 프로토타입은 '집필'만 활성 (다른 화면은 후속). */
export function Rail() {
  return (
    <nav className="rail" aria-label="화면 전환">
      <div className="rail__mark" aria-hidden="true" title="write-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a.5.5 0 0 1-.5.5H6a2 2 0 0 1-2-2Z" />
          <path d="M14 4v5h5" />
          <path d="M8.5 13.5h7M8.5 16.5h4" />
        </svg>
      </div>
      <div className="rail__nav">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="rail__item"
            aria-current={item.key === "write" ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
