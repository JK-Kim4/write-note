"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// 에디터 툴바 아이콘 — 인라인 SVG(외부 아이콘 라이브러리 없이 기존 패턴 따름). 18×18, currentColor.

export function QuoteIcon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
            <path d="M9.2 7C6.9 7 5 8.9 5 11.2c0 2 1.5 3.7 3.4 4.1-.1 1.3-.8 2.4-2 3.1-.4.2-.5.7-.3 1 .2.3.6.4.9.3 2.4-.9 3.9-3 3.9-5.7v-1.9C10.8 8.9 9.6 7 9.2 7Zm9 0C15.9 7 14 8.9 14 11.2c0 2 1.5 3.7 3.4 4.1-.1 1.3-.8 2.4-2 3.1-.4.2-.5.7-.3 1 .2.3.6.4.9.3 2.4-.9 3.9-3 3.9-5.7v-1.9C19.8 8.9 18.6 7 18.2 7Z" />
        </svg>
    );
}

export function BulletListIcon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4.4" cy="6" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="4.4" cy="12" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="4.4" cy="18" r="1.3" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function OrderedListIcon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <line x1="10" y1="6" x2="20" y2="6" />
            <line x1="10" y1="12" x2="20" y2="12" />
            <line x1="10" y1="18" x2="20" y2="18" />
            <text x="2" y="8.4" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text>
            <text x="2" y="14.4" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text>
            <text x="2" y="20.4" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text>
        </svg>
    );
}

export function DividerIcon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
    );
}

/** 툴바 기능 그룹 사이 세로 구분선. */
export function ToolbarDivider() {
    return <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "#e3e4e7", margin: "4px 6px" }} />;
}

/**
 * 툴바 버튼 — 텍스트(블록 전환) 또는 아이콘(글자·삽입) 공용. 호버 배경은 인라인 스타일로 칠하려 자체 hover state 사용.
 * 활성(현재 적용 중)은 파란 강조. mouseDown preventDefault 로 에디터 포커스/선택 유지.
 */
export function ToolbarButton({
    children,
    isActive,
    onClick,
    icon = false,
    title,
}: {
    children: ReactNode;
    isActive: boolean;
    onClick: () => void;
    icon?: boolean;
    title?: string;
}) {
    const [hover, setHover] = useState(false);
    return (
        <button
            type="button"
            title={title}
            aria-label={icon ? title : undefined}
            aria-pressed={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 30,
                ...(icon ? { width: 30 } : { padding: "0 10px" }),
                border: "1px solid",
                borderColor: isActive ? "#c7d2fe" : "transparent",
                borderRadius: 7,
                background: isActive ? "#e0e7ff" : hover ? "#eef0f3" : "transparent",
                color: isActive ? "#3730a3" : "#374151",
                fontSize: 13.5,
                lineHeight: 1,
                cursor: "pointer",
                transition: "background .12s, color .12s, border-color .12s",
            }}
        >
            {children}
        </button>
    );
}

/** 글자 서식(굵게/기울임/밑줄/취소선) 글리프 — 의미를 모양으로 드러내는 스타일된 글자. */
export function MarkGlyph({ kind }: { kind: "bold" | "italic" | "underline" | "strike" }) {
    const style: Record<typeof kind, CSSProperties> = {
        bold: { fontWeight: 800 },
        italic: { fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif" },
        underline: { textDecoration: "underline", textUnderlineOffset: 2 },
        strike: { textDecoration: "line-through" },
    };
    const label: Record<typeof kind, string> = { bold: "B", italic: "I", underline: "U", strike: "S" };
    return <span style={{ fontSize: 16, ...style[kind] }}>{label[kind]}</span>;
}
