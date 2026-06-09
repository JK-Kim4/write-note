"use client";

import { useState } from "react";
import { PaperEditor } from "@/components/editor/PaperEditor";
import "@/components/editor/paper-editor.css";

/**
 * 015 PoC (T003) — 페이지 분할 + 한글 선증명용 임시 화면(작업 규율 §10).
 *
 * 데이터 연동 없음(에디터만). T004 브라우저 dogfooding 통과 후 US1 정식 이식.
 * 통과 시점에 이 (poc) 라우트는 제거/정식화.
 */
const SAMPLE = JSON.stringify({
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "여기에 한글을 입력해 보세요. 한 페이지(26줄)를 넘기면 종이가 다음 장으로 나뉘는지 확인합니다.",
                },
            ],
        },
    ],
});

export default function PocWritePage() {
    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);

    return (
        <div className="paper-editor" style={{ ["--zoom"]: zoom } as React.CSSProperties}>
            <div
                style={{
                    position: "fixed",
                    top: 12,
                    right: 12,
                    zIndex: 50,
                    display: "flex",
                    gap: 8,
                    fontSize: 13,
                    background: "var(--pe-surface)",
                    border: "1px solid var(--pe-hairline)",
                    borderRadius: 8,
                    padding: "6px 10px",
                }}
            >
                <label>
                    <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} /> 줄노트
                </label>
                <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>
                    축소
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
                    확대
                </button>
            </div>
            <PaperEditor title="PoC 집필실 — 페이지 분할 + 한글" initialBodyJson={SAMPLE} onChange={() => {}} lined={lined} zoom={zoom} />
        </div>
    );
}
