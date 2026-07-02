"use client";

import { useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useCreateShareLink, useDeleteShareLink, useMyShareLinks, useSetShareLinkActive } from "@/lib/query/useShares";
import { useCategories } from "@/lib/query/useCategories";
import { groupByTarget, unreadProjects, type TargetGroup } from "@/lib/share/shareGrouping";
import { PublicWorkPicker } from "./PublicWorkPicker";
import { AuthorFeedbackView } from "./AuthorFeedbackView";
import { MAX_SHARE_LINKS_PER_TARGET } from "@/lib/api/share";
import type { ShareLinkResponse } from "@/lib/api/share";

/**
 * 공유 관리 허브(047 US2) — 헤더 "공유" 전용 화면(`/shares`).
 *
 * 받은 피드백(맨 위, 안 읽은 작품)을 전면에 노출하고, 그 아래 작품/시리즈별로 묶은 공유 링크(1:N)를 보여준다.
 * 생성 폼은 두지 않는다(첫 공유는 작품/시리즈 화면 진입점이 담당) — 단, 이미 링크가 있는 대상은 그룹에서
 * "새 공유 링크"로 하나 더 만들 수 있다. 빈 상태는 화면 컨텍스트(헤딩·섹션)를 유지한 채 안내(전체 takeover 아님).
 *
 * 050 US1 — 링크별 "받은 피드백"은 이제 `AuthorFeedbackView`(전문+우측 패널 맥락 뷰)를 연다(047
 * `AuthorCommentInbox` 조각 모달 대체, research D9). 상단 안 읽은 요약의 "피드백 보기"는 모달을 열지 않고
 * 그 작품이 속한 링크 그룹으로 스크롤+강조한다(다중 링크에서 임의 스냅샷 선택 모호성 회피).
 */
function groupKey(targetType: TargetGroup["targetType"], targetId: number): string {
    return `${targetType}:${targetId}`;
}

/** projectId 가 속한 첫 번째 그룹의 key(작품 자신의 work 그룹이든, 소속 시리즈 그룹이든). 없으면 null. */
function findGroupKeyForProject(groups: TargetGroup[], projectId: number): string | null {
    for (const g of groups) {
        if (g.links.some((l) => l.snapshots.some((s) => s.projectId === projectId))) return groupKey(g.targetType, g.targetId);
    }
    return null;
}
const SHARE_ERROR_MESSAGES: Record<string, string> = {
    SHARE_TARGET_INVALID: "공유할 수 없는 대상이에요.",
    SHARE_TARGET_NOT_FOUND: "공유 대상을 찾을 수 없어요.",
    SHARE_FORBIDDEN: "이 대상을 공유할 권한이 없어요.",
    SHARE_LINK_NOT_FOUND: "이미 사라진 링크예요.",
    SHARE_LINK_LIMIT_EXCEEDED: "공유 링크는 작품·시리즈당 5개까지예요. 기존 링크를 삭제하고 만들어 주세요.",
};

function messageFor(e: unknown): string {
    if (e instanceof ApiError) return SHARE_ERROR_MESSAGES[e.code] ?? e.message;
    return "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function shareDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ShareLinkManager() {
    const linksQuery = useMyShareLinks();
    const categories = useCategories();
    const createMutation = useCreateShareLink();
    const setActiveMutation = useSetShareLinkActive();
    const deleteMutation = useDeleteShareLink();

    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [pickerLink, setPickerLink] = useState<ShareLinkResponse | null>(null);
    const [feedbackTarget, setFeedbackTarget] = useState<{ linkId: number; projectId: number } | null>(null);
    const [highlightedGroup, setHighlightedGroup] = useState<string | null>(null);

    const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const links = linksQuery.data ?? [];
    const series = categories.data ?? [];
    const groups = groupByTarget(links);
    const unread = unreadProjects(links);
    const unreadTotal = unread.reduce((n, u) => n + u.unread, 0);

    const scrollToGroupForProject = (projectId: number) => {
        const key = findGroupKeyForProject(groups, projectId);
        if (!key) return;
        const el = groupRefs.current[key];
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedGroup(key);
        window.setTimeout(() => setHighlightedGroup((k) => (k === key ? null : k)), 1600);
    };

    const titleForGroup = (group: TargetGroup): string => {
        if (group.targetType === "series") {
            return series.find((c) => c.id === group.targetId)?.name ?? `시리즈 #${group.targetId}`;
        }
        return group.links[0]?.snapshots[0]?.title ?? `작품 #${group.targetId}`;
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

    const handleToggleActive = (link: ShareLinkResponse) => {
        setError(null);
        setActiveMutation.mutate({ id: link.id, isActive: !link.isActive }, { onError: (e: unknown) => setError(messageFor(e)) });
    };

    const handleDelete = (link: ShareLinkResponse) => {
        setError(null);
        deleteMutation.mutate(link.id, {
            onSuccess: () => setConfirmDeleteId(null),
            onError: (e: unknown) => setError(messageFor(e)),
        });
    };

    const handleAddLink = (group: TargetGroup) => {
        setError(null);
        createMutation.mutate(
            { targetType: group.targetType, targetId: group.targetId },
            {
                onSuccess: (created) => {
                    if (group.targetType === "series") setPickerLink(created);
                },
                onError: (e: unknown) => setError(messageFor(e)),
            },
        );
    };

    const renderSublink = (link: ShareLinkResponse, group: TargetGroup) => {
        const workUnread = group.targetType === "work" ? link.snapshots[0]?.unreadCommentCount ?? 0 : 0;
        return (
            <div key={link.id} className="mb-2 rounded-xl border border-border bg-surface-2 p-3 last:mb-2.5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-ink-2">{shareDate(link.createdAt)} 공유</span>
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            link.isActive ? "bg-teal-50 text-teal-600" : "bg-surface-3 text-faint"
                        }`}
                    >
                        {link.isActive ? "● 공유 중" : "꺼짐"}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <input
                        readOnly
                        value={link.shareUrl}
                        aria-label="공유 주소"
                        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[11.5px] text-muted"
                    />
                    <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        className="shrink-0 rounded-md border border-border-strong px-2.5 py-1.5 text-[11.5px] text-muted-strong hover:bg-surface"
                    >
                        {copiedId === link.id ? "복사됨" : "복사"}
                    </button>
                </div>

                {group.targetType === "series" && (
                    link.snapshots.length > 0 ? (
                        <ul className="mt-2.5 space-y-1 border-t border-border pt-2.5">
                            {link.snapshots.map((snap) => (
                                <li key={snap.projectId} className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[12px] text-ink-2">{snap.title}</span>
                                    <button
                                        type="button"
                                        onClick={() => setFeedbackTarget({ linkId: link.id, projectId: snap.projectId })}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-text hover:bg-terracotta-100"
                                    >
                                        본문 보기
                                        {snap.unreadCommentCount > 0 && (
                                            <span className="inline-flex min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[9.5px] text-accent-ink">
                                                {snap.unreadCommentCount}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2.5 border-t border-border pt-2.5 text-[11px] text-faint">아직 공개한 작품이 없어요.</p>
                    )
                )}

                {/* 기능 버튼 한 줄(안 A) — 우측 클러스터. 작품=본문 보기, 시리즈=공개 작품 선택 + 공통 끄기·삭제 */}
                <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
                    {group.targetType === "series" && (
                        <button
                            type="button"
                            onClick={() => setPickerLink(link)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-strong hover:bg-surface"
                        >
                            공개 작품 선택{link.snapshots.length > 0 ? ` (${link.snapshots.length})` : ""}
                        </button>
                    )}
                    <span className="flex-1" />
                    {group.targetType === "work" && (
                        <button
                            type="button"
                            onClick={() => setFeedbackTarget({ linkId: link.id, projectId: group.targetId })}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-[11.5px] font-semibold text-accent-text hover:bg-terracotta-100"
                        >
                            본문 보기
                            {workUnread > 0 && (
                                <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] text-accent-ink">
                                    {workUnread}
                                </span>
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleToggleActive(link)}
                        disabled={setActiveMutation.isPending}
                        className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-strong hover:bg-surface disabled:opacity-50"
                    >
                        {link.isActive ? "끄기" : "다시 켜기"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmDeleteId(link.id)}
                        className="shrink-0 rounded-md px-2 py-1.5 text-[11px] font-semibold text-faint hover:text-red-600"
                    >
                        삭제
                    </button>
                </div>

                {confirmDeleteId === link.id && (
                    <div className="mt-2.5 rounded-md border border-red-200 bg-red-50 p-2">
                        <p className="text-[11px] leading-relaxed text-red-600">삭제하면 받은 피드백도 함께 사라져요. 되돌릴 수 없어요.</p>
                        <div className="mt-1.5 flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-strong hover:bg-surface"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(link)}
                                disabled={deleteMutation.isPending}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <div>
                <h1 className="text-xl font-bold text-ink">공유</h1>
                <p className="mt-1 text-sm text-muted">작품·시리즈 화면에서 만든 공유 링크와, 독자가 남긴 피드백을 한곳에서 봅니다.</p>
            </div>

            {/* 받은 피드백 — 맨 위(서비스 특징 전면) */}
            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    받은 피드백
                    {unreadTotal > 0 ? (
                        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">
                            {unreadTotal}
                        </span>
                    ) : null}
                </h2>
                {unread.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">확인할 새 피드백이 없어요. 전체 피드백은 아래 링크에서 다시 볼 수 있어요.</p>
                ) : (
                    <ul className="mt-3 space-y-2.5">
                        {unread.map((u) => (
                            <li key={u.projectId} className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-sm text-ink-2">
                                    <b className="font-semibold text-ink">{u.title}</b> · {u.unread}개의 새 피드백
                                </span>
                                <button
                                    type="button"
                                    onClick={() => scrollToGroupForProject(u.projectId)}
                                    className="shrink-0 rounded-md bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-text hover:bg-terracotta-100"
                                >
                                    피드백 보기
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* 내 공유 링크 — 작품/시리즈별 그룹(1:N) */}
            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-ink">내 공유 링크</h2>

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
                ) : groups.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                        아직 만든 공유 링크가 없어요. 작품 목록이나 시리즈 화면에서 공유를 시작해 보세요.
                    </p>
                ) : (
                    <div className="mt-3 space-y-3">
                        {groups.map((group) => {
                            const key = groupKey(group.targetType, group.targetId);
                            return (
                            <div
                                key={key}
                                ref={(el) => {
                                    groupRefs.current[key] = el;
                                }}
                                className={`relative overflow-hidden rounded-xl border p-4 pl-5 transition-shadow ${
                                    highlightedGroup === key ? "border-accent ring-2 ring-accent" : "border-border"
                                }`}
                            >
                                <span
                                    aria-hidden
                                    className={`absolute inset-y-0 left-0 w-[5px] ${group.targetType === "series" ? "bg-teal-600" : "bg-accent"}`}
                                />
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="truncate text-sm font-bold text-ink">{titleForGroup(group)}</span>
                                    <span
                                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                            group.targetType === "series" ? "bg-teal-50 text-teal-700" : "bg-accent-soft text-accent-text"
                                        }`}
                                    >
                                        <span
                                            aria-hidden
                                            className={`h-1.5 w-1.5 rounded-full ${group.targetType === "series" ? "bg-teal-600" : "bg-accent"}`}
                                        />
                                        {group.targetType === "series" ? "시리즈" : "작품"}
                                    </span>
                                    <span className="ml-auto shrink-0 text-[11.5px] text-muted">공유 링크 {group.links.length}</span>
                                </div>
                                {group.links.map((link) => renderSublink(link, group))}
                                <button
                                    type="button"
                                    onClick={() => handleAddLink(group)}
                                    disabled={createMutation.isPending || group.links.length >= MAX_SHARE_LINKS_PER_TARGET}
                                    className="mt-1 w-full rounded-lg border border-dashed border-border-strong py-2 text-[12.5px] font-semibold text-accent-text hover:bg-accent-soft disabled:opacity-50"
                                >
                                    {createMutation.isPending
                                        ? "만드는 중…"
                                        : group.targetType === "series"
                                          ? "+ 이 시리즈 새 공유 링크"
                                          : "+ 이 작품 새 공유 링크"}
                                </button>
                                {group.links.length >= MAX_SHARE_LINKS_PER_TARGET ? (
                                    <p className="mt-1.5 text-[11px] font-medium text-accent-text">
                                        {MAX_SHARE_LINKS_PER_TARGET}개까지예요. 기존 링크를 삭제하면 더 만들 수 있어요.
                                    </p>
                                ) : null}
                            </div>
                            );
                        })}
                    </div>
                )}

                {error ? (
                    <p role="alert" className="mt-3 text-xs text-red-500">
                        {error}
                    </p>
                ) : null}
            </section>

            {pickerLink ? (
                <PublicWorkPicker
                    linkId={pickerLink.id}
                    categoryId={pickerLink.targetId}
                    currentProjectIds={pickerLink.snapshots.map((s) => s.projectId)}
                    onClose={() => setPickerLink(null)}
                />
            ) : null}

            {feedbackTarget ? (
                <AuthorFeedbackView
                    linkId={feedbackTarget.linkId}
                    projectId={feedbackTarget.projectId}
                    onClose={() => setFeedbackTarget(null)}
                />
            ) : null}
        </div>
    );
}
