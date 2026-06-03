import { useEffect } from "react";

type Props = { onClose: () => void };

/**
 * 빠른 메모 캡처 모달 — 떠오른 생각을 최소 마찰로. 본문만 저장, 미연결 default.
 * (전역 단축키는 후속 phase. 지금은 rail 하단 + 버튼으로 연다.)
 */
export function QuickCapture({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal capture"
        role="dialog"
        aria-modal="true"
        aria-label="빠른 메모"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 className="modal__title">빠른 메모</h2>
          <span className="modal__hint">미연결로 저장됩니다</span>
        </div>
        <textarea
          className="capture__input"
          placeholder="떠오른 생각을 적어두세요…"
          rows={4}
          autoFocus
        />
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn btn--primary" onClick={onClose}>저장</button>
        </div>
      </div>
    </div>
  );
}
