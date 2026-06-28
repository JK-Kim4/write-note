"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useCreateShareLink, useMyShareLinks, useRevokeShareLink } from "@/lib/query/useShares";
import { useProjectCards } from "@/lib/query/useProjects";
import { useCategories } from "@/lib/query/useCategories";
import { PublicWorkPicker } from "./PublicWorkPicker";
import { AuthorCommentInbox } from "./AuthorCommentInbox";
import type { ShareLinkResponse, ShareTargetType } from "@/lib/api/share";

/**
 * 공유 관리(046 R4) — 내 공유 링크 목록 + 작품/시리즈 공유 생성·끄기·주소 복사 + 받은 피드백 진입.
 *
 * 시리즈 링크는 "공개 작품 선택"(PublicWorkPicker)으로 노출 작품을 직접 고른다(FR-012).
 * 각 공개 작품(스냅샷)에서 "받은 피드백"으로 작가 인박스(AuthorCommentInbox)를 연다.
 * 빈 상태는 페이지 컨텍스트(생성 카드·헤딩) 유지한 채 목록 카드 안에 안내(전체 화면 takeover 아님).
 */
const SHARE_ERROR_MESSAGES: Record<string, string> = {
    SHARE_TARGET_INVALID: "공유할 수 없는 대상이에요.",
    SHARE_TARGET_NOT_FOUND: "공유 대상을 찾을 수 없어요.",
    SHARE_FORBIDDEN: "이 대상을 공유할 권한이 없어요.",
    SHARE_LINK_NOT_FOUND: "이미 사라진 링크예요.",
};

function messageFor(e: unknown): string {
    if (e instanceof ApiError) return SHARE_ERROR_MESSAGES[e.code] ?? e.message;
    return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function ShareLinkManager() {
    const linksQuery = useMyShareLinks();
    const projectCards = useProjectCards();
    const categories = useCategories();
    const createMutation = useCreateShareLink();
    const revokeMutation = useRevokeShareLink();

    const [targetType, setTargetType] = useState<ShareTargetType>("work");
    const [selectedTargetId, setSelectedTargetId] = useState<number | "">("");
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [pickerLink, setPickerLink] = useState<ShareLinkResponse | null>(null);
    const [inboxProject, setInboxProject] = useState<{ id: number; title: string } | null>(null);

    const works = projectCards.data ?? [];
    const series = categories.data ?? [];
    const links = linksQuery.data ?? [];

    const setMode = (mode: ShareTargetType) => {
        setTargetType(mode);
        setSelectedTargetId("");
        setError(null);
    };

    const labelFor = (link: ShareLinkResponse): string => {
        if (link.targetType === "series") {
            return series.find((c) => c.id === link.targetId)?.name ?? `시리즈 #${link.targetId}`;
        }
        return link.snapshots[0]?.title ?? `작품 #${link.targetId}`;
    };

    const handleCreate = () => {
        if (selectedTargetId === "") return;
        setError(null);
        createMutation.mutate(
            { targetType, targetId: selectedTargetId },
            {
                onSuccess: () => setSelectedTargetId(""),
                onError: (e: unknown) => setError(messageFor(e)),
            },
        );
    };

    const handleCopy = async (link: ShareLinkResponse) => {
        setError(null);
        try {
            await navigator.clipboard.writeText(link.shareUrl);
            setCopiedId(link.id);
            window.setTimeout(() => setCopiedId(null), 2000);
        } catch {
            setError("주소를 복사하지 못했어요. 직접 복사해 주세요.");
        }
    };

    const handleRevoke = (link: ShareLinkResponse) => {
        setError(null);
        revokeMutation.mutate(link.id, { onError: (e: unknown) => setError(messageFor(e)) });
    };

    const TOGGLE_BASE = "rounded-md px-3 py-1.5 text-sm";
    const ACTIVE_BTN = `${TOGGLE_BASE} bg-accent-soft font-medium text-accent-text`;
    const IDLE_BTN = `${TOGGLE_BASE} text-muted-strong hover:bg-surface-2`;

    return (
        <div className="space-y-5">
            {/* 공유 만들기 */}
            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-base font-semibold text-ink">공유 만들기</h2>
                <p className="mt-0.5 text-xs text-faint">작품 또는 시리즈의 공유 링크를 만들어 외부에 전달하세요.</p>

                <div className="mt-3 inline-flex gap-1 rounded-lg bg-surface-2 p-1">
                    <button type="button" aria-pressed={targetType === "work"} onClick={() => setMode("work")} className={targetType === "work" ? ACTIVE_BTN : IDLE_BTN}>
                        작품
                    </button>
                    <button type="button" aria-pressed={targetType === "series"} onClick={() => setMode("series")} className={targetType === "series" ? ACTIVE_BTN : IDLE_BTN}>
                        시리즈
                    </button>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="share-target" className="sr-only">
                        {targetType === "work" ? "공유할 작품" : "공유할 시리즈"}
                    </label>
                    <select
                        id="share-target"
                        value={selectedTargetId === "" ? "" : String(selectedTargetId)}
                        onChange={(e) => setSelectedTargetId(e.target.value === "" ? "" : Number(e.target.value))}
                        className="min-w-0 flex-1 rounded-md border border-border-strong px-3 py-2 text-sm text-ink outline-none focus:border-terracotta-400"
                    >
                        <option value="">{targetType === "work" ? "작품을 고르세요" : "시리즈를 고르세요"}</option>
                        {targetType === "work"
                            ? works.map((w) => (
                                  <option key={w.id} value={w.id}>
                                      {w.title}
                                  </option>
                              ))
                            : series.map((c) => (
                                  <option key={c.id} value={c.id}>
                                      {c.name}
                                  </option>
                              ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={selectedTargetId === "" || createMutation.isPending}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                    >
                        {createMutation.isPending ? "만드는 중…" : "공유 링크 만들기"}
                    </button>
                </div>

                {error ? (
                    <p role="alert" className="mt-2 text-xs text-red-500">
                        {error}
                    </p>
                ) : null}
            </section>

            {/* 내 공유 링크 */}
            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-base font-semibold text-ink">내 공유 링크</h2>

                {linksQuery.isPending ? (
                    <p className="mt-4 text-sm text-faint">불러오는 중…</p>
                ) : linksQuery.isError ? (
                    <div className="mt-4">
                        <p className="text-sm text-muted">공유 링크를 불러오지 못했어요.</p>
                        <button
                            type="button"
                            onClick={() => linksQuery.refetch()}
                            disabled={linksQuery.isFetching}
                            className="mt-2 rounded-md border border-border-strong px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : links.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                        아직 만든 공유 링크가 없어요. 위에서 작품이나 시리즈를 공유해 보세요.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-3">
                        {links.map((link) => (
                            <li key={link.id} className="rounded-xl border border-border bg-surface p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-ink">{labelFor(link)}</span>
                                        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                                            {link.targetType === "series" ? "시리즈" : "작품"}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                                                link.isActive ? "bg-teal-50 text-teal-600" : "bg-surface-2 text-faint"
                                            }`}
                                        >
                                            {link.isActive ? "공유 중" : "꺼짐"}
                                        </span>
                                    </div>
                                    {link.isActive ? (
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(link)}
                                            disabled={revokeMutation.isPending}
                                            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                                        >
                                            끄기
                                        </button>
                                    ) : null}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={link.shareUrl}
                                        aria-label="공유 주소"
                                        className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-muted"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(link)}
                                        className="shrink-0 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-muted-strong hover:bg-surface-2"
                                    >
                                        {copiedId === link.id ? "복사됨" : "복사"}
                                    </button>
                                </div>

                                {link.targetType === "series" ? (
                                    <button
                                        type="button"
                                        onClick={() => setPickerLink(link)}
                                        className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs text-muted-strong hover:bg-surface-2"
                                    >
                                        공개 작품 선택{link.snapshots.length > 0 ? ` (${link.snapshots.length})` : ""}
                                    </button>
                                ) : null}

                                {link.snapshots.length > 0 ? (
                                    <ul className="mt-3 space-y-1 border-t border-border pt-3">
                                        {link.snapshots.map((snap) => (
                                            <li key={snap.projectId} className="flex items-center justify-between gap-2">
                                                <span className="truncate text-sm text-ink-2">{snap.title}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setInboxProject({ id: snap.projectId, title: snap.title })}
                                                    className="shrink-0 rounded-md px-2 py-1 text-xs text-accent-text hover:bg-accent-soft"
                                                >
                                                    받은 피드백
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : link.targetType === "series" ? (
                                    <p className="mt-3 border-t border-border pt-3 text-xs text-faint">아직 공개한 작품이 없어요.</p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {pickerLink ? (
                <PublicWorkPicker
                    linkId={pickerLink.id}
                    categoryId={pickerLink.targetId}
                    currentProjectIds={pickerLink.snapshots.map((s) => s.projectId)}
                    onClose={() => setPickerLink(null)}
                />
            ) : null}

            {inboxProject ? (
                <AuthorCommentInbox projectId={inboxProject.id} projectTitle={inboxProject.title} onClose={() => setInboxProject(null)} />
            ) : null}
        </div>
    );
}
