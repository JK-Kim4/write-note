import type { LogCard as LogCardData } from "../../electron/db/types";
import { lastSentence } from "../lib/lastSentence";
import { calcProgress, formatDuration } from "../lib/progress";
import { formatRelativeDay } from "../lib/relativeDate";

type Props = {
  card: LogCardData;
  now: Date;
};

/**
 * 기록 화면 작품 카드 — 제목·진척 바+수치·최근 수정일·마지막 문장·총 작업 시간.
 * latestLog 아코디언은 US2 에서 추가.
 */
export function LogCard({ card, now }: Props) {
  const { project, wordCount, lastSentenceSource, totalDurationMs } = card;
  const progress = calcProgress(wordCount, project.targetLength);
  const sentence = lastSentence(lastSentenceSource);
  const relativeDate = formatRelativeDay(project.updatedAt, now);
  const duration = formatDuration(totalDurationMs);

  return (
    <article className="log-card">
      <header className="log-card__header">
        <h2 className="log-card__title">{project.title}</h2>
        <span className="log-card__date">{relativeDate}</span>
      </header>

      <div className="log-card__progress">
        {progress !== null ? (
          <>
            <div className="log-card__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="log-card__bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <span className="log-card__percent">{progress}%</span>
          </>
        ) : (
          <span className="log-card__no-target">목표 미설정</span>
        )}
      </div>

      {sentence && <p className="log-card__sentence">{sentence}</p>}

      <div className="log-card__duration">{duration}</div>
    </article>
  );
}
