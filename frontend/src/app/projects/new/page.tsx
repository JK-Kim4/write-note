"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { createProject } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import { FormInput } from "@/components/ui/FormInput";
import { FormTextarea } from "@/components/ui/FormTextarea";
import { TopBar } from "@/components/shell/TopBar";

/**
 * 새 프로젝트 만들기 (US2, contracts/screen-data-flow.md §2).
 *
 * title(필수) + 메타 5필드(선택). 생성 성공 → `['projects']` 무효화 + `/projects/{id}` 이동.
 * 검증: title 빈값은 클라이언트에서 차단(서버가 최종 SoT — 400 VALIDATION_FAILED 시 메시지 표시).
 */

export default function NewProjectPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();
    const queryClient = useQueryClient();

    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [targetLength, setTargetLength] = useState("");
    const [toneNotes, setToneNotes] = useState("");
    const [synopsis, setSynopsis] = useState("");
    const [worldNotes, setWorldNotes] = useState("");
    const [titleError, setTitleError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: () =>
            createProject({
                title: title.trim(),
                genre: genre.trim() || null,
                targetLength: targetLength.trim() ? Number(targetLength) : null,
                toneNotes: toneNotes.trim() || null,
                synopsis: synopsis.trim() || null,
                worldNotes: worldNotes.trim() || null,
            }),
        onSuccess: async (project) => {
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
            router.push(`/projects/${project.id}`);
        },
    });

    const serverError = createMutation.isError
        ? createMutation.error instanceof ApiError
            ? createMutation.error.message
            : "프로젝트를 만들지 못했습니다."
        : null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setTitleError("제목을 입력해주세요.");
            return;
        }
        setTitleError(null);
        createMutation.mutate();
    };

    const pending = createMutation.isPending;

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="새 프로젝트" />
            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10">
                <form
                    className="flex flex-col gap-6"
                    style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
                    onSubmit={handleSubmit}
                >
                    <FormInput
                        name="title"
                        label="제목 *"
                        placeholder="작품 제목"
                        value={title}
                        error={titleError !== null}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    {titleError ? (
                        <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px", marginTop: "-12px" }}>
                            {titleError}
                        </p>
                    ) : null}
                    <FormInput
                        name="genre"
                        label="장르"
                        placeholder="예: 판타지, 로맨스"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                    />
                    <FormInput
                        name="targetLength"
                        type="number"
                        label="목표 분량 (자)"
                        placeholder="예: 100000"
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
                            onClick={() => router.back()}
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
                            {pending ? "만드는 중…" : "프로젝트 만들기"}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
