"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/auth/guard";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { ProjectWallCard } from "@/components/workspace/ProjectWallCard";
import { toProjectCardView } from "@/lib/projectView";
import { useCreateProject, useDeleteProject, useProjectCards, useUpdateProject } from "@/lib/query/useProjects";
import type { ProjectCardView } from "@/lib/projectView";

/**
 * 작품 벽 (015 US1 → 018 /library 이동) — desktop ProjectsScreen 1:1 이식. 006 home 폐기.
 * .app(Rail+main) 셸 + Titlebar + work-wall + ProjectWallCard. 데이터는 React Query 훅.
 * `?new=1` 진입 시 새 작품 폼이 바로 열린다(대시보드 "+ 새 작품" 동선).
 * useSearchParams 는 Suspense 경계 내부에서만 호출(전례: auth/verify, Next 공식 문서 권장).
 */
export default function LibraryPage() {
    return (
        <Suspense fallback={<p style={{ padding: "2rem", opacity: 0.5 }}>여는 중…</p>}>
            <ProjectsWallPage />
        </Suspense>
    );
}

function ProjectsWallPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();
    const wantsCreate = useSearchParams().get("new") === "1";
    const cardsQuery = useProjectCards();
    const createProject = useCreateProject();
    const updateProject = useUpdateProject();
    const deleteProject = useDeleteProject();

    const [mode, setMode] = useState<"list" | "create">(wantsCreate ? "create" : "list");
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [genre, setGenre] = useState("");
    const [targetLength, setTargetLength] = useState("");
    const [tone, setTone] = useState("");
    const [showMore, setShowMore] = useState(false);
    const [createError, setCreateError] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<ProjectCardView | null>(null);

    const projects: ProjectCardView[] | null = cardsQuery.data ? cardsQuery.data.map(toProjectCardView) : null;

    const resetForm = () => {
        setTitle("");
        setSummary("");
        setGenre("");
        setTargetLength("");
        setTone("");
        setShowMore(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim() || createProject.isPending) return;
        setCreateError(false);
        const parsed = Number(targetLength.trim());
        const target = targetLength.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        try {
            const { project } = await createProject.mutateAsync({
                title: title.trim(),
                synopsis: summary.trim() || null,
                toneNotes: tone.trim() || null,
                genre: genre.trim() || null,
                targetLength: target,
            });
            resetForm();
            setMode("list");
            router.push(`/projects/${project.id}/write`);
        } catch {
            setCreateError(true);
        }
    };

    return (
        <div className="app">
            <Rail />
            <div className="main">
                <Titlebar title={mode === "create" ? "새 작품" : "작품"} />
                <div className="screen-body screen-body--solo">
                    <div className="screen-main">
                        {projects === null && !cardsQuery.isError ? (
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
                                            placeholder="이 작품이 어떤 이야기인지, 어디로 향하는지."
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="disclosure__toggle"
                                        aria-expanded={showMore}
                                        onClick={() => setShowMore((v) => !v)}
                                    >
                                        추가 정보 <span className="disclosure__hint">장르 · 목표 분량 · 톤</span>
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
                                    {createError && (
                                        <p role="alert" style={{ color: "var(--danger, #c0392b)", fontSize: 13 }}>
                                            작품을 만들지 못했습니다. 다시 시도해 주세요.
                                        </p>
                                    )}
                                    <div className="create-foot">
                                        <button type="submit" className="btn btn--primary" disabled={!title.trim() || createProject.isPending}>
                                            작품 만들기
                                        </button>
                                        <button type="button" className="btn btn--ghost" onClick={() => { setMode("list"); resetForm(); }}>
                                            취소
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : cardsQuery.isError ? (
                            <div className="projects-error" role="alert">
                                <span>작품 목록을 불러오지 못했습니다.</span>
                                <button type="button" className="btn btn--ghost" onClick={() => cardsQuery.refetch()}>
                                    다시 시도
                                </button>
                            </div>
                        ) : projects && projects.length === 0 ? (
                            <section className="welcome" aria-label="작업실 입구">
                                <span className="welcome__mark" aria-hidden="true" />
                                <p className="welcome__brand">나래 노트</p>
                                <h1 className="welcome__title">작업실이 준비됐습니다</h1>
                                <p className="welcome__sub">
                                    메모와 등장인물, 톤과 목표 분량, 지난 세션의 마지막 한 줄까지 한자리에. 며칠 만에 다시 열어도
                                    작품의 맥락이 그대로 남아, 흐름을 처음부터 되짚지 않아도 됩니다.
                                </p>
                                <button type="button" className="btn btn--primary" onClick={() => setMode("create")}>
                                    첫 작품 시작하기
                                </button>
                            </section>
                        ) : (
                            <div className="projects-list-wrap">
                                <div className="projects-head">
                                    <h1 className="projects-head__title">이어 쓸 작품</h1>
                                    <button type="button" className="btn btn--secondary" onClick={() => setMode("create")}>
                                        새 작품
                                    </button>
                                </div>
                                <div className="work-wall">
                                    {(projects ?? []).map((p, i) => (
                                        <ProjectWallCard
                                            key={p.id}
                                            card={p}
                                            index={i}
                                            onOpen={() => router.push(`/projects/${p.id}/write`)}
                                            onSaveNextScene={(next) => updateProject.mutate({ id: p.id, patch: { nextScene: next } })}
                                            onDelete={() => setConfirmDelete(p)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {confirmDelete && (
                <div className="modal-backdrop" onClick={() => !deleteProject.isPending && setConfirmDelete(null)}>
                    <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="작품 삭제 확인"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal__head">
                            <h2 className="modal__title">작품을 삭제할까요?</h2>
                        </div>
                        <p className="modal__text">‘{confirmDelete.title}’과 작성한 본문이 영구 삭제됩니다. 되돌릴 수 없습니다.</p>
                        <div className="modal__foot">
                            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)} disabled={deleteProject.isPending}>
                                취소
                            </button>
                            <button
                                type="button"
                                className="btn btn--danger"
                                disabled={deleteProject.isPending}
                                onClick={() => deleteProject.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
