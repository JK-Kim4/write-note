"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "@/lib/api/client";
import { useCreateShareLink, useDeleteShareLink, useMyShareLinks, useSetShareLinkActive } from "@/lib/query/useShares";
import { linksForTarget } from "@/lib/share/shareGrouping";
import { PublicWorkPicker } from "./PublicWorkPicker";
import { AuthorFeedbackView } from "./AuthorFeedbackView";
import { MAX_SHARE_LINKS_PER_TARGET } from "@/lib/api/share";
import type { ShareLinkResponse, ShareTargetType } from "@/lib/api/share";

/**
 * 작품/시리즈 공용 1:N 공유 팝오버(047 US1) — 카드/타일에 앵커되어 그 대상의 공유 링크를 직접 만들고 관리.
 *
 * 링크 0개면 "공유 링크 만들기"(그 시점 본문 고정 안내), 1개+면 시점별 링크 목록(주소·복사·받은 피드백·끄기/
 * 다시 켜기) + "새 공유 링크 만들기". 시리즈는 PublicWorkPicker 로 공개 작품을 직접 고른다. 받은 피드백은
 * AuthorFeedbackView(그 링크의 전문+피드백 맥락 뷰, 050 D9) 로 연다. 바깥 클릭/ESC 닫기(자식 모달 먼저).
 *
 * 자체 useMyShareLinks 구독(부모 카드의 배지 조회와 같은 쿼리 → React Query dedup, 추가 네트워크 0).
 */
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

type Props = {
    targetType: ShareTargetType;
    targetId: number;
    /** 표시용 — 작품 제목 또는 시리즈 이름. */
    title: string;
    onClose: () => void;
    /** 팝오버를 띄울 기준 요소(공유 트리거 버튼). 카드/타일 자손 stacking·이벤트 얽힘 탈출 위해 body 포털 + 이 위치 기준 fixed. */
    anchorRef: React.RefObject<HTMLElement | null>;
};

export function SharePopover({ targetType, targetId, title, onClose, anchorRef }: Props) {
    const linksQuery = useMyShareLinks();
    const createMutation = useCreateShareLink();
    const setActiveMutation = useSetShareLinkActive();
    const deleteMutation = useDeleteShareLink();

    const links = useMemo(
        () => linksForTarget(linksQuery.data ?? [], targetType, targetId),
        [linksQuery.data, targetType, targetId],
    );

    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [pickerLink, setPickerLink] = useState<ShareLinkResponse | null>(null);
    const [feedbackTarget, setFeedbackTarget] = useState<{ linkId: number; projectId: number } | null>(null);

    const popRef = useRef<HTMLDivElement>(null);
    const modalOpen = feedbackTarget != null || pickerLink != null;

    // body 포털 — 카드/타일 자손으로 렌더되면 클릭이 카드 진입·드래그와 얽혀 팝오버가 흔들리고 ✕ 가 빗나가던
    // 회귀(047) 근본 해결. 트리거(공유 버튼) 위치 기준 fixed 배치(아래 공간 충분하면 아래, 아니면 위).
    const [coords, setCoords] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
    useLayoutEffect(() => {
        const a = anchorRef.current;
        if (!a) return;
        const r = a.getBoundingClientRect();
        const left = Math.max(8, Math.min(r.right - 336, window.innerWidth - 344));
        const spaceBelow = window.innerHeight - r.bottom;
        setCoords(
            spaceBelow > 460
                ? { position: "fixed", top: r.bottom + 4, left }
                : { position: "fixed", bottom: window.innerHeight - r.top + 4, left },
        );
    }, [anchorRef]);

    // 바깥 클릭/ESC 닫기 — 자식 모달(인박스·공개작품선택)이 열려 있으면 모달부터.
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (modalOpen) return;
            const target = e.target as HTMLElement;
            // 팝오버를 연 트리거(공유 버튼) 클릭은 부모가 토글 처리 — 바깥 클릭으로 보지 않는다.
            if (target.closest("[data-share-trigger]")) return;
            if (popRef.current && !popRef.current.contains(target)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (feedbackTarget) {
                setFeedbackTarget(null);
                return;
            }
            if (pickerLink) {
                setPickerLink(null);
                return;
            }
            onClose();
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [modalOpen, feedbackTarget, pickerLink, onClose]);

    const handleCreate = () => {
        setError(null);
        createMutation.mutate(
            { targetType, targetId },
            {
                onSuccess: (created) => {
                    // 시리즈는 만든 즉시 공개 작품을 고르게(스냅샷 없이 생성됨).
                    if (targetType === "series") setPickerLink(created);
                },
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

    const handleToggleActive = (link: ShareLinkResponse) => {
        setError(null);
        setActiveMutation.mutate(
            { id: link.id, isActive: !link.isActive },
            { onError: (e: unknown) => setError(messageFor(e)) },
        );
    };

    const handleDelete = (link: ShareLinkResponse) => {
        setError(null);
        deleteMutation.mutate(link.id, {
            onSuccess: () => setConfirmDeleteId(null),
            onError: (e: unknown) => setError(messageFor(e)),
        });
    };

    const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation(), onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

    const renderLink = (link: ShareLinkResponse) => {
        const workUnread = targetType === "work" ? link.snapshots[0]?.unreadCommentCount ?? 0 : 0;
        return (
            <div key={link.id} className="mb-2.5 rounded-xl border border-border bg-surface p-3 last:mb-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-2">{shareDate(link.createdAt)} 공유</span>
                    <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            link.isActive ? "bg-teal-50 text-teal-600" : "bg-surface-2 text-faint"
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
                        className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11.5px] text-muted"
                    />
                    <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        className="shrink-0 rounded-md border border-border-strong px-2.5 py-1.5 text-[11.5px] text-muted-strong hover:bg-surface-2"
                    >
                        {copiedId === link.id ? "복사됨" : "복사"}
                    </button>
                </div>

                {targetType === "series" ? (
                    <button
                        type="button"
                        onClick={() => setPickerLink(link)}
                        className="mt-2 rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-strong hover:bg-surface-2"
                    >
                        공개 작품 선택{link.snapshots.length > 0 ? ` (${link.snapshots.length})` : ""}
                    </button>
                ) : null}

                {/* 본문 보기 — work=단일, series=공개 작품별(피드백 수는 배지). ShareLinkManager 와 동일 라벨. */}
                {targetType === "work" ? (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
                        <span className="flex-1" />
                        <button
                            type="button"
                            onClick={() => setFeedbackTarget({ linkId: link.id, projectId: link.snapshots[0]?.projectId ?? targetId })}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-[11.5px] font-semibold text-accent-text hover:bg-terracotta-100"
                        >
                            본문 보기
                            {workUnread > 0 && (
                                <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] text-accent-ink">
                                    {workUnread}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleToggleActive(link)}
                            disabled={setActiveMutation.isPending}
                            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                        >
                            {link.isActive ? "끄기" : "다시 켜기"}
                        </button>
                    </div>
                ) : (
                    <div className="mt-2.5 border-t border-border pt-2.5">
                        {link.snapshots.length > 0 ? (
                            <ul className="space-y-1">
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
                            <p className="text-[11px] text-faint">아직 공개한 작품이 없어요.</p>
                        )}
                        <div className="mt-2 text-right">
                            <button
                                type="button"
                                onClick={() => handleToggleActive(link)}
                                disabled={setActiveMutation.isPending}
                                className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                            >
                                {link.isActive ? "끄기" : "다시 켜기"}
                            </button>
                        </div>
                    </div>
                )}

                {confirmDeleteId === link.id ? (
                    <div className="mt-2.5 rounded-md border border-red-200 bg-red-50 p-2">
                        <p className="text-[11px] leading-relaxed text-red-600">삭제하면 받은 피드백도 함께 사라져요. 되돌릴 수 없어요.</p>
                        <div className="mt-1.5 flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-strong hover:bg-surface-2"
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
                ) : (
                    <div className="mt-2 text-right">
                        <button
                            type="button"
                            onClick={() => setConfirmDeleteId(link.id)}
                            className="text-[11px] text-faint hover:text-red-600"
                        >
                            삭제
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (typeof document === "undefined") return null;
    return createPortal(
        <>
            <div
                ref={popRef}
                role="dialog"
                aria-label={`${title} 공유`}
                {...stop}
                style={coords}
                className="z-50 max-h-[440px] w-[336px] overflow-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-ink">
                        {links.length === 0 ? (targetType === "series" ? "시리즈 공유하기" : "이 작품 공유하기") : title}
                    </h3>
                    <button type="button" onClick={onClose} aria-label="닫기" className="shrink-0 text-faint hover:text-muted">
                        ✕
                    </button>
                </div>

                {linksQuery.isPending ? (
                    <p className="mt-3 text-xs text-faint">불러오는 중…</p>
                ) : links.length === 0 ? (
                    <>
                        <p className="mt-2 mb-3 text-xs leading-relaxed text-muted">
                            공유 링크를 만들면 링크를 받은 누구나 읽을 수 있어요. 공유한 <b>그 시점의 내용으로 고정</b>되고,
                            이후 수정은 반영되지 않아요.
                        </p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={createMutation.isPending}
                            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                        >
                            {createMutation.isPending
                                ? "만드는 중…"
                                : targetType === "series"
                                  ? "🔗 공유 링크 만들고 공개 작품 고르기"
                                  : "🔗 공유 링크 만들기"}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="mt-1 mb-2.5 text-[11px] text-muted">
                            공유 링크 {links.length}개 · 각 링크는 만든 시점 내용으로 고정
                        </p>
                        {links.map(renderLink)}
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={createMutation.isPending || links.length >= MAX_SHARE_LINKS_PER_TARGET}
                            className="mt-1 w-full rounded-lg border border-dashed border-border-strong py-2 text-[12.5px] font-semibold text-accent-text hover:bg-accent-soft disabled:opacity-50"
                        >
                            {createMutation.isPending ? "만드는 중…" : "+ 새 공유 링크 만들기"}
                        </button>
                        {links.length >= MAX_SHARE_LINKS_PER_TARGET ? (
                            <p className="mt-1.5 px-0.5 text-[11px] font-medium text-accent-text">
                                작품·시리즈당 {MAX_SHARE_LINKS_PER_TARGET}개까지예요. 기존 링크를 삭제하면 더 만들 수 있어요.
                            </p>
                        ) : (
                            <p className="mt-1.5 px-0.5 text-[11px] leading-relaxed text-faint">
                                새 링크는 <b>지금 시점</b>의 내용으로 고정돼요. 끄면 그 링크는 더 이상 열람할 수 없어요.
                            </p>
                        )}
                    </>
                )}

                {error ? (
                    <p role="alert" className="mt-2 text-xs text-red-500">
                        {error}
                    </p>
                ) : null}
            </div>

            {/* 모달은 PublicWorkPicker·AuthorFeedbackView 가 자체적으로 body 포털 렌더(부모 카드/타일 stacking·이벤트 탈출). */}
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
        </>,
        document.body,
    );
}
