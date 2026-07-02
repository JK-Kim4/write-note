"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { ALLOWED_REACTION_EMOJIS } from "@/lib/api/share";
import type { CommentResponse, ReactionAggregate } from "@/lib/api/share";
import { isTempCommentId, useCreateComment, useDeleteComment } from "@/lib/query/useShareComments";
import { useAddReaction, useRemoveReaction } from "@/lib/query/useShareReactions";
import { formatCommentAnchor } from "@/lib/share/commentLocation";
import { buildAnchorRange, type CommentAnchor, quoteForAnchor, readSelectionAnchor } from "@/lib/share/anchorFromSelection";
import { findMineReaction } from "@/lib/share/reactionAggregate";
import { saveReturnTo } from "@/lib/share/returnTo";
import { blockTextsOf, buildSharedView } from "@/lib/share/sharedDoc";

/**
 * 공유 공개 페이지(046 R5 + 050 US2/US3) — 텍스트 구간 댓글·이모지 반응 레이어.
 *
 * optional auth: 로그인 회원만 구간 선택→반응/댓글 작성 UI 노출. 비로그인 방문자는 같은 드래그에서
 * "로그인 유도" 힌트를 보고, 클릭 시 현재 경로를 저장(`saveReturnTo`)한 뒤 로그인으로 이동한다(US2) —
 * 로그인 후 `/entering` 이 그 경로로 복귀시킨다(D5).
 *
 * 반응 개수(`reactions`)는 공개 집계라 비로그인 포함 모든 열람자에게 렌더한다(FR-013). 텍스트 댓글은
 * 여전히 "요청자 본인 것만"(가시성 R-3, 작가 전용 비공개) 그대로다.
 *
 * 선택/하이라이트/오프셋은 DOM(window.Selection·Range) 의존 = jsdom 미보장 → dogfooding 게이트.
 * 앵커 도출·집계 갱신의 순수부만 단위 테스트(anchorFromSelection.test.ts · reactionAggregate.test.ts).
 */
type Props = {
    containerRef: RefObject<HTMLDivElement | null>;
    bodyJson: string;
    comments: CommentResponse[];
    reactions: ReactionAggregate[];
    isMember: boolean;
    token: string;
    projectId: number;
};

const COMMENT_ERROR_MESSAGES: Record<string, string> = {
    COMMENT_UNAUTHENTICATED: "로그인 후 의견을 남길 수 있어요.",
    COMMENT_ANCHOR_INVALID: "선택한 구간이 올바르지 않아요. 다시 선택해 주세요.",
    REACTION_EMOJI_INVALID: "지원하지 않는 반응이에요.",
    SHARE_LINK_NOT_FOUND: "공유가 종료되어 의견을 남길 수 없어요.",
    SHARE_TARGET_NOT_FOUND: "이 글을 찾을 수 없어요.",
};

function messageFor(e: unknown): string {
    if (e instanceof ApiError) return COMMENT_ERROR_MESSAGES[e.code] ?? e.message;
    return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

type HighlightRect = { id: number; left: number; top: number; width: number; height: number };
type ReactionChip = { key: string; left: number; top: number; emoji: string; count: number };

export function CommentLayer({ containerRef, bodyJson, comments, reactions, isMember, token, projectId }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = useMemo(() => buildSharedView(bodyJson), [bodyJson]);
    const blockTexts = useMemo(() => blockTextsOf(view), [view]);
    const blockTextLengths = useMemo(() => blockTexts.map((t) => t.length), [blockTexts]);

    const createMutation = useCreateComment(token, projectId);
    const deleteMutation = useDeleteComment();
    const addReactionMutation = useAddReaction(token, projectId);
    const removeReactionMutation = useRemoveReaction(token, projectId);

    // 선택 → 떠 있는 툴바(회원=반응+댓글 / 비회원=로그인 유도) 위치(viewport 기준) + 그 시점 앵커.
    const [pending, setPending] = useState<{ anchor: CommentAnchor; left: number; top: number } | null>(null);
    // 작성 중 앵커(버튼 클릭으로 고정). 작성 중에는 selection 변동을 무시.
    const [composing, setComposing] = useState<CommentAnchor | null>(null);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [highlights, setHighlights] = useState<HighlightRect[]>([]);
    const [reactionChips, setReactionChips] = useState<ReactionChip[]>([]);

    // 전체 의견("작품 전체에 한마디", 앵커 없음) — 별도 폼 상태.
    const [wholeDraft, setWholeDraft] = useState("");
    const [wholeError, setWholeError] = useState<string | null>(null);

    const composingRef = useRef(false);
    useEffect(() => {
        composingRef.current = composing !== null;
    }, [composing]);

    // composer 밖(반응 토글 등)에서 난 오류는 인라인 표시처가 없으므로 잠깐 토스트로 띄웠다 자동 소거.
    useEffect(() => {
        if (!error || composing) return;
        const t = window.setTimeout(() => setError(null), 3500);
        return () => window.clearTimeout(t);
    }, [error, composing]);

    const handleGuestLogin = useCallback(() => {
        saveReturnTo(pathname ?? `/shared/${token}/works/${projectId}`);
        router.push("/auth/login");
    }, [pathname, router, token, projectId]);

    // ── 선택 감지 → 떠 있는 툴바(회원·비회원 공통 감지, 렌더만 분기) ────────────────
    useEffect(() => {
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
    }, [blockTextLengths, containerRef]);

    // ── 본인 댓글 하이라이트 사각형 계산(컨테이너 기준). 앵커 null(전체 의견)은 계산에서 제외. ──
    const recomputeHighlights = useCallback(() => {
        const root = containerRef.current;
        if (!root) {
            setHighlights([]);
            return;
        }
        const cRect = root.getBoundingClientRect();
        const next: HighlightRect[] = [];
        for (const c of comments) {
            if (c.anchorBlockIndex == null || c.anchorStart == null || c.anchorLength == null) continue;
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

    // ── 반응 칩(공개 집계 — 비로그인 포함 모든 열람자) 위치 계산 ─────────────────────
    const recomputeReactionChips = useCallback(() => {
        const root = containerRef.current;
        if (!root) {
            setReactionChips([]);
            return;
        }
        const cRect = root.getBoundingClientRect();
        const next: ReactionChip[] = [];
        for (const r of reactions) {
            const range = buildAnchorRange(root, {
                blockIndex: r.anchorBlockIndex,
                start: r.anchorStart,
                length: r.anchorLength,
            });
            if (!range) continue;
            const rects = Array.from(range.getClientRects());
            const last = rects[rects.length - 1];
            if (!last) continue;
            next.push({
                key: `${r.anchorBlockIndex}-${r.anchorStart}-${r.anchorLength}-${r.emoji}`,
                left: last.right - cRect.left,
                top: last.top - cRect.top,
                emoji: r.emoji,
                count: r.count,
            });
        }
        setReactionChips(next);
    }, [reactions, containerRef]);

    useEffect(() => {
        recomputeHighlights();
        recomputeReactionChips();
        const onResize = () => {
            recomputeHighlights();
            recomputeReactionChips();
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [recomputeHighlights, recomputeReactionChips]);

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

    // 이모지 클릭(회원 전용 UI 에서만 노출) — 이미 내 반응이면 취소(토글), 아니면 추가.
    const handleReactionClick = (emoji: string) => {
        if (!pending) return;
        setError(null);
        const anchorInput = { blockIndex: pending.anchor.blockIndex, start: pending.anchor.start, length: pending.anchor.length };
        const mine = findMineReaction(reactions, anchorInput, emoji);
        const input = {
            anchorBlockIndex: pending.anchor.blockIndex,
            anchorStart: pending.anchor.start,
            anchorLength: pending.anchor.length,
            emoji,
        };
        // 실패 시 훅이 낙관 갱신을 롤백 + 사용자에게 안내(댓글 경로와 동일). onError 없으면 개수가 조용히 원복됨.
        if (mine) removeReactionMutation.mutate(input, { onError: (e) => setError(messageFor(e)) });
        else addReactionMutation.mutate(input, { onError: (e) => setError(messageFor(e)) });
        setPending(null);
        window.getSelection()?.removeAllRanges();
    };

    const submitWhole = () => {
        if (wholeDraft.trim().length === 0 || createMutation.isPending) return;
        setWholeError(null);
        createMutation.mutate(
            { content: wholeDraft.trim() },
            {
                onSuccess: () => setWholeDraft(""),
                onError: (e) => setWholeError(messageFor(e)),
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

            {/* 구간별 반응 개수 칩(공개 집계 — 비로그인 포함 모든 열람자에게 노출, FR-013). */}
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
                {reactionChips.map((c) => (
                    <span
                        key={c.key}
                        style={{ position: "absolute", left: c.left + 2, top: c.top - 2, transform: "translateY(-100%)" }}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-strong shadow-sm"
                    >
                        {c.emoji} {c.count}
                    </span>
                ))}
            </div>

            {/* 오류 토스트 — composer 밖(반응 토글 등) 실패 안내(composer 는 인라인 표시). */}
            {error && !composing && (
                <div role="alert" className="fixed inset-x-0 bottom-6 z-[60] mx-auto w-fit max-w-[90vw] rounded-lg bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
                    {error}
                </div>
            )}

            {/* 떠 있는 툴바(유효 선택 시) — 회원=반응 5종+댓글, 비회원=로그인 유도(US2). */}
            {pending && !composing && isMember && (
                <div
                    style={{ position: "fixed", left: pending.left, top: pending.top, zIndex: 50 }}
                    className="flex items-center gap-0.5 rounded-xl border border-border-strong bg-surface p-1 shadow-lg"
                >
                    {ALLOWED_REACTION_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleReactionClick(emoji)}
                            title={emoji}
                            className="rounded-lg px-2 py-1.5 text-lg leading-none transition hover:scale-110 hover:bg-surface-2"
                        >
                            {emoji}
                        </button>
                    ))}
                    <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={openComposer}
                        className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                    >
                        💬 댓글
                    </button>
                </div>
            )}
            {pending && !composing && !isMember && (
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleGuestLogin}
                    style={{ position: "fixed", left: pending.left, top: pending.top, zIndex: 50 }}
                    className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs text-canvas shadow-lg"
                >
                    이 구간에 의견을 남기려면?
                    <span className="rounded bg-accent px-2 py-0.5 font-semibold text-accent-ink">로그인</span>
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

            {/* 하단 — 비회원: 로그인 유도 CTA(US2) / 회원: 전체 의견 + 내가 남긴 것(US3). */}
            <section className="mx-auto mt-10 max-w-[680px] border-t border-border pt-6">
                <h2 className="mb-3 text-sm font-semibold text-ink">{isMember ? "작품 전체에 한마디" : "이 작품에 의견 남기기"}</h2>
                {!isMember ? (
                    <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#f0d9cb] bg-accent-soft px-4 py-4 sm:flex-row sm:items-center">
                        <p className="text-sm leading-relaxed text-accent-text">
                            마음에 남는 구절이 있었나요? 로그인하면 본문에서 구간을 선택해 반응·의견을 남기거나, 작품 전체에
                            한마디 남길 수 있어요. (작가에게만 보여요)
                        </p>
                        <button
                            type="button"
                            onClick={handleGuestLogin}
                            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
                        >
                            로그인하고 남기기
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="mb-2 text-xs text-muted">특정 구간이 아니라 이 작품 전체에 대한 감상을 남겨요. (작가에게만 보여요)</p>
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={wholeDraft}
                                onChange={(e) => setWholeDraft(e.target.value)}
                                rows={3}
                                placeholder="완결까지 기대돼요. 이 작품 전체에 대한 의견을 남겨주세요."
                                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                            />
                            {wholeError && <p className="text-sm text-red-600">{wholeError}</p>}
                            <button
                                type="button"
                                onClick={submitWhole}
                                disabled={wholeDraft.trim().length === 0 || createMutation.isPending}
                                className="self-end rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
                            >
                                {createMutation.isPending ? "남기는 중…" : "전체 의견 남기기"}
                            </button>
                        </div>
                    </>
                )}

                {isMember && (
                    <div className="mt-6">
                        <h3 className="mb-3 text-xs font-semibold text-muted-strong">내가 남긴 것</h3>
                        {comments.length === 0 ? (
                            <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
                                본문에서 마음에 남는 구간을 드래그해 첫 의견을 남겨보세요. (작가에게만 보여요)
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {comments.map((c) => {
                                    const isAnchored = c.anchorBlockIndex != null && c.anchorStart != null && c.anchorLength != null;
                                    const quote = isAnchored ? quoteForAnchor(blockTexts[c.anchorBlockIndex as number] ?? "", c.anchorStart as number, c.anchorLength as number) : "";
                                    return (
                                        <li key={c.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                                            <p className="text-xs text-muted">
                                                {isAnchored
                                                    ? formatCommentAnchor(c.anchorBlockIndex as number, c.anchorStart as number, c.anchorLength as number)
                                                    : "작품 전체"}
                                            </p>
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
                    </div>
                )}
            </section>
        </>
    );
}
