type Props = { open: boolean; onToggle: () => void; label: string };

/** titlebar 우측 패널 토글 버튼 (열림 시 accent). */
export function PanelToggle({ open, onToggle, label }: Props) {
  return (
    <button
      type="button"
      className={`panel-toggle ${open ? "is-open" : ""}`}
      onClick={onToggle}
      aria-pressed={open}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="15" y1="4" x2="15" y2="20" />
      </svg>
    </button>
  );
}
