"use client";

import { useState } from "react";
import { CustomEditor } from "@/components/custom-editor/CustomEditor";
import { pmJsonToModel } from "@/components/custom-editor/pmConvert";
import type { DocModel } from "@/components/custom-editor/model";

/**
 * 026 모바일 입력 PoC — iOS textarea 입력 프록시 dogfooding.
 *
 * iOS(EditContext 미지원)에서 자체 에디터 입력을 textarea 프록시로 해결(deep research 2026-06-18).
 * 한글 IME·줄바꿈·받침·탭 이동 검증 완료. 상단은 buffer 한 줄 표시(레이아웃 비침습).
 */
export default function MobileEditorPocPage() {
    const [model, setModel] = useState<DocModel>(() => pmJsonToModel(JSON.stringify({ type: "doc", content: [] })));
    const buf = model.buffer;
    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "4px 8px", fontSize: 11, background: "#fffbe6", borderBottom: "1px solid #eee", flex: "none", color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                buffer &quot;{buf.replace(/\n/g, "⏎").slice(0, 60)}&quot; · 줄수 {buf.split("\n").length}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <CustomEditor model={model} onModelChange={setModel} paperSize="A4" fontSizePx={18} />
            </div>
        </div>
    );
}
