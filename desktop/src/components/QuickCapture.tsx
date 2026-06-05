import { useEffect, useState } from "react";

type Props = {
  /** 있으면 기본 연결, null 이면 미연결로 저장한다. */
  activeProjectId: string | null;
  onClose: () => void;
  /** 저장 성공 시 호출 — App 이 inbox 재조회를 유도한다. */
  onCaptured: () => void;
};

/**
 * 빠른 메모 캡처 모달 — 떠오른 생각을 최소 마찰로. 본문만 저장.
 * active project 가 있으면 기본 연결, 없으면 미연결.
 * (전역 단축키는 후속 phase. 지금은 rail 하단 + 버튼으로 연다.)
 */
export function QuickCapture({ activeProjectId, onClose, onCaptured }: Props) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = body.trim().length > 0 && !saving;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await window.electronAPI.memos.create({ body: body.trim(), linkProjectId: activeProjectId });
      onCaptured();
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
          <span className="modal__hint">
            {activeProjectId ? "현재 작품에 연결됩니다" : "미연결로 저장됩니다"}
          </span>
        </div>
        <textarea
          className="capture__input"
          placeholder="떠오른 생각을 적어두세요…"
          rows={4}
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!canSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
