"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { captureMemo } from "@/lib/api/memo";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";

/**
 * 빠른 캡처 모달 + 전역 ⌘+N 단축키 (006 US3 T047).
 *
 * - useGlobalShortcut: ⌘+N(Mac) / Ctrl+N(Win·Linux) → 모달 open
 * - activeProjectId: URL query `projectId` 파싱 → 없으면 null (미분류)
 * - 저장 성공 → 모달 닫기 + ['memos'] 쿼리 invalidate
 * - useSearchParams 는 Suspense 내부에서만 안전 → QuickCaptureInner 분리
 *
 * 본 컴포넌트는 Providers 내부(전역 레이아웃 레벨)에서 렌더.
 */

interface QuickCaptureInnerProps {
    isOpen: boolean;
    onClose: () => void;
}

function QuickCaptureInner({ isOpen, onClose }: QuickCaptureInnerProps) {
    const searchParams = useSearchParams();
    const rawProjectId = searchParams.get("projectId");
    const activeProjectId = rawProjectId !== null ? Number(rawProjectId) : null;

    const queryClient = useQueryClient();
    const [body, setBody] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const mutation = useMutation({
        mutationFn: () => captureMemo({ body: body.trim(), activeProjectId }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["memos"] });
            setBody("");
            onClose();
        },
    });

    // 모달 열릴 때 textarea 포커스
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Escape 닫기
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        if (body.trim() === "") return;
        mutation.mutate();
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="빠른 메모 캡처"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-lg rounded-card-memo p-6"
                style={{ backgroundColor: "var(--w-canvas)", border: "1px solid var(--w-hairline)" }}
            >
                <h2
                    className="font-display font-semibold mb-4"
                    style={{ fontSize: "18px", color: "var(--w-ink)" }}
                >
                    빠른 메모
                </h2>
                <form onSubmit={handleSubmit}>
                    <textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="지금 떠오른 생각을 적어두세요…"
                        rows={5}
                        className="w-full resize-none rounded p-3 text-sm"
                        style={{
                            backgroundColor: "var(--w-parchment)",
                            border: "1px solid var(--w-hairline)",
                            color: "var(--w-ink)",
                            outline: "none",
                        }}
                    />
                    {mutation.isError && (
                        <p className="mt-2 text-sm" style={{ color: "var(--w-accent)" }}>
                            저장에 실패했습니다. 다시 시도해 주세요.
                        </p>
                    )}
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-button-pill text-sm"
                            style={{
                                backgroundColor: "var(--w-canvas)",
                                border: "1px solid var(--w-hairline)",
                                color: "var(--w-ink)",
                            }}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending || body.trim() === ""}
                            className="px-4 py-2 rounded-button-pill text-sm font-semibold"
                            style={{
                                backgroundColor: "var(--w-ink)",
                                color: "var(--w-canvas)",
                                opacity: mutation.isPending || body.trim() === "" ? 0.5 : 1,
                                cursor: mutation.isPending || body.trim() === "" ? "not-allowed" : "pointer",
                            }}
                        >
                            {mutation.isPending ? "저장 중…" : "저장"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function QuickCaptureModal() {
    const [isOpen, setIsOpen] = useState(false);

    const handleTrigger = useCallback(() => {
        setIsOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    useGlobalShortcut(handleTrigger);

    return (
        <Suspense fallback={null}>
            <QuickCaptureInner isOpen={isOpen} onClose={handleClose} />
        </Suspense>
    );
}
