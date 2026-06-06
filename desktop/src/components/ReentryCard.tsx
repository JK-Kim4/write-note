import type { Reentry } from "../screens/WriteStudioScreen";

type ReentryCardProps = {
  reentry: Reentry;
  onClose: () => void;
};

/**
 * 재진입 한 장 — "여기서 멈췄어요". 마지막 문장 + 다음 장면 + 곁에 둘 쪽지 제안(FR-008).
 * 종이 옆에 한 장으로 펼쳐지고, 작가가 닫으면 사라진다.
 */
export function ReentryCard({ reentry, onClose }: ReentryCardProps) {
  return (
    <aside className="reentry" aria-label="이어 쓰기 안내">
      <div className="reentry__head">
        <span className="reentry__kicker">여기서 멈췄어요</span>
        <button type="button" className="reentry__close" aria-label="이어 쓰기 안내 닫기" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {reentry.lastSentence ? (
        <p className="reentry__sentence">{reentry.lastSentence}</p>
      ) : (
        <p className="reentry__sentence reentry__sentence--empty">아직 첫 문장을 기다리는 중</p>
      )}

      <div className="reentry__next">
        <span className="reentry__label">다음은</span>
        {reentry.nextScene ? (
          <p className="reentry__next-text">{reentry.nextScene}</p>
        ) : (
          <p className="reentry__next-text reentry__next-text--empty">아직 정하지 않았어요</p>
        )}
      </div>

      {reentry.memo && (
        <div className="reentry__memo">
          <span className="reentry__label">곁에 둘 쪽지</span>
          <p className="reentry__memo-body">{reentry.memo.body}</p>
        </div>
      )}
    </aside>
  );
}
