"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useSharedWork } from "@/lib/query/useShares";
import { SharedReader } from "./SharedReader";
import { CommentLayer } from "./CommentLayer";

/**
 * 공유 본문 단건(046 R5) — 비로그인 읽기 전용 스냅샷 렌더 + 회원 텍스트 구간 댓글/반응.
 *
 * optional auth: ['auth','me'] 쿼리로 회원 여부만 본다(인증벽 없음 — 비로그인도 200 으로 본문 열람).
 * 본문(읽기 전용)과 댓글 레이어를 같은 position:relative 컨테이너에 겹쳐 하이라이트 좌표계를 공유한다.
 *
 * 050 US4 — "종이 위의 글": 집필 화면(`CustomEditor`)과 동일 토큰으로 종이(`--w-ms-page`) 위에 글을
 * 얹고 바깥은 어두운 톤(`--w-ms-outer`)으로 감싼다(research D8, 목업 `2026-07-01-share-paper-layout-mockup`).
 */
type Props = { token: string; projectId: number };

const PAPER_SHADOW = "0 1px 2px rgba(40,30,20,.08), 0 10px 34px rgba(40,30,20,.12)";

export function SharedWorkView({ token, projectId }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const work = useSharedWork(token, projectId);
    // 회원 식별만 — 실패(비로그인)는 정상 흐름(인증벽 아님). 리다이렉트 없음.
    const me = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });
    const isMember = me.data !== undefined && !me.isError;

    if (work.isLoading) {
        return <p className="py-16 text-center text-sm text-muted">불러오는 중…</p>;
    }

    if (work.error || !work.data) {
        const gone = work.error instanceof ApiError && work.error.code === "SHARE_LINK_NOT_FOUND";
        return (
            <div className="mx-auto max-w-md rounded-xl border border-border bg-surface px-6 py-12 text-center">
                <p className="text-sm text-muted">
                    {gone ? "공유가 종료되었거나 존재하지 않는 링크예요." : "지금은 이 글을 불러올 수 없어요."}
                </p>
                <Link href={`/shared/${token}`} className="mt-4 inline-block text-sm text-accent-text hover:underline">
                    목록으로
                </Link>
            </div>
        );
    }

    return (
        <div className="-mx-4 -my-8 rounded-2xl px-4 py-8 sm:px-8 sm:py-12" style={{ background: "var(--w-ms-outer)" }}>
            <Link
                href={`/shared/${token}`}
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
            >
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
                목록
            </Link>

            <div className="mx-auto max-w-[760px] rounded-md px-6 py-12 sm:px-16" style={{ background: "var(--w-ms-page)", boxShadow: PAPER_SHADOW }}>
                <h1 className="mb-6 text-center text-2xl font-bold" style={{ color: "var(--w-ink)" }}>
                    {work.data.title}
                </h1>

                <div ref={containerRef} style={{ position: "relative" }}>
                    <SharedReader bodyJson={work.data.bodyJson} />
                    <CommentLayer
                        containerRef={containerRef}
                        bodyJson={work.data.bodyJson}
                        comments={work.data.comments}
                        reactions={work.data.reactions ?? []}
                        isMember={isMember}
                        token={token}
                        projectId={projectId}
                    />
                </div>
            </div>
        </div>
    );
}
