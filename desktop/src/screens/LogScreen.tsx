import { useEffect, useState } from "react";
import type { LogCard as LogCardData } from "../../electron/db/types";
import { LogCard } from "../components/LogCard";
import { PanelToggle } from "../components/PanelToggle";
import { Titlebar } from "../components/Titlebar";

type Props = { panelOpen: boolean; onTogglePanel: () => void };

/** 기록 화면 — 작품별 진척 카드 목록. */
export function LogScreen({ panelOpen, onTogglePanel }: Props) {
  const [cards, setCards] = useState<LogCardData[]>([]);
  const now = new Date();

  useEffect(() => {
    window.electronAPI.logs.list().then(setCards).catch(console.error);
  }, []);

  return (
    <div className="main">
      <Titlebar title="기록" right={<PanelToggle open={panelOpen} onToggle={onTogglePanel} label="요약" />} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <div className="screen-main">
          {cards.length === 0 ? (
            <div className="log-empty">
              <div className="log-empty__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4" />
                  <path d="M3 4v3.5h3.5" />
                  <path d="M12 8v4l3 2" />
                </svg>
              </div>
              <h1 className="screen-h1">글쓰기 기록</h1>
              <p className="log-empty__text">
                작품을 만들면 진척과 기록이 여기 쌓입니다.
              </p>
            </div>
          ) : (
            <ul className="log-card-list">
              {cards.map((card) => (
                <li key={card.project.id}>
                  <LogCard card={card} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
