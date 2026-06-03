import { Titlebar } from "../components/Titlebar";
import { PanelToggle } from "../components/PanelToggle";
import type { Project } from "../types";

const PROJECTS: Project[] = [
  { id: "p1", title: "바다가 보이는 방", genre: "단편소설", wordCount: 1248, lastEdited: "오늘" },
  { id: "p2", title: "겨울의 문장들", genre: "시", wordCount: 312, lastEdited: "3일 전" },
  { id: "p3", title: "이름 없는 막", genre: "단막극", wordCount: 0, lastEdited: "1주 전" },
];

type Props = { onOpenProject: () => void; panelOpen: boolean; onTogglePanel: () => void };

/** 작품 화면 — 새 작품 작성(main body) + 이어 쓸 기존 작품 목록(우측 토글). */
export function ProjectsScreen({ onOpenProject, panelOpen, onTogglePanel }: Props) {
  return (
    <div className="main">
      <Titlebar title="작품" right={<PanelToggle open={panelOpen} onToggle={onTogglePanel} label="작품 목록" />} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <div className="screen-main">
        <section className="newproject" aria-label="새 작품 시작">
          <h1 className="screen-h1">새 작품을 시작합니다</h1>
          <p className="newproject__sub">제목만으로 시작하고, 나머지는 쓰면서 채워도 됩니다.</p>
          <form className="newproject__form" onSubmit={(e) => e.preventDefault()}>
            <label className="field">
              <span className="field__label">제목</span>
              <input className="input" type="text" placeholder="예: 바다가 보이는 방" />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">장르 <em>선택</em></span>
                <input className="input" type="text" placeholder="단편소설 · 시 · 단막극…" />
              </label>
              <label className="field">
                <span className="field__label">목표 분량 <em>선택</em></span>
                <input className="input" type="text" placeholder="예: 8,000자" />
              </label>
            </div>
            <label className="field">
              <span className="field__label">톤 노트 <em>선택</em></span>
              <input className="input" type="text" placeholder="담담하게, 1인칭 회상" />
            </label>
            <label className="field">
              <span className="field__label">시놉시스 · 큰 그림 <em>선택</em></span>
              <textarea
                className="input textarea"
                rows={5}
                placeholder="이 작품이 어떤 이야기인지, 어디로 향하는지 — 줄거리·세계관·결말의 방향을 자유롭게 적어두세요. 세션이 끊겨도 다시 열면 여기서 큰 그림을 되찾습니다."
              />
            </label>
            <button type="submit" className="btn btn--primary">작품 만들기</button>
          </form>
        </section>
        </div>

        {panelOpen && (
        <aside className="side-panel" aria-label="기존 작품">
          <div className="panel__head">
            <h2 className="panel__title">이어 쓰기</h2>
            <p className="panel__sub">작품 {PROJECTS.length}개</p>
          </div>
          {PROJECTS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="project-card"
              style={{ animationDelay: `${40 + i * 50}ms` }}
              onClick={onOpenProject}
            >
              <span className="project-card__title">{p.title}</span>
              <span className="project-card__meta">{p.genre} · {p.wordCount.toLocaleString("ko-KR")}자</span>
              <span className="project-card__date">마지막 작업 {p.lastEdited}</span>
            </button>
          ))}
        </aside>
        )}
      </div>
    </div>
  );
}
