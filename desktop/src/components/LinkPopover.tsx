import { useEffect } from "react";
import type { LinkedProject } from "../types";

type LinkPopoverProps = {
  /** 연결 후보 — 전체 작품 목록 */
  projects: LinkedProject[];
  /** 현재 이 메모가 연결된 작품 id */
  linkedProjectIds: string[];
  /** 토글 — next=true 연결, false 해제 */
  onToggle: (projectId: string, next: boolean) => void;
  onClose: () => void;
};

/** 메모를 여러 작품에 연결/해제하는 체크리스트 팝오버. 에디터 캔버스보다 조용하게(DESIGN). */
export function LinkPopover({ projects, linkedProjectIds, onToggle, onClose }: LinkPopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const linked = new Set(linkedProjectIds);

  return (
    <>
      <button type="button" className="popover-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="link-popover" role="group" aria-label="작품 연결">
        {projects.length === 0 ? (
          <p className="link-popover__empty">먼저 작품을 만들어 주세요.</p>
        ) : (
          <ul className="link-popover__list">
            {projects.map((p) => {
              const isLinked = linked.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={isLinked ? "link-opt is-linked" : "link-opt"}
                    aria-pressed={isLinked}
                    onClick={() => onToggle(p.id, !isLinked)}
                  >
                    <span className="link-opt__check" aria-hidden="true">
                      {isLinked ? "✓" : ""}
                    </span>
                    <span className="link-opt__title">{p.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
