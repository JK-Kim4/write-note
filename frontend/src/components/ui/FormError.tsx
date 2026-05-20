import type { ReactNode } from "react";

/**
 * FormError — 필드 인라인 에러 메시지.
 *
 * Spec reference: contracts/route-surfaces.md §1 (signup-error 인라인 해결 경로 링크)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — Apple System Red,
 *   ::before 시그널 + a 링크 (인라인 해결 경로).
 */

interface FormErrorProps {
    children: ReactNode;
}

export function FormError({ children }: FormErrorProps) {
    return (
        <div
            className="flex items-start gap-2 text-sm mt-1"
            style={{ color: "var(--w-error)" }}
        >
            <span aria-hidden="true" style={{ marginTop: 2 }}>
                ⚠
            </span>
            <div className="flex-1">{children}</div>
        </div>
    );
}
