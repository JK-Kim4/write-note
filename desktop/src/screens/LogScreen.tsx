import { Titlebar } from "../components/Titlebar";
import { PanelToggle } from "../components/PanelToggle";

type Props = { panelOpen: boolean; onTogglePanel: () => void };

/**
 * 기록 화면 — 글쓰기 세션/진척 로그.
 * 세션 노트·진척 통계는 MVP 제외 영역이라, 자리만 잡고 향후 모습을 흐리게 미리 보인다.
 */
export function LogScreen({ panelOpen, onTogglePanel }: Props) {
  return (
    <div className="main">
      <Titlebar title="기록" right={<PanelToggle open={panelOpen} onToggle={onTogglePanel} label="요약" />} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <div className="screen-main">
          <div className="log-empty">
            <div className="log-empty__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4" />
                <path d="M3 4v3.5h3.5" />
                <path d="M12 8v4l3 2" />
              </svg>
            </div>
            <h1 className="screen-h1">글쓰기 기록</h1>
            <p className="log-empty__text">
              지난 세션의 마지막 한 줄, 누적 글자수, 진척 흐름이 여기 쌓입니다.<br />
              재진입할 때 “어디까지 했지”를 다시 떠올리지 않도록.
            </p>
            <p className="log-empty__note">첫 MVP 이후 추가되는 영역이에요.</p>

            <div className="log-preview" aria-hidden="true">
              <div className="log-preview__row"><span>지난 세션</span><b>“…오래 미뤄둔 이야기가 시작되려는 참이었다”</b></div>
              <div className="log-preview__row"><span>누적</span><b>1,248자 · 4세션</b></div>
              <div className="log-preview__row"><span>이번 주</span><b>312자</b></div>
            </div>
          </div>
        </div>

        {panelOpen && (
          <aside className="side-panel" aria-label="요약">
            <div className="panel__head">
              <h2 className="panel__title">요약</h2>
              <p className="panel__sub">곧 추가됩니다</p>
            </div>
            <div className="stat-card stat-card--ghost">
              <span className="stat-card__num">1,248</span>
              <span className="stat-card__label">누적 글자수</span>
            </div>
            <div className="stat-card stat-card--ghost">
              <span className="stat-card__num">4</span>
              <span className="stat-card__label">세션</span>
            </div>
            <div className="stat-card stat-card--ghost">
              <span className="stat-card__num">312</span>
              <span className="stat-card__label">이번 주</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
