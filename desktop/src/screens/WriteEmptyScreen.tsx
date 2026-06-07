import { Titlebar } from "../components/Titlebar";

type Props = { onGoToProjects: () => void };

/**
 * 집필 빈 상태 — 펼친 작품이 없을 때.
 * 작품을 고르지 않으면 본문을 쓸 곳(document)이 없으므로, 편집기를 띄우는 대신
 * 작품 선택을 안내한다(편집기를 띄우면 저장되지 않는데도 '저장됨'으로 보이는 착시 회피).
 */
export function WriteEmptyScreen({ onGoToProjects }: Props) {
  return (
    <div className="main">
      <Titlebar title="집필" />
      <div className="screen-main">
        <div className="log-empty">
          <div className="log-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <h1 className="screen-h1">아직 펼친 작품이 없어요</h1>
          <p className="log-empty__text">작품에서 하나 골라 펼치면 여기서 이어 씁니다.</p>
          <button type="button" className="btn btn--primary write-empty__cta" onClick={onGoToProjects}>
            작품으로 가기
          </button>
        </div>
      </div>
    </div>
  );
}
