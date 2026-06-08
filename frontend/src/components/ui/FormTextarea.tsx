"use client";

/**
 * FormTextarea — 메타 자유 텍스트 입력(톤 노트 / 시놉시스 / 세계관). 새 프로젝트·편집 폼 공용.
 *
 * Source: FormInput 의 디자인 토큰 정합 (border var(--w-hairline) / canvas 배경).
 */

interface FormTextareaProps {
    name: string;
    label: string;
    value: string;
    onChange: (next: string) => void;
    rows?: number;
}

export function FormTextarea({ name, label, value, onChange, rows = 3 }: FormTextareaProps) {
    return (
        <label htmlFor={name} className="flex flex-col gap-2 w-full">
            <span className="text-sm font-semibold" style={{ color: "var(--w-ink)" }}>
                {label}
            </span>
            <textarea
                id={name}
                name={name}
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-4 py-3 rounded-button-utility outline-none resize-y"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    color: "var(--w-ink)",
                    border: "1px solid var(--w-hairline)",
                    fontSize: "15px",
                }}
            />
        </label>
    );
}
