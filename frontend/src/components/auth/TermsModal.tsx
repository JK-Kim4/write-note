"use client";

import { useEffect } from "react";

/**
 * TermsModal — 회원가입 약관(이용약관·개인정보처리방침) 열람 모달.
 * QuickCaptureModal 패턴 차용. 긴 본문 세로 스크롤. 닫기: ✕ / Escape / 백드롭.
 */

interface TermsModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

export function TermsModal({ title, children, onClose }: TermsModalProps) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-2xl rounded-card-memo flex flex-col"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                    maxHeight: "85vh",
                }}
            >
                <div
                    className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: "1px solid var(--w-hairline)" }}
                >
                    <h2 className="font-display font-semibold" style={{ fontSize: "18px", color: "var(--w-ink)" }}>
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-xl leading-none px-2"
                        style={{ color: "var(--w-ink)", background: "none", border: "none", cursor: "pointer" }}
                    >
                        ✕
                    </button>
                </div>
                <div
                    className="overflow-y-auto px-6 py-4"
                    style={{
                        color: "var(--w-ink)",
                        fontFamily: "var(--font-noto-serif-kr, 'Apple SD Gothic Neo', sans-serif)",
                        lineHeight: 1.8,
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
