"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthorComments, useMarkCommentsRead } from "@/lib/query/useShareComments";
import { formatCommentAnchor } from "@/lib/share/commentLocation";
import { formatRelativeDay } from "@/lib/relativeDate";
import type { AuthorCommentResponse } from "@/lib/api/share";

/**
 * 작가 댓글 인박스(046 R4) — 자기 작품에 달린 전체 댓글 모아보기 + 항목 선택 시 작품으로 이동.
 *
 * 가시성: 작가에게만 전체 공개(타 열람자 비노출). 작성자 신원(닉네임)·위치(공유본 문단·구간)·내용 표시.
 * 댓글이 가리키는 위치는 공유본(불변 스냅샷) 기준이라 항상 유효(FR-022). 위치 in-context 하이라이트는
 * 공개 열람 화면(R5)이 담당 — 본 인박스는 위치를 텍스트로 보이고, 항목 선택 시 작품(`/works/{id}`)으로 이동한다.
 */
type Props = {
    projectId: number;
    projectTitle: string;
    onClose: () => void;
    /** 항목 선택 동작 재정의(미지정 시 `/works/{projectId}` 로 이동). */
    onNavigate?: (comment: AuthorCommentResponse) => void;
};

export function AuthorCommentInbox({ projectId, projectTitle, onClose, onNavigate }: Props) {
    const router = useRouter();
    const { data: comments, isPending, isError, refetch, isFetching } = useAuthorComments(projectId);
    const markRead = useMarkCommentsRead();
    const markMutate = markRead.mutate;

    // "열면 그 묶음 전체 읽음"(047 US3) — 첫 로드에서 안 읽은 댓글이 있으면 1회 읽음 처리.
    // shareKeys.mine 만 무효화하므로(인박스 author 쿼리는 보존) 보는 동안 readAt==null 강조는 유지되고,
    // 받은 피드백 배지·집계는 즉시 감소한다. 다시 열면 refetchOnMount 가 읽음 상태를 새로 받아 강조가 사라진다.
    const didMarkRef = useRef(false);
    useEffect(() => {
        if (!comments || didMarkRef.current) return;
        didMarkRef.current = true;
        if (comments.some((c) => c.readAt == null)) markMutate(projectId);
    }, [comments, projectId, markMutate]);

    const handleSelect = (comment: AuthorCommentResponse) => {
        if (onNavigate) {
            onNavigate(comment);
            return;
        }
        router.push(`/works/${comment.projectId}`);
    };

    return (
        <div role="dialog" aria-label={`${projectTitle} 받은 피드백`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-[32rem] max-w-[94vw] rounded-2xl bg-surface p-5 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-ink">{projectTitle}</h2>
                        <p className="mt-0.5 text-xs text-muted">독자가 보낸 위치 피드백입니다. 작가에게만 보입니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="shrink-0 rounded-md px-2 py-1 text-faint hover:bg-surface-2 hover:text-muted"
                    >
                        ✕
                    </button>
                </div>

                {isPending ? (
                    <p className="mt-4 text-sm text-faint">불러오는 중…</p>
                ) : isError ? (
                    <div className="mt-4">
                        <p className="text-sm text-muted">댓글을 불러오지 못했어요.</p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="mt-2 rounded-md border border-border-strong px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : comments.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                        아직 받은 피드백이 없어요.
                    </p>
                ) : (
                    <ul className="mt-3 max-h-[60vh] space-y-2 overflow-auto">
                        {comments.map((comment) => {
                            const isUnread = comment.readAt == null;
                            return (
                            <li key={comment.id}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(comment)}
                                    className={`block w-full rounded-lg border px-3 py-2.5 text-left hover:border-border-strong hover:bg-surface-2 ${
                                        isUnread ? "border-terracotta-300 bg-accent-soft" : "border-border bg-surface"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="flex items-center gap-1.5 font-medium text-ink-2">
                                            {isUnread ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                                            {comment.authorNickname}
                                            {isUnread ? <span className="sr-only">(새 피드백)</span> : null}
                                        </span>
                                        <span className="shrink-0 text-faint">{formatRelativeDay(comment.createdAt, new Date())}</span>
                                    </div>
                                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-ink">{comment.content}</p>
                                    <p className="mt-1.5 text-xs text-faint">
                                        {formatCommentAnchor(comment.anchorBlockIndex, comment.anchorStart, comment.anchorLength)}
                                    </p>
                                </button>
                            </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
