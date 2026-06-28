"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { CommentResponse } from "@/lib/api/share";
import { isTempCommentId, useCreateComment, useDeleteComment } from "@/lib/query/useShareComments";
import { formatCommentAnchor } from "@/lib/share/commentLocation";
import { buildAnchorRange, type CommentAnchor, quoteForAnchor, readSelectionAnchor } from "@/lib/share/anchorFromSelection";
import { blockTextsOf, buildSharedView } from "@/lib/share/sharedDoc";

/**
 * 공유 공개 페이지(046 R5) — 텍스트 구간 댓글 레이어(작가 전용 비공개 피드백).
 *
 * optional auth: 로그인 회원만 구간 선택→댓글 작성 UI 노출(비로그인은 안내만). 표시되는 댓글은
 * 서버가 내려준 "요청자 본인 것만"(가시성 R-3). 본인 댓글은 삭제 가능.
 *
 * 선택/하이라이트/오프셋은 DOM(window.Selection·Range) 의존 = jsdom 미보장 → dogfooding 게이트.
 * 앵커 도출의 순수부(deriveAnchor)만 단위 테스트(anchorFromSelection.test.ts).
 */
type Props = {
    containerRef: RefObject<HTMLDivElement | null>;
    bodyJson: string;
    comments: CommentResponse[];
    isMember: boolean;
    token: string;
    projectId: number;
};

const COMMENT_ERROR_MESSAGES: Record<string, string> = {
    COMMENT_UNAUTHENTICATED: "로그인 후 댓글을 남길 수 있어요.",
    COMMENT_ANCHOR_INVALID: "선택한 구간이 올바르지 않아요. 다시 선택해 주세요.",
    SHARE_LINK_NOT_FOUND: "공유가 종료되어 댓글을 남길 수 없어요.",
    SHARE_TARGET_NOT_FOUND: "이 글을 찾을 수 없어요.",
};

function messageFor(e: unknown): string {
    if (e instanceof ApiError) return COMMENT_ERROR_MESSAGES[e.code] ?? e.message;
    return "댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

type HighlightRect = { id: number; left: number; top: number; width: number; height: number };

export function CommentLayer({ containerRef, bodyJson, comments, isMember, token, projectId }: Props) {
    const view = useMemo(() => buildSharedView(bodyJson), [bodyJson]);
    const blockTexts = useMemo(() => blockTextsOf(view), [view]);
    const blockTextLengths = useMemo(() => blockTexts.map((t) => t.length), [blockTexts]);

    const createMutation = useCreateComment(token, projectId);
    const deleteMutation = useDeleteComment();

    // 선택 → 떠 있는 "댓글 달기" 버튼 위치(viewport 기준) + 그 시점 앵커.
    const [pending, setPending] = useState<{ anchor: CommentAnchor; left: number; top: number } | null>(null);
    // 작성 중 앵커(버튼 클릭으로 고정). 작성 중에는 selection 변동을 무시.
    const [composing, setComposing] = useState<CommentAnchor | null>(null);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [highlights, setHighlights] = useState<HighlightRect[]>([]);

    const composingRef = useRef(false);
    useEffect(() => {
        composingRef.current = composing !== null;
    }, [composing]);

    // ── 선택 감지 → 떠 있는 버튼 ───────────────────────────────────────────────
    useEffect(() => {
        if (!isMember) return;
        const onSelectionChange = () => {
            if (composingRef.current) return; // 작성 중에는 selection 변동 무시(textarea 선택 등).
            const root = containerRef.current;
            const selection = typeof window !== "undefined" ? window.getSelection() : null;
            if (!root || !selection) {
                setPending(null);
                return;
            }
            const anchor = readSelectionAnchor(root, blockTextLengths, selection);
            if (!anchor || selection.rangeCount === 0) {
                setPending(null);
                return;
            }
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                setPending(null);
                return;
            }
            setPending({ anchor, left: rect.left, top: rect.bottom + 6 });
        };
        document.addEventListener("selectionchange", onSelectionChange);
        return () => document.removeEventListener("selectionchange", onSelectionChange);
    }, [isMember, blockTextLengths, containerRef]);

    // ── 본인 댓글 하이라이트 사각형 계산(컨테이너 기준) ──────────────────────────
    const recomputeHighlights = useCallback(() => {
        const root = containerRef.current;
        if (!root) {
            setHighlights([]);
            return;
        }
        const cRect = root.getBoundingClientRect();
        const next: HighlightRect[] = [];
        for (const c of comments) {
            const range = buildAnchorRange(root, {
                blockIndex: c.anchorBlockIndex,
                start: c.anchorStart,
                length: c.anchorLength,
            });
            if (!range) continue;
            for (const r of Array.from(range.getClientRects())) {
                if (r.width === 0 && r.height === 0) continue;
                next.push({ id: c.id, left: r.left - cRect.left, top: r.top - cRect.top, width: r.width, height: r.height });
            }
        }
        setHighlights(next);
    }, [comments, containerRef]);

    useEffect(() => {
        recomputeHighlights();
        window.addEventListener("resize", recomputeHighlights);
        return () => window.removeEventListener("resize", recomputeHighlights);
    }, [recomputeHighlights]);

    const openComposer = () => {
        if (!pending) return;
        setComposing(pending.anchor);
        setDraft("");
        setError(null);
        setPending(null);
    };

    const cancelComposer = () => {
        setComposing(null);
        setDraft("");
        setError(null);
    };

    const submit = () => {
        if (!composing || draft.trim().length === 0 || createMutation.isPending) return;
        setError(null);
        createMutation.mutate(
            {
                anchorBlockIndex: composing.blockIndex,
                anchorStart: composing.start,
                anchorLength: composing.length,
                content: draft.trim(),
            },
            {
                onSuccess: () => {
                    cancelComposer();
                    window.getSelection()?.removeAllRanges();
                },
                onError: (e) => setError(messageFor(e)),
            },
        );
    };

    const composingQuote = composing ? quoteForAnchor(blockTexts[composing.blockIndex] ?? "", composing.start, composing.length) : "";

    return (
        <>
            {/* 본인 댓글 구간 하이라이트(읽기 방해 없는 옅은 강조). 컨테이너 내 absolute, 클릭 통과. */}
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
                {highlights.map((h, i) => (
                    <span
                        key={`${h.id}-${i}`}
                        style={{ position: "absolute", left: h.left, top: h.top, width: h.width, height: h.height, background: "rgba(234, 179, 8, 0.28)", borderRadius: 2 }}
                    />
                ))}
            </div>

            {/* 떠 있는 "댓글 달기" 버튼(회원·유효 선택 시). */}
            {isMember && pending && !composing && (
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // 선택 유지(blur 로 selection 사라짐 방지).
                    onClick={openComposer}
                    style={{ position: "fixed", left: pending.left, top: pending.top, zIndex: 50 }}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink shadow-md hover:opacity-90"
                >
                    이 구간에 댓글
                </button>
            )}

            {/* 작성 패널(고정 앵커). */}
            {isMember && composing && (
                <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-4 shadow-lg md:left-auto md:right-6 md:bottom-6 md:w-96 md:rounded-xl md:border">
                    <p className="mb-1 text-xs text-muted">{formatCommentAnchor(composing.blockIndex, composing.start, composing.length)}</p>
                    {composingQuote && (
                        <p className="mb-2 line-clamp-2 rounded bg-surface-2 px-2 py-1 text-sm text-ink-2">“{composingQuote}”</p>
                    )}
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                        rows={3}
                        placeholder="이 구간에 대한 의견을 남겨주세요. (작가에게만 보여요)"
                        className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                    />
                    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                    <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={cancelComposer} className="rounded-md px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2">
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={draft.trim().length === 0 || createMutation.isPending}
                            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
                        >
                            {createMutation.isPending ? "남기는 중…" : "댓글 남기기"}
                        </button>
                    </div>
                </div>
            )}

            {/* 본인 댓글 목록(작가 전용 비공개 피드백 — 내가 남긴 것만). */}
            <section className="mx-auto mt-10 max-w-[680px] border-t border-border pt-6">
                <h2 className="mb-3 text-sm font-semibold text-ink">내가 남긴 댓글</h2>
                {!isMember ? (
                    <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
                        로그인하면 본문에서 구간을 선택해 작가에게만 보이는 의견을 남길 수 있어요.
                    </p>
                ) : comments.length === 0 ? (
                    <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
                        본문에서 마음에 남는 구간을 드래그해 첫 의견을 남겨보세요. (작가에게만 보여요)
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {comments.map((c) => {
                            const quote = quoteForAnchor(blockTexts[c.anchorBlockIndex] ?? "", c.anchorStart, c.anchorLength);
                            return (
                                <li key={c.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                                    <p className="text-xs text-muted">{formatCommentAnchor(c.anchorBlockIndex, c.anchorStart, c.anchorLength)}</p>
                                    {quote && <p className="mt-1 line-clamp-1 text-sm text-faint">“{quote}”</p>}
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.content}</p>
                                    {!isTempCommentId(c.id) && (
                                        <div className="mt-2 text-right">
                                            <button
                                                type="button"
                                                onClick={() => deleteMutation.mutate(c.id)}
                                                disabled={deleteMutation.isPending}
                                                className="text-xs text-muted-strong hover:text-red-600 disabled:opacity-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </>
    );
}
