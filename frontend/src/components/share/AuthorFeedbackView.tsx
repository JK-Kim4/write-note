"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { AuthorCommentResponse } from "@/lib/api/share";
import { useAuthorFeedback } from "@/lib/query/useShares";
import { useMarkSnapshotRead } from "@/lib/query/useShareComments";
import { formatRelativeDay } from "@/lib/relativeDate";
import { buildAnchorRange, quoteForAnchor } from "@/lib/share/anchorFromSelection";
import { blockTextsOf, buildSharedView } from "@/lib/share/sharedDoc";
import { SharedReader } from "./SharedReader";

/**
 * 작가용 피드백 맥락 뷰(050 US1) — 한 공유 링크(스냅샷)의 전문 + 받은 피드백 전부 + 반응 집계를
 * 작가 권한으로 한 화면에서 본다. 047 `AuthorCommentInbox`(조각 텍스트 모달)를 대체(retire, research D9)
 * — `ShareLinkManager` 의 "받은 피드백" 진입은 이제 본 컴포넌트로 연다.
 *
 * 레이아웃 = 목업 안 B(`2026-07-01-share-author-feedback-view-mockup.html`): 좌측 종이(전문, 댓글 달린
 * 구간 항상 하이라이트) + 우측 고정 패널(닉네임·인용·내용·시각·안읽음, 클릭 시 본문 스크롤+반짝).
 * 앵커 null(전체 의견) 댓글은 하이라이트 계산에서 제외하고 별도 "전체 의견" 구획에 나열한다(FR-014/016).
 * 050 US4 종이 스타일(`--w-ms-page`/`--w-ms-outer`)도 함께 적용.
 *
 * 하이라이트/스크롤은 DOM 의존(jsdom 미보장) → dogfooding 게이트. 데이터 조회·집계는 서버가 계산해
 * 내려주므로(BE `ShareReactionService.aggregate`) 본 컴포넌트는 렌더·상호작용만 담당한다.
 */
type Props = {
    linkId: number;
    projectId: number;
    onClose: () => void;
};

const PAPER_SHADOW = "0 1px 2px rgba(40,30,20,.08), 0 10px 34px rgba(40,30,20,.12)";

const FEEDBACK_ERROR_MESSAGES: Record<string, string> = {
    SHARE_FORBIDDEN: "이 공유의 소유자만 볼 수 있어요.",
    SHARE_LINK_NOT_FOUND: "링크나 공유본을 찾을 수 없어요.",
};

function messageFor(e: unknown): string {
    if (e instanceof ApiError) return FEEDBACK_ERROR_MESSAGES[e.code] ?? e.message;
    return "받은 피드백을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function hasAnchor(c: AuthorCommentResponse): c is AuthorCommentResponse & { anchorBlockIndex: number; anchorStart: number; anchorLength: number } {
    return c.anchorBlockIndex != null && c.anchorStart != null && c.anchorLength != null;
}

type Rect = { id: number; left: number; top: number; width: number; height: number };

export function AuthorFeedbackView({ linkId, projectId, onClose }: Props) {
    const feedback = useAuthorFeedback(linkId, projectId);
    const markRead = useMarkSnapshotRead();
    const markMutate = markRead.mutate;
    const didMarkRef = useRef(false);

    // 진입 시 1회 — 그 링크(스냅샷)의 안 읽은 피드백을 읽음 처리(D7, FR-005).
    useEffect(() => {
        if (didMarkRef.current) return;
        didMarkRef.current = true;
        markMutate({ linkId, projectId });
    }, [linkId, projectId, markMutate]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [flashId, setFlashId] = useState<number | null>(null);
    const [highlights, setHighlights] = useState<Rect[]>([]);

    const view = useMemo(() => (feedback.data ? buildSharedView(feedback.data.bodyJson) : null), [feedback.data]);
    const blockTexts = useMemo(() => (view ? blockTextsOf(view) : []), [view]);

    const comments = useMemo(() => feedback.data?.comments ?? [], [feedback.data]);
    const anchored = useMemo(() => comments.filter(hasAnchor), [comments]);
    const general = useMemo(() => comments.filter((c) => !hasAnchor(c)), [comments]);
    const reactions = useMemo(() => feedback.data?.reactions ?? [], [feedback.data]);
    // 댓글 없는 구간의 반응(=글 없이 남긴 반응)도 작가가 봐야 한다(FR-016) — 댓글과 겹치지 않는 반응만 세그먼트별로 묶어 별도 표시.
    const standaloneReactions = useMemo(() => {
        const commented = new Set(anchored.map((c) => `${c.anchorBlockIndex}:${c.anchorStart}:${c.anchorLength}`));
        const bySeg = new Map<string, { id: number; blockIndex: number; start: number; length: number; emojis: { emoji: string; count: number }[] }>();
        let syntheticId = -1;
        for (const r of reactions) {
            const key = `${r.anchorBlockIndex}:${r.anchorStart}:${r.anchorLength}`;
            if (commented.has(key)) continue; // 댓글 아래에 이미 함께 표시됨
            const g = bySeg.get(key);
            if (g) g.emojis.push({ emoji: r.emoji, count: r.count });
            else bySeg.set(key, { id: syntheticId--, blockIndex: r.anchorBlockIndex, start: r.anchorStart, length: r.anchorLength, emojis: [{ emoji: r.emoji, count: r.count }] });
        }
        return [...bySeg.values()];
    }, [reactions, anchored]);

    const recomputeHighlights = useCallback(() => {
        const root = containerRef.current;
        if (!root) {
            setHighlights([]);
            return;
        }
        const cRect = root.getBoundingClientRect();
        const next: Rect[] = [];
        // 댓글 구간 + 댓글 없는 반응 구간 모두 하이라이트(작가가 피드백 위치를 한눈에).
        const targets = [
            ...anchored.map((c) => ({ id: c.id, blockIndex: c.anchorBlockIndex, start: c.anchorStart, length: c.anchorLength })),
            ...standaloneReactions.map((s) => ({ id: s.id, blockIndex: s.blockIndex, start: s.start, length: s.length })),
        ];
        for (const t of targets) {
            const range = buildAnchorRange(root, { blockIndex: t.blockIndex, start: t.start, length: t.length });
            if (!range) continue;
            for (const r of Array.from(range.getClientRects())) {
                if (r.width === 0 && r.height === 0) continue;
                next.push({ id: t.id, left: r.left - cRect.left, top: r.top - cRect.top, width: r.width, height: r.height });
            }
        }
        setHighlights(next);
    }, [anchored, standaloneReactions]);

    useEffect(() => {
        recomputeHighlights();
        window.addEventListener("resize", recomputeHighlights);
        return () => window.removeEventListener("resize", recomputeHighlights);
        // view 가 바뀌면(본문 로드 시점) 레이아웃이 확정된 뒤 재계산.
    }, [recomputeHighlights, view]);

    const focusBlock = (id: number, blockIndex: number) => {
        setActiveId(id);
        setFlashId(id);
        window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1200);
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-block-index="${blockIndex}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const handleSelectItem = (c: AuthorCommentResponse & { anchorBlockIndex: number; anchorStart: number; anchorLength: number }) =>
        focusBlock(c.id, c.anchorBlockIndex);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-auto" style={{ background: "var(--w-canvas)" }}>
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
                    >
                        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
                        공유 관리로
                    </button>
                </div>
            </header>

            <div className="px-4 py-8 sm:px-8 sm:py-10" style={{ background: "var(--w-ms-outer)" }}>
                <div className="mx-auto max-w-5xl">
                    {feedback.isLoading ? (
                        <p className="py-16 text-center text-sm text-muted">불러오는 중…</p>
                    ) : feedback.error || !feedback.data ? (
                        <p className="rounded-xl border border-border bg-surface px-6 py-12 text-center text-sm text-muted">
                            {messageFor(feedback.error)}
                        </p>
                    ) : (
                        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
                            <div
                                className="rounded-md px-6 py-12 sm:px-14"
                                style={{ background: "var(--w-ms-page)", boxShadow: PAPER_SHADOW }}
                            >
                                <h1 className="mb-6 text-center text-xl font-bold" style={{ color: "var(--w-ink)" }}>
                                    {feedback.data.title}
                                </h1>
                                <div ref={containerRef} style={{ position: "relative" }}>
                                    <SharedReader bodyJson={feedback.data.bodyJson} />
                                    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                                        {highlights.map((h, i) => (
                                            <span
                                                key={`${h.id}-${i}`}
                                                style={{
                                                    position: "absolute",
                                                    left: h.left,
                                                    top: h.top,
                                                    width: h.width,
                                                    height: h.height,
                                                    borderRadius: 2,
                                                    background: flashId === h.id ? "rgba(234,179,8,0.55)" : "rgba(234,179,8,0.28)",
                                                    boxShadow: activeId === h.id ? "0 0 0 2px rgba(234,179,8,0.4)" : undefined,
                                                    transition: "background .18s",
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <aside className="rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-6">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                                    받은 피드백
                                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">
                                        {anchored.length}
                                    </span>
                                </h2>
                                <p className="mb-3 mt-1 text-[11.5px] text-muted">항목을 누르면 본문의 해당 구간으로 이동해요 · 작가에게만 보여요</p>

                                {anchored.length === 0 ? (
                                    <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-xs text-muted">아직 받은 구간 피드백이 없어요.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {anchored.map((c) => {
                                            const quote = quoteForAnchor(blockTexts[c.anchorBlockIndex] ?? "", c.anchorStart, c.anchorLength);
                                            const reactionsHere = reactions.filter(
                                                (r) => r.anchorBlockIndex === c.anchorBlockIndex && r.anchorStart === c.anchorStart && r.anchorLength === c.anchorLength,
                                            );
                                            return (
                                                <li key={c.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectItem(c)}
                                                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                                                            activeId === c.id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            {c.readAt == null && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
                                                            <span className="font-semibold text-ink-2">{c.authorNickname}</span>
                                                            <span className="ml-auto shrink-0 text-faint">{formatRelativeDay(c.createdAt, new Date())}</span>
                                                        </div>
                                                        {quote && <p className="mt-1 truncate text-[11.5px] italic text-faint">“{quote}”</p>}
                                                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-ink">{c.content}</p>
                                                        {reactionsHere.length > 0 && (
                                                            <p className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted-strong">
                                                                {reactionsHere.map((r) => (
                                                                    <span key={r.emoji} className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5">
                                                                        {r.emoji} {r.count}
                                                                    </span>
                                                                ))}
                                                            </p>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}

                                {standaloneReactions.length > 0 && (
                                    <div className="mt-5 border-t border-border pt-4">
                                        <h3 className="text-xs font-bold text-muted-strong">반응</h3>
                                        <ul className="mt-2 space-y-2">
                                            {standaloneReactions.map((s) => {
                                                const quote = quoteForAnchor(blockTexts[s.blockIndex] ?? "", s.start, s.length);
                                                return (
                                                    <li key={s.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => focusBlock(s.id, s.blockIndex)}
                                                            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                                                activeId === s.id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2"
                                                            }`}
                                                        >
                                                            {quote && <p className="truncate text-[11.5px] italic text-faint">“{quote}”</p>}
                                                            <p className="mt-1 flex flex-wrap gap-1 text-[12px] text-muted-strong">
                                                                {s.emojis.map((e) => (
                                                                    <span key={e.emoji} className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5">
                                                                        {e.emoji} {e.count}
                                                                    </span>
                                                                ))}
                                                            </p>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                <div className="mt-5 border-t border-border pt-4">
                                    <h3 className="text-xs font-bold text-muted-strong">전체 의견</h3>
                                    {general.length === 0 ? (
                                        <p className="mt-2 text-xs text-faint">아직 없어요.</p>
                                    ) : (
                                        <ul className="mt-2 space-y-2">
                                            {general.map((c) => (
                                                <li key={c.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                                                    <div className="flex items-center gap-1.5 text-xs text-ink-2">
                                                        {c.readAt == null && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}
                                                        <span className="font-semibold">{c.authorNickname}</span>
                                                        <span className="ml-auto shrink-0 text-faint">{formatRelativeDay(c.createdAt, new Date())}</span>
                                                    </div>
                                                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink">{c.content}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </aside>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
