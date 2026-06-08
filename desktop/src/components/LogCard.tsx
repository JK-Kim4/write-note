import { useState } from "react";
import type { LogCard as LogCardData, ProjectLog } from "../../electron/db/types";
import { lastSentence } from "../lib/lastSentence";
import { calcProgress, formatDuration } from "../lib/progress";
import { formatRelativeDay } from "../lib/relativeDate";

type Props = {
  card: LogCardData;
  now: Date;
};

/**
 * 기록 화면 작품 카드 — 제목·진척 바+수치·최근 수정일·마지막 문장·총 작업 시간.
 * latestLog 최신 기록 1줄 + 아코디언 토글(펼침 시 logs.listByProject lazy 조회).
 */
export function LogCard({ card, now }: Props) {
  const { project, wordCount, lastSentenceSource, latestLog, totalDurationMs } = card;
  const progress = calcProgress(wordCount, project.targetLength);
  const sentence = lastSentence(lastSentenceSource);
  const relativeDate = formatRelativeDay(project.updatedAt, now);
  const duration = formatDuration(totalDurationMs);

  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ProjectLog[]>([]);

  const handleToggle = async () => {
    if (!open) {
      try {
        const fetched = await window.electronAPI.logs.listByProject(project.id);
        setLogs(fetched);
      } catch {
        return; // 조회 실패 시 펼치지 않음(빈 목록 노출 방지)
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <article className="log-card">
      <header className="log-card__header">
        <h2 className="log-card__title">{project.title}</h2>
      </header>

      <div className="log-card__field">
        <span className="log-card__label">진척도</span>
        {progress !== null ? (
          <div className="log-card__progress">
            <div className="log-card__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="log-card__bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <span className="log-card__percent">{progress}%</span>
          </div>
        ) : (
          <span className="log-card__no-target">목표 미설정</span>
        )}
      </div>

      <div className="log-card__field">
        <span className="log-card__label">최근 수정</span>
        <span className="log-card__value">{relativeDate}</span>
      </div>

      {sentence && (
        <div className="log-card__field">
          <span className="log-card__label">마지막 문장</span>
          <p className="log-card__sentence">{sentence}</p>
        </div>
      )}

      <div className="log-card__field">
        <span className="log-card__label">총 작업 시간</span>
        <span className="log-card__value">{duration}</span>
      </div>

      <div className="log-card__log-section">
        <div className="log-card__latest-log">
          <span className="log-card__label">마지막 기록</span>
          {latestLog ? (
            <>
              <span className="log-card__latest-body">{latestLog.body}</span>
              <button
                type="button"
                className="log-card__accordion-btn"
                aria-expanded={open}
                aria-label={open ? "기록 접기" : "기록 펼치기"}
                onClick={handleToggle}
              >
                {open ? "▲" : "▼"}
              </button>
            </>
          ) : (
            <span className="log-card__no-log">아직 기록 없음</span>
          )}
        </div>

        {open && latestLog && (
          <ul className="log-card__log-list">
            {logs.map((log) => (
              <li key={log.id} className="log-card__log-item">
                <span className="log-card__log-time">{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                <span className="log-card__log-body">{log.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
