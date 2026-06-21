"use client";

import { useState, type InputHTMLAttributes } from "react";
import { FormInput } from "./FormInput";

/**
 * PasswordInput — 비밀번호 입력 + 표시/숨김 토글 래퍼.
 *
 * FormInput 을 감싸고(공통 컴포넌트 미수정), 우측에 평문 보기 버튼을 절대배치한다.
 * 버튼은 FormInput 의 <label> 바깥에 두어 getByLabelText 셀렉터를 보존한다.
 */

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    error?: boolean;
    label?: string;
};

export function PasswordInput({ className = "", ...rest }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ position: "relative" }}>
            <FormInput
                {...rest}
                type={visible ? "text" : "password"}
                className={`pr-12 ${className}`}
            />
            <button
                type="button"
                aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
                className="absolute"
                style={{
                    right: "12px",
                    bottom: "12px",
                    color: "var(--w-ink)",
                    opacity: 0.55,
                    fontSize: "13px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                }}
            >
                {visible ? "숨기기" : "표시"}
            </button>
        </div>
    );
}
