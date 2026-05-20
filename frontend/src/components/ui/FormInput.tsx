import { forwardRef, type InputHTMLAttributes } from "react";

/**
 * FormInput — 인증 폼 input 통합 컴포넌트.
 *
 * Spec reference: contracts/route-surfaces.md §1
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — form-input.error 변형
 *   (border-color #d70015 라이트).
 */

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    label?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
    function FormInput({ error = false, label, id, className = "", ...rest }, ref) {
        const inputId = id ?? rest.name;
        return (
            <label htmlFor={inputId} className="flex flex-col gap-2 w-full">
                {label ? (
                    <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--w-ink)" }}
                    >
                        {label}
                    </span>
                ) : null}
                <input
                    ref={ref}
                    id={inputId}
                    className={`px-4 py-3 rounded-button-utility outline-none ${className}`}
                    style={{
                        backgroundColor: "var(--w-canvas)",
                        color: "var(--w-ink)",
                        border: error
                            ? "1px solid var(--w-error)"
                            : "1px solid var(--w-hairline)",
                        fontSize: "15px",
                    }}
                    {...rest}
                />
            </label>
        );
    },
);
