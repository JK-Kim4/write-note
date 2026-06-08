"use client";

import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { getProject } from "@/lib/api/projects";
import { listCharacters } from "@/lib/api/characters";
import { TopBar } from "@/components/shell/TopBar";
import { SidePanel } from "@/components/shell/SidePanel";
import { ProgressRing } from "@/components/shell/ProgressRing";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MetaCard } from "@/components/projects/MetaCard";
import { useUi } from "@/stores/ui";
import { calcProgress } from "@/components/editor/wordCountUtils";

/**
 * Write shared layout — `/write` 와 `/write/preview` 공통 shell (006 T021).
 *
 * Spec reference: contracts/route-surfaces.md §2-2
 * 가드: requireAuth (FR-009).
 * 구조: TopBar (프로젝트 타이틀 / 진행 ring / 미리보기 진입 / 사이드 토글) + 본문 slot + SidePanel.
 * 실데이터: ?projectId= 로 getProject + listCharacters 호출.
 */
export default function WriteLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<div style={{ height: "100vh", backgroundColor: "var(--w-parchment)" }} />}>
            <WriteLayoutInner>{children}</WriteLayoutInner>
        </Suspense>
    );
}

function WriteLayoutInner({ children }: { children: ReactNode }) {
    useAuthGuard("requireAuth");

    const sidePanelOpen = useUi((s) => s.sidePanelOpen);
    const setSidePanelOpen = useUi((s) => s.setSidePanelOpen);

    const projectIdParam = useSearchParams().get("projectId");
    const projectId = projectIdParam != null ? parseInt(projectIdParam, 10) : null;
    const isValidProjectId = projectId != null && !isNaN(projectId);

    const { data: project } = useQuery({
        queryKey: ["project", projectId],
        queryFn: () => getProject(projectId!),
        enabled: isValidProjectId,
        retry: false,
    });

    const { data: charactersPage } = useQuery({
        queryKey: ["characters", projectId],
        queryFn: () => listCharacters(projectId!, { size: 50 }),
        enabled: isValidProjectId,
        retry: false,
    });

    const characters = charactersPage?.content ?? [];

    // 진행률 계산 (문서 wordCount 는 page 에서 갱신 — layout 은 프로젝트 targetLength 만 사용)
    // 현재는 0으로 초기화, page 에서 TopBar 를 제어하는 구조로 추후 개선 가능
    const targetLength = project?.targetLength ?? null;
    const progress = targetLength != null && targetLength > 0
        ? calcProgress(0, targetLength)
        : 0;
    const progressLabel =
        targetLength != null && targetLength > 0
            ? `0 / ${targetLength.toLocaleString()} 자`
            : "0 자";

    return (
        <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar
                title={project?.title ?? ""}
                progress={<ProgressRing value={progress} label={progressLabel} />}
                actions={
                    <>
                        <Link
                            href={isValidProjectId ? `/write/preview?projectId=${projectId}` : "/write/preview"}
                            className="px-3 py-2 rounded-button-utility text-sm"
                            style={{ color: "var(--w-ink)", opacity: 0.8 }}
                        >
                            📖 미리보기
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidePanelOpen(!sidePanelOpen)}
                            className="px-3 py-2 rounded-button-utility text-sm"
                            style={{ color: "var(--w-ink)", opacity: 0.8 }}
                        >
                            ⊞
                        </button>
                        <ThemeToggle />
                    </>
                }
            />
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto">{children}</div>
                <SidePanel>
                    <div className="flex flex-col gap-6">
                        {project != null && (
                            <section>
                                <h3
                                    className="text-xs font-semibold mb-3 uppercase tracking-wide"
                                    style={{ color: "var(--w-ink)", opacity: 0.5 }}
                                >
                                    프로젝트 메타
                                </h3>
                                <MetaCard project={project} />
                            </section>
                        )}
                        {characters.length > 0 && (
                            <section>
                                <h3
                                    className="text-xs font-semibold mb-3 uppercase tracking-wide"
                                    style={{ color: "var(--w-ink)", opacity: 0.5 }}
                                >
                                    등장인물
                                </h3>
                                <ul className="flex flex-col gap-2">
                                    {characters.map((c) => (
                                        <li
                                            key={c.id}
                                            className="p-3 rounded-card-project"
                                            style={{
                                                backgroundColor: "var(--w-canvas)",
                                                border: "1px solid var(--w-hairline)",
                                            }}
                                        >
                                            <span className="font-medium" style={{ color: "var(--w-ink)", fontSize: "14px" }}>
                                                {c.name}
                                            </span>
                                            {c.shortDescription ? (
                                                <p style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "13px", marginTop: "2px" }}>
                                                    {c.shortDescription}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {project == null && (
                            <p style={{ color: "var(--w-ink)", opacity: 0.5, fontSize: "14px" }}>
                                ?projectId=N 으로 접근하면 프로젝트 정보가 표시됩니다.
                            </p>
                        )}
                    </div>
                </SidePanel>
            </div>
        </div>
    );
}
