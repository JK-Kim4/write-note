"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { archiveProject, getProject, unarchiveProject } from "@/lib/api/projects";
import { useDeleteProject } from "@/lib/query/useProjects";
import { ApiError } from "@/lib/api/client";
import { MetaCard } from "@/components/projects/MetaCard";
import { TopBar } from "@/components/shell/TopBar";
import { EmptyHero } from "@/components/ui/EmptyHero";

/**
 * 프로젝트 메타 카드 + 생명주기 (US3, contracts/screen-data-flow.md §3).
 *
 * getProject → MetaCard + 액션(편집/보관·해제/삭제/등장인물). 404(RESOURCE_NOT_FOUND) → 존재 비노출 안내.
 */

export default function ProjectDetailPage() {
    useAuthGuard("requireAuth");
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const projectQuery = useQuery({
        queryKey: ["project", id],
        queryFn: () => getProject(id),
        retry: false,
    });

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: ["project", id] });
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
    };

    const archiveMutation = useMutation({ mutationFn: () => archiveProject(id), onSuccess: invalidate });
    const unarchiveMutation = useMutation({ mutationFn: () => unarchiveProject(id), onSuccess: invalidate });
    // 공용 훅 재사용 — 삭제 성공 시 lastProject 정리(019 버그픽스 C)가 이 경로에서도 적용된다.
    const deleteMutation = useDeleteProject();
    const handleDelete = () => deleteMutation.mutate(id, { onSuccess: () => router.push("/") });

    const notFound =
        projectQuery.isError &&
        projectQuery.error instanceof ApiError &&
        projectQuery.error.code === "RESOURCE_NOT_FOUND";

    if (notFound) {
        return (
            <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
                <TopBar title="프로젝트" />
                <EmptyHero
                    title="프로젝트를 찾을 수 없습니다"
                    lede="이미 삭제되었거나 접근 권한이 없습니다."
                    cta={
                        <Link
                            href="/"
                            className="px-6 py-3 rounded-button-pill font-semibold"
                            style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                        >
                            홈으로
                        </Link>
                    }
                />
            </div>
        );
    }

    const project = projectQuery.data;
    const archived = project?.archivedAt !== null && project?.archivedAt !== undefined;

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title={project?.title ?? "프로젝트"} />
            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
                {project ? (
                    <>
                        <MetaCard project={project} />
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href={`/projects/${id}/edit`}
                                className="px-4 py-2 rounded-button-pill font-semibold"
                                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
                            >
                                편집
                            </Link>
                            <Link
                                href={`/projects/${id}/characters`}
                                className="px-4 py-2 rounded-button-pill font-semibold"
                                style={{
                                    backgroundColor: "var(--w-canvas)",
                                    color: "var(--w-ink)",
                                    border: "1px solid var(--w-hairline)",
                                }}
                            >
                                등장인물
                            </Link>
                            {archived ? (
                                <button
                                    type="button"
                                    onClick={() => unarchiveMutation.mutate()}
                                    className="px-4 py-2 rounded-button-pill font-semibold"
                                    style={{
                                        backgroundColor: "var(--w-canvas)",
                                        color: "var(--w-ink)",
                                        border: "1px solid var(--w-hairline)",
                                    }}
                                >
                                    보관 해제
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => archiveMutation.mutate()}
                                    className="px-4 py-2 rounded-button-pill font-semibold"
                                    style={{
                                        backgroundColor: "var(--w-canvas)",
                                        color: "var(--w-ink)",
                                        border: "1px solid var(--w-hairline)",
                                    }}
                                >
                                    보관
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 py-2 rounded-button-pill font-semibold"
                                style={{ backgroundColor: "transparent", color: "var(--w-error)", border: "1px solid var(--w-error)" }}
                            >
                                삭제
                            </button>
                        </div>
                    </>
                ) : (
                    <p style={{ color: "var(--w-ink)", opacity: 0.6 }}>불러오는 중…</p>
                )}
            </main>

            {showDeleteConfirm ? (
                <div
                    role="dialog"
                    aria-label="프로젝트 삭제 확인"
                    className="fixed inset-0 flex items-center justify-center p-4"
                    style={{ backgroundColor: "color-mix(in srgb, var(--w-ink) 40%, transparent)" }}
                >
                    <div
                        className="flex flex-col gap-5 p-6 rounded-card-project max-w-sm w-full"
                        style={{ backgroundColor: "var(--w-canvas)" }}
                    >
                        <h2 className="font-display font-semibold" style={{ fontSize: "18px", color: "var(--w-ink)" }}>
                            프로젝트를 삭제할까요?
                        </h2>
                        <p style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                            등장인물·문서가 함께 영구 삭제됩니다. 되돌릴 수 없습니다.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-button-pill font-semibold"
                                style={{
                                    backgroundColor: "var(--w-canvas)",
                                    color: "var(--w-ink)",
                                    border: "1px solid var(--w-hairline)",
                                }}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-button-pill font-semibold"
                                style={{ backgroundColor: "var(--w-error)", color: "var(--w-canvas)" }}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
