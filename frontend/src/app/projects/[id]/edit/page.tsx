"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { getProject, updateProject } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import type { ProjectResponse } from "@/types/api";
import { FormInput } from "@/components/ui/FormInput";
import { FormTextarea } from "@/components/ui/FormTextarea";
import { TopBar } from "@/components/shell/TopBar";

/**
 * 프로젝트 메타 편집 (US3, contracts/screen-data-flow.md §3 편집).
 *
 * getProject 로 초기값 → updateProject(PATCH). 성공 → `['project',id]`+`['projects']` 무효화 + 상세 복귀.
 * 폼은 project 로드 후에만 마운트해 초기값을 useState 로 1회 설정(props→state 동기 useEffect 회피).
 * V1: 빈 값은 null(미변경) 로 전송(data-model §4 — 값 비우기 미지원).
 */

export default function ProjectEditPage() {
    useAuthGuard("requireAuth");
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const projectQuery = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id), retry: false });

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="프로젝트 편집" />
            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">
                {projectQuery.data ? (
                    <EditForm id={id} project={projectQuery.data} />
                ) : (
                    <p style={{ color: "var(--w-ink)", opacity: 0.6 }}>불러오는 중…</p>
                )}
            </main>
        </div>
    );
}

function EditForm({ id, project }: { id: number; project: ProjectResponse }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState(project.title);
    const [genre, setGenre] = useState(project.genre ?? "");
    const [targetLength, setTargetLength] = useState(project.targetLength !== null ? String(project.targetLength) : "");
    const [toneNotes, setToneNotes] = useState(project.toneNotes ?? "");
    const [synopsis, setSynopsis] = useState(project.synopsis ?? "");
    const [worldNotes, setWorldNotes] = useState(project.worldNotes ?? "");
    const [titleError, setTitleError] = useState<string | null>(null);

    const updateMutation = useMutation({
        mutationFn: () =>
            updateProject(id, {
                title: title.trim(),
                genre: genre.trim() || null,
                targetLength: targetLength.trim() ? Number(targetLength) : null,
                toneNotes: toneNotes.trim() || null,
                synopsis: synopsis.trim() || null,
                worldNotes: worldNotes.trim() || null,
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["project", id] });
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
            router.push(`/projects/${id}`);
        },
    });

    const serverError = updateMutation.isError
        ? updateMutation.error instanceof ApiError
            ? updateMutation.error.message
            : "수정하지 못했습니다."
        : null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setTitleError("제목을 입력해주세요.");
            return;
        }
        setTitleError(null);
        updateMutation.mutate();
    };

    const pending = updateMutation.isPending;

    return (
        <form
            className="flex flex-col gap-6"
            style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
            onSubmit={handleSubmit}
        >
            <FormInput
                name="title"
                label="제목 *"
                value={title}
                error={titleError !== null}
                onChange={(e) => setTitle(e.target.value)}
            />
            {titleError ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px", marginTop: "-12px" }}>
                    {titleError}
                </p>
            ) : null}
            <FormInput name="genre" label="장르" value={genre} onChange={(e) => setGenre(e.target.value)} />
            <FormInput
                name="targetLength"
                type="number"
                label="목표 분량 (자)"
                value={targetLength}
                onChange={(e) => setTargetLength(e.target.value)}
            />
            <FormTextarea name="toneNotes" label="톤·문체 노트" value={toneNotes} onChange={setToneNotes} />
            <FormTextarea name="synopsis" label="시놉시스" value={synopsis} onChange={setSynopsis} />
            <FormTextarea name="worldNotes" label="세계관 메모" value={worldNotes} onChange={setWorldNotes} />

            {serverError ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px" }}>
                    {serverError}
                </p>
            ) : null}

            <div className="flex items-center justify-end gap-3 mt-2">
                <button
                    type="button"
                    onClick={() => router.push(`/projects/${id}`)}
                    className="px-5 py-2.5 rounded-button-pill font-semibold"
                    style={{
                        backgroundColor: "var(--w-canvas)",
                        color: "var(--w-ink)",
                        border: "1px solid var(--w-hairline)",
                    }}
                >
                    취소
                </button>
                <button
                    type="submit"
                    className="px-6 py-2.5 rounded-button-pill font-semibold"
                    style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                >
                    {pending ? "저장 중…" : "저장"}
                </button>
            </div>
        </form>
    );
}
