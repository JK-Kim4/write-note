import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Titlebar } from "../components/Titlebar";
import { toProjectCardView, type ProjectCardView } from "../lib/projectView";

type Props = { onOpenProject: (project: ProjectCardView) => void };
type Mode = "list" | "create";

/**
 * 작품 화면 — 상태를 한 화면에 섞지 않는다.
 * - 작품 0개: 작업실 입구(서비스 설명 + 시작 진입)
 * - 작품 ≥1: 작품 목록(최근 수정순) + 새 작품 진입
 * - 생성: 별도 폼 뷰(모달 회피, inline 전환)
 */
export function ProjectsScreen({ onOpenProject }: Props) {
  const [projects, setProjects] = useState<ProjectCardView[] | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [genre, setGenre] = useState("");
  const [targetLength, setTargetLength] = useState("");
  const [tone, setTone] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setGenre("");
    setTargetLength("");
    setTone("");
    setShowMore(false);
  };

  const load = useCallback(async () => {
    setError(false);
    try {
      const rows = await window.electronAPI.projects.list();
      const now = new Date();
      setProjects(rows.map((p) => toProjectCardView(p, now)));
    } catch {
      setError(true);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelCreate = () => {
    setMode("list");
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    const parsed = Number(targetLength.trim());
    const target = targetLength.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    setSubmitting(true);
    try {
      await window.electronAPI.projects.create({
        title: title.trim(),
        summary: summary.trim(),
        tone: tone.trim(),
        genre: genre.trim(),
        targetLength: target,
      });
      resetForm();
      setMode("list");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="main">
      <Titlebar title={mode === "create" ? "새 작품" : "작품"} />
      <div className="screen-body screen-body--solo">
        <div className="screen-main">
          {projects === null ? (
            <div className="projects-skel" aria-hidden="true">
              <div className="skel">
                <div className="skel__bar" />
                <div className="skel__bar" />
                <div className="skel__bar" />
              </div>
            </div>
          ) : mode === "create" ? (
            <form className="newproject" onSubmit={handleSubmit} aria-label="새 작품 만들기">
              <div className="create-head">
                <h1 className="screen-h1">새 작품을 시작합니다</h1>
                <p className="newproject__sub">제목만으로 시작하고, 나머지는 쓰면서 채워도 됩니다.</p>
              </div>
              <div className="newproject__form">
                <label className="field">
                  <span className="field__label">제목</span>
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus -- 생성 뷰 진입 시 첫 입력으로 바로 이동 */}
                  <input
                    className="input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 바다가 보이는 방"
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span className="field__label">
                    시놉시스 · 큰 그림 <em>선택</em>
                  </span>
                  <textarea
                    className="input textarea"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="이 작품이 어떤 이야기인지, 어디로 향하는지. 줄거리·세계관·결말의 방향을 자유롭게 적어두세요."
                  />
                </label>

                <button
                  type="button"
                  className="disclosure__toggle"
                  aria-expanded={showMore}
                  onClick={() => setShowMore((v) => !v)}
                >
                  추가 정보 <span className="disclosure__hint">장르 · 목표 분량 · 톤</span>
                  <svg
                    className="disclosure__chevron"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {showMore && (
                  <div className="disclosure__body">
                    <label className="field">
                      <span className="field__label">장르</span>
                      <input
                        className="input"
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="단편소설 · 시 · 단막극"
                      />
                    </label>
                    <div className="field-row">
                      <label className="field">
                        <span className="field__label">목표 분량 (자)</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={targetLength}
                          onChange={(e) => setTargetLength(e.target.value)}
                          placeholder="예: 8000"
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">톤</span>
                        <input
                          className="input"
                          type="text"
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          placeholder="담담하게, 1인칭 회상"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="create-foot">
                  <button type="submit" className="btn btn--primary" disabled={!title.trim() || submitting}>
                    작품 만들기
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={cancelCreate}>
                    취소
                  </button>
                </div>
              </div>
            </form>
          ) : error ? (
            <div className="projects-error" role="alert">
              <span>작품 목록을 불러오지 못했습니다.</span>
              <button type="button" className="btn btn--ghost" onClick={() => void load()}>
                다시 시도
              </button>
            </div>
          ) : projects.length === 0 ? (
            <section className="welcome" aria-label="작업실 입구">
              <h1 className="welcome__title">작업실이 준비됐습니다</h1>
              <p className="welcome__sub">
                메모와 등장인물, 톤과 목표 분량, 지난 세션의 마지막 한 줄까지 한자리에. 며칠 만에 다시 열어도 작품의
                맥락이 그대로 남아, 흐름을 처음부터 되짚지 않아도 됩니다.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => setMode("create")}>
                첫 작품 시작하기
              </button>
            </section>
          ) : (
            <div className="projects-list-wrap">
              <div className="projects-head">
                <h1 className="projects-head__title">
                  이어 쓸 작품
                  <span className="projects-head__count">{projects.length}개</span>
                </h1>
                <button type="button" className="btn btn--secondary" onClick={() => setMode("create")}>
                  새 작품
                </button>
              </div>
              <div className="projects-list">
                {projects.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className="project-card"
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => onOpenProject(p)}
                  >
                    <span className="project-card__title">{p.title}</span>
                    {p.summaryPreview && <span className="project-card__excerpt">{p.summaryPreview}</span>}
                    <span className="project-card__date">
                      마지막 작업 <time>{p.lastEditedLabel}</time>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
