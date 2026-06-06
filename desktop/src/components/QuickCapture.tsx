import { useEffect, useRef, useState } from "react";

type Props = {
  /** 있으면 기본 연결, null 이면 미연결로 저장한다. */
  activeProjectId: string | null;
  onClose: () => void;
  /** 저장 성공 시 호출 — App 이 inbox 재조회를 유도한다. */
  onCaptured: () => void;
};

/**
 * 잉크 한 방울 — 떠오른 생각을 최소 마찰로 남기는 캡처 모달. 본문만 저장.
 * active project 가 있으면 기본 연결, 없으면 미연결.
 * hardening: focus trap(Tab 순환) + 닫힐 때 직전 포커스 복귀 + 초안 보존(내용 있으면 가벼운 닫기 무시).
 */
export function QuickCapture({ activeProjectId, onClose, onCaptured }: Props) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  // 취소(명시적 닫기)에 초안이 있을 때 거치는 확인 단계 — 초안 소실 방지(FR-017).
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const canSave = body.trim().length > 0 && !saving;
  const hasDraft = body.trim().length > 0;

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 열기 직전 포커스를 둔 요소 — 닫힐 때 복귀(FR-018).
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // mount 시 textarea 포커스 + 직전 포커스 저장. unmount 시 직전 포커스로 복귀.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    textareaRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);

  // 가벼운 닫기(Escape/backdrop) — 초안이 있으면 무시해 유실 방지(FR-017).
  const requestSoftClose = () => {
    if (hasDraft) return;
    onClose();
  };

  // 명시적 닫기(취소 버튼) — 초안이 있으면 확인 단계를 거친다(FR-017).
  const handleCancel = () => {
    if (hasDraft) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  // Escape 닫기 + Tab focus trap(모달 안에서 순환, FR-018).
  useEffect(() => {
    const focusable = (): HTMLElement[] => {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, input, [href], select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestSoftClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // hasDraft 변화로 requestSoftClose 동작이 달라지므로 의존성에 포함.
  }, [hasDraft]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="modal-backdrop" onClick={requestSoftClose}>
      <div
        ref={dialogRef}
        className="modal capture"
        role="dialog"
        aria-modal="true"
        aria-label="빠른 메모"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 className="modal__title">잉크 한 방울</h2>
          <span className="modal__hint">
            {activeProjectId ? "현재 작품에 연결됩니다" : "미연결로 저장됩니다"}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          className="capture__input"
          placeholder="떠오른 생각을 적어두세요…"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="modal__foot">
          {confirmDiscard ? (
            <>
              <span className="modal__hint modal__confirm">작성 중인 메모를 버릴까요?</span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setConfirmDiscard(false);
                  textareaRef.current?.focus();
                }}
              >
                계속 쓰기
              </button>
              <button type="button" className="btn btn--danger" onClick={onClose}>
                버리기
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={handleCancel}>
                취소
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!canSave}>
                저장
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
