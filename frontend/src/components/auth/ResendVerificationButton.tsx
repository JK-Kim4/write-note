"use client";

import { useState } from "react";
import { resendVerification } from "@/lib/api/auth";

/**
 * 인증 메일 재발송 버튼 — verify-pending 에서 가입 이메일로 인증 메일을 다시 보낸다.
 * email 이 없으면(가입 흐름을 거치지 않은 직접 진입) 렌더하지 않는다.
 */
export function ResendVerificationButton({ email }: { email?: string }) {
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

    if (!email) return null;

    const handleResend = async () => {
        setStatus("sending");
        try {
            await resendVerification(email);
            setStatus("sent");
        } catch {
            setStatus("error");
        }
    };

    const label =
        status === "sent"
            ? "메일을 다시 보냈습니다"
            : status === "sending"
              ? "보내는 중…"
              : status === "error"
                ? "실패 — 다시 시도"
                : "다시 보내기";

    const disabled = status === "sending" || status === "sent";

    return (
        <button
            type="button"
            onClick={handleResend}
            disabled={disabled}
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline disabled:no-underline"
            style={{
                color: "var(--w-ink)",
                opacity: 0.7,
                fontSize: "14px",
                background: "none",
                border: "none",
                cursor: disabled ? "default" : "pointer",
            }}
        >
            {label}
        </button>
    );
}
